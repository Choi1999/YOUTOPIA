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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;

/** UI-R04-R: offline-only, no secrets, no caller-created metadata, no real transport. */
@WebMvcTest(
        controllers = MetadataOfflineBoundaryController.class,
        properties = "youtopia.metadata.synthetic-boundary.enabled=true")
@ActiveProfiles("metadata-offline-test")
@Import({SecurityConfiguration.class, TraceFilter.class})
class MetadataOfflineBoundarySecurityTest {
    private static final String ROOT = "/api/v1/youtube/metadata";
    private static final String VIDEO_ID = "Ab0_-123xyz";
    private static final String CHANNEL_ID = "UC" + "A".repeat(22);

    @Autowired MockMvc mvc;

    @Test
    void routeRequiresBothTestProfileAndExplicitProperty() {
        var t = MetadataOfflineBoundaryController.class;
        var profile = t.getAnnotation(Profile.class);
        var condition = t.getAnnotation(ConditionalOnProperty.class);
        assertNotNull(profile);
        assertArrayEquals(new String[]{"metadata-offline-test"}, profile.value());
        assertNotNull(condition);
        assertArrayEquals(
                new String[]{"youtopia.metadata.synthetic-boundary.enabled"},
                condition.name());
        assertEquals("true", condition.havingValue());
        assertFalse(condition.matchIfMissing());
        assertNotNull(t.getAnnotation(
                org.springframework.web.bind.annotation.RestController.class));
        // No system property/env flag by itself can bypass the required profile.
    }

    @Test
    void anonymousCannotAccessMetadataEvenThoughReadOnly() throws Exception {
        mvc.perform(get(ROOT + "/videos/" + VIDEO_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("code").value("AUTHENTICATION_REQUIRED"));
        mvc.perform(get(ROOT + "/channels/" + CHANNEL_ID))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/handles/@somecreator"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mockUserOnlyGetsFixedPolicyHoldForAllMetadataKinds() throws Exception {
        for (String endpoint : new String[]{
                "/videos/" + VIDEO_ID, "/channels/" + CHANNEL_ID,
                "/handles/@somecreator"}) {
            mvc.perform(get(ROOT + endpoint).with(user("member").roles("USER")))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(content().contentTypeCompatibleWith(
                            MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("code").value("METADATA_UNAVAILABLE"))
                    .andExpect(jsonPath("status").value(503))
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(content().string(not(containsString("sourceAuthenticated"))))
                    .andExpect(content().string(not(containsString("thumbnailUrl"))));
        }
    }

    @Test
    void mockAdministratorWithoutMemberRoleCannotReadMetadata() throws Exception {
        mvc.perform(get(ROOT + "/videos/" + VIDEO_ID)
                        .with(user("operator").roles("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("code").value("ACCESS_DENIED"));
    }

    @Test
    void callerClaimedRolesOrCredentialsNeverEnableMetadataRead() throws Exception {
        mvc.perform(get(ROOT + "/videos/" + VIDEO_ID)
                        .header("X-Role", "ADMIN")
                        .header("X-Metadata-Approved", "true"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/videos/" + VIDEO_ID)
                        .with(user("member").roles("USER"))
                        .header("X-Role", "ADMIN")
                        .header("X-Cloud-Project", "do-not-trust")
                        .header("X-Api-Key", "DONT_ECHO_PROVIDER_KEY")
                        .param("apiKey", "DONT_ECHO_PROVIDER_KEY")
                        .param("allowRead", "true"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().string(not(containsString("DONT_ECHO_PROVIDER_KEY"))))
                .andExpect(content().string(not(containsString("do-not-trust"))))
                .andExpect(content().string(not(containsString(VIDEO_ID))));
    }

    @Test
    void postOrMutationNeverActivatesAReadBoundary() throws Exception {
        mvc.perform(post(ROOT + "/videos/" + VIDEO_ID)
                        .with(user("member").roles("USER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approved\":true,\"apiKey\":\"NOT_A_SECRET\"}"))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(post(ROOT + "/videos/" + VIDEO_ID)
                        .with(user("member").roles("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("code").value("CSRF_INVALID"));
    }

    @Test
    void noTransportOrCredentialsAreExposedByThisController() {
        var methods = MetadataOfflineBoundaryController.class.getDeclaredMethods();
        assertTrue(methods.length > 0);
        assertTrue(java.util.Arrays.stream(methods)
                .noneMatch(method -> method.getName().matches(
                        "(?i)(execute|send|fetch|authorize|enableLive|loadSecret|publish)")));
        assertTrue(java.util.Arrays.stream(
                MetadataOfflineBoundaryController.class.getDeclaredFields())
                .noneMatch(field -> java.net.http.HttpClient.class.isAssignableFrom(
                        field.getType()) || java.net.http.HttpRequest.class.isAssignableFrom(
                        field.getType())));
    }
}
