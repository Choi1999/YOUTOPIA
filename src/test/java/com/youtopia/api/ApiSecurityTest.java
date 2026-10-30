package com.youtopia.api;

import com.youtopia.security.CsrfController;
import com.youtopia.security.SecurityConfiguration;
import com.youtopia.steam.api.CcuController;
import com.youtopia.steam.repository.CcuRepository;
import com.youtopia.steam.service.CcuService;
import com.youtopia.steam.service.CcuRequestBudget;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.PermissionDeniedDataAccessException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({CcuController.class, CsrfController.class})
@Import({SecurityConfiguration.class, CcuService.class, TimeConfiguration.class, TraceFilter.class})
class ApiSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean CcuRepository repository;
    @MockitoBean CcuRequestBudget budget;

    @Test
    void guestCanReadApprovedPublicData() throws Exception {
        when(repository.findObservations(anyLong(), any(), any())).thenReturn(List.of());
        mvc.perform(get("/api/v1/steam/apps/570/ccu"))
            .andExpect(status().isOk()).andExpect(jsonPath("dataStatus").value("EMPTY"))
            .andExpect(jsonPath("latestObservedCcu.value").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"days=14", "days=abc", "days=", "days=7&days=30", "sort=playerCount", "page=-1"})
    void rejectsUnknownMalformedOrDuplicateParameters(String query) throws Exception {
        mvc.perform(get("/api/v1/steam/apps/570/ccu?" + query))
            .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("code").value("INVALID_REQUEST")).andExpect(jsonPath("traceId").isNotEmpty());
        verifyNoInteractions(repository);
    }

    @Test
    void badIdReturnsProblemRatherThanQuerying() throws Exception {
        mvc.perform(get("/api/v1/steam/apps/0/ccu"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @Test
    void sourcePermissionFailureIsNotDisguisedAsEmptyAndDoesNotLeakSql() throws Exception {
        when(repository.findObservations(anyLong(), any(), any()))
            .thenThrow(new PermissionDeniedDataAccessException("sensitive SQL detail", null));
        mvc.perform(get("/api/v1/steam/apps/570/ccu"))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("code").value("DATA_SOURCE_ERROR"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("sensitive"))));
    }

    @Test
    void protectedSurfaceRequiresAuthenticationAndDoesNotTrustClientTraceId() throws Exception {
        mvc.perform(get("/api/v1/admin/users").header("X-Request-ID", "attacker"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("AUTHENTICATION_REQUIRED"))
            .andExpect(jsonPath("traceId").value(org.hamcrest.Matchers.not("attacker")));
    }

    @Test
    void authenticatedUserCannotEnterAdminOrUnimplementedWriteRoutes() throws Exception {
        mvc.perform(get("/api/v1/admin/users").with(user("member").roles("USER")))
            .andExpect(status().isForbidden()).andExpect(jsonPath("code").value("ACCESS_DENIED"));
        mvc.perform(post("/api/v1/admin/users").with(user("member").roles("USER")).with(csrf()))
            .andExpect(status().isForbidden());
    }

    @Test
    void missingAndInvalidCsrfAreRejectedEvenWithUserAuthentication() throws Exception {
        mvc.perform(post("/api/v1/steam/apps/570/ccu").with(user("member")))
            .andExpect(status().isForbidden()).andExpect(jsonPath("code").value("CSRF_INVALID"));
        mvc.perform(post("/api/v1/steam/apps/570/ccu").with(user("member")).with(csrf().useInvalidToken()))
            .andExpect(status().isForbidden()).andExpect(jsonPath("code").value("CSRF_INVALID"));
    }

    @Test
    void csrfBootstrapIsExplicitAndNotCacheable() throws Exception {
        mvc.perform(get("/api/v1/auth/csrf"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("headerName").value("X-CSRF-TOKEN")).andExpect(jsonPath("token").isNotEmpty());
    }

    @Test
    void exhaustedBudgetReturns429WithRetryAfter() throws Exception {
        doThrow(new CcuRequestBudget.BudgetExceededException(30)).when(budget).acquire();
        mvc.perform(get("/api/v1/steam/apps/570/ccu"))
            .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "30"))
            .andExpect(jsonPath("code").value("RATE_LIMITED"));
        verifyNoInteractions(repository);
    }

    @Test
    void unavailableBudgetFailsClosedRatherThanRemovingLimit() throws Exception {
        doThrow(new CcuRequestBudget.BudgetUnavailableException()).when(budget).acquire();
        mvc.perform(get("/api/v1/steam/apps/570/ccu"))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("code").value("REQUEST_BUDGET_UNAVAILABLE"));
        verifyNoInteractions(repository);
    }
}
