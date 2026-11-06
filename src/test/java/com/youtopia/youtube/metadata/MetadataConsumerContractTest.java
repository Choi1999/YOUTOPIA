package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** UI-R04-AF: pure no-I/O consumer contract, same descriptors as UI-R04-AE. */
class MetadataConsumerContractTest {
    private static final String VIDEO = "Ab0_-123xyz";
    private static final String CHANNEL = "UC" + "A".repeat(22);

    @Test
    void descriptorsMatchTheFrontendAeRequestSchema() {
        var video = MetadataConsumerContract.request("VIDEO", VIDEO);
        assertEquals("YOUTOPIA_UI_R04_AE_METADATA_REQUEST_V01", video.schema());
        assertEquals("VIDEO", video.kind());
        assertEquals(VIDEO, video.requestedId());
        assertEquals(CHANNEL,
                MetadataConsumerContract.request("CHANNEL", CHANNEL).requestedId());
        assertEquals("@samplecreator",
                MetadataConsumerContract.request("CHANNEL_HANDLE", "@samplecreator").requestedId());
        assertEquals("YOUTOPIA_UI_R04_AE_METADATA_RESPONSE_V01",
                MetadataConsumerContract.FUTURE_RESPONSE_SCHEMA);
    }

    @Test
    void malformedOrNoncanonicalTargetsCannotEscapeTheOfflineBoundary() {
        for (String bad : List.of("xyz", "https://youtube.com/watch?v=" + VIDEO,
                "Ab0_-123xyz?key=secret", "../secret", "Ab0_-123xyz\n")) {
            assertThrows(IllegalArgumentException.class,
                    () -> MetadataConsumerContract.request("VIDEO", bad));
        }
        for (String bad : List.of("@SampleCreator", "@x", "not-a-handle")) {
            assertThrows(IllegalArgumentException.class,
                    () -> MetadataConsumerContract.request("CHANNEL_HANDLE", bad));
        }
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.request("CHANNEL", VIDEO));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.request("OTHER", VIDEO));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.request(null, VIDEO));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.request("VIDEO", null));
    }

    @Test
    void boundedBatchRejectsDuplicateUnknownAndOverBudgetTargets() {
        var one = MetadataConsumerContract.request("VIDEO", VIDEO);
        assertEquals(List.of(one), MetadataConsumerContract.bounded(List.of(one)));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.bounded(List.of()));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.bounded(List.of(one, one)));
        var forged = new MetadataConsumerContract.RequestDescriptor(
                "FORGED_APPROVAL", "VIDEO", VIDEO);
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.bounded(List.of(forged)));
        var nine = new ArrayList<MetadataConsumerContract.RequestDescriptor>();
        for (int i = 0; i < 9; i++) {
            nine.add(MetadataConsumerContract.request(
                    "VIDEO", "Ab0_-123xy" + i));
        }
        assertThrows(IllegalArgumentException.class,
                () -> MetadataConsumerContract.bounded(nine));
    }

    @Test
    void policyDenialNeverClaimsAuthenticationOrConsumerPublication() {
        var receipt = MetadataConsumerContract.deny();
        assertEquals("POLICY_HOLD", receipt.status());
        assertEquals("POLICY_HOLD", receipt.policy());
        assertEquals(0, receipt.providerRequestsMade());
        assertFalse(receipt.sourceAuthenticated());
        assertFalse(receipt.consumerPublicationAuthorized());
        assertFalse(MetadataConsumerContract.LIVE_PROVIDER_CALLS_AUTHORIZED);
        assertFalse(MetadataConsumerContract.REAL_CREDENTIAL_ACCESS_AUTHORIZED);
        assertFalse(MetadataConsumerContract.CONSUMER_PUBLICATION_AUTHORIZED);
        assertEquals(8, MetadataConsumerContract.MAX_BATCH);
    }
}
