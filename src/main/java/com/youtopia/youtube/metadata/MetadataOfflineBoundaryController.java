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
 * UI-R04-R — test-profile-only HTTP boundary for a future *read-only*
 * YouTube metadata endpoint. THIS IS NOT AN API CLIENT.
 *
 * The canonical default application does not register this route:
 * both a synthetic profile and an explicit opt-in property are required.
 * Even when deliberately enabled in isolated tests, every request is
 * denied without reading credentials, accessing network, or writing data.
 *
 * Existing SecurityConfiguration protects /api/v1/youtube/** with ROLE_USER.
 * No security configuration, auth role, CSRF policy or policy gate is changed.
 */
@RestController
@RequestMapping("/api/v1/youtube/metadata")
@Profile("metadata-offline-test")
@ConditionalOnProperty(
        name = "youtopia.metadata.synthetic-boundary.enabled",
        havingValue = "true",
        matchIfMissing = false)
public final class MetadataOfflineBoundaryController {
    @GetMapping(path = "/videos/{videoId}", produces = MediaType.APPLICATION_PROBLEM_JSON_VALUE)
    public ResponseEntity<ProblemDetail> video(@PathVariable String videoId) {
        return notAvailable();
    }

    @GetMapping(path = "/channels/{channelId}", produces = MediaType.APPLICATION_PROBLEM_JSON_VALUE)
    public ResponseEntity<ProblemDetail> channel(@PathVariable String channelId) {
        return notAvailable();
    }

    @GetMapping(path = "/handles/{handle}", produces = MediaType.APPLICATION_PROBLEM_JSON_VALUE)
    public ResponseEntity<ProblemDetail> handle(@PathVariable String handle) {
        return notAvailable();
    }

    private static ResponseEntity<ProblemDetail> notAvailable() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                "YouTube metadata is unavailable. No provider request was made.");
        problem.setTitle("Metadata unavailable");
        problem.setType(URI.create("urn:youtopia:problem:metadata-unavailable"));
        problem.setProperty("code", "METADATA_UNAVAILABLE");
        // No request URI, caller IDs, provider URLs, tokens, raw errors,
        // Cloud evidence, personal data or source credibility claims.
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problem);
    }
}
