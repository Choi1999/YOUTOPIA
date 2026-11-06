package com.youtopia.youtube.metadata;

import java.net.URI;
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
 * UI-R04-AF: TEST-SOURCE-SET ONLY. Even when both test opt-ins are set,
 * members get a fixed policy-denied result. Never included in bootJar.
 *
 * Existing SecurityConfiguration retains /api/v1/youtube/** ROLE_USER
 * enforcement and default CSRF protection. No browser routes or secrets.
 */
@RestController
@RequestMapping("/api/v1/youtube/metadata/consumer-offline")
@Profile("metadata-offline-test")
@ConditionalOnProperty(
        name = "youtopia.metadata.consumer-offline-test.enabled",
        havingValue = "true",
        matchIfMissing = false)
public final class MetadataConsumerOfflineController {
    @GetMapping(path = "/videos/{videoId}")
    public ResponseEntity<ProblemDetail> video(@PathVariable String videoId) {
        return respond("VIDEO", videoId);
    }

    @GetMapping(path = "/channels/{channelId}")
    public ResponseEntity<ProblemDetail> channel(@PathVariable String channelId) {
        return respond("CHANNEL", channelId);
    }

    @GetMapping(path = "/handles/{handle}")
    public ResponseEntity<ProblemDetail> handle(@PathVariable String handle) {
        return respond("CHANNEL_HANDLE", handle);
    }

    private static ResponseEntity<ProblemDetail> respond(String kind, String id) {
        try {
            // Parse ONLY, never a provider request or a source-identity proof.
            MetadataConsumerContract.request(kind, id);
        } catch (IllegalArgumentException invalid) {
            return problem(HttpStatus.BAD_REQUEST,
                    "METADATA_TARGET_INVALID", "Metadata request is invalid.");
        }
        var denial = MetadataConsumerContract.deny();
        if (denial.providerRequestsMade() != 0 ||
                denial.sourceAuthenticated() ||
                denial.consumerPublicationAuthorized())
            throw new IllegalStateException("OFFLINE_POLICY_INVARIANT");
        return problem(HttpStatus.SERVICE_UNAVAILABLE,
                "METADATA_POLICY_HOLD", "Metadata is unavailable.");
    }

    private static ResponseEntity<ProblemDetail> problem(
            HttpStatus status, String code, String detail) {
        ProblemDetail value = ProblemDetail.forStatusAndDetail(status, detail);
        value.setTitle("Metadata unavailable");
        value.setType(URI.create("urn:youtopia:problem:metadata-policy-hold"));
        // A fixed instance prevents echoing target IDs, query strings or keys.
        value.setInstance(URI.create("/api/v1/youtube/metadata/consumer-offline"));
        value.setProperty("code", code);
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(value);
    }
}
