package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MetadataApprovalPreflightTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final String DIGEST = "a".repeat(64);
    private static final long DAY = 24L * 60 * 60 * 1000;

    private static MetadataApprovalPreflight.EvidenceReference receipt(String id) {
        return new MetadataApprovalPreflight.EvidenceReference(
                id, DIGEST, NOW - DAY, NOW + DAY);
    }

    @Test
    void missingCloudEvidenceRemainsDenied() {
        var assessment = MetadataApprovalPreflight.assess(List.of(), NOW);
        assertEquals("REFERENCES_MISSING_NOT_AUTHORIZED", assessment.status());
        assertEquals(10, assessment.missingRequirements().size());
        assertEquals("POLICY_HOLD", assessment.policy());
        assertFalse(assessment.firstLiveMetadataReadAuthorized());
        assertFalse(assessment.commentOrSentimentReadAuthorized());
        assertFalse(assessment.referencesIndependentlyVerified());
        assertFalse(assessment.quotaVerified());
        assertEquals(0, assessment.actualYouTubeRequests());
    }

    @Test
    void evenCompleteCallerSuppliedHashesCannotAuthorizeCloudOrGoogleRead() {
        var receipts = MetadataApprovalPreflight.REQUIRED.stream()
                .map(MetadataApprovalPreflightTest::receipt).toList();
        var assessment = MetadataApprovalPreflight.assess(receipts, NOW);
        assertEquals("REFERENCE_SET_COMPLETE_INDEPENDENT_REVIEW_REQUIRED",
                assessment.status());
        assertTrue(assessment.missingRequirements().isEmpty());
        assertTrue(assessment.invalidRequirements().isEmpty());
        assertFalse(assessment.referencesIndependentlyVerified());
        assertFalse(assessment.credentialRestrictionsVerified());
        assertFalse(assessment.quotaVerified());
        assertFalse(assessment.providerOriginVerified());
        assertFalse(assessment.firstLiveMetadataReadAuthorized());
        assertFalse(assessment.commentOrSentimentReadAuthorized());
        assertEquals(0, assessment.actualYouTubeRequests());
    }

    @Test
    void oneMissingEvidenceReportsOnlyMissingRequirementName() {
        var receipts = MetadataApprovalPreflight.REQUIRED.stream()
                .skip(1).map(MetadataApprovalPreflightTest::receipt).toList();
        var assessment = MetadataApprovalPreflight.assess(receipts, NOW);
        assertEquals(List.of("M01_SAME_PROJECT_OWNER_AND_OPERATOR"),
                assessment.missingRequirements());
        assertEquals("REFERENCES_MISSING_NOT_AUTHORIZED", assessment.status());
    }

    @Test
    void invalidDigestAndUnknownRequirementFailClosed() {
        var list = new ArrayList<MetadataApprovalPreflight.EvidenceReference>();
        list.add(new MetadataApprovalPreflight.EvidenceReference(
                "M01_SAME_PROJECT_OWNER_AND_OPERATOR", "not-a-digest",
                NOW - DAY, NOW + DAY));
        list.add(receipt("M11_FAKE_ALLOW_ALL"));
        var result = MetadataApprovalPreflight.assess(list, NOW);
        assertEquals("INVALID_REFERENCE_PACKAGE", result.status());
        assertEquals(2, result.invalidRequirements().size());
        assertFalse(result.firstLiveMetadataReadAuthorized());
    }

    @Test
    void duplicateRequirementCannotMintTwoValidReviews() {
        var one = receipt("M01_SAME_PROJECT_OWNER_AND_OPERATOR");
        var result = MetadataApprovalPreflight.assess(List.of(one, one), NOW);
        assertEquals("INVALID_REFERENCE_PACKAGE", result.status());
        assertEquals(List.of("M01_SAME_PROJECT_OWNER_AND_OPERATOR"),
                result.invalidRequirements());
    }

    @Test
    void expiredFutureOrOversizedEvidenceValidityFailsClosed() {
        var samples = List.of(
                new MetadataApprovalPreflight.EvidenceReference(
                        "M01_SAME_PROJECT_OWNER_AND_OPERATOR", DIGEST, NOW - 2 * DAY, NOW),
                new MetadataApprovalPreflight.EvidenceReference(
                        "M01_SAME_PROJECT_OWNER_AND_OPERATOR", DIGEST, NOW + 1, NOW + DAY),
                new MetadataApprovalPreflight.EvidenceReference(
                        "M01_SAME_PROJECT_OWNER_AND_OPERATOR", DIGEST, NOW - 35 * DAY,
                        NOW + DAY));
        for (var sample : samples) {
            var result = MetadataApprovalPreflight.assess(List.of(sample), NOW);
            assertEquals("INVALID_REFERENCE_PACKAGE", result.status());
            assertFalse(result.firstLiveMetadataReadAuthorized());
        }
    }

    @Test
    void callerHasNoPathToSecretsLiveTransportOrApproval() {
        assertEquals(10, MetadataApprovalPreflight.REQUIRED.size());
        assertFalse(MetadataApprovalPreflight.LIVE_METADATA_READ_AUTHORIZED);
        assertFalse(MetadataApprovalPreflight.LIVE_COMMENT_READ_AUTHORIZED);
        assertEquals(0, MetadataApprovalPreflight.class.getAnnotations().length);
        assertTrue(java.util.Arrays.stream(
                MetadataApprovalPreflight.class.getDeclaredMethods())
                .noneMatch(m -> m.getName().matches(
                        "(?i)(execute|send|fetch|authorize|loadSecret|publish|approve)")));
    }

    @Test
    void invalidEnvelopeAlsoNeverAuthorizesRequests() {
        var result = MetadataApprovalPreflight.assess(null, NOW);
        assertEquals("INVALID_REFERENCE_PACKAGE", result.status());
        assertFalse(result.firstLiveMetadataReadAuthorized());
        assertFalse(result.referencesIndependentlyVerified());
        var oversized = new ArrayList<MetadataApprovalPreflight.EvidenceReference>();
        for (int i = 0; i < 11; i++) oversized.add(receipt("M01_SAME_PROJECT_OWNER_AND_OPERATOR"));
        assertEquals("INVALID_REFERENCE_PACKAGE",
                MetadataApprovalPreflight.assess(oversized, NOW).status());
    }
}
