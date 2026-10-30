package com.youtopia.restore;

import com.youtopia.account.*;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;

@Component @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.control.enabled:false}")
public class DeletionJournal {
    public record Marker(UUID generation,long sequence) {}
    public record Fence(String state,UUID generation,byte[] fingerprint,long committedSequence,boolean pending) {}
    public record Entry(long sequence,UUID operation,byte[] subjectTag,String phase,Instant requestedAt,Instant recoverUntil,long minimumVersion) {}
    private final JdbcTemplate control;private final JdbcTemplate main;private final TransactionTemplate transaction;
    private final AccountSecrets secrets;private final String service;
    private static final String COMMITTED="'DELETION_REQUESTED','ACCOUNT_RECOVERED','PURGED'";
    public DeletionJournal(@Qualifier("controlJdbc")JdbcTemplate control,@Qualifier("memberJdbc")JdbcTemplate main,
        @Qualifier("controlTx")PlatformTransactionManager manager,@Qualifier("journalSecrets")AccountSecrets secrets,
        @Value("${youtopia.control.service-key:youtopia}")String service){
        if(!service.matches("[a-z0-9][a-z0-9_-]{0,63}"))throw new IllegalArgumentException("Invalid control service key");
        this.control=control;this.main=main;this.secrets=secrets;this.service=service;transaction=new TransactionTemplate(manager);transaction.setTimeout(8);
    }
    public String service(){return service;}
    public byte[] tag(UUID user){return secrets.tag("deletion-subject-v1",service+":"+user);}
    public byte[] fingerprint(){return secrets.tag("journal-key-v1",service);}
    public Marker marker(){return main.queryForObject("SELECT generation,journal_sequence FROM service.restore_marker WHERE singleton=true",(r,n)->new Marker(r.getObject(1,UUID.class),r.getLong(2)));}
    public Fence fence(){
        return control.queryForObject("""
            SELECT f.state,f.generation,f.key_fingerprint,
              coalesce((SELECT max(sequence_id) FROM restore_control.deletion_journal WHERE service_key=f.service_key AND phase IN ('DELETION_REQUESTED','ACCOUNT_RECOVERED','PURGED')),0),
              EXISTS(SELECT FROM restore_control.deletion_journal i WHERE i.service_key=f.service_key AND i.phase IN ('DELETE_INTENT','RECOVERY_INTENT','PURGE_INTENT') AND NOT EXISTS(
                SELECT FROM restore_control.deletion_journal done WHERE done.service_key=i.service_key AND done.operation_id=i.operation_id AND (done.phase IN ('DELETION_REQUESTED','ACCOUNT_RECOVERED','PURGED') OR (done.phase='CANCELLED' AND done.attempt_id=i.attempt_id))))
            FROM restore_control.service_fence f WHERE service_key=?
            """,(r,n)->new Fence(r.getString(1),r.getObject(2,UUID.class),r.getBytes(3),r.getLong(4),r.getBoolean(5)),service);
    }
    public boolean servingAllowed(){
        Marker marker=marker();Fence fence=fence();
        return fence.state().equals("OPEN")&&!fence.pending()&&MessageDigest.isEqual(fingerprint(),fence.fingerprint())
            &&marker.generation().equals(fence.generation())&&marker.sequence()>=fence.committedSequence();
    }
    public void intent(UUID operation,UUID user,String phase,Instant requested,Instant deadline,long minimumVersion){
        UUID attempt=UUID.randomUUID();
        append(operation,user,phase,requested,deadline,minimumVersion,true,attempt);
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCompletion(int status){
                // UNKNOWN is deliberately not treated as rollback. An unresolved intent prevents restoration from reopening.
                if(status==STATUS_ROLLED_BACK)try{append(operation,user,"CANCELLED",null,null,minimumVersion,false,attempt);}catch(RuntimeException ignored){}
            }
        });
    }
    public long commit(UUID operation,UUID user,String phase,Instant requested,Instant deadline,long version){
        long sequence=append(operation,user,phase,requested,deadline,version,false,new UUID(0,0));
        main.update("UPDATE service.restore_marker SET journal_sequence=greatest(journal_sequence,?) WHERE singleton=true",sequence);return sequence;
    }
    private long append(UUID operation,UUID user,String phase,Instant requested,Instant deadline,long version,boolean intent,UUID attempt){
        return transaction.execute(tx->{
            control.queryForList("SELECT pg_advisory_xact_lock_shared(hashtextextended(?,0))",Object.class,"restore-control:"+service);
            Fence fence=fence();if(!MessageDigest.isEqual(fingerprint(),fence.fingerprint()))throw new IllegalStateException("Deletion journal key identity mismatch");
            if(intent&&(!fence.state().equals("OPEN")||!marker().generation().equals(fence.generation())))throw new IllegalStateException("Service is fenced for restoration");
            UUID event=UUID.nameUUIDFromBytes((service+":"+operation+":"+attempt+":"+phase).getBytes(java.nio.charset.StandardCharsets.US_ASCII));byte[] tag=tag(user);
            var created=control.query("INSERT INTO restore_control.deletion_journal(event_id,operation_id,attempt_id,service_key,subject_tag,phase,requested_at,recover_until_at,minimum_auth_version) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING sequence_id",(r,n)->r.getLong(1),event,operation,attempt,service,tag,phase,requested==null?null:Timestamp.from(requested),deadline==null?null:Timestamp.from(deadline),version);
            if(!created.isEmpty())return created.getFirst();
            Entry existing=control.queryForObject("SELECT sequence_id,operation_id,subject_tag,phase,requested_at,recover_until_at,minimum_auth_version FROM restore_control.deletion_journal WHERE event_id=?",(r,n)->entry(r),event);
            if(existing==null||!MessageDigest.isEqual(tag,existing.subjectTag())||!Objects.equals(requested,existing.requestedAt())||!Objects.equals(deadline,existing.recoverUntil())||version!=existing.minimumVersion())throw AccountProblem.conflict("DELETION_JOURNAL_CONFLICT");
            return existing.sequence();
        });
    }
    public boolean policyApproved(String reference){
        if(reference==null||reference.isBlank())return false;
        Long total=control.queryForObject("SELECT count(*) FROM restore_control.policy_item WHERE item_key IN('MEMBER_CREDENTIALS','RECOVERY_CODES','USER_SETTINGS','ANALYTICS_LINK','PRODUCT_EVENTS','SECURITY_AUDIT','BACKUPS','DELETION_JOURNAL') AND approval_status='APPROVED' AND approval_ref=? AND approved_at IS NOT NULL AND legal_basis IS NOT NULL AND duration_rule IS NOT NULL AND disposal_method IS NOT NULL AND nullif(btrim(legal_basis),'') IS NOT NULL AND nullif(btrim(duration_rule),'') IS NOT NULL AND nullif(btrim(separate_storage_ref),'') IS NOT NULL AND nullif(btrim(disposal_method),'') IS NOT NULL",Long.class,reference);
        return total!=null&&total==8;
    }
    public List<Entry> latestCommitted(){
        return control.query("SELECT DISTINCT ON(subject_tag) sequence_id,operation_id,subject_tag,phase,requested_at,recover_until_at,minimum_auth_version FROM restore_control.deletion_journal WHERE service_key=? AND phase IN ("+COMMITTED+") ORDER BY subject_tag,minimum_auth_version DESC,sequence_id DESC",(r,n)->entry(r),service);
    }
    private Entry entry(java.sql.ResultSet r)throws java.sql.SQLException{return new Entry(r.getLong(1),r.getObject(2,UUID.class),r.getBytes(3),r.getString(4),r.getTimestamp(5)==null?null:r.getTimestamp(5).toInstant(),r.getTimestamp(6)==null?null:r.getTimestamp(6).toInstant(),r.getLong(7));}
}
