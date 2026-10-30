package com.youtopia.privacy;

import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit bounded worker. No scheduler or web endpoint starts destructive maintenance implicitly. */
@Service @ConditionalOnProperty(name="youtopia.privacy.enabled",havingValue="true")
public class PrivacyPurgeService {
    private final com.youtopia.restore.DeletionJournal journal;
    private final String approval;
    private final PurgeRepository repository;private final TransactionTemplate transaction;private final String environment;private final int maximumAttempts;
    public record Result(int claimed,int purged,int failed) {}
    public PrivacyPurgeService(PurgeRepository repository,@Qualifier("privacyTx")PlatformTransactionManager manager,
        @Value("${youtopia.privacy.approval-ref:}")String approval,
        @Value("${youtopia.privacy.retention-plan:}")String plan,
        @Value("${youtopia.privacy.maximum-attempts:3}")int maximumAttempts,
        @Value("${youtopia.environment:LOCAL}")String environment,com.youtopia.restore.DeletionJournal journal){
        if(approval.isBlank()||!plan.equals("NO_LEGAL_EXCEPTIONS_APPROVED"))throw new IllegalStateException("An approved itemized retention plan is required; automatic all-data deletion is not a default");
        if(maximumAttempts<1||maximumAttempts>10||!java.util.Set.of("LOCAL","STAGING","PRODUCTION").contains(environment))throw new IllegalArgumentException("Invalid privacy worker configuration");
        this.journal=journal;this.approval=approval;this.repository=repository;transaction=new TransactionTemplate(manager);transaction.setTimeout(15);this.maximumAttempts=maximumAttempts;this.environment=environment;
    }
    public Result runOnce(){
        if(!journal.policyApproved(approval))throw new IllegalStateException("Itemized retention policy is not approved");
        var claim=transaction.execute(tx->repository.claim(maximumAttempts));if(claim==null)return new Result(0,0,0);
        try {
            boolean purged=Boolean.TRUE.equals(transaction.execute(tx->{journal.intent(claim.operation(),claim.user(),"PURGE_INTENT",null,null,claim.version());return repository.purge(claim,environment);}));
            if(purged)journal.commit(claim.operation(),claim.user(),"PURGED",null,null,claim.version());
            return new Result(1,purged?1:0,0);
        }
        catch(RuntimeException exception){transaction.executeWithoutResult(tx->repository.failed(claim));return new Result(1,0,1);}
    }
}
