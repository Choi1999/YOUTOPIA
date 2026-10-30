package com.youtopia.restore;

import java.security.MessageDigest;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Restore operator's fenced workflow. Manager credentials must never be supplied to web application pools. */
public class RestoreCoordinator {
    private final DeletionJournal journal;private final JdbcTemplate manager,target;private final TransactionTemplate controlTx,targetTx;
    private final RestoreMarkerStore markers;
    public RestoreCoordinator(DeletionJournal journal,JdbcTemplate manager,JdbcTemplate target,PlatformTransactionManager controlTx,PlatformTransactionManager targetTx){
        this.journal=journal;this.manager=manager;this.target=target;this.controlTx=new TransactionTemplate(controlTx);this.targetTx=new TransactionTemplate(targetTx);
        this.controlTx.setTimeout(15);this.targetTx.setTimeout(30);markers=new RestoreMarkerStore(target);
    }
    public UUID begin(String backupReference){
        if(!backupReference.matches("[A-Za-z0-9_.:-]{1,64}"))throw new IllegalArgumentException("Opaque backup reference required");
        UUID run=UUID.randomUUID();controlTx.executeWithoutResult(tx->{
            lock();var f=journal.fence();if(!MessageDigest.isEqual(f.fingerprint(),journal.fingerprint()))throw new IllegalStateException("Journal key mismatch");
            manager.update("UPDATE restore_control.service_fence SET state='RESTORING',generation=?,verified_sequence=NULL,updated_at=current_timestamp WHERE service_key=?",run,journal.service());
            manager.update("INSERT INTO restore_control.restore_run(run_id,service_key,backup_ref,state) VALUES(?,?,?,'RESTORING')",run,journal.service(),backupReference);
        });return run;
    }
    public void replay(UUID run){
        try{
            var fence=journal.fence();requireKey(fence);if(!fence.state().equals("RESTORING")||!fence.generation().equals(run)||fence.pending())throw new IllegalStateException("Restore has unresolved operations");
            var entries=journal.latestCommitted();
            targetTx.executeWithoutResult(tx->{
                if(!markers.marker().generation().equals(run)){
                    // An old Redis session or backup recovery code must not regain validity after restoring old rows.
                    target.update("UPDATE auth.service_user SET auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp");
                    target.update("UPDATE auth.admin_account SET auth_version=auth_version+1,row_version=row_version+1,updated_at=current_timestamp");
                    target.update("DELETE FROM auth.admin_active_session");
                    target.update("UPDATE auth.recovery_code SET revoked_at=current_timestamp WHERE consumed_at IS NULL AND revoked_at IS NULL");
                }
                var users=target.queryForList("SELECT user_id FROM auth.service_user ORDER BY user_id",UUID.class);
                for(UUID user:users){byte[] tag=journal.tag(user);var latest=entries.stream().filter(e->MessageDigest.isEqual(tag,e.subjectTag())).findFirst();if(latest.isEmpty())continue;
                    var event=latest.get();
                    if(event.phase().equals("PURGED"))purgeRestored(user);
                    else if(event.phase().equals("DELETION_REQUESTED"))pending(user,event);
                    else if(event.phase().equals("ACCOUNT_RECOVERED")){
                        // Old backups may contain obsolete credentials/codes. Never reactivate these automatically.
                        throw new IllegalStateException("Restored recovered account needs current credential-state verification");
                    }
                }
                markers.seal(run,fence.committedSequence());
            });
            manager.update("UPDATE restore_control.restore_run SET state='REPLAYED',replay_sequence=?,updated_at=current_timestamp WHERE run_id=?",fence.committedSequence(),run);
        }catch(RuntimeException exception){fail(run,"REPLAY_UNCONFIRMED");throw exception;}
    }
    private void pending(UUID user,DeletionJournal.Entry event){
        target.update("UPDATE auth.service_user SET account_status=CASE WHEN account_status='ACTIVE' THEN 'PENDING_DELETION' ELSE account_status END,auth_version=greatest(auth_version+CASE WHEN account_status='ACTIVE' THEN 1 ELSE 0 END,?),row_version=row_version+1,updated_at=current_timestamp WHERE user_id=? AND (account_status='ACTIVE' OR auth_version<?)",event.minimumVersion(),user,event.minimumVersion());
        var active=target.queryForList("SELECT request_id FROM auth.deletion_request WHERE user_id=? AND request_state IN('PENDING','PURGE_IN_PROGRESS','PURGE_FAILED')",UUID.class,user);
        if(active.isEmpty())target.update("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) VALUES(?,?,?)",user,Timestamp.from(event.requestedAt()),Timestamp.from(event.recoverUntil()));
        else if(!Boolean.TRUE.equals(target.queryForObject("SELECT EXISTS(SELECT FROM auth.deletion_request WHERE user_id=? AND requested_at=? AND recover_until_at=?)",Boolean.class,user,Timestamp.from(event.requestedAt()),Timestamp.from(event.recoverUntil()))))throw new IllegalStateException("Deletion deadline mismatch");
    }
    private void purgeRestored(UUID user){
        target.update("DELETE FROM telemetry.product_event WHERE analytics_user_key IN(SELECT analytics_user_key FROM auth.analytics_identity WHERE user_id=?)",user);
        target.update("UPDATE security.security_audit_event SET actor_id=CASE WHEN actor_kind='USER' AND actor_id=? THEN NULL ELSE actor_id END,subject_user_id=CASE WHEN subject_user_id=? THEN NULL ELSE subject_user_id END WHERE (actor_kind='USER' AND actor_id=?) OR subject_user_id=?",user,user,user,user);
        target.update("UPDATE auth.security_operation SET principal_id=NULL WHERE account_kind='USER' AND principal_id=?",user);
        target.update("UPDATE auth.deletion_request SET request_state='PURGE_IN_PROGRESS',updated_at=current_timestamp WHERE user_id=? AND request_state IN('PENDING','PURGE_FAILED')",user);
        target.update("UPDATE auth.deletion_request SET request_state='PURGED',closed_at=current_timestamp,updated_at=current_timestamp WHERE user_id=? AND request_state='PURGE_IN_PROGRESS'",user);
        if(target.update("DELETE FROM auth.service_user WHERE user_id=?",user)!=1)throw new IllegalStateException("Restored purge unconfirmed");
    }
    public void verify(UUID run,boolean currentCredentialStateVerified){
        try{
            var fence=journal.fence();requireKey(fence);var marker=markers.marker();
            if(!"REPLAYED".equals(manager.queryForObject("SELECT state FROM restore_control.restore_run WHERE run_id=?",String.class,run))||!fence.state().equals("RESTORING")||!currentCredentialStateVerified||fence.pending()||!run.equals(fence.generation())||!run.equals(marker.generation())||marker.sequence()<fence.committedSequence())throw new IllegalStateException("Restore verification incomplete");
            for(UUID user:target.queryForList("SELECT user_id FROM auth.service_user",UUID.class))for(var event:journal.latestCommitted())if(MessageDigest.isEqual(journal.tag(user),event.subjectTag())){
                if(event.phase().equals("PURGED"))throw new IllegalStateException("Purged subject resurrected");
                if(event.phase().equals("DELETION_REQUESTED")&&!Boolean.TRUE.equals(target.queryForObject("SELECT u.account_status IN ('PENDING_DELETION','PURGING') AND u.auth_version>=? AND EXISTS(SELECT FROM auth.deletion_request d WHERE d.user_id=u.user_id AND d.requested_at=? AND d.recover_until_at=? AND d.request_state IN ('PENDING','PURGE_IN_PROGRESS','PURGE_FAILED')) FROM auth.service_user u WHERE u.user_id=?",Boolean.class,event.minimumVersion(),Timestamp.from(event.requestedAt()),Timestamp.from(event.recoverUntil()),user)))throw new IllegalStateException("Pending subject or exact deadline unconfirmed after restore");
                if(event.phase().equals("ACCOUNT_RECOVERED"))throw new IllegalStateException("Credential state cannot be inferred from an old backup");
            }
            controlTx.executeWithoutResult(tx->{lock();var fresh=journal.fence();if(fresh.pending()||fresh.committedSequence()!=marker.sequence())throw new IllegalStateException("Journal changed during verification");
                manager.update("UPDATE restore_control.service_fence SET state='VERIFIED',verified_sequence=?,updated_at=current_timestamp WHERE service_key=? AND generation=?",marker.sequence(),journal.service(),run);
                manager.update("UPDATE restore_control.restore_run SET state='VERIFIED',updated_at=current_timestamp WHERE run_id=?",run);
            });
        }catch(RuntimeException exception){fail(run,"VERIFICATION_FAILED");throw exception;}
    }
    public void open(UUID run){controlTx.executeWithoutResult(tx->{
        lock();var fence=journal.fence();requireKey(fence);var marker=markers.marker();
        if(!fence.state().equals("VERIFIED")||fence.pending()||!run.equals(fence.generation())||!run.equals(marker.generation())||marker.sequence()!=fence.committedSequence())throw new IllegalStateException("External service must remain fenced");
        manager.update("UPDATE restore_control.service_fence SET state='OPEN',updated_at=current_timestamp WHERE service_key=? AND generation=?",journal.service(),run);
        manager.update("UPDATE restore_control.restore_run SET state='OPEN',updated_at=current_timestamp WHERE run_id=?",run);
    });}
    private void fail(UUID run,String code){manager.update("UPDATE restore_control.service_fence SET state='BLOCKED',updated_at=current_timestamp WHERE service_key=? AND generation=?",journal.service(),run);manager.update("UPDATE restore_control.restore_run SET state='FAILED',failure_code=?,updated_at=current_timestamp WHERE run_id=?",code,run);}
    private void requireKey(DeletionJournal.Fence fence){if(!MessageDigest.isEqual(fence.fingerprint(),journal.fingerprint()))throw new IllegalStateException("Journal key identity mismatch");}
    private void lock(){manager.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",Object.class,"restore-control:"+journal.service());}
}
