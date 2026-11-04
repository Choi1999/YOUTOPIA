package com.youtopia.account;

import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthenticationIdentityTest {
    @Test void existingIdentityResponseUsesVerifiedSessionVersionsWithoutCredentials(){
        var service=mock(AuthenticationService.class);var now=Instant.parse("2026-11-04T00:00:00Z");
        var controller=new AuthenticationController(service,Clock.fixed(now,ZoneOffset.UTC));
        var request=new MockHttpServletRequest();var response=new MockHttpServletResponse();
        var identity=new SessionIdentity(Account.Kind.ADMIN,UUID.randomUUID(),9007199254740993L,now,now,42);
        when(service.login(eq(Account.Kind.ADMIN),anyString(),anyString(),eq(request),eq(response))).thenReturn(identity);
        var login=controller.adminLogin(new AuthenticationController.Login("synthetic-operator","synthetic-password"),request,response);
        request.getSession().setAttribute(SessionIdentity.ATTRIBUTE,identity);
        assertThat(controller.me(request,response)).isEqualTo(login);
        assertThat(login.authVersion()).isEqualTo("9007199254740993");assertThat(login.adminGeneration()).isEqualTo("42");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
        request.getSession().setAttribute(SessionIdentity.ATTRIBUTE,new SessionIdentity(Account.Kind.USER,UUID.randomUUID(),3,now,now,0));
        assertThat(controller.me(request,response).adminGeneration()).isNull();
    }
}
