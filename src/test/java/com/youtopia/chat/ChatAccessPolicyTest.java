package com.youtopia.chat;

import com.youtopia.account.*;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.*;

class ChatAccessPolicyTest {
    private final Instant now=Instant.parse("2026-11-02T15:00:00Z");
    private MockHttpServletRequest request(Account.Kind kind,long age){var request=new MockHttpServletRequest();request.getSession().setAttribute(SessionIdentity.ATTRIBUTE,new SessionIdentity(kind,UUID.randomUUID(),1,now.minusSeconds(age),now.minusSeconds(age),1));return request;}
    @Test void adminRequiresExistingEnabledAuthenticationSubsystem(){
        var policy=new ChatAccessPolicy(false,Clock.fixed(now,ZoneOffset.UTC));assertThatThrownBy(()->policy.require(request(Account.Kind.ADMIN,0))).isInstanceOf(AccountProblem.class);
    }
    @Test void memberAndExpiredAdminCannotPassEvenWithAnIdentityAttribute(){
        var policy=new ChatAccessPolicy(true,Clock.fixed(now,ZoneOffset.UTC));assertThatThrownBy(()->policy.require(request(Account.Kind.USER,0))).isInstanceOf(AccountProblem.class);assertThatThrownBy(()->policy.require(request(Account.Kind.ADMIN,900))).isInstanceOf(AccountProblem.class);
    }
    @Test void currentAdminUsesStableAccountIdentityNotSessionId(){
        var policy=new ChatAccessPolicy(true,Clock.fixed(now,ZoneOffset.UTC));var request=request(Account.Kind.ADMIN,1);var id=policy.require(request);request.changeSessionId();assertThat(policy.require(request)).isEqualTo(id);
    }
}
