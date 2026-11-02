package com.youtopia.chat;

import com.youtopia.account.AccountProblem;
import org.springframework.http.HttpStatus;

public final class ChatFailure extends RuntimeException {
    public static final String MAINTENANCE="현재 점검 중입니다. 잠시 후 다시 이용해 주세요.";
    public final String category;
    public ChatFailure(String category){super(MAINTENANCE);this.category=category;}
    public boolean ambiguous(){return java.util.Set.of("PROVIDER_TIMEOUT","PROVIDER_TRANSPORT","PROVIDER_INTERRUPTED").contains(category);}
    public static AccountProblem limit(String code){return new AccountProblem(HttpStatus.TOO_MANY_REQUESTS,"CHAT_"+code,"시연 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",code.equals("ADMIN_RATE_LIMIT")?Long.valueOf(60):code.equals("BUSY")?Long.valueOf(1):null);}
}
