package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WindowsDpapiVaultReadinessTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    private static Map<String, Object> report(boolean pass) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("schema", WindowsDpapiVaultReadiness.SCHEMA);
        value.put("status", pass ? "SYNTHETIC_DPAPI_ROUNDTRIP_PASS" :
                "OFFLINE_PLATFORM_READY_NOT_AUTHORIZED");
        value.put("mode", pass ? "SelfTest" : "Check");
        value.put("policy", "POLICY_HOLD");
        value.put("dpapiScope", "CURRENT_USER");
        value.put("supportedWindows", true);
        value.put("syntheticRoundTripSucceeded", pass);
        value.put("syntheticCipherFileUsed", pass);
        value.put("temporaryCipherFileRemoved", pass);
        value.put("realApiKeyRead", false);
        value.put("actualCredentialsProvisioned", false);
        value.put("credentialReaderEnabled", false);
        value.put("productionSecretStoreModified", false);
        value.put("cloudCliInvoked", false);
        value.put("externalRequestsMade", 0);
        value.put("firstLiveMetadataReadAuthorized", false);
        value.put("firstLiveCommentReadAuthorized", false);
        return value;
    }
    private static WindowsDpapiVaultReadiness.Status parse(Map<String, Object> value)
            throws Exception {
        return WindowsDpapiVaultReadiness.inspect(JSON.writeValueAsBytes(value));
    }
    private static void rejected(String code, Map<String, Object> value) throws Exception {
        var thrown = assertThrows(IllegalArgumentException.class, () -> parse(value));
        assertEquals("UI_R04T_REPORT_" + code, thrown.getMessage());
    }

    @Test
    void checkOnlyPlatformStatementNeverClaimsCredentialAccessOrLiveRead() throws Exception {
        var result = parse(report(false));
        assertEquals("OFFLINE_PLATFORM_READY_NOT_AUTHORIZED", result.status());
        assertEquals("Check", result.mode());
        assertFalse(result.syntheticRoundTripReported());
        assertFalse(result.observedReportAuthenticated());
        assertFalse(result.actualCredentialsRead());
        assertFalse(result.liveMetadataAuthorized());
        assertFalse(result.commentOrSentimentAuthorized());
        assertEquals(0, result.actualProviderRequests());
    }

    @Test
    void evenReportedSyntheticDpapiSuccessCannotMintProviderApproval() throws Exception {
        var result = parse(report(true));
        assertEquals("SYNTHETIC_DPAPI_ROUNDTRIP_PASS", result.status());
        assertTrue(result.syntheticRoundTripReported());
        assertFalse(result.observedReportAuthenticated());
        assertFalse(result.actualCredentialsRead());
        assertFalse(result.liveMetadataAuthorized());
        assertFalse(result.commentOrSentimentAuthorized());
        assertEquals(0, result.actualProviderRequests());
    }

    @Test
    void realCredentialReadOrProvisionFlagAlwaysRejected() throws Exception {
        for (String key : new String[]{
                "realApiKeyRead", "actualCredentialsProvisioned",
                "credentialReaderEnabled", "productionSecretStoreModified",
                "cloudCliInvoked", "firstLiveMetadataReadAuthorized",
                "firstLiveCommentReadAuthorized"}) {
            var value = report(true);
            value.put(key, true);
            rejected("PROHIBITED_ACTIVITY", value);
        }
        var count = report(true);
        count.put("externalRequestsMade", 1);
        rejected("PROHIBITED_ACTIVITY", count);
    }

    @Test
    void rejectUnexpectedSourceIdentitySecretsAndRichData() throws Exception {
        for (String injected : new String[]{
                "apiKey", "projectId", "username", "publicIp", "vaultPath",
                "ciphertext", "callerApproved", "realMetadata"}) {
            var value = report(true);
            value.put(injected, "SHOULD_NOT_BE_ACCEPTED");
            rejected("SCHEMA", value);
        }
        var missing = report(false);
        missing.remove("credentialReaderEnabled");
        rejected("SCHEMA", missing);
    }

    @Test
    void rejectNonWindowsOrMachineScopeAsSuccessfulRoundtrip() throws Exception {
        var machine = report(true);
        machine.put("dpapiScope", "LOCAL_MACHINE");
        rejected("SCHEMA", machine);
        var unsupported = report(true);
        unsupported.put("supportedWindows", false);
        rejected("INCONSISTENT_STATUS", unsupported);
        var wrongMode = report(true);
        wrongMode.put("mode", "Check");
        rejected("INCONSISTENT_STATUS", wrongMode);
    }

    @Test
    void failedOrUnsupportedSyntheticResultsStayDenied() throws Exception {
        var bad = report(true);
        bad.put("status", "SYNTHETIC_DPAPI_SELFTEST_FAILED");
        bad.put("syntheticRoundTripSucceeded", false);
        var failed = parse(bad);
        assertFalse(failed.liveMetadataAuthorized());
        assertFalse(failed.actualCredentialsRead());

        var unavailable = report(false);
        unavailable.put("status", "UNSUPPORTED_PLATFORM");
        unavailable.put("supportedWindows", false);
        var result = parse(unavailable);
        assertEquals("UNSUPPORTED_PLATFORM", result.status());
        assertFalse(result.observedReportAuthenticated());
    }

    @Test
    void rejectAnySyntheticStatusThatClaimsImproperCleanup() throws Exception {
        var notDeleted = report(true);
        notDeleted.put("temporaryCipherFileRemoved", false);
        rejected("INCONSISTENT_STATUS", notDeleted);

        var noFile = report(true);
        noFile.put("syntheticCipherFileUsed", false);
        rejected("INCONSISTENT_STATUS", noFile);
    }

    @Test
    void badJsonDuplicateKeysAndOversizePayloadFailClosed() throws Exception {
        var exception = assertThrows(IllegalArgumentException.class,
                () -> WindowsDpapiVaultReadiness.inspect("{ ".getBytes(StandardCharsets.UTF_8)));
        assertEquals("UI_R04T_REPORT_JSON", exception.getMessage());

        String duplicated = JSON.writeValueAsString(report(false))
                .replace("\"schema\":", "\"schema\":\"FAKE\",\"schema\":");
        assertEquals("UI_R04T_REPORT_JSON", assertThrows(IllegalArgumentException.class,
                () -> WindowsDpapiVaultReadiness.inspect(
                        duplicated.getBytes(StandardCharsets.UTF_8))).getMessage());

        assertEquals("UI_R04T_REPORT_SIZE", assertThrows(IllegalArgumentException.class,
                () -> WindowsDpapiVaultReadiness.inspect(new byte[WindowsDpapiVaultReadiness.MAX_REPORT_BYTES + 1]))
                        .getMessage());
        assertEquals("UI_R04T_REPORT_SIZE", assertThrows(IllegalArgumentException.class,
                () -> WindowsDpapiVaultReadiness.inspect(null)).getMessage());
    }

    @Test
    void emptyOrIncorrectFieldTypesAreRejected() throws Exception {
        var invalid = report(false);
        invalid.put("externalRequestsMade", "0");
        rejected("PROHIBITED_ACTIVITY", invalid);
        var flags = report(false);
        flags.put("supportedWindows", "true");
        rejected("SCHEMA", flags);
        var wrongSchema = report(false);
        wrongSchema.put("schema", "OTHER");
        rejected("SCHEMA", wrongSchema);
    }

    @Test
    void pureOfflineBoundaryCannotExecuteRealSecretFlow() {
        assertFalse(WindowsDpapiVaultReadiness.ACTUAL_CREDENTIAL_READER_ENABLED);
        assertFalse(WindowsDpapiVaultReadiness.LIVE_METADATA_READ_AUTHORIZED);
        assertEquals(0, WindowsDpapiVaultReadiness.class.getAnnotations().length);
        assertTrue(java.lang.reflect.Modifier.isFinal(
                WindowsDpapiVaultReadiness.class.getModifiers()));
        assertTrue(java.util.Arrays.stream(WindowsDpapiVaultReadiness.class.getDeclaredMethods())
                .noneMatch(method -> method.getName().matches(
                        "(?i)execute|fetch|readCredential|unprotect|authorize|publish|loadSecret")));
    }

    @Test
    void vaultHealthDoesNotAuthorizeOfflineYoutubeMetadataPlanning() throws Exception {
        var report = parse(report(true));
        var videoPlan = OfflineMetadataBridge.plan(
                java.util.List.of("Ab0_-123xyz"), null, null);
        assertTrue(report.syntheticRoundTripReported());
        assertFalse(report.observedReportAuthenticated());
        assertFalse(videoPlan.networkEnabled());
        assertFalse(videoPlan.consumerPublicationAuthorized());
        assertEquals(0, videoPlan.providerRequestsMade());
    }
}
