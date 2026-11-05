package com.youtopia.youtube.metadata;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * UI-R04-S — pure evidence-package COMPLETENESS check, NOT an authorization
 * system. Caller-supplied file digests and time stamps do not establish
 * independent reviewer identity, Google Cloud ownership, quotas, policy
 * approval, or permission to make a real provider request.
 *
 * No Spring Bean, HTTP route, Cloud SDK, credential reader, filesystem,
 * persistence, or API transport. Every result forbids first live calls.
 */
public final class MetadataApprovalPreflight {
    public static final String SCHEMA = "YOUTOPIA_R04S_METADATA_EVIDENCE_PACKAGE_V01";
    public static final String POLICY = "POLICY_HOLD";
    public static final boolean LIVE_METADATA_READ_AUTHORIZED = false;
    public static final boolean LIVE_COMMENT_READ_AUTHORIZED = false;
    public static final long MAX_EVIDENCE_AGE_MS = 30L * 24 * 60 * 60 * 1000;

    public static final List<String> REQUIRED = List.of(
            "M01_SAME_PROJECT_OWNER_AND_OPERATOR",
            "M02_YOUTUBE_DATA_API_ENABLED",
            "M03_API_KEY_SERVICE_RESTRICTION",
            "M04_SERVER_EGRESS_AND_IP_RESTRICTION",
            "M05_ACTUAL_PROJECT_QUOTA_AND_BUDGET",
            "M06_METADATA_ONLY_POLICY_AND_TERMS",
            "M07_SERVER_SECRET_VAULT_AND_ROTATION",
            "M08_DURABLE_TENANT_QUOTA_SECURITY",
            "M09_PROVIDER_ORIGIN_CACHE_RETENTION",
            "M10_FIRST_CALL_OPERATOR_SCOPE_AND_STOP");

    private static final Pattern SHA256 = Pattern.compile("^[a-f0-9]{64}$");

    private MetadataApprovalPreflight() {}

    /**
     * A reference digest is only a manifest pointer; it is NOT an assurance
     * signature. Never store a raw screenshot, API key, project ID, account
     * email, external IP, access token or provider error body here.
     */
    public record EvidenceReference(String requirement, String opaqueSha256,
                                    long observedAtEpochMs, long expiresAtEpochMs) {}

    public record Assessment(String schema, String status, String policy,
                             boolean referencesIndependentlyVerified,
                             boolean credentialRestrictionsVerified,
                             boolean quotaVerified,
                             boolean providerOriginVerified,
                             boolean firstLiveMetadataReadAuthorized,
                             boolean commentOrSentimentReadAuthorized,
                             int actualYouTubeRequests,
                             List<String> missingRequirements,
                             List<String> invalidRequirements) {
        public Assessment {
            missingRequirements = List.copyOf(missingRequirements);
            invalidRequirements = List.copyOf(invalidRequirements);
        }
    }

    /**
     * A COMPLETE_REFERENCE_SET status means the human reviewer received
     * references to consider, NOT that any evidence is independently valid.
     */
    public static Assessment assess(List<EvidenceReference> supplied, long nowEpochMs) {
        if (nowEpochMs < 0 || supplied == null || supplied.size() > REQUIRED.size())
            return build("INVALID_REFERENCE_PACKAGE", REQUIRED, List.of("INVALID_ENVELOPE"));
        Set<String> seen = new HashSet<>();
        Set<String> accepted = new HashSet<>();
        List<String> invalid = new ArrayList<>();
        for (EvidenceReference item : supplied) {
            if (item == null || item.requirement() == null ||
                    !REQUIRED.contains(item.requirement())) {
                invalid.add("UNKNOWN_OR_NULL_REFERENCE");
                continue;
            }
            String name = item.requirement();
            if (!seen.add(name) ||
                    item.opaqueSha256() == null ||
                    !SHA256.matcher(item.opaqueSha256()).matches() ||
                    item.observedAtEpochMs() < 0 ||
                    item.expiresAtEpochMs() <= item.observedAtEpochMs() ||
                    item.observedAtEpochMs() > nowEpochMs ||
                    item.expiresAtEpochMs() <= nowEpochMs ||
                    item.expiresAtEpochMs() - item.observedAtEpochMs() > MAX_EVIDENCE_AGE_MS) {
                invalid.add(name);
                continue;
            }
            accepted.add(name);
        }
        var missing = REQUIRED.stream().filter(name -> !accepted.contains(name)).toList();
        if (!invalid.isEmpty())
            return build("INVALID_REFERENCE_PACKAGE", missing, invalid);
        return build(missing.isEmpty()
                ? "REFERENCE_SET_COMPLETE_INDEPENDENT_REVIEW_REQUIRED"
                : "REFERENCES_MISSING_NOT_AUTHORIZED", missing, invalid);
    }

    private static Assessment build(String status, List<String> missing,
                                    List<String> invalid) {
        // No caller-supplied flags, signed approvals, or arbitrary receipt
        // can change the hard-coded false authorization/provenance results.
        return new Assessment(SCHEMA, status, POLICY,
                false, false, false, false,
                false, false, 0, missing, invalid);
    }
}
