package com.youtopia.youtube.lifecycle;

import com.youtopia.integration.IsolatedTestServices;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;

/** G45-L6 TEST-ONLY; owned loopback PostgreSQL 16/Redis, no live or production data. */
class G45L6IsolatedLifecycleIntegrationTest {
    private static final String VIDEO = "Ab0_-123xyz";
    private static final List<String> TARGETS = List.of(
        "raw-and-identity", "snapshot-and-derived", "report", "search-index",
        "server-cache", "client-and-cdn-cache", "job-and-outbox",
        "temporary-export", "backup-and-restore-fence");

    private static Connection isolatedPg() throws SQLException {
        String container = IsolatedTestServices.postgresContainer();
        String url = IsolatedTestServices.url("youtopia_test");
        if (!container.matches("youtopia-test-pg-[a-f0-9]{12}") ||
            !url.matches("jdbc:postgresql://127[.]0[.]0[.]1:[0-9]+/youtopia_test"))
            throw new IllegalStateException("Owned disposable loopback PostgreSQL required");
        Connection c = DriverManager.getConnection(url, "postgres", "");
        try {
            if (!"youtopia_test".equals(c.getCatalog()) ||
                c.getMetaData().getDatabaseMajorVersion() != 16)
                throw new IllegalStateException("Synthetic PostgreSQL identity mismatch");
            return c;
        } catch (SQLException | RuntimeException error) {
            c.close();
            throw error;
        }
    }
    private static int count(Connection c, String table, String tenant) throws SQLException {
        if (!List.of("g45_l6_rows","g45_l6_tombstone").contains(table))
            throw new IllegalArgumentException("Only fixture TEMP tables allowed");
        try (var q=c.prepareStatement("SELECT count(*) FROM pg_temp."+table+" WHERE tenant_id=?")) {
            q.setString(1, tenant);
            try (var r=q.executeQuery()) {assertTrue(r.next());return r.getInt(1);}
        }
    }

    @Test void temporaryPostgresTableIsInvisibleOutsideItsTestSession() throws Exception {
        try (var c=isolatedPg();var s=c.createStatement()) {
            s.execute("CREATE TEMP TABLE g45_l6_rows(tenant_id text NOT NULL, video_id text NOT NULL, marker text NOT NULL, PRIMARY KEY(tenant_id,video_id)) ON COMMIT PRESERVE ROWS");
            s.execute("INSERT INTO pg_temp.g45_l6_rows VALUES('tenant-alpha','Ab0_-123xyz','STATIC_FIXTURE')");
            assertEquals(1,count(c,"g45_l6_rows","tenant-alpha"));
            try (var other=isolatedPg();var statement=other.createStatement()) {
                SQLException error=assertThrows(SQLException.class,
                    ()->statement.executeQuery("SELECT * FROM pg_temp.g45_l6_rows"));
                assertEquals("42P01",error.getSQLState());
            }
        }
    }

    @Test void committedSyntheticTombstoneSurvivesFailedDeleteAndProtectsOtherTenant() throws Exception {
        try (var c=isolatedPg()) {
            c.setAutoCommit(false);
            try(var s=c.createStatement()) {
                s.execute("CREATE TEMP TABLE g45_l6_rows(tenant_id text NOT NULL,video_id text NOT NULL,marker text NOT NULL, PRIMARY KEY(tenant_id,video_id)) ON COMMIT PRESERVE ROWS");
                s.execute("CREATE TEMP TABLE g45_l6_tombstone(tenant_id text NOT NULL,video_id text NOT NULL,epoch bigint NOT NULL CHECK(epoch>0), PRIMARY KEY(tenant_id,video_id)) ON COMMIT PRESERVE ROWS");
                s.execute("INSERT INTO pg_temp.g45_l6_rows VALUES('tenant-alpha','Ab0_-123xyz','STATIC_FIXTURE'),('tenant-beta','Ab0_-123xyz','STATIC_FIXTURE')");
                s.execute("INSERT INTO pg_temp.g45_l6_tombstone VALUES('tenant-alpha','Ab0_-123xyz',4)");
            }
            c.commit(); // durable within this TEMP table session, before deletion attempts
            assertEquals(1,count(c,"g45_l6_tombstone","tenant-alpha"));
            Savepoint failed=c.setSavepoint();
            try(var q=c.prepareStatement("DELETE FROM pg_temp.g45_l6_rows WHERE tenant_id=? AND video_id=?")) {
                q.setString(1,"tenant-alpha");q.setString(2,VIDEO);
                assertEquals(1,q.executeUpdate());
            }
            c.rollback(failed); // emulate one failed propagation attempt
            assertEquals(1,count(c,"g45_l6_tombstone","tenant-alpha"));
            assertEquals(1,count(c,"g45_l6_rows","tenant-alpha"));
            try(var q=c.prepareStatement("DELETE FROM pg_temp.g45_l6_rows WHERE tenant_id=? AND video_id=?")) {
                q.setString(1,"tenant-alpha");q.setString(2,VIDEO);
                assertEquals(1,q.executeUpdate());
            }
            c.commit();
            assertEquals(0,count(c,"g45_l6_rows","tenant-alpha"));
            assertEquals(1,count(c,"g45_l6_rows","tenant-beta"));
            assertEquals(1,count(c,"g45_l6_tombstone","tenant-alpha"));
            assertEquals(0,count(c,"g45_l6_tombstone","tenant-beta"));
        }
    }

