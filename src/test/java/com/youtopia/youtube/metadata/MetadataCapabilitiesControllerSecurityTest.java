package com.youtopia.youtube.metadata;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.youtopia.security.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * UI-R04-AN: real controller availability is distinct from provider readiness.
 * Test-only member identities do not enable a real cloud call.
 */
@WebMvcTest(controllers = MetadataCapabilitiesController.class)
@Import(SecurityConfiguration.class)
class MetadataCapabilitiesControllerSecurityTest {
    private static final String PATH = "/api/v1/youtube/metadata/capabilities";

    @Autowired MockMvc mvc;

    @Test
    void controllerIsPartOfTheNormalApplicationNotSyntheticProfile() {
        var controller = MetadataCapabilitiesController.class;
        assertNotNull(controller.getAnnotation(
                org.springframework.web.bind.annotation.RestController.class));
        assertNull(controller.getAnnotation(
                org.springframework.context.annotation.Profile.class));
        assertNull(controller.getAnnotation(
                org.springframework.boot.autoconfigure.condition.ConditionalOnProperty.class));
    }

    @Test
    void anonymousRequestsAreDenied() throws Exception {
        mvc.perform(get(PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void administratorRoleAloneCannotAccessMemberMetadataCapabilities()
            throws Exception {
        mvc.perform(get(PATH).with(user("operator").roles("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void authenticatedMemberReceivesExplicitFailClosedCapabilityDocument()
            throws Exception {
        mvc.perform(get(PATH).with(user("member").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.schema").value("YOUTOPIA_METADATA_CAPABILITIES_V01"))
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.policy").value("POLICY_HOLD"))
                .andExpect(jsonPath("$.memberAuthenticationRequired").value(true))
                .andExpect(jsonPath("$.metadataReadAuthorized").value(false))
                .andExpect(jsonPath("$.commentReadAuthorized").value(false))
                .andExpect(jsonPath("$.consumerPublicationAuthorized").value(false))
                .andExpect(jsonPath("$.providerCredentialsAvailable").value(false))
                .andExpect(jsonPath("$.providerRequestsMade").value(0))
                .andExpect(content().string(not(containsString("thumbnailUrl"))))
                .andExpect(content().string(not(containsString("requestedId"))));
    }

    @Test
    void callerSuppliedApprovalClaimsNeverChangeAvailability()
            throws Exception {
        mvc.perform(get(PATH)
                        .with(user("member").roles("USER"))
                        .header("X-Metadata-Approved", "true")
                        .header("X-Api-Key", "SHOULD_NOT_ECHO")
                        .param("allowLive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.policy").value("POLICY_HOLD"))
                .andExpect(jsonPath("$.metadataReadAuthorized").value(false))
                .andExpect(jsonPath("$.providerRequestsMade").value(0))
                .andExpect(content().string(not(containsString("SHOULD_NOT_ECHO"))));
    }

    @Test
    void noWriteRouteIsRegistered() throws Exception {
        mvc.perform(post(PATH)
                        .with(user("member").roles("USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"allowLive\":true}"))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post(PATH).with(user("member").roles("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void policyConstantsCannotEnablePublication() {
        assertFalse(MetadataConsumerContract.LIVE_PROVIDER_CALLS_AUTHORIZED);
        assertFalse(MetadataConsumerContract.CONSUMER_PUBLICATION_AUTHORIZED);
        assertFalse(MetadataConsumerContract.REAL_CREDENTIAL_ACCESS_AUTHORIZED);
        assertEquals("POLICY_HOLD", MetadataConsumerContract.POLICY);
    }
}
