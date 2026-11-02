package com.youtopia.youtube.admin;

import com.youtopia.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Deliberately non-destructive. Available ONLY in the synthetic-test profile
 * when a second explicit property is enabled. This is not a production purge.
 * SecurityConfiguration already restricts all /api/v1/admin/** to ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/v1/admin/youtube-data/deletions")
@Profile("g45-synthetic-test")
@ConditionalOnProperty(name = "youtopia.g45.synthetic-admin-boundary.enabled", havingValue = "true", matchIfMissing = false)
public class G45AdminDeletionBoundaryController {
    @GetMapping("/capabilities")
    public Map<String, Object> capabilities() {
        return Map.of(
            "mode", "SYNTHETIC_TEST_ONLY",
            "realDeletionImplemented", false,
            "requiresAdminRole", "ADMIN",
            "policyState", "POLICY_HOLD",
            "actualRecordsDeleted", 0,
            "sourceProviderRequests", 0
        );
    }

    @PostMapping("/preview")
    public ResponseEntity<ProblemDetail> preview(HttpServletRequest request) {
        return denied(request);
    }

    @PostMapping
    public ResponseEntity<ProblemDetail> delete(HttpServletRequest request) {
        return denied(request);
    }

    private static ResponseEntity<ProblemDetail> denied(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ApiProblems.create(HttpStatus.SERVICE_UNAVAILABLE,
                "G45_REAL_PURGE_POLICY_HOLD",
                "Real YouTube analysis data deletion has not been implemented or authorized.",
                request));
    }
}
