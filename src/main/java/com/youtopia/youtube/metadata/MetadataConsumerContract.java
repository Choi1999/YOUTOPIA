package com.youtopia.youtube.metadata;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * UI-R04-AF: a NON-EXECUTABLE backend request and policy-denial contract
 * matching the offline frontend AE request descriptor.
 *
 * No Spring bean, controller, credential reader, provider client, response
 * publication or runtime feature flag. A request shape is NOT authorization.
 * All live metadata and comment collection remain POLICY_HOLD.
 */
public final class MetadataConsumerContract {
    public static final String REQUEST_SCHEMA =
            "YOUTOPIA_UI_R04_AE_METADATA_REQUEST_V01";
    public static final String FUTURE_RESPONSE_SCHEMA =
            "YOUTOPIA_UI_R04_AE_METADATA_RESPONSE_V01";
    public static final String POLICY = "POLICY_HOLD";
    public static final int MAX_BATCH = 8;
    public static final boolean LIVE_PROVIDER_CALLS_AUTHORIZED = false;
    public static final boolean REAL_CREDENTIAL_ACCESS_AUTHORIZED = false;
    public static final boolean CONSUMER_PUBLICATION_AUTHORIZED = false;

    private static final Pattern VIDEO = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern CHANNEL = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");
    private static final Pattern HANDLE =
            Pattern.compile("^@[\\p{L}\\p{N}._-]{3,30}$");

    private MetadataConsumerContract() {}

    public record RequestDescriptor(String schema, String kind, String requestedId) {}

    /**
     * Safe denial receipt, never a provider payload. Intentionally contains
     * no request ID, source body, API key, URL, user identity or trust claim.
     */
    public record Denial(String status, String policy, boolean sourceAuthenticated,
                         boolean consumerPublicationAuthorized, int providerRequestsMade) {}

    private static IllegalArgumentException rejected() {
        return new IllegalArgumentException("UI_R04_AF_INVALID_TARGET");
    }

    public static RequestDescriptor request(String kind, String id) {
        if (kind == null || id == null) throw rejected();
        boolean valid = switch (kind) {
            case "VIDEO" -> VIDEO.matcher(id).matches();
            case "CHANNEL" -> CHANNEL.matcher(id).matches();
            case "CHANNEL_HANDLE" -> HANDLE.matcher(id).matches() &&
                    id.equals(id.toLowerCase(java.util.Locale.ROOT)) &&
                    Normalizer.isNormalized(id, Normalizer.Form.NFC);
            default -> false;
        };
        if (!valid) throw rejected();
        return new RequestDescriptor(REQUEST_SCHEMA, kind, id);
    }

    /** Duplicate and over-budget requests fail closed before any future I/O. */
    public static List<RequestDescriptor> bounded(List<RequestDescriptor> input) {
        if (input == null || input.isEmpty() || input.size() > MAX_BATCH)
            throw rejected();
        Set<String> keys = new HashSet<>();
        for (RequestDescriptor item : input) {
            if (item == null) throw rejected();
            RequestDescriptor checked = request(item.kind(), item.requestedId());
            if (!REQUEST_SCHEMA.equals(item.schema()) ||
                    !keys.add(checked.kind() + ":" + checked.requestedId()))
                throw rejected();
        }
        return List.copyOf(input);
    }

    /** POLICY_HOLD cannot be unlocked via request JSON, headers or arguments. */
    public static Denial deny() {
        return new Denial("POLICY_HOLD", POLICY, false, false, 0);
    }
}
