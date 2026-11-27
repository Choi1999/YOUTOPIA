package com.youtopia.account;

import com.youtopia.api.*;
import com.youtopia.settings.SettingsController;
import com.youtopia.settings.SettingsService;
import com.youtopia.telemetry.*;
import java.time.*;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Handler binding/validation only; production realm/CSRF filters remain covered separately. */
class NoQueryMutationContractTest {
    final AuthenticationService auth=mock(AuthenticationService.class);
    final AccountLifecycleService lifecycle=mock(AccountLifecycleService.class);
    final ProductEventService events=mock(ProductEventService.class);
    final SettingsService settings=mock(SettingsService.class);
    final Instant now=Instant.parse("2026-11-27T00:00:00Z");
    MockMvc mvc;
    @BeforeEach void setup(){
        mvc=MockMvcBuilders.standaloneSetup(new AuthenticationController(auth,Clock.fixed(now,ZoneOffset.UTC)),
            new AccountLifecycleController(lifecycle),new ProductEventController(events),new SettingsController(settings))
            .setControllerAdvice(new ApiExceptionHandler()).addFilters(new TraceFilter())
            .setMessageConverters(new MappingJackson2HttpMessageConverter()).build();
    }
    static Stream<Arguments> writes(){
        String id="00000000-0000-0000-0000-000000000001";
        String login="{\"login\":\"synthetic@example.invalid\",\"password\":\"synthetic-password\"}";
        String change="{\"requestKey\":\""+id+"\",\"currentPassword\":\"synthetic-current\",\"newPassword\":\"synthetic-next\"}";
        String recover="{\"requestKey\":\""+id+"\",\"email\":\"synthetic@example.invalid\",\"recoveryCode\":\"synthetic-code\",\"newPassword\":\"synthetic-next\"}";
        return Stream.of(
            Arguments.of("/api/v1/auth/signup","{\"email\":\"synthetic@example.invalid\",\"password\":\"synthetic-password\"}"),
            Arguments.of("/api/v1/auth/login",login),Arguments.of("/api/v1/admin/auth/login",login),
            Arguments.of("/api/v1/auth/password",change),Arguments.of("/api/v1/admin/auth/password",change),
            Arguments.of("/api/v1/auth/recovery-codes","{\"requestKey\":\""+id+"\",\"currentPassword\":\"synthetic-current\"}"),
            Arguments.of("/api/v1/me/deletion","{\"requestKey\":\""+id+"\",\"currentPassword\":\"synthetic-current\",\"confirmed\":true}"),
            Arguments.of("/api/v1/auth/password-reset",recover),Arguments.of("/api/v1/auth/account-recovery",recover),
            Arguments.of("/api/v1/auth/logout",""),Arguments.of("/api/v1/auth/activity",""),
            Arguments.of("/api/v1/events","{\"clientEventId\":\""+id+"\",\"eventType\":\"PAGE_VIEW\",\"actionKey\":\"route.view\",\"properties\":{\"routeKey\":\"dashboard\"}}"));
    }
    @ParameterizedTest @MethodSource("writes")
    void unknownAndRepeatedQueryNeverReachMutationServices(String path,String body)throws Exception {
        for(String[] values:new String[][]{{"one"},{"one","two"}}){
            mvc.perform(post(path).param("unexpected",values).contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        }
        verifyNoInteractions(auth,lifecycle,events);
    }
    @Test void readHandlersRejectUnknownQueryAndActivityDoesNotExtendTheSession()throws Exception {
        for(String path:new String[]{"/api/v1/auth/me","/api/v1/admin/auth/me","/api/v1/me/deletion-policy"})
            mvc.perform(get(path).param("unexpected","one")).andExpect(status().isBadRequest());
        var identity=new SessionIdentity(Account.Kind.USER,UUID.randomUUID(),1,now.minusSeconds(60),now.minusSeconds(30),0);
        var session=new MockHttpSession();session.setAttribute(SessionIdentity.ATTRIBUTE,identity);
        mvc.perform(post("/api/v1/auth/activity").session(session).param("unexpected","one")).andExpect(status().isBadRequest());
        assertThat(session.getAttribute(SessionIdentity.ATTRIBUTE)).isSameAs(identity);
        verifyNoInteractions(auth,lifecycle,events);
    }
    @Test void unexpectedSettingsQueryDoesNotReachPersistence() throws Exception {
        mvc.perform(patch("/api/v1/me/settings").param("theme","dark","light").contentType("application/json")
                .content("{\"expectedVersion\":0,\"changes\":{\"theme\":\"dark\"}}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        verifyNoInteractions(settings);
    }
    @Test void validQueryFreeSignupAndEventStillReachTheirServices()throws Exception {
        when(auth.signup(anyString(),anyString())).thenReturn(UUID.randomUUID());
        mvc.perform(post("/api/v1/auth/signup").contentType("application/json")
            .content("{\"email\":\"synthetic@example.invalid\",\"password\":\"synthetic-password\"}"))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/events").contentType("application/json")
            .content("{\"clientEventId\":\"00000000-0000-0000-0000-000000000001\",\"eventType\":\"PAGE_VIEW\",\"actionKey\":\"route.view\",\"properties\":{\"routeKey\":\"dashboard\"}}"))
            .andExpect(status().isNoContent());
        verify(auth).signup("synthetic@example.invalid","synthetic-password");verify(events).record(any(),any());
    }
}
