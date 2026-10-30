package com.youtopia.telemetry;

import com.youtopia.account.*;
import jakarta.servlet.http.HttpServletRequest;
import java.security.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
public class ProductEventService {
    private final EventPersistence repository;private final EventCatalog catalog;private final SearchReceipt receipts;
    private final AccountSecrets secrets;
    private final AccountRepository members;private final String environment;
    public ProductEventService(EventPersistence repository,EventCatalog catalog,SearchReceipt receipts,AccountSecrets secrets,AccountRepository members,@Value("${youtopia.environment:LOCAL}")String environment){
        if(!java.util.Set.of("LOCAL","STAGING","PRODUCTION").contains(environment))throw new IllegalArgumentException("Invalid environment");
        this.secrets=secrets;this.repository=repository;this.catalog=catalog;this.receipts=receipts;this.members=members;this.environment=environment;
    }
    // Hold the account share lock until the independent event transaction has committed.
    // Deletion/purge cannot overtake an event and then leave its member link resurrected.
    @Transactional(transactionManager="memberTx",timeout=10)
    public void record(ProductEvent event,HttpServletRequest request){
        var current=request.getSession(false);
        if(current!=null&&current.getAttribute(SessionIdentity.ATTRIBUTE) instanceof SessionIdentity identity&&identity.kind()==Account.Kind.ADMIN)
            throw new AccountProblem(org.springframework.http.HttpStatus.FORBIDDEN,"ADMIN_EVENTS_EXCLUDED","Administrator activity is excluded from visitor product events.");
        var value=catalog.validate(event);byte[] digest;
        try{digest=MessageDigest.getInstance("SHA-256").digest(catalog.canonical(value));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
        byte[] existing=repository.existing(event.clientEventId());if(existing!=null){equal(existing,digest);return;}
        UUID session=analyticsSession(request);
        if(event.eventType().equals("SEARCH_EXECUTED"))receipts.verify(session,event.clientEventId(),value,event.searchReceipt());
        UUID user=null;var auth=request.getSession(false).getAttribute(SessionIdentity.ATTRIBUTE);
        if(auth instanceof SessionIdentity identity && identity.kind()==Account.Kind.USER){
            user=members.lockedAnalyticsKey(identity);
        }
        if(!repository.insert(event,value,session,user,environment,digest))equal(repository.existing(event.clientEventId()),digest);
    }
    public UUID analyticsSession(HttpServletRequest request){
        var session=request.getSession(true);UUID id=(UUID)session.getAttribute("youtopia.analyticsSession");
        if(id==null){var b=java.nio.ByteBuffer.wrap(secrets.tag("analytics-session-v1",session.getId()));id=new UUID(b.getLong(),b.getLong());session.setAttribute("youtopia.analyticsSession",id);}return id;
    }
    private void equal(byte[] existing,byte[] supplied){if(existing==null||!MessageDigest.isEqual(existing,supplied))throw AccountProblem.conflict("EVENT_IDEMPOTENCY_CONFLICT");}
}
