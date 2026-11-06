package com.youtopia.youtube.metadata.synthetic;

import java.net.URI;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * UI-R04-Z — synthetic consumer-state fixture, TEST SOURCE SET ONLY.
 * Not shipped in bootJar, not a provider client, not authenticated metadata.
 * No external I/O, key, real channel associations or production routing.
 */
@RestController
@RequestMapping("/api/v1/youtube/metadata/synthetic-state")
@Profile("metadata-offline-test")
@ConditionalOnProperty(name = "youtopia.metadata.synthetic-http.enabled",
        havingValue = "true", matchIfMissing = false)
public final class MetadataSyntheticStateController {
    public static final String SCHEMA = "YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01";
    private static final Pattern VIDEO = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern CHANNEL = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");
    private static final Pattern HANDLE =
            Pattern.compile("^@[\\p{L}\\p{N}._-]{3,30}$");
    private static final long READY_TTL_MS = 60_000L;

    /**
     * Fixed fields even on failure. Source-authentication, association and
     * publication flags MUST remain false in synthetic contract version 01.
     */
    public record StateEnvelope(String schema, String status,
            String source, String kind, String requestedId, String title,
            String channelName, String artwork, String channelId,
            boolean associationVerified, long observedAt, long expiresAt,
            String failureCode, boolean sourceAuthenticated,
            int providerRequestsMade, boolean consumerPublicationAuthorized) {}

    @GetMapping(value = "/videos/{videoId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> video(@PathVariable String videoId,
            @RequestParam(defaultValue = "READY") String scenario) {
        return respond("VIDEO", videoId, scenario, VIDEO);
    }

    @GetMapping(value = "/channels/{channelId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> channel(@PathVariable String channelId,
            @RequestParam(defaultValue = "READY") String scenario) {
        return respond("CHANNEL", channelId, scenario, CHANNEL);
    }

    @GetMapping(value = "/handles/{handle}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> handle(@PathVariable String handle,
            @RequestParam(defaultValue = "READY") String scenario) {
        return respond("CHANNEL_HANDLE", handle, scenario, HANDLE);
    }

    private static ResponseEntity<?> respond(String kind, String id,
            String scenario, Pattern allowed) {
        if (id == null || !allowed.matcher(id).matches() ||
                !("READY".equals(scenario) || "NOT_FOUND".equals(scenario) ||
                  "FAILED".equals(scenario) || "STALE".equals(scenario)))
            return invalid();

        long now = System.currentTimeMillis();
        boolean hasRecord = "READY".equals(scenario) || "STALE".equals(scenario);
        boolean isVideo = "VIDEO".equals(kind);
        long observedAt = hasRecord
                ? ("STALE".equals(scenario) ? now - 120_000L : now) : 0;
        long expiresAt = hasRecord
                ? ("STALE".equals(scenario) ? now - 60_000L : now + READY_TTL_MS) : 0;
        String failure = switch (scenario) {
            case "NOT_FOUND" -> "FIXTURE_NOT_FOUND";
            case "FAILED" -> "FIXTURE_UNAVAILABLE";
            case "STALE" -> "FIXTURE_EXPIRED";
            default -> null;
        };
        StateEnvelope value = new StateEnvelope(
                SCHEMA, scenario, "LOCAL_SYNTHETIC_ONLY", kind, id,
                hasRecord ? (isVideo ? "합성 영상 제목 · " : "합성 채널 이름 · ") + id : null,
                hasRecord && isVideo ? "합성 채널 안내 · 실제 소속 미확인" : null,
                hasRecord ? (isVideo ? "VIDEO_PLACEHOLDER" : "CHANNEL_PLACEHOLDER") : null,
                null, false, observedAt, expiresAt, failure,
                false, 0, false);
        HttpStatus status = switch (scenario) {
            case "NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "FAILED" -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.OK;
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-YOUTOPIA-Synthetic", "test-only")
                .contentType(MediaType.APPLICATION_JSON)
                .body(value);
    }

    private static ResponseEntity<ProblemDetail> invalid() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Synthetic state fixture target or scenario is invalid.");
        problem.setTitle("Invalid synthetic state fixture");
        problem.setType(URI.create("urn:youtopia:problem:synthetic-state-invalid"));
        problem.setInstance(URI.create("/api/v1/youtube/metadata/synthetic-state"));
        problem.setProperty("code", "SYNTHETIC_STATE_INVALID");
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON).body(problem);
    }
}
