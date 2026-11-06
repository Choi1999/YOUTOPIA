package com.youtopia.youtube.metadata.synthetic;

import java.net.URI;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * UI-R04-X test classpath only: this controller is NEVER present in the
 * backend's production JAR. No YouTube, Google, key, DB, analytics, quota,
 * host URL, redirect, snapshot or external I/O is used here.
 */
@RestController
@RequestMapping("/api/v1/youtube/metadata/synthetic")
@Profile("metadata-offline-test")
@ConditionalOnProperty(name = "youtopia.metadata.synthetic-http.enabled",
        havingValue = "true", matchIfMissing = false)
public final class MetadataSyntheticHttpController {
    public static final String SCHEMA =
            "YOUTOPIA_R04W_SYNTHETIC_METADATA_INTEGRATION_V01";
    private static final Pattern VIDEO = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern CHANNEL = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");
    private static final Pattern HANDLE =
            Pattern.compile("^@[\\p{L}\\p{N}._-]{3,30}$");

    public record MetadataRecord(String source, String kind, String requestedId,
                                 String title, String channelName, String artwork,
                                 boolean sourceAuthenticated, int providerRequestsMade,
                                 boolean consumerPublicationAuthorized) {}
    public record Envelope(String schema, String status, MetadataRecord record) {}

    @GetMapping(value = "/videos/{videoId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> video(@PathVariable String videoId) {
        return respond("VIDEO", videoId, VIDEO);
    }

    @GetMapping(value = "/channels/{channelId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> channel(@PathVariable String channelId) {
        return respond("CHANNEL", channelId, CHANNEL);
    }

    @GetMapping(value = "/handles/{handle}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> handle(@PathVariable String handle) {
        return respond("CHANNEL_HANDLE", handle, HANDLE);
    }

    private static ResponseEntity<?> respond(String kind, String id, Pattern required) {
        if (id == null || !required.matcher(id).matches())
            return reject();
        boolean video = "VIDEO".equals(kind);
        MetadataRecord record = new MetadataRecord(
                "LOCAL_SYNTHETIC_ONLY", kind, id,
                (video ? "합성 영상 제목 · " : "합성 채널 이름 · ") + id,
                video ? "합성 채널 안내 · 실제 소속 미확인" : null,
                video ? "VIDEO_PLACEHOLDER" : "CHANNEL_PLACEHOLDER",
                false, 0, false);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-YOUTOPIA-Synthetic", "test-only")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new Envelope(SCHEMA, "SYNTHETIC_NOT_PROVIDER_DATA", record));
    }

    private static ResponseEntity<ProblemDetail> reject() {
        var p = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Synthetic metadata target is invalid.");
        p.setTitle("Invalid synthetic target");
        p.setType(URI.create("urn:youtopia:problem:synthetic-target-invalid"));
        // Neither canonical id nor request URI is echoed.
        p.setInstance(URI.create("/api/v1/youtube/metadata/synthetic"));
        p.setProperty("code", "SYNTHETIC_INVALID_TARGET");
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON).body(p);
    }
}
