package com.youtopia.youtube.metadata;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * UI-R04-T — strict schema boundary for a Windows-only SYNTHETIC DPAPI
 * self-test report. No service/Bean annotation, ProcessBuilder, platform
 * access, credential loading, persisted key, provider HTTP, or approval.
 *
 * The external script's claim is NOT independently authenticated. Java
 * validation of a report DOES NOT prove that the script ran on Windows.
 * Independent Windows CI executes the DPAPI roundtrip separately.
 */
public final class WindowsDpapiVaultReadiness {
    public static final String SCHEMA = "YOUTOPIA_R04T_WINDOWS_DPAPI_OFFLINE_V01";
    public static final int MAX_REPORT_BYTES = 4096;
    public static final boolean ACTUAL_CREDENTIAL_READER_ENABLED = false;
    public static final boolean LIVE_METADATA_READ_AUTHORIZED = false;

    private static final Set<String> KEYS = Set.of(
            "schema", "status", "mode", "policy", "dpapiScope",
            "supportedWindows", "syntheticRoundTripSucceeded",
            "syntheticCipherFileUsed", "temporaryCipherFileRemoved",
            "realApiKeyRead", "actualCredentialsProvisioned",
            "credentialReaderEnabled", "productionSecretStoreModified",
            "cloudCliInvoked", "externalRequestsMade",
            "firstLiveMetadataReadAuthorized", "firstLiveCommentReadAuthorized");

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private WindowsDpapiVaultReadiness() {}

    public record Status(String schema, String mode, String status,
                         boolean syntheticRoundTripReported,
                         boolean observedReportAuthenticated,
                         boolean actualCredentialsRead,
                         boolean liveMetadataAuthorized,
                         boolean commentOrSentimentAuthorized,
                         int actualProviderRequests) {}

    private static IllegalArgumentException rejected(String reason) {
        return new IllegalArgumentException("UI_R04T_REPORT_" + reason);
    }
    private static boolean requiredBoolean(JsonNode root, String name) {
        JsonNode v = root.get(name);
        if (v == null || !v.isBoolean()) throw rejected("SCHEMA");
        return v.booleanValue();
    }
    private static boolean exactly(JsonNode root, String name, String expected) {
        JsonNode node = root.get(name);
        return node != null && node.isTextual() && expected.equals(node.textValue());
    }

    /**
     * Strictly accepts ONLY sanitized, no-secret reports. The output never
     * upgrades provider origin or enables any key-reader or runtime API.
     */
    public static Status inspect(byte[] untrusted) {
        if (untrusted == null || untrusted.length < 2 ||
                untrusted.length > MAX_REPORT_BYTES) throw rejected("SIZE");
        JsonNode root;
        try {
            root = MAPPER.readTree(untrusted);
        } catch (IOException exception) {
            throw rejected("JSON");
        }
        if (root == null || !root.isObject()) throw rejected("SCHEMA");
        Set<String> keys = new HashSet<>();
        root.fieldNames().forEachRemaining(keys::add);
        if (!keys.equals(KEYS) || !exactly(root, "schema", SCHEMA) ||
                !exactly(root, "policy", "POLICY_HOLD") ||
                !exactly(root, "dpapiScope", "CURRENT_USER"))
            throw rejected("SCHEMA");

        boolean windows = requiredBoolean(root, "supportedWindows");
        boolean roundtrip = requiredBoolean(root, "syntheticRoundTripSucceeded");
        boolean fileUsed = requiredBoolean(root, "syntheticCipherFileUsed");
        boolean tempRemoved = requiredBoolean(root, "temporaryCipherFileRemoved");

        if (requiredBoolean(root, "realApiKeyRead") ||
                requiredBoolean(root, "actualCredentialsProvisioned") ||
                requiredBoolean(root, "credentialReaderEnabled") ||
                requiredBoolean(root, "productionSecretStoreModified") ||
                requiredBoolean(root, "cloudCliInvoked") ||
                requiredBoolean(root, "firstLiveMetadataReadAuthorized") ||
                requiredBoolean(root, "firstLiveCommentReadAuthorized"))
            throw rejected("PROHIBITED_ACTIVITY");

        JsonNode count = root.get("externalRequestsMade");
        if (!count.isIntegralNumber() || !count.canConvertToInt() ||
                count.intValue() != 0) throw rejected("PROHIBITED_ACTIVITY");

        String mode = root.get("mode").isTextual() ? root.get("mode").textValue() : "";
        String status = root.get("status").isTextual() ? root.get("status").textValue() : "";
        boolean valid = switch (status) {
            case "OFFLINE_PLATFORM_READY_NOT_AUTHORIZED" ->
                "Check".equals(mode) && windows && !roundtrip && !fileUsed && !tempRemoved;
            case "SYNTHETIC_DPAPI_ROUNDTRIP_PASS" ->
                "SelfTest".equals(mode) && windows && roundtrip && fileUsed && tempRemoved;
            case "SYNTHETIC_DPAPI_SELFTEST_FAILED" ->
                "SelfTest".equals(mode) && windows && !roundtrip;
            case "UNSUPPORTED_PLATFORM" ->
                ("Check".equals(mode) || "SelfTest".equals(mode))
                    && !windows && !roundtrip && !fileUsed && !tempRemoved;
            default -> false;
        };
        if (!valid) throw rejected("INCONSISTENT_STATUS");

        // A claimed successful self-test in caller-provided JSON is never an
        // independently verified operating-system or API authorization fact.
        return new Status(SCHEMA, mode, status,
                roundtrip, false, false, false, false, 0);
    }
}
