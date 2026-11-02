package com.youtopia.youtube.admin;

import com.youtopia.api.TraceFilter;
import com.youtopia.security.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = G45AdminDeletionBoundaryController.class,
    properties = "youtopia.g45.synthetic-admin-boundary.enabled=true")
@ActiveProfiles("g45-synthetic-test")
@Import({SecurityConfiguration.class, TraceFilter.class})
class G45AdminDeletionBoundarySecurityTest {
    private static final String ROOT = "/api/v1/admin/youtube-data/deletions";
    @Autowired MockMvc mvc;

    @Test void profileAndFlagMustBothBeExplicitlyEnabled() {
        var t=G45AdminDeletionBoundaryController.class;
        var profile=t.getAnnotation(org.springframework.context.annotation.Profile.class);
        var condition=t.getAnnotation(org.springframework.boot.autoconfigure.condition.ConditionalOnProperty.class);
        assertNotNull(profile);
        assertArrayEquals(new String[]{"g45-synthetic-test"},profile.value());
        assertNotNull(condition);
        assertArrayEquals(new String[]{"youtopia.g45.synthetic-admin-boundary.enabled"},condition.name());
        assertEquals("true",condition.havingValue());
        assertFalse(condition.matchIfMissing());
    }
    @Test void anonymousCannotInspectAdminCapabilities() throws Exception {
        mvc.perform(get(ROOT+"/capabilities"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("code").value("AUTHENTICATION_REQUIRED"));
    }
    @Test void memberCannotInspectCapabilities() throws Exception {
        mvc.perform(get(ROOT+"/capabilities").with(user("member").roles("USER")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("code").value("ACCESS_DENIED"));
    }
    @Test void mockAdminCanReadNonDestructiveCapabilities() throws Exception {
        mvc.perform(get(ROOT+"/capabilities").with(user("operator").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("mode").value("SYNTHETIC_TEST_ONLY"))
            .andExpect(jsonPath("realDeletionImplemented").value(false))
            .andExpect(jsonPath("actualRecordsDeleted").value(0))
            .andExpect(jsonPath("sourceProviderRequests").value(0))
            .andExpect(jsonPath("policyState").value("POLICY_HOLD"));
    }
    @Test void postWithoutCsrfFailsEvenForMockAdmin() throws Exception {
        mvc.perform(post(ROOT).with(user("operator").roles("ADMIN")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("code").value("CSRF_INVALID"));
        mvc.perform(post(ROOT+"/preview").with(user("operator").roles("ADMIN")))
            .andExpect(status().isForbidden());
    }
    @Test void postWithInvalidCsrfFailsEvenForMockAdmin() throws Exception {
        mvc.perform(post(ROOT).with(user("operator").roles("ADMIN")).with(csrf().useInvalidToken()))
            .andExpect(status().isForbidden());
    }
    @Test void memberRoleSpoofingViaHeaderCannotAccessDelete() throws Exception {
        mvc.perform(post(ROOT).with(user("member").roles("USER")).with(csrf())
                .header("X-Role", "ADMIN").header("X-Tenant", "tenant-alpha"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("code").value("ACCESS_DENIED"));
    }
    @Test void mockAdminStillCannotPreviewOrDeleteRealData() throws Exception {
        mvc.perform(post(ROOT+"/preview").with(user("operator").roles("ADMIN")).with(csrf()))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("code").value("G45_REAL_PURGE_POLICY_HOLD"));
        mvc.perform(post(ROOT).with(user("operator").roles("ADMIN")).with(csrf()))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("code").value("G45_REAL_PURGE_POLICY_HOLD"));
    }
    @Test void errorBodyDoesNotLeakUserTargetsOrProviderSecrets() throws Exception {
        mvc.perform(post(ROOT).with(user("operator").roles("ADMIN")).with(csrf())
                .header("X-Request-ID", "attacker-secret")
                .contentType("application/json")
                .content("{\"videoId\":\"Ab0_-123xyz\",\"deleteAllTenants\":true}"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(content().string(not(containsString("Ab0_-123xyz"))))
            .andExpect(content().string(not(containsString("attacker-secret"))));
    }
}
