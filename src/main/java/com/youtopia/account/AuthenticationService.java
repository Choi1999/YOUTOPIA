package com.youtopia.account;

import jakarta.servlet.http.*;
import java.time.Clock;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.session.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AuthenticationService {
    private final AccountRepository repository;
    private final LifecycleStore store;
    private final com.youtopia.restore.DeletionJournal journal;
    private final PasswordEncoder passwords;
    private final PasswordPolicy policy;
    private final AccountBudget budget;
    private final LoginAbuseGuard abuse;
    private final SecurityAudit audit;
    private final AccountSecrets secrets;
    private final Clock clock;
    private final TransactionTemplate memberTx,adminTx;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final String dummyHash;
    public AuthenticationService(AccountRepository repository,LifecycleStore store,com.youtopia.restore.DeletionJournal journal,PasswordEncoder passwords,PasswordPolicy policy,
        AccountBudget budget,LoginAbuseGuard abuse,SecurityAudit audit,AccountSecrets secrets,Clock clock,
        @Qualifier("memberTx") PlatformTransactionManager memberTx,@Qualifier("adminTx") PlatformTransactionManager adminTx,
        FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.repository=repository;this.store=store;this.journal=journal;this.passwords=passwords;this.policy=policy;this.budget=budget;this.abuse=abuse;this.audit=audit;this.secrets=secrets;this.clock=clock;
        this.memberTx=new TransactionTemplate(memberTx);this.adminTx=new TransactionTemplate(adminTx);this.sessions=sessions;
        this.memberTx.setTimeout(10);this.adminTx.setTimeout(10);
        dummyHash=passwords.encode(UUID.randomUUID()+"-dummy-only");
    }
    public UUID signup(String email,String password) {
        email=normalize(email);budget.acquire("signup",email);policy.validate(password);
        String hash=passwords.encode(password);String login=email;
        try {return memberTx.execute(tx->repository.signup(login,hash));}
        catch(DataIntegrityViolationException e) {throw AccountProblem.conflict("USER_ALREADY_EXISTS");}
    }
    public SessionIdentity login(Account.Kind kind,String login,String password,HttpServletRequest request,HttpServletResponse response) {
        login=normalize(login);
        if(password==null || password.length()>512) throw AccountProblem.invalid();
        abuse.check(login,request.getRemoteAddr());
        HttpSession existing=request.getSession(false);
        if(existing!=null && existing.getAttribute(SessionIdentity.ATTRIBUTE)!=null)
            throw AccountProblem.conflict("LOGOUT_REQUIRED");
        String normalized=login;
        final UUID[] operation={null};
        try {
            UUID authenticationGeneration=journal.marker().generation();
            SessionIdentity identity=(kind==Account.Kind.USER?memberTx:adminTx).execute(tx->{
                Account account=repository.byLogin(kind,normalized,true);
                boolean matches=passwords.matches(password,account==null?dummyHash:account.passwordHash());
                if(account==null || !matches || !account.status().equals("ACTIVE")) throw AccountProblem.invalid();
                HttpSession session=request.getSession(true);request.changeSessionId();
                var now=clock.instant();long generation=0;
                if(kind==Account.Kind.ADMIN){
                    store.supersedeAdminLogins(account.id());operation[0]=UUID.randomUUID();
                    store.create(kind,account.id(),"ADMIN_LOGIN",UUID.randomUUID(),operation[0]);
                    generation=repository.adminGeneration(account,session.getId(),now,secrets);
                    store.versionCommitted(kind,account.id(),operation[0]);
                }
                var id=new SessionIdentity(kind,account.id(),account.authVersion(),now,now,generation);
                session.setMaxInactiveInterval(kind==Account.Kind.ADMIN?900:3600);
                session.setAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME,kind+":"+account.id());
                session.setAttribute(SessionIdentity.ATTRIBUTE,id);
                session.setAttribute("youtopia.authFinalized",false);
                session.setAttribute("youtopia.authGeneration",authenticationGeneration);
                var context=SecurityContextHolder.createEmptyContext();
                context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(id,null,List.of(new SimpleGrantedAuthority("ROLE_"+kind))));
                session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,context);
                SecurityContextHolder.setContext(context);
                new HttpSessionCsrfTokenRepository().saveToken(null,request,response);
                Session saved=sessions.findById(session.getId());
                if(saved==null || !id.equals(saved.getAttribute(SessionIdentity.ATTRIBUTE)) || !authenticationGeneration.equals(saved.getAttribute("youtopia.authGeneration")))
                    throw new IllegalStateException("Authenticated session could not be confirmed");
                return id;
            });
            audit.write(kind==Account.Kind.ADMIN?"ADMIN_LOGIN":"LOGIN_SUCCESS",kind.name(),identity.id(),"SUCCESS",operation[0]==null?UUID.randomUUID():operation[0]);
            if(operation[0]!=null)store.completed(kind,operation[0]);
            request.getSession(false).setAttribute("youtopia.authFinalized",true);
            Session confirmed=sessions.findById(request.getSession(false).getId());
            if(confirmed==null||!Boolean.TRUE.equals(confirmed.getAttribute("youtopia.authFinalized")))throw new IllegalStateException("Final authenticated session save is unconfirmed");
            return identity;
        } catch(AccountProblem e) {
            if(e.code.equals("INVALID_CREDENTIALS"))abuse.failed(normalized,request.getRemoteAddr());
            audit.write("LOGIN_FAILED","GUEST",null,"FAILURE",UUID.randomUUID());throw e;
        } catch(RuntimeException e) {
            if(operation[0]!=null)try{store.retry(Account.Kind.ADMIN,operation[0]);}catch(RuntimeException ignored){ /* response remains failure; no unconfirmed session is granted */ }
            SecurityContextHolder.clearContext();
            try {var session=request.getSession(false);if(session!=null && session.getAttribute(SessionIdentity.ATTRIBUTE)!=null)session.invalidate();}
            catch(RuntimeException ignored) { /* authoritative DB check prevents a partially committed admin guard from granting access */ }
            throw e;
        }
    }
    public void logout(HttpServletRequest request) {
        var session=request.getSession(false);
        if(session!=null) {
            SessionIdentity id=(SessionIdentity)session.getAttribute(SessionIdentity.ATTRIBUTE);
            session.invalidate();
            if(id!=null)audit.write("LOGOUT",id.kind().name(),id.id(),"SUCCESS",UUID.randomUUID());
        }
        SecurityContextHolder.clearContext();
    }
    public static String normalize(String login) {return login==null?"":login.strip().toLowerCase(Locale.ROOT);}
}
