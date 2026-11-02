package com.youtopia.chat;

import com.youtopia.account.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;

/** Temporary demo gate, independent of the general-purpose assistant implementation. */
@Component
public class ChatAccessPolicy {
    private final boolean accountsEnabled;private final java.time.Clock clock;
    public ChatAccessPolicy(@org.springframework.beans.factory.annotation.Value("${youtopia.accounts.enabled:false}")boolean accountsEnabled,java.time.Clock clock){this.accountsEnabled=accountsEnabled;this.clock=clock;}
    public java.util.UUID require(HttpServletRequest request){
        if(!accountsEnabled)throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"AUTH_STATE_UNAVAILABLE","인증 상태를 확인할 수 없습니다.");
        var identity=AccountContext.require(request);
        if(identity.expired(clock.instant()))throw AccountProblem.invalid();
        if(identity.kind()!=Account.Kind.ADMIN)throw new AccountProblem(HttpStatus.FORBIDDEN,"CHAT_ACCESS_DENIED","현재 시연은 관리자 로그인 상태에서만 이용할 수 있습니다.");
        return identity.id();
    }
}
