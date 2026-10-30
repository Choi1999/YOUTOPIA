package com.youtopia.privacy;

import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.privacy.enabled",havingValue="true")
public class PurgeRepository {
    private final JdbcTemplate jdbc;
    public record Claim(UUID user,UUID request,long version,int attempt) {
        public UUID operation(){return UUID.nameUUIDFromBytes((request+":"+attempt).getBytes(java.nio.charset.StandardCharsets.US_ASCII));}
    }
    public PurgeRepository(@Qualifier("privacyJdbc")JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Claim claim(int maximumAttempts){
        var rows=jdbc.query("""
            SELECT u.user_id,d.request_id,u.auth_version,d.purge_attempts FROM auth.service_user u JOIN auth.deletion_request d USING(user_id)
            WHERE u.account_status IN ('PENDING_DELETION','PURGING') AND d.recover_until_at<=current_timestamp
              AND d.purge_attempts<? AND (d.request_state IN ('PENDING','PURGE_FAILED')
                OR (d.request_state='PURGE_IN_PROGRESS' AND d.updated_at<current_timestamp-interval '5 minutes'))
            ORDER BY d.recover_until_at,d.request_id LIMIT 1 FOR UPDATE OF u SKIP LOCKED
            """,(r,n)->new Claim(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getLong(3)+1,r.getInt(4)+1),maximumAttempts);
        if(rows.isEmpty())return null;Claim claim=rows.getFirst();
        jdbc.update("UPDATE auth.service_user SET account_status='PURGING',auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp WHERE user_id=?",claim.user());
        jdbc.update("UPDATE auth.deletion_request SET request_state='PURGE_IN_PROGRESS',purge_attempts=purge_attempts+1,last_error_code=NULL,updated_at=current_timestamp WHERE request_id=?",claim.request());return claim;
    }
    public boolean purge(Claim claim,String environment){
        var users=jdbc.queryForList("SELECT user_id FROM auth.service_user WHERE user_id=? AND account_status='PURGING' FOR UPDATE",UUID.class,claim.user());
        if(users.isEmpty())return false;
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT FROM auth.deletion_request WHERE request_id=? AND user_id=? AND request_state='PURGE_IN_PROGRESS' AND recover_until_at<=current_timestamp)",Boolean.class,claim.request(),claim.user())))throw new IllegalStateException("Invalid purge claim");
        jdbc.update("DELETE FROM telemetry.product_event WHERE analytics_user_key IN (SELECT analytics_user_key FROM auth.analytics_identity WHERE user_id=?)",claim.user());
        jdbc.update("UPDATE security.security_audit_event SET actor_id=CASE WHEN actor_kind='USER' AND actor_id=? THEN NULL ELSE actor_id END,subject_user_id=CASE WHEN subject_user_id=? THEN NULL ELSE subject_user_id END WHERE (actor_kind='USER' AND actor_id=?) OR subject_user_id=?",claim.user(),claim.user(),claim.user(),claim.user());
        jdbc.update("UPDATE auth.security_operation SET principal_id=NULL WHERE account_kind='USER' AND principal_id=?",claim.user());
        jdbc.update("UPDATE auth.deletion_request SET request_state='PURGED',closed_at=current_timestamp,updated_at=current_timestamp WHERE request_id=?",claim.request());
        if(jdbc.update("DELETE FROM auth.service_user WHERE user_id=? AND account_status='PURGING'",claim.user())!=1)throw new IllegalStateException("Purge was not confirmed");
        jdbc.update("INSERT INTO security.security_audit_event(audit_event_id,event_type,actor_kind,result_code,correlation_id,environment) VALUES(?,'ACCOUNT_PURGED','SYSTEM','SUCCESS',?,?) ON CONFLICT DO NOTHING",claim.request(),claim.request(),environment);
        return true;
    }
    public void failed(Claim claim){jdbc.update("UPDATE auth.deletion_request SET request_state='PURGE_FAILED',last_error_code='PURGE_FAILED',updated_at=current_timestamp WHERE request_id=? AND request_state='PURGE_IN_PROGRESS'",claim.request());}
}
