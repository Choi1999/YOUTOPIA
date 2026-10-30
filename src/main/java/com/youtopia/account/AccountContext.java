package com.youtopia.account;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

/** A stale browser tab must not read or update the next account's settings. */
public final class AccountContext {
    public static final String HEADER="X-Youtopia-Account";
    private AccountContext() {}
    public static SessionIdentity require(HttpServletRequest request) {
        var identity=AuthenticationController.identity(request);
        String expected=request.getHeader(HEADER);
        if(expected!=null){
            if(!expected.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
                throw new IllegalArgumentException("Invalid account context");
            if(!identity.id().toString().equalsIgnoreCase(expected))
                throw new AccountProblem(HttpStatus.CONFLICT,"ACCOUNT_CONTEXT_CHANGED","The active account changed. Refresh the session before continuing.");
        }
        return identity;
    }
}