    @Test void nineSyntheticAcknowledgementsAreMandatoryIncludingBackupFence() throws Exception {
        assertEquals(9,TARGETS.size());
        UUID request=UUID.fromString("11111111-1111-4111-8111-111111111111");
        try (var c=isolatedPg();var s=c.createStatement()) {
            s.execute("CREATE TEMP TABLE g45_l6_op(id uuid PRIMARY KEY,state text NOT NULL CHECK(state IN('PROPAGATING','PURGED_SYNTHETIC_ONLY'))) ON COMMIT PRESERVE ROWS");
            s.execute("CREATE TEMP TABLE g45_l6_ack(id uuid NOT NULL,target text NOT NULL,PRIMARY KEY(id,target)) ON COMMIT PRESERVE ROWS");
            try (var q=c.prepareStatement("INSERT INTO pg_temp.g45_l6_op VALUES(?,'PROPAGATING')")) {
                q.setObject(1,request);assertEquals(1,q.executeUpdate());
            }
            try (var q=c.prepareStatement("INSERT INTO pg_temp.g45_l6_ack VALUES (?,?) ON CONFLICT DO NOTHING")) {
                for(String target:TARGETS) {
                    if(target.equals("backup-and-restore-fence"))continue;
                    q.setObject(1,request);q.setString(2,target);
                    assertEquals(1,q.executeUpdate());
                }
                q.setObject(1,request);q.setString(2,TARGETS.getFirst());
                assertEquals(0,q.executeUpdate()); // duplicate receipt
            }
            String sql="UPDATE pg_temp.g45_l6_op SET state='PURGED_SYNTHETIC_ONLY' WHERE id=? AND state='PROPAGATING' AND 9=(SELECT count(*) FROM pg_temp.g45_l6_ack WHERE id=?)";
            try(var q=c.prepareStatement(sql)) {
                q.setObject(1,request);q.setObject(2,request);
                assertEquals(0,q.executeUpdate()); // backup receipt not present
            }
            try(var q=c.prepareStatement("INSERT INTO pg_temp.g45_l6_ack VALUES (?,?)")) {
                q.setObject(1,request);q.setString(2,"backup-and-restore-fence");
                assertEquals(1,q.executeUpdate());
            }
            try(var q=c.prepareStatement(sql)) {
                q.setObject(1,request);q.setObject(2,request);
                assertEquals(1,q.executeUpdate());
                assertEquals(0,q.executeUpdate()); // completion cannot replay
            }
            try(var r=s.executeQuery("SELECT state FROM pg_temp.g45_l6_op")) {
                assertTrue(r.next());
                assertEquals("PURGED_SYNTHETIC_ONLY",r.getString(1));
            }
        }
    }

    @Test void realRedisInvalidationOnlyTouchesSyntheticUuidNamespace() throws Exception {
        int port=IsolatedTestServices.redisPort();
        var factory=new LettuceConnectionFactory(new RedisStandaloneConfiguration("127.0.0.1",port));
        var redis=new StringRedisTemplate(factory);
        String prefix="youtopia:g45-l6:synthetic:"+UUID.randomUUID()+":";
        String alpha=prefix+"tenant-alpha:"+VIDEO;
        String beta=prefix+"tenant-beta:"+VIDEO;
        String fence=prefix+"tombstone:tenant-alpha:"+VIDEO;
        try {
            factory.afterPropertiesSet();
            factory.start();
            redis.afterPropertiesSet();
            redis.opsForValue().set(alpha,"STATIC_FIXTURE_ALPHA",Duration.ofMinutes(2));
            redis.opsForValue().set(beta,"STATIC_FIXTURE_BETA",Duration.ofMinutes(2));
            redis.opsForValue().set(fence,"epoch-4",Duration.ofMinutes(2));
            assertEquals("STATIC_FIXTURE_ALPHA",redis.opsForValue().get(alpha));
            assertEquals(Boolean.TRUE,redis.delete(alpha));
            assertNull(redis.opsForValue().get(alpha));
            assertEquals("STATIC_FIXTURE_BETA",redis.opsForValue().get(beta));
            assertEquals("epoch-4",redis.opsForValue().get(fence));
            assertEquals(Boolean.FALSE,redis.delete(alpha)); // idempotent no-op
        } finally {
            try {redis.delete(List.of(alpha,beta,fence));}
            finally {factory.destroy();}
        }
    }

    @Test void existingSyntheticReadOnlyRoleHasNoDeletePrivilege() throws Exception {
        try(var c=isolatedPg();
            PreparedStatement q=c.prepareStatement(
              "SELECT has_table_privilege('ytp_test_data_ro','collector.ccu_fixture','DELETE')")) {
            try(var r=q.executeQuery()) {
                assertTrue(r.next());
                assertFalse(r.getBoolean(1));
            }
        }
    }
}
