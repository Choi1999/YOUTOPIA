package com.youtopia.account;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountRepository {
    private final JdbcTemplate member;
    private final JdbcTemplate admin;
    public AccountRepository(@Qualifier("memberJdbc") JdbcTemplate member,@Qualifier("adminJdbc") JdbcTemplate admin) {this.member=member;this.admin=admin;}
    public Account byLogin(Account.Kind kind,String login,boolean lock) {
        String sql=kind==Account.Kind.USER
            ? "SELECT user_id AS id,login_email AS login,password_hash,account_status,auth_version,row_version FROM auth.service_user JOIN auth.user_credential USING(user_id) WHERE login_email=?"
            : "SELECT admin_id AS id,admin_login_name AS login,password_hash,account_status,auth_version,row_version FROM auth.admin_account WHERE admin_login_name=?";
        var result=jdbc(kind).query(sql+(lock?(kind==Account.Kind.USER?" FOR UPDATE OF service_user":" FOR UPDATE"):""),(r,n)->new Account(r.getObject("id",UUID.class),r.getString("login"),r.getString("password_hash"),r.getString("account_status"),r.getLong("auth_version"),r.getLong("row_version")),login);
        return result.isEmpty()?null:result.getFirst();
    }
    public boolean current(SessionIdentity identity,String sessionId,AccountSecrets secrets) {
        if(identity.kind()==Account.Kind.USER)
            return Boolean.TRUE.equals(member.queryForObject("SELECT EXISTS(SELECT FROM auth.service_user WHERE user_id=? AND account_status='ACTIVE' AND auth_version=?)",Boolean.class,identity.id(),identity.authVersion()));
        return Boolean.TRUE.equals(admin.queryForObject("SELECT EXISTS(SELECT FROM auth.admin_account a JOIN auth.admin_active_session s USING(admin_id) WHERE a.admin_id=? AND account_status='ACTIVE' AND auth_version=? AND session_generation=? AND session_tag_hmac=? AND absolute_expires_at>current_timestamp AND NOT EXISTS(SELECT FROM auth.security_operation o WHERE o.account_kind='ADMIN' AND o.principal_id=a.admin_id AND o.operation_type='ADMIN_LOGIN' AND o.operation_state<>'COMPLETED'))",Boolean.class,identity.id(),identity.authVersion(),identity.generation(),secrets.tag("admin-session-v1",sessionId)));
    }
    public UUID signup(String email,String hash) {
        UUID id=member.queryForObject("INSERT INTO auth.service_user(login_email) VALUES(?) RETURNING user_id",UUID.class,email);
        member.update("INSERT INTO auth.user_credential(user_id,password_hash) VALUES(?,?)",id,hash);
        member.update("INSERT INTO auth.analytics_identity(user_id) VALUES(?)",id);
        return id;
    }
    public long adminGeneration(Account account,String sessionId,Instant issued,AccountSecrets secrets) {
        return admin.queryForObject("INSERT INTO auth.admin_active_session(admin_id,session_tag_hmac,activated_at,absolute_expires_at) VALUES(?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET session_tag_hmac=EXCLUDED.session_tag_hmac,session_generation=auth.admin_active_session.session_generation+1,activated_at=EXCLUDED.activated_at,absolute_expires_at=EXCLUDED.absolute_expires_at RETURNING session_generation",Long.class,account.id(),secrets.tag("admin-session-v1",sessionId),Timestamp.from(issued),Timestamp.from(issued.plusSeconds(28800)));
    }
    public AccountProfile profile(UUID id,long version){
        var rows=member.query("SELECT user_id,login_email,account_status,created_at FROM auth.service_user WHERE user_id=? AND account_status='ACTIVE' AND auth_version=?",(r,n)->new AccountProfile(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getTimestamp(4).toInstant()),id,version);
        return rows.isEmpty()?null:rows.getFirst();
    }
    public UUID lockedAnalyticsKey(SessionIdentity identity){
        var keys=member.queryForList("SELECT a.analytics_user_key FROM auth.service_user u JOIN auth.analytics_identity a USING(user_id) WHERE u.user_id=? AND u.account_status='ACTIVE' AND u.auth_version=? AND a.revoked_at IS NULL FOR SHARE OF u",UUID.class,identity.id(),identity.authVersion());
        if(keys.isEmpty())throw AccountProblem.invalid();return keys.getFirst();
    }
    public JdbcTemplate jdbc(Account.Kind kind) {return kind==Account.Kind.USER?member:admin;}
}
