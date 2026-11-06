package com.youtopia.youtube.metadata;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.youtopia.api.TraceFilter;
import com.youtopia.security.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** UI-R04-AF test-only HTTP, existing ROLE_USER / CSRF, no live calls. */
@WebMvcTest(
        controllers = MetadataConsumerOfflineController.class,
        properties = "youtopia.metadata.consumer-offline-test.enabled=true")
@ActiveProfiles("metadata-offline-test")
@Import({SecurityConfiguration.class, TraceFilter.class})
class MetadataConsumerOfflineSecurityTest {
    private static final String ROOT = "/api/v1/youtube/metadata/consumer-offline";
    private static final String VIDEO = "Ab0_-123xyz";
    private static final String CHANNEL = "UC" + "A".repeat(22);

    @Autowired MockMvc mvc;

    @Test
    void controllerIsTestProfileAndOptInPropertyOnly() {
        var clazz = MetadataConsumerOfflineController.class;
        assertArrayEquals(new String[]{"metadata-offline-test"},
                clazz.getAnnotation(Profile.class).value());
        var property = clazz.getAnnotation(ConditionalOnProperty.class);
        assertNotNull(property);
        assertArrayEquals(new String[]{"youtopia.metadata.consumer-offline-test.enabled"},
                property.name());
        assertEquals("true", property.havingValue());
        assertFalse(property.matchIfMissing());
    }

    @Test
    void anonymousAndAdminWithoutUserRoleCannotReadMetadata() throws Exception {
        mvc.perform(get(ROOT + "/videos/" + VIDEO))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("code").value("AUTHENTICATION_REQUIRED"));
        mvc.perform(get(ROOT + "/videos/" + VIDEO)
                        .with(user("operator").roles("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("code").value("ACCESS_DENIED"));
    }

    @Test
    void authorizedMemberReceivesOnlySanitizedPolicyHoldForEachKind() throws Exception {
        for (String path : new String[]{
                "/videos/" + VIDEO, "/channels/" + CHANNEL,
                "/handles/@samplecreator"}) {
            mvc.perform(get(ROOT + path).with(user("member").roles("USER")))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(content().contentTypeCompatibleWith(
                            MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("code").value("METADATA_POLICY_HOLD"))
                    .andExpect(jsonPath("status").value(503))
                    .andExpect(jsonPath("instance").value(ROOT))
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(content().string(not(containsString(VIDEO))))
                    .andExpect(content().string(not(containsString(CHANNEL))))
                    .andExpect(content().string(not(containsString("sourceAuthenticated"))))
                    .andExpect(content().string(not(containsString("thumbnailUrl"))));
        }
    }

    @Test
    void callerControlledApprovalOrCredentialsCannotUnlockMetadata() throws Exception {
        mvc.perform(get(ROOT + "/videos/" + VIDEO)
                        .with(user("member").roles("USER"))
                        .header("X-Role","ADMIN")
                        .header("X-Metadata-Approved","true")
                        .header("X-Api-Key","DONT_ECHO_REAL_CREDENTIAL")
                        .param("allowRead","true").param("apiKey","DONT_ECHO_REAL_CREDENTIAL"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("code").value("METADATA_POLICY_HOLD"))
                .andExpect(content().string(
                        not(containsString("DONT_ECHO_REAL_CREDENTIAL"))));
        mvc.perform(get(ROOT + "/videos/bad")
                        .with(user("member").roles("USER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("code").value("METADATA_TARGET_INVALID"))
                .andExpect(content().string(not(containsString("bad"))));
    }

    @Test
    void mutationsNeverActivateConsumerReads() throws Exception {
        mvc.perform(post(ROOT + "/videos/" + VIDEO)
                        .with(user("member").roles("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("code").value("CSRF_INVALID"));
        mvc.perform(post(ROOT + "/videos/" + VIDEO)
                        .with(user("member").roles("USER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"allowRead\":true}"))
                .andExpect(status().isMethodNotAllowed());
    }
}
