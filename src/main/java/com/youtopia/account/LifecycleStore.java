package com.youtopia.account;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class LifecycleStore {
    private final JdbcTemplate member,admin;
    private final AccountRepository accounts;
    public record Operation(UUID id,String state,Instant createdAt) {}
    public record Pending(Account.Kind kind,UUID userId,UUID operationId,String type) {}
    public LifecycleStore(@Qualifier("memberJdbc") JdbcTemplate member,@Qualifier("adminJdbc") JdbcTemplate admin,AccountRepository accounts){this.member=member;this.admin=admin;this.accounts=accounts;}
    public Account lock(SessionIdentity id) {
        String sql=id.kind()==Account.Kind.USER?"SELECT login_email FROM auth.service_user WHERE user_id=? FOR UPDATE":"SELECT admin_login_name FROM auth.admin_account WHERE admin_id=? FOR UPDATE";
        var rows=jdbc(id.kind()).queryForList(sql,String.class,id.id());
        return rows.isEmpty()?null:accounts.byLogin(id.kind(),rows.getFirst(),true);
    }
    public boolean codesExist(UUID user,UUID batch){return Boolean.TRUE.equals(member.queryForObject("SELECT EXISTS(SELECT FROM auth.recovery_code WHERE user_id=? AND batch_id=?)",Boolean.class,user,batch));}
    public void insertCode(UUID user,UUID batch,byte[] hash){member.update("INSERT INTO auth.recovery_code(user_id,batch_id,code_hmac,hmac_key_version) VALUES(?,?,?,1)",user,batch,hash);}
    public void revokeCodes(UUID user){member.update("UPDATE auth.recovery_code SET revoked_at=current_timestamp WHERE user_id=? AND consumed_at IS NULL AND revoked_at IS NULL",user);}
    public boolean consumeCode(UUID user,byte[] hash){return member.update("UPDATE auth.recovery_code SET consumed_at=current_timestamp WHERE user_id=? AND code_hmac=? AND hmac_key_version=1 AND consumed_at IS NULL AND revoked_at IS NULL",user,hash)==1;}
    public void password(Account.Kind kind,UUID user,String hash){
        if(kind==Account.Kind.USER)member.update("UPDATE auth.user_credential SET password_hash=?,password_changed_at=current_timestamp WHERE user_id=?",hash,user);
        else admin.update("UPDATE auth.admin_account SET password_hash=?,password_changed_at=current_timestamp,auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp WHERE admin_id=?",hash,user);
    }
    public void deleteRequest(UUID user){
        member.update("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp WHERE user_id=?",user);
        member.update("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) VALUES(?,current_timestamp,current_timestamp+interval '72 hours')",user);
    }
    public boolean recoverable(UUID user){return Boolean.TRUE.equals(member.queryForObject("SELECT EXISTS(SELECT FROM auth.deletion_request WHERE user_id=? AND request_state='PENDING' AND recover_until_at>current_timestamp)",Boolean.class,user));}
    public void restore(UUID user){
        member.update("UPDATE auth.deletion_request SET request_state='RECOVERED',closed_at=current_timestamp,updated_at=current_timestamp WHERE user_id=? AND request_state='PENDING'",user);
        member.update("UPDATE auth.service_user SET account_status='ACTIVE',auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp WHERE user_id=?",user);
    }
    public Operation find(Account.Kind kind,UUID user,String type,UUID key){
        var rows=jdbc(kind).query("SELECT operation_id,operation_state,created_at FROM auth.security_operation WHERE account_kind=? AND principal_id=? AND operation_type=? AND request_key=?",(r,n)->new Operation(r.getObject(1,UUID.class),r.getString(2),r.getTimestamp(3).toInstant()),kind.name(),user,type,key);
        return rows.isEmpty()?null:rows.getFirst();
    }
    public Operation create(Account.Kind kind,UUID user,String type,UUID key,UUID id){
        Instant time=jdbc(kind).queryForObject("INSERT INTO auth.security_operation(operation_id,account_kind,principal_id,operation_type,request_key) VALUES(?,?,?,?,?) RETURNING created_at",Timestamp.class,id,kind.name(),user,type,key).toInstant();return new Operation(id,"PENDING",time);
    }
    public void versionCommitted(Account.Kind kind,UUID user,UUID operation){
        String sql=kind==Account.Kind.USER?"SELECT auth_version FROM auth.service_user WHERE user_id=?":"SELECT auth_version FROM auth.admin_account WHERE admin_id=?";
        long version=jdbc(kind).queryForObject(sql,Long.class,user);
        jdbc(kind).update("UPDATE auth.security_operation SET committed_auth_version=?,operation_state='REDIS_PENDING',updated_at=current_timestamp WHERE operation_id=?",version,operation);
    }
    public String state(Account.Kind kind,UUID operation){return jdbc(kind).queryForObject("SELECT operation_state FROM auth.security_operation WHERE operation_id=?",String.class,operation);}
    public long committedVersion(Account.Kind kind,UUID operation){return jdbc(kind).queryForObject("SELECT committed_auth_version FROM auth.security_operation WHERE operation_id=?",Long.class,operation);}
    public void completed(Account.Kind kind,UUID operation){jdbc(kind).update("UPDATE auth.security_operation SET operation_state='COMPLETED',error_code=NULL,attempts=attempts+1,completed_at=current_timestamp,updated_at=current_timestamp WHERE operation_id=?",operation);}
    public void retry(Account.Kind kind,UUID operation){jdbc(kind).update("UPDATE auth.security_operation SET operation_state='NEEDS_RETRY',completed_at=NULL,error_code='DEPENDENCY_UNAVAILABLE',attempts=attempts+1,updated_at=current_timestamp WHERE operation_id=?",operation);}
    public List<Pending> pending(Account.Kind kind){return jdbc(kind).query("SELECT principal_id,operation_id,operation_type FROM auth.security_operation WHERE account_kind=? AND operation_state IN ('REDIS_PENDING','NEEDS_RETRY') AND committed_auth_version IS NOT NULL ORDER BY created_at,operation_id LIMIT 100",(r,n)->new Pending(kind,r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3)),kind.name());}
    public Operation operation(Account.Kind kind,UUID id){return jdbc(kind).queryForObject("SELECT operation_id,operation_state,created_at FROM auth.security_operation WHERE operation_id=?",(r,n)->new Operation(r.getObject(1,UUID.class),r.getString(2),r.getTimestamp(3).toInstant()),id);}
    public void supersedeAdminLogins(UUID user){admin.update("UPDATE auth.security_operation SET operation_state='COMPLETED',completed_at=current_timestamp,updated_at=current_timestamp WHERE account_kind='ADMIN' AND principal_id=? AND operation_type='ADMIN_LOGIN' AND operation_state<>'COMPLETED'",user);}
    public void cancelAdminGuard(UUID user){admin.update("DELETE FROM auth.admin_active_session WHERE admin_id=?",user);}
    public void lockAdmin(UUID user){admin.queryForList("SELECT admin_id FROM auth.admin_account WHERE admin_id=? FOR UPDATE",UUID.class,user);}
    private JdbcTemplate jdbc(Account.Kind kind){return kind==Account.Kind.USER?member:admin;}
}
