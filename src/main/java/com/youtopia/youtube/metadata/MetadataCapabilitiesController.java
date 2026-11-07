package com.youtopia.youtube.metadata;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * UI-R04-AN: a real, read-only application capability endpoint.
 *
 * This is NOT a metadata reader, discovery endpoint, provider bridge, or
 * authorization grant. The regular application registers this controller,
 * while the existing /api/v1/youtube/** security rule requires ROLE_USER.
 *
 * Nothing here accesses credentials, Redis, PostgreSQL, YouTube or network.
 * A 200 capability document never implies that metadata is available.
 */
@RestController
@RequestMapping("/api/v1/youtube/metadata")
public final class MetadataCapabilitiesController {
    public static final String SCHEMA = "YOUTOPIA_METADATA_CAPABILITIES_V01";

    public record Capabilities(
            String schema,
            String status,
            String policy,
            boolean memberAuthenticationRequired,
            boolean metadataReadAuthorized,
            boolean commentReadAuthorized,
            boolean consumerPublicationAuthorized,
            boolean providerCredentialsAvailable,
            int providerRequestsMade) {}

    /**
     * Read-only feature negotiation for a future authenticated FE/BE adapter.
     * This response deliberately contains no source data or target identity.
     */
    @GetMapping(value = "/capabilities", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Capabilities> capabilities() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new Capabilities(
                        SCHEMA,
                        "UNAVAILABLE",
                        MetadataConsumerContract.POLICY,
                        true,
                        MetadataConsumerContract.LIVE_PROVIDER_CALLS_AUTHORIZED,
                        false,
                        MetadataConsumerContract.CONSUMER_PUBLICATION_AUTHORIZED,
                        MetadataConsumerContract.REAL_CREDENTIAL_ACCESS_AUTHORIZED,
                        0));
    }
}
