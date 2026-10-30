package com.youtopia.telemetry;

import com.youtopia.account.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Issued only by successful server search execution; never accepts a client assertion as proof of success. */
@Component @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
public class SearchReceipt {
    private final AccountSecrets secrets;private final Clock clock;private final EventCatalog catalog;
    public SearchReceipt(AccountSecrets secrets,Clock clock,EventCatalog catalog){this.secrets=secrets;this.clock=clock;this.catalog=catalog;}
    public String issue(UUID analyticsSession,UUID clientEventId,EventCatalog.Validated successfulSearch){
        if(!successfulSearch.type().equals("SEARCH_EXECUTED"))throw new IllegalArgumentException("Wrong receipt type");
        long expiry=clock.instant().plusSeconds(300).getEpochSecond();
        return expiry+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(secrets.tag("search-receipt-v1",payload(analyticsSession,clientEventId,successfulSearch,expiry)));
    }
    public void verify(UUID session,UUID clientEventId,EventCatalog.Validated search,String token){
        try {
            String[] parts=token.split("\\.",-1);if(parts.length!=2)throw new IllegalArgumentException();long expiry=Long.parseLong(parts[0]);
            byte[] supplied=Base64.getUrlDecoder().decode(parts[1]);
            if(clock.instant().getEpochSecond()>=expiry||!MessageDigest.isEqual(supplied,secrets.tag("search-receipt-v1",payload(session,clientEventId,search,expiry))))throw new IllegalArgumentException();
        }catch(RuntimeException e){throw new AccountProblem(HttpStatus.BAD_REQUEST,"SEARCH_RECEIPT_REQUIRED","A successful server search receipt is required.");}
    }
    private String payload(UUID session,UUID eventId,EventCatalog.Validated value,long expiry){return session+":"+eventId+":"+expiry+":"+Base64.getEncoder().encodeToString(catalog.canonical(value));}
}
