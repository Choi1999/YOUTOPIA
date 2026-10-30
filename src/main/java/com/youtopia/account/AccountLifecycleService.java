package com.youtopia.account;

import com.youtopia.account.LifecycleStore.Operation;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountLifecycleService {
    private final AccountRepository repository;
    private final LifecycleStore store;
    private final boolean deletionEnabled;
    private final org.springframework.beans.factory.ObjectProvider<com.youtopia.restore.DeletionJournal> journals;
    private final String policyReference;
    private final PasswordEncoder passwords;
    private final PasswordPolicy policy;
    private final AccountSecrets secrets;
    private final AccountBudget budget;
    private final SecurityAudit audit;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final TransactionTemplate memberTx,adminTx;
    public record Outcome(UUID operationId,Instant recoverUntil,boolean replay) {}
    public record Codes(List<String> codes) {}

    public AccountLifecycleService(AccountRepository repository,LifecycleStore store,
        org.springframework.beans.factory.ObjectProvider<com.youtopia.restore.DeletionJournal> journals,
        @org.springframework.beans.factory.annotation.Value("${youtopia.privacy.approval-ref:}")String policyReference,PasswordEncoder passwords,PasswordPolicy policy,AccountSecrets secrets,
        @org.springframework.beans.factory.annotation.Value("${youtopia.accounts.deletion-enabled:false}") boolean deletionEnabled,AccountBudget budget,SecurityAudit audit,FindByIndexNameSessionRepository<? extends Session> sessions,
        @Qualifier("memberTx") PlatformTransactionManager memberTx,@Qualifier("adminTx") PlatformTransactionManager adminTx) {
        this.repository=repository;this.store=store;this.deletionEnabled=deletionEnabled;this.journals=journals;this.policyReference=policyReference;this.passwords=passwords;this.policy=policy;this.secrets=secrets;this.budget=budget;this.audit=audit;this.sessions=sessions;
        this.memberTx=new TransactionTemplate(memberTx);this.adminTx=new TransactionTemplate(adminTx);this.memberTx.setTimeout(10);this.adminTx.setTimeout(10);
    }
    public Outcome changePassword(SessionIdentity identity,UUID key,String current,String next) {
        policy.validate(next);budget.acquire("password",identity.kind()+":"+identity.id());
        UUID operation=secrets.operationId(identity.id(),key,"PASSWORD_CHANGE",payload(current,next));
        var result=tx(identity.kind()).execute(status->{
            Account account=lock(identity);
            Operation existing=store.find(identity.kind(),identity.id(),"PASSWORD_CHANGE",key);
            if(existing!=null)return replay(existing,operation,false);
            verify(account,current);
            Operation op=store.create(identity.kind(),account.id(),"PASSWORD_CHANGE",key,operation);
            String hash=passwords.encode(next);
            store.password(identity.kind(),account.id(),hash);
            store.versionCommitted(identity.kind(),account.id(),operation);
            return new Outcome(op.id(),null,false);
        });
        finish(identity.kind(),identity.id(),result,"PASSWORD_CHANGED");return result;
    }
    public Codes issueCodes(SessionIdentity identity,UUID batch,String currentPassword) {
        if(identity.kind()!=Account.Kind.USER)throw AccountProblem.invalid();
        budget.acquire("recovery-codes",identity.id().toString());
        Codes result=memberTx.execute(status->{
            Account account=lock(identity);verify(account,currentPassword);
            if(store.codesExist(account.id(),batch))
                throw AccountProblem.conflict("RECOVERY_CODES_ALREADY_ISSUED");
            store.revokeCodes(account.id());List<String> codes=new ArrayList<>();
            for(int i=0;i<8;i++) {
                String code=secrets.recoveryCode();codes.add(code);
                store.insertCode(account.id(),batch,secrets.recoveryHash(account.id(),code));
            }
            return new Codes(List.copyOf(codes));
        });
        // Only report issuance after its DB commit and an append-only audit. A lost response never replays plaintext.
        audit.write("RECOVERY_CODES_ISSUED","USER",identity.id(),"SUCCESS",batch);
        return result;
    }
    public Outcome requestDeletion(SessionIdentity identity,UUID key,String currentPassword,boolean confirmed) {
        if(!deletionEnabled||journals.getIfAvailable()==null||!journals.getObject().policyApproved(policyReference))throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"DELETION_POLICY_PENDING","Account deletion requires approved retention policy configuration.");
        if(identity.kind()!=Account.Kind.USER)throw AccountProblem.invalid();
        if(!confirmed)throw new AccountProblem(HttpStatus.BAD_REQUEST,"DELETION_CONFIRMATION_REQUIRED","Explicit deletion confirmation is required.");
        budget.acquire("deletion",identity.id().toString());
        UUID operation=secrets.operationId(identity.id(),key,"DELETE_REQUEST",payload(currentPassword,Boolean.toString(confirmed)));
        var result=memberTx.execute(status->{
            Account account=lock(identity);Operation existing=store.find(Account.Kind.USER,account.id(),"DELETE_REQUEST",key);
            if(existing!=null)return replay(existing,operation,true);
            verify(account,currentPassword);Operation op=store.create(Account.Kind.USER,account.id(),"DELETE_REQUEST",key,operation);
            journal().intent(operation,account.id(),"DELETE_INTENT",op.createdAt(),op.createdAt().plusSeconds(72*3600),account.authVersion()+1);
            store.deleteRequest(account.id());
            store.versionCommitted(Account.Kind.USER,account.id(),operation);
            return new Outcome(operation,op.createdAt().plusSeconds(72*3600),false);
        });
        finish(Account.Kind.USER,identity.id(),result,"DELETION_REQUESTED");return result;
    }
    public Outcome recover(String email,UUID key,String code,String next,boolean deleted) {
        policy.validate(next);String normalized=AuthenticationService.normalize(email);budget.acquire("recover",normalized);
        String action=deleted?"ACCOUNT_RECOVERY":"PASSWORD_RESET";
        if(deleted)journal();
        final UUID[] user={null};
        var result=memberTx.execute(status->{
            Account account=repository.byLogin(Account.Kind.USER,normalized,true);
            if(account==null)throw AccountProblem.invalid();user[0]=account.id();
            UUID id=secrets.operationId(account.id(),key,action,payload(code,next));
            Operation previous=store.find(Account.Kind.USER,account.id(),action,key);
            if(previous!=null)return replay(previous,id,false);
            if(!account.status().equals(deleted?"PENDING_DELETION":"ACTIVE"))throw AccountProblem.invalid();
            if(deleted && !store.recoverable(account.id()))throw AccountProblem.invalid();
            byte[] hash=secrets.recoveryHash(account.id(),code);
            if(!store.consumeCode(account.id(),hash))throw AccountProblem.invalid();
            Operation op=store.create(Account.Kind.USER,account.id(),action,key,id);
            if(deleted)journal().intent(id,account.id(),"RECOVERY_INTENT",null,null,account.authVersion()+2);
            store.revokeCodes(account.id());
            store.password(Account.Kind.USER,account.id(),passwords.encode(next));
            if(deleted)store.restore(account.id());
            store.versionCommitted(Account.Kind.USER,account.id(),id);
            return new Outcome(op.id(),null,false);
        });
        finish(Account.Kind.USER,user[0],result,deleted?"ACCOUNT_RECOVERED":"PASSWORD_RESET");
        return result;
    }
    public record Reconciliation(int attempted,int completed,int failed) {}
    public Reconciliation reconcilePending() {
        int attempted=0,completed=0,failed=0;
        for(var kind:Account.Kind.values())for(var pending:store.pending(kind)) {
            attempted++;
            String event=switch(pending.type()) {
                case "PASSWORD_CHANGE" -> "PASSWORD_CHANGED";
                case "PASSWORD_RESET" -> "PASSWORD_RESET";
                case "DELETE_REQUEST" -> "DELETION_REQUESTED";
                case "ACCOUNT_RECOVERY" -> "ACCOUNT_RECOVERED";
                default -> "SECURITY_OPERATION_RETRY";
            };
            try {
                if(pending.type().equals("ADMIN_LOGIN")){
                    adminTx.executeWithoutResult(tx->{
                        store.lockAdmin(pending.userId());
                        if(store.state(kind,pending.operationId()).equals("COMPLETED"))return;
                        sessions.findByPrincipalName(kind+":"+pending.userId()).keySet().forEach(sessions::deleteById);
                        store.cancelAdminGuard(pending.userId());
                        audit.write("SECURITY_OPERATION_RETRY","ADMIN",pending.userId(),"DENIED",pending.operationId());
                        store.completed(kind,pending.operationId());
                    });
                } else finish(kind,pending.userId(),new Outcome(pending.operationId(),null,true),event);
                completed++;
            }
            catch(AccountProblem exception){failed++;}
        }
        return new Reconciliation(attempted,completed,failed);
    }
    private Account lock(SessionIdentity id) {
        Account account=store.lock(id);
        if(account==null || !account.status().equals("ACTIVE") || account.authVersion()!=id.authVersion())throw AccountProblem.invalid();
        return account;
    }
    private void verify(Account account,String password) {
        if(password==null || password.length()>512 || !passwords.matches(password,account.passwordHash()))throw AccountProblem.invalid();
    }
    private Outcome replay(Operation existing,UUID expected,boolean deletion) {
        if(!existing.id().equals(expected))throw AccountProblem.conflict("IDEMPOTENCY_CONFLICT");
        return new Outcome(existing.id(),deletion?existing.createdAt().plusSeconds(72*3600):null,true);
    }
    private void finish(Account.Kind kind,UUID user,Outcome outcome,String event) {
        String state=store.state(kind,outcome.operationId());
        if(state.equals("COMPLETED"))return;
        try {
            long committed=store.committedVersion(kind,outcome.operationId());
            if(event.equals("DELETION_REQUESTED")){
                var op=store.operation(kind,outcome.operationId());journal().commit(op.id(),user,"DELETION_REQUESTED",op.createdAt(),op.createdAt().plusSeconds(72*3600),committed);
            }else if(event.equals("ACCOUNT_RECOVERED"))journal().commit(outcome.operationId(),user,"ACCOUNT_RECOVERED",null,null,committed);
            sessions.findByPrincipalName(kind+":"+user).forEach((id,session)->{
                SessionIdentity identity=session.getAttribute(SessionIdentity.ATTRIBUTE);
                if(identity==null || identity.authVersion()<committed)sessions.deleteById(id);
            });
            audit.write(event,kind.name(),user,"SUCCESS",outcome.operationId());
            store.completed(kind,outcome.operationId());
        } catch(RuntimeException e) {
            store.retry(kind,outcome.operationId());
            throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"SECURITY_OPERATION_PENDING","The security change requires reconciliation; previous credentials remain revoked.");
        }
    }
    private com.youtopia.restore.DeletionJournal journal(){var journal=journals.getIfAvailable();if(journal==null)throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"DELETION_JOURNAL_REQUIRED","Independent deletion control is not configured.");return journal;}
    private TransactionTemplate tx(Account.Kind kind) {return kind==Account.Kind.USER?memberTx:adminTx;}
    private String payload(String... values) {
        // Length-prefixing avoids ambiguities, including passwords containing delimiters.
        var s=new StringBuilder();for(String value:values){s.append(value==null?-1:value.length()).append(':');if(value!=null)s.append(value);}return s.toString();
    }
}
