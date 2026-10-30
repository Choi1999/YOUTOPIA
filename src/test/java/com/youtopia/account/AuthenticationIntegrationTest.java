package com.youtopia.account;

import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.context.annotation.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.http.MediaType;
import org.springframework.test.context.*;
import static org.assertj.core.api.Assertions.*;

@org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AuthenticationIntegrationTest.Time.class)
class AuthenticationIntegrationTest {
    static final String URL="jdbc:postgresql://127.0.0.1:25432/youtopia_auth_test";
    static final String PASSWORD="synthetic test pass phrase 1234";
    static final String EMAIL="member@example.invalid";
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired StringRedisTemplate redis;
    @Autowired MutableClock clock;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean SecurityAudit audit;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean com.youtopia.telemetry.EventPersistence eventPersistence;
    @Autowired AccountLifecycleService lifecycle;
    @Autowired com.youtopia.restore.DeletionJournal journal;
    @Autowired com.youtopia.privacy.PrivacyPurgeService privacy;
    @Autowired com.youtopia.telemetry.EventCatalog eventCatalog;
    @Autowired com.youtopia.telemetry.SearchReceipt searchReceipts;
    @Autowired com.youtopia.telemetry.ProductEventService events;

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    org.springframework.session.data.redis.RedisIndexedSessionRepository sessions;

    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwords;
    @TestConfiguration static class Time {
        @Bean @Primary MutableClock testClock(){return new MutableClock();}
    }
    static class MutableClock extends Clock {
        Instant now=Instant.now();
        public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return Clock.fixed(now,zone);}
        public Instant instant(){return now;}
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry p) throws Exception {
        p.add("spring.datasource.url",()->"jdbc:postgresql://127.0.0.1:25432/youtopia_test");
        p.add("spring.datasource.username",()->"ytp_test_data_ro");p.add("spring.datasource.password",()->"");
        p.add("spring.data.redis.host",()->"127.0.0.1");p.add("spring.data.redis.port",()->26379);
        p.add("spring.data.redis.username",()->"");p.add("spring.data.redis.password",()->"");p.add("spring.data.redis.ssl.enabled",()->false);
        p.add("spring.session.data.redis.namespace",()->"youtopia:p0-auth-tests");
        p.add("youtopia.accounts.enabled",()->true);
        p.add("youtopia.games.enabled",()->true);
        p.add("youtopia.games.video-associations-enabled",()->true);
        p.add("youtopia.control.enabled",()->true);
        p.add("youtopia.control.service-key",()->"p0-test");
        p.add("youtopia.control.hmac-key",()->Base64.getEncoder().encodeToString(new byte[32]));
        p.add("youtopia.control.datasource.jdbc-url",()->"jdbc:postgresql://127.0.0.1:25432/youtopia_control_test");
        p.add("youtopia.control.datasource.username",()->"ytp_test_control_app");
        p.add("youtopia.control.datasource.password",()->"");
        p.add("youtopia.accounts.deletion-enabled",()->true);
        p.add("youtopia.privacy.enabled",()->true);
        p.add("youtopia.privacy.approval-ref",()->"SYNTHETIC_TEST_ONLY");
        p.add("youtopia.privacy.retention-plan",()->"NO_LEGAL_EXCEPTIONS_APPROVED");
        p.add("youtopia.privacy.datasource.jdbc-url",()->URL);
        p.add("youtopia.privacy.datasource.username",()->"ytp_test_privacy");
        p.add("youtopia.privacy.datasource.password",()->"");
        p.add("youtopia.reporting.enabled",()->true);
        p.add("youtopia.reporting.active-window-seconds",()->300); // approved server-side initial policy
        p.add("youtopia.reporting.datasource.jdbc-url",()->URL);
        p.add("youtopia.reporting.datasource.username",()->"ytp_test_report");
        p.add("youtopia.reporting.datasource.password",()->"");
        p.add("youtopia.events.enabled",()->true);
        p.add("youtopia.events.datasource.jdbc-url",()->URL);
        p.add("youtopia.events.datasource.username",()->"ytp_test_event");
        p.add("youtopia.events.datasource.password",()->"");
        p.add("youtopia.directory.enabled",()->true);
        p.add("youtopia.directory.datasource.jdbc-url",()->URL);
        p.add("youtopia.directory.datasource.username",()->"ytp_test_directory");
        p.add("youtopia.directory.datasource.password",()->"");
        p.add("youtopia.accounts.hmac-key",()->Base64.getEncoder().encodeToString(new byte[32]));
        Path file=Files.createTempFile("youtopia-test-password-blocklist-",".txt");
        Files.writeString(file,PasswordPolicy.hash("passwordpassword")+"\n");file.toFile().deleteOnExit();
        p.add("youtopia.accounts.password-blocklist",file::toString);
        for(var pair:Map.of("member","ytp_test_member","admin","ytp_test_admin","audit","ytp_test_audit").entrySet()) {
            p.add("youtopia.accounts."+pair.getKey()+".jdbc-url",()->URL);
            p.add("youtopia.accounts."+pair.getKey()+".username",pair::getValue);
            p.add("youtopia.accounts."+pair.getKey()+".password",()->"");
        }
    }
    @BeforeEach void prepare() throws Exception {
        org.mockito.Mockito.reset(sessions,audit,eventPersistence);
        clock.now=Instant.now();
        var abuseKeys=redis.keys("youtopia:p0-auth-tests:auth-abuse:*");if(abuseKeys!=null&&!abuseKeys.isEmpty())redis.delete(abuseKeys);
        var keys=redis.keys("youtopia:p0-auth-tests:account-budget:*");if(keys!=null&&!keys.isEmpty())redis.delete(keys);
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()) {
            assertThat(c.getMetaData().getDatabaseMajorVersion()).isEqualTo(16);
            s.execute("TRUNCATE auth.service_user,auth.admin_account,auth.security_operation,security.security_audit_event,telemetry.product_event,service.signup_daily_count CASCADE");
            try(var insert=c.prepareStatement("INSERT INTO auth.admin_account(admin_login_name,password_hash) VALUES('operator',?)")) {
                insert.setString(1,passwords.encode(PASSWORD));insert.executeUpdate();
            }
        }
        try(var main=DriverManager.getConnection(URL,"postgres","");var control=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_control_test","postgres","");var ms=main.createStatement();var cs=control.createStatement()){
            ms.execute("UPDATE service.restore_marker SET journal_sequence=0");
            cs.execute("TRUNCATE restore_control.deletion_journal,restore_control.restore_run,restore_control.service_fence");
            cs.execute("UPDATE restore_control.policy_item SET approval_status='APPROVED',approval_ref='SYNTHETIC_TEST_ONLY',approved_at=current_timestamp,legal_basis='SYNTHETIC_FIXTURE_NOT_LEGAL_APPROVAL',duration_rule='SYNTHETIC_RULE_NOT_PRODUCTION_RETENTION',separate_storage_ref='ISOLATED_TEST_ONLY'");
            UUID generation;try(var row=ms.executeQuery("SELECT generation FROM service.restore_marker")){row.next();generation=row.getObject(1,UUID.class);}
            try(var add=control.prepareStatement("INSERT INTO restore_control.service_fence(service_key,state,generation,key_fingerprint,verified_sequence) VALUES('p0-test','OPEN',?,?,0)")){
                add.setObject(1,generation);add.setBytes(2,new AccountSecrets(Base64.getEncoder().encodeToString(new byte[32])).tag("journal-key-v1","p0-test"));add.executeUpdate();
            }
        }
    }
    class Browser {
        String cookie;
        String csrf;
        JsonNode get(String path,int expected) throws Exception {
            var headers=new HttpHeaders();if(cookie!=null)headers.set("Cookie",cookie);
            var r=http.exchange(path,HttpMethod.GET,new HttpEntity<>(headers),String.class);update(r);
            assertThat(r.getStatusCode().value()).isEqualTo(expected);
            return r.getBody()==null?json.nullNode():json.readTree(r.getBody());
        }
        void token() throws Exception {csrf=get("/api/v1/auth/csrf",200).path("token").asText();}
        JsonNode post(String path,Object body,int expected) throws Exception {
            token();var headers=new HttpHeaders();headers.setContentType(MediaType.APPLICATION_JSON);headers.set("Cookie",cookie);headers.set("X-CSRF-TOKEN",csrf);
            var r=http.exchange(path,HttpMethod.POST,new HttpEntity<>(json.writeValueAsString(body),headers),String.class);update(r);
            assertThat(r.getStatusCode().value()).withFailMessage("%s: expected %s, got %s; code=%s",path,expected,r.getStatusCode(),r.getBody()==null?"":json.readTree(r.getBody()).path("code")).isEqualTo(expected);
            return r.getBody()==null?json.nullNode():json.readTree(r.getBody());
        }
        void update(ResponseEntity<?> r){String header=r.getHeaders().getFirst("Set-Cookie");if(header!=null)cookie=header.split(";",2)[0];}
        JsonNode signup(){try{return post("/api/v1/auth/signup",Map.of("email",EMAIL,"password",PASSWORD),201);}catch(Exception e){throw new RuntimeException(e);}}
        JsonNode login() throws Exception {return post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),200);}
    }
    @Test void signupIsAtomicNormalizesEmailAndNeverAuthenticates() throws Exception {
        var b=new Browser();var user=b.post("/api/v1/auth/signup",Map.of("email"," MEMBER@EXAMPLE.INVALID ","password",PASSWORD),201);
        assertThat(user.path("emailVerified").asBoolean()).isFalse();b.get("/api/v1/auth/me",401);
        assertThat(b.post("/api/v1/auth/signup",Map.of("email",EMAIL,"password",PASSWORD),409).path("code").asText()).isEqualTo("USER_ALREADY_EXISTS");
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement();var rows=s.executeQuery("SELECT login_email,password_hash,(SELECT count(*) FROM auth.analytics_identity),(SELECT count(*) FROM service.user_setting) FROM auth.service_user JOIN auth.user_credential USING(user_id)")) {
            assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo(EMAIL);assertThat(rows.getString(2)).isNotEqualTo(PASSWORD);
            assertThat(passwords.matches(PASSWORD,rows.getString(2))).isTrue();assertThat(rows.getLong(3)).isEqualTo(1);assertThat(rows.getLong(4)).isZero();assertThat(rows.next()).isFalse();
        }
    }
    @Test void realLoginRotatesSessionRestoresAuthAndLogoutRevokes() throws Exception {
        var b=new Browser();b.signup();b.token();String anonymous=b.cookie;
        assertThat(b.login().path("kind").asText()).isEqualTo("USER");assertThat(b.cookie).isNotEqualTo(anonymous);
        var other=new Browser();other.cookie=b.cookie;assertThat(other.get("/api/v1/auth/me",200).path("id")).isNotNull();
        b.get("/api/v1/admin/auth/me",403);b.post("/api/v1/auth/logout",Map.of(),204);other.get("/api/v1/auth/me",401);
    }
    @Test void unknownAndWrongPasswordHaveIdenticalGenericResponse() throws Exception {
        var b=new Browser();b.signup();
        var a=b.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","wrong synthetic password"),401);
        var missing=b.post("/api/v1/auth/login",Map.of("login","absent@example.invalid","password",PASSWORD),401);
        assertThat(a.path("code")).isEqualTo(missing.path("code"));assertThat(a.path("detail")).isEqualTo(missing.path("detail"));
    }
    @Test void sessionRealmCannotSwitchWithoutLogoutAndUsersCanHaveMultipleDevices() throws Exception {
        var one=new Browser();one.signup();one.login();var two=new Browser();two.login();
        one.get("/api/v1/auth/me",200);two.get("/api/v1/auth/me",200);
        assertThat(one.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),409).path("code").asText()).isEqualTo("LOGOUT_REQUIRED");
        one.get("/api/v1/auth/me",200);
    }
    @Test void adminNewSuccessfulSessionWinsButFailedLoginDoesNotRevoke() throws Exception {
        var first=new Browser();var second=new Browser();
        first.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        second.post("/api/v1/admin/auth/login",Map.of("login","operator","password","bad synthetic password"),401);
        first.get("/api/v1/admin/auth/me",200);
        second.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        first.get("/api/v1/admin/auth/me",401);second.get("/api/v1/admin/auth/me",200);second.get("/api/v1/auth/me",403);
    }
    @Test void passiveAuthPollingDoesNotExtendIdleAndExactBoundaryExpires() throws Exception {
        var b=new Browser();b.signup();b.login();clock.now=clock.now.plusSeconds(3599);b.get("/api/v1/auth/me",200);
        clock.now=clock.now.plusSeconds(1);b.get("/api/v1/auth/me",401);
    }
    @Test void dbAuthVersionChangeInvalidatesEveryExistingDevice() throws Exception {
        var b=new Browser();b.signup();b.login();var other=new Browser();other.login();
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()) {s.execute("UPDATE auth.service_user SET auth_version=auth_version+1,row_version=row_version+1");}
        b.get("/api/v1/auth/me",401);other.get("/api/v1/auth/me",401);
    }
    @Test void missingCsrfCannotLoginAndUnknownBodyFieldsAreRejected() throws Exception {
        var r=http.postForEntity("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        var b=new Browser();b.post("/api/v1/auth/signup",Map.of("email",EMAIL,"password",PASSWORD,"role","ADMIN"),400);
        b.post("/api/v1/auth/signup",Map.of("email",EMAIL,"password","passwordpassword"),400);
        b.post("/api/v1/auth/signup",Map.of("email",EMAIL,"password","short"),400);
    }
    @Test void passwordChangeUsesRealHashAndRevokesAllOldDevices() throws Exception {
        var b=new Browser();b.signup();b.login();var other=new Browser();other.login();
        var key=UUID.randomUUID();
        b.post("/api/v1/auth/password",Map.of("requestKey",key,"currentPassword","incorrect synthetic password","newPassword","a new synthetic pass phrase 5678"),401);
        b.get("/api/v1/auth/me",200);
        b.post("/api/v1/auth/password",Map.of("requestKey",key,"currentPassword",PASSWORD,"newPassword","a new synthetic pass phrase 5678"),200);
        other.get("/api/v1/auth/me",401);b.get("/api/v1/auth/me",401);
        var next=new Browser();next.post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),401);
        next.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","a new synthetic pass phrase 5678"),200);
    }
    @Test void recoveryCodesAreOneTimeAndResetRevokesSessionsAndOtherCodes() throws Exception {
        var b=new Browser();b.signup();b.login();UUID batch=UUID.randomUUID();
        var codes=b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",batch,"currentPassword",PASSWORD),200).path("codes");
        assertThat(codes.size()).isEqualTo(8);var unique=new HashSet<String>();
        for(var code:codes){assertThat(code.asText()).matches("[0-9a-f]{8}(-[0-9a-f]{8}){3}");unique.add(code.asText());}
        assertThat(unique).hasSize(8);
        b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",batch,"currentPassword",PASSWORD),409);
        var guest=new Browser();UUID reset=UUID.randomUUID();
        var input=Map.of("requestKey",reset,"email",EMAIL,"recoveryCode",codes.get(0).asText(),"newPassword","another synthetic password 2026");
        guest.post("/api/v1/auth/password-reset",input,200);
        guest.post("/api/v1/auth/password-reset",input,200); // replay is successful without consuming/auditing again
        guest.post("/api/v1/auth/password-reset",Map.of("requestKey",reset,"email",EMAIL,"recoveryCode",codes.get(0).asText(),"newPassword","different synthetic password 2026"),409);
        guest.post("/api/v1/auth/password-reset",Map.of("requestKey",UUID.randomUUID(),"email",EMAIL,"recoveryCode",codes.get(1).asText(),"newPassword","different synthetic password 2026"),401);
        b.get("/api/v1/auth/me",401);guest.get("/api/v1/auth/me",401);
        guest.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","another synthetic password 2026"),200);
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var rows=st.executeQuery("SELECT (SELECT count(*) FROM auth.recovery_code WHERE consumed_at IS NOT NULL),(SELECT count(*) FROM auth.recovery_code WHERE revoked_at IS NOT NULL),(SELECT count(*) FROM auth.security_operation WHERE operation_state='COMPLETED'),(SELECT count(*) FROM security.security_audit_event WHERE event_type='PASSWORD_RESET')")) {
            rows.next();assertThat(rows.getInt(1)).isEqualTo(1);assertThat(rows.getInt(2)).isEqualTo(7);assertThat(rows.getInt(3)).isEqualTo(1);assertThat(rows.getInt(4)).isEqualTo(1);
        }
    }
    @Test void deletionNeedsConfirmationAndPasswordAndRecoveryKeepsIdentityWithoutOldSessions() throws Exception {
        var b=new Browser();String original=b.signup().path("userId").asText();b.login();
        String code=b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200).path("codes").get(0).asText();
        b.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",false),400);
        b.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword","wrong synthetic password","confirmed",true),401);
        var result=b.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",true),200);
        assertThat(Instant.parse(result.path("recoverUntil").asText())).isAfter(Instant.now().plusSeconds(71*3600));
        b.get("/api/v1/auth/me",401);var guest=new Browser();guest.post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),401);
        guest.post("/api/v1/auth/account-recovery",Map.of("requestKey",UUID.randomUUID(),"email",EMAIL,"recoveryCode",code,"newPassword","recovered synthetic password 1234"),200);
        guest.get("/api/v1/auth/me",401);b.get("/api/v1/auth/me",401);
        assertThat(guest.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","recovered synthetic password 1234"),200).path("id").asText()).isEqualTo(original);
    }
    @Test void expiredDeletionCannotRecoverEvenBeforeWorkerRuns() throws Exception {
        var b=new Browser();b.signup();b.login();String code=b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200).path("codes").get(0).asText();
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement()) {
            st.execute("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1");
            st.execute("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) SELECT user_id,current_timestamp-interval '72 hours',current_timestamp FROM auth.service_user");
        }
        new Browser().post("/api/v1/auth/account-recovery",Map.of("requestKey",UUID.randomUUID(),"email",EMAIL,"recoveryCode",code,"newPassword","recovered synthetic password 1234"),401);
    }
    @Test void membershipWritesCannotReachAdminOrAuditReadback() throws Exception {
        try(var c=DriverManager.getConnection(URL,"ytp_test_member","");var st=c.createStatement()) {
            assertThatThrownBy(()->st.execute("SELECT password_hash FROM auth.admin_account")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("SELECT * FROM security.security_audit_event")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("DELETE FROM auth.service_user")).isInstanceOf(SQLException.class);
        }
    }

    @Test void redisDeletionFailureIsTrackedAndReconciliationDoesNotRevokeNewLogin() throws Exception {
        var b=new Browser();b.signup();b.login();var other=new Browser();other.login();
        org.mockito.Mockito.doThrow(new org.springframework.data.redis.RedisConnectionFailureException("synthetic injected failure"))
            .doCallRealMethod().when(sessions).deleteById(org.mockito.ArgumentMatchers.anyString());
        b.post("/api/v1/auth/password",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"newPassword","new synthetic recovery password 4567"),503);
        org.mockito.Mockito.reset(sessions);
        other.get("/api/v1/auth/me",401);
        var next=new Browser();next.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","new synthetic recovery password 4567"),200);
        assertThat(lifecycle.reconcilePending().completed()).isEqualTo(1);
        next.get("/api/v1/auth/me",200);assertThat(lifecycle.reconcilePending().attempted()).isZero();
    }
    @Test void sixthFailedLoginTriggersTemporaryLimitWithoutEndingValidSession() throws Exception {
        var existing=new Browser();existing.signup();existing.login();var attacker=new Browser();
        for(int i=0;i<6;i++)attacker.post("/api/v1/auth/login",Map.of("login",EMAIL,"password","wrong synthetic password"),401);
        var blocked=attacker.post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),429);
        assertThat(blocked.path("code").asText()).isEqualTo("AUTH_RATE_LIMITED");existing.get("/api/v1/auth/me",200);
        assertThat(redis.keys("youtopia:p0-auth-tests:auth-abuse:*")).allSatisfy(key->assertThat(key).doesNotContain(EMAIL,"127.0.0.1"));
    }
    @Test void concurrentAdminLoginsLeaveExactlyOneUsableSession() throws Exception {
        var one=new Browser();var two=new Browser();one.token();two.token();
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var a=executor.submit(()->one.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200));
            var b=executor.submit(()->two.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200));
            a.get();b.get();
        }
        int successes=0;
        for(var browser:List.of(one,two)) {
            var headers=new HttpHeaders();headers.set("Cookie",browser.cookie);
            int status=http.exchange("/api/v1/admin/auth/me",HttpMethod.GET,new HttpEntity<>(headers),String.class).getStatusCode().value();
            assertThat(status).isIn(200,401);if(status==200)successes++;
        }
        assertThat(successes).isEqualTo(1);
    }
    @Test void concurrentSignupCreatesOnlyOneCompleteAccount() throws Exception {
        var one=new Browser();var two=new Browser();one.token();two.token();
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> request=()->{
                var browser=new Browser();browser.token();var h=new HttpHeaders();h.setContentType(MediaType.APPLICATION_JSON);h.set("Cookie",browser.cookie);h.set("X-CSRF-TOKEN",browser.csrf);
                return http.exchange("/api/v1/auth/signup",HttpMethod.POST,new HttpEntity<>(Map.of("email",EMAIL,"password",PASSWORD),h),String.class).getStatusCode().value();
            };
            var a=executor.submit(request);var b=executor.submit(request);
            assertThat(List.of(a.get(),b.get())).containsExactlyInAnyOrder(201,409);
        }
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var result=st.executeQuery("SELECT count(*) FROM auth.service_user JOIN auth.user_credential USING(user_id) JOIN auth.analytics_identity USING(user_id)")) {result.next();assertThat(result.getInt(1)).isEqualTo(1);}
    }

    @Test void adminDirectoryIsMaskedPaginatedAndDefaultsToActiveOnly() throws Exception {
        var member=new Browser();String id=member.signup().path("userId").asText();member.login();
        member.get("/api/v1/admin/members",403);
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        String body=admin.get("/api/v1/admin/members",200).toString();assertThat(body).contains("m***@example.invalid").doesNotContain(EMAIL,"passwordHash","recoveryCode");
        admin.get("/api/v1/admin/members?page=-1",400);admin.get("/api/v1/admin/members?size=101",400);
        assertThat(admin.get("/api/v1/admin/members?page=999",200).path("content").size()).isZero();
        member.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",true),200);
        assertThat(admin.get("/api/v1/admin/members",200).path("content").size()).isZero();
        assertThat(admin.get("/api/v1/admin/members?status=PENDING_DELETION",200).path("content").get(0).path("recoverUntil").isTextual()).isTrue();
        assertThat(admin.get("/api/v1/admin/members/"+id,200).path("maskedEmail").asText()).isEqualTo("m***@example.invalid");
        try(var c=DriverManager.getConnection(URL,"ytp_test_directory","");var st=c.createStatement()) {
            assertThatThrownBy(()->st.execute("SELECT login_email FROM auth.service_user")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("SELECT password_hash FROM auth.admin_account")).isInstanceOf(SQLException.class);
        }
    }
    @Test void administratorBootstrapIsExplicitHashedAndNeverOverwritesExistingCredential() throws Exception {
        var file=Files.createTempFile("bootstrap-blocklist-",".txt");Files.writeString(file,PasswordPolicy.hash("passwordpassword"));
        try(var c=DriverManager.getConnection(URL,"postgres","")) {
            c.createStatement().execute("TRUNCATE auth.admin_account CASCADE");
            assertThat(AdminBootstrapCommand.initialize(c,"first_operator",PASSWORD,new PasswordPolicy(file.toString()),passwords)).isTrue();
            assertThat(AdminBootstrapCommand.initialize(c,"replacement_operator","another synthetic password 5678",new PasswordPolicy(file.toString()),passwords)).isFalse();
        } finally {Files.deleteIfExists(file);}
        var browser=new Browser();browser.post("/api/v1/admin/auth/login",Map.of("login","first_operator","password",PASSWORD),200);
    }

    Map<String,Object> pageEvent(UUID id,String route){return Map.of("clientEventId",id,"eventType","PAGE_VIEW","actionKey","route.view","properties",Map.of("routeKey",route));}
    @Test void productEventsDeduplicateConcurrentRetriesAndRejectChangedContentAndPii() throws Exception {
        var b=new Browser();b.signup();b.login();UUID id=UUID.randomUUID();
        b.post("/api/v1/events",pageEvent(id,"game.list"),204);b.post("/api/v1/events",pageEvent(id,"game.list"),204);
        b.post("/api/v1/events",pageEvent(id,"game.detail"),409);
        b.post("/api/v1/events",Map.of("clientEventId",UUID.randomUUID(),"eventType","PAGE_VIEW","actionKey","route.view","properties",Map.of("routeKey","game.list","email",EMAIL)),400);
        b.post("/api/v1/events",Map.of("clientEventId",UUID.randomUUID(),"eventType","SEARCH_EXECUTED","actionKey","games.search.execute","properties",Map.of("totalResultCount",0)),400);
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var row=st.executeQuery("SELECT count(*),count(DISTINCT analytics_session_key),count(DISTINCT analytics_user_key) FROM telemetry.product_event")){row.next();assertThat(row.getInt(1)).isEqualTo(1);assertThat(row.getInt(2)).isEqualTo(1);assertThat(row.getInt(3)).isEqualTo(1);}
        var guest=new Browser();guest.post("/api/v1/events",pageEvent(id,"game.list"),204);
        guest.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204);
    }
    @Test void eventWriterCannotReadIdentitiesOrModifyStoredEvents() throws Exception {
        try(var c=DriverManager.getConnection(URL,"ytp_test_event","");var st=c.createStatement()){
            assertThatThrownBy(()->st.execute("SELECT analytics_user_key FROM telemetry.product_event")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("SELECT * FROM auth.service_user")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("DELETE FROM telemetry.product_event")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("UPDATE telemetry.product_event SET environment='PRODUCTION'")).isInstanceOf(SQLException.class);
        }
    }
    @Test void concurrentSameEventIdStoresOneEventAndMeaningfulNewIdsRemainSeparate() throws Exception {
        UUID event=UUID.randomUUID();
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var a=executor.submit(()->{new Browser().post("/api/v1/events",pageEvent(event,"dashboard"),204);return true;});
            var b=executor.submit(()->{new Browser().post("/api/v1/events",pageEvent(event,"dashboard"),204);return true;});a.get();b.get();
        }
        new Browser().post("/api/v1/events",pageEvent(UUID.randomUUID(),"dashboard"),204);
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var r=st.executeQuery("SELECT count(*) FROM telemetry.product_event")){r.next();assertThat(r.getInt(1)).isEqualTo(2);}
    }

    @Test void settingsPatchRejectsUnknownFieldsAndDetectsConcurrentRevisionWithoutOverwriting() throws Exception {
        var b=new Browser();b.signup();b.login();assertThat(b.get("/api/v1/me/settings",200).path("version").asLong()).isZero();
        b.token();var headers=new HttpHeaders();headers.setContentType(MediaType.APPLICATION_JSON);headers.set("Cookie",b.cookie);headers.set("X-CSRF-TOKEN",b.csrf);
        var request=new HttpEntity<>(Map.of("expectedVersion",0,"changes",Map.of("theme","dark")),headers);
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.PATCH,request,String.class).getStatusCode().value()).isEqualTo(200);
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.PATCH,request,String.class).getStatusCode().value()).isEqualTo(409);
        var invalid=new HttpEntity<>(Map.of("expectedVersion",1,"changes",Map.of("email",EMAIL)),headers);
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.PATCH,invalid,String.class).getStatusCode().value()).isEqualTo(400);
        assertThat(b.get("/api/v1/me/settings",200).at("/values/theme").asText()).isEqualTo("dark");
    }

    @Test void usageReportsCountDistinctAcrossTypesWithoutExposingPseudonymOrRawEvents() throws Exception {
        var b=new Browser();b.signup();b.login();
        b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204);
        b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.detail"),204);
        b.post("/api/v1/events",Map.of("clientEventId",UUID.randomUUID(),"eventType","GAME_VIEW","actionKey","game.detail.view","properties",Map.of("appId",570,"source","DIRECT")),204);
        b.get("/api/v1/admin/usage",403);
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        var usage=admin.get("/api/v1/admin/usage",200);
        assertThat(usage.path("aggregationTimezone").asText()).isEqualTo("Asia/Seoul");
        assertThat(usage.path("activeUsers").path("dau").asLong()).isEqualTo(1);
        assertThat(usage.path("activeSessions").asLong()).isEqualTo(1);
        assertThat(usage.path("observedVisitors").get(0).path("newlyObserved").asLong()).isEqualTo(1);
        assertThat(usage.path("observedVisitors").get(0).path("returningObserved").asLong()).isZero();
        assertThat(usage.path("daily").get(0).path("eventCount").asLong()).isEqualTo(3);
        assertThat(usage.path("daily").get(0).path("sessions").asLong()).isEqualTo(1);
        assertThat(usage.toString()).doesNotContain(EMAIL,"analyticsUserKey","analyticsSessionKey", "passwordHash");
        admin.get("/api/v1/admin/usage?from=2026-10-29&to=2026-10-28",400);
        try(var c=DriverManager.getConnection(URL,"ytp_test_report","");var st=c.createStatement()) {
            assertThatThrownBy(()->st.execute("SELECT * FROM telemetry.product_event")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->st.execute("SELECT login_email FROM auth.service_user")).isInstanceOf(SQLException.class);
        }
    }
    @Test void signupCounterRollsBackWithFailedSignupAndDoesNotDependOnRetainedUserRows() throws Exception {
        new Browser().signup();
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement()) {
            try(var count=st.executeQuery("SELECT sum(signups) FROM service.signup_daily_count")){count.next();assertThat(count.getLong(1)).isEqualTo(1);}
            c.setAutoCommit(false);st.execute("INSERT INTO auth.service_user(login_email) VALUES('rolled-back@example.invalid')");c.rollback();c.setAutoCommit(true);
            try(var count=st.executeQuery("SELECT sum(signups) FROM service.signup_daily_count")){count.next();assertThat(count.getLong(1)).isEqualTo(1);}
            st.execute("DELETE FROM auth.service_user");
            try(var count=st.executeQuery("SELECT sum(signups) FROM service.signup_daily_count")){count.next();assertThat(count.getLong(1)).isEqualTo(1);}
        }
    }

    UUID expireAccountWithRecoveredHistory() throws Exception {
        UUID user;
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement()) {
            try(var row=st.executeQuery("SELECT user_id FROM auth.service_user")){row.next();user=row.getObject(1,UUID.class);}
            st.execute("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at,request_state,closed_at) SELECT user_id,current_timestamp-interval '100 hours',current_timestamp-interval '28 hours','RECOVERED',current_timestamp-interval '30 hours' FROM auth.service_user");
            st.execute("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1");
            st.execute("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) SELECT user_id,current_timestamp-interval '72 hours',current_timestamp FROM auth.service_user");
        }return user;
    }
    @Test void approvedPurgeRemovesLinkedDataAfterExpiryAndAllowsNewIdentityOnRejoin() throws Exception {
        var b=new Browser();String old=b.signup().path("userId").asText();b.login();
        b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200);
        b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204);
        expireAccountWithRecoveredHistory();
        assertThat(privacy.runOnce().purged()).isEqualTo(1);assertThat(privacy.runOnce().claimed()).isZero();
        b.get("/api/v1/auth/me",401);
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement()) {
            for(String table:List.of("auth.service_user","auth.user_credential","auth.recovery_code","auth.analytics_identity","service.user_setting","telemetry.product_event"))
                try(var rows=st.executeQuery("SELECT count(*) FROM "+table)){rows.next();assertThat(rows.getLong(1)).as(table).isZero();}
            try(var rows=st.executeQuery("SELECT count(*) FROM auth.deletion_request WHERE user_id IS NOT NULL")){rows.next();assertThat(rows.getLong(1)).isZero();}
            try(var rows=st.executeQuery("SELECT count(*) FROM security.security_audit_event WHERE actor_id IS NOT NULL OR subject_user_id IS NOT NULL")){rows.next();assertThat(rows.getLong(1)).isZero();}
        }
        assertThat(new Browser().signup().path("userId").asText()).isNotEqualTo(old);
    }
    @Test void purgeFailureDoesNotRestoreAccountOrCommitPartialDeletesAndCanBeRetried() throws Exception {
        var b=new Browser();b.signup();b.login();b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204);expireAccountWithRecoveredHistory();
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement()) {
            st.execute("CREATE FUNCTION auth.test_fail_purge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$");
            st.execute("CREATE TRIGGER test_fail_purge BEFORE DELETE ON auth.service_user FOR EACH ROW EXECUTE FUNCTION auth.test_fail_purge()");
            try {
                assertThat(privacy.runOnce().failed()).isEqualTo(1);
                try(var row=st.executeQuery("SELECT account_status,(SELECT count(*) FROM telemetry.product_event),(SELECT count(*) FROM auth.deletion_request WHERE request_state='PURGE_FAILED') FROM auth.service_user")){
                    row.next();assertThat(row.getString(1)).isEqualTo("PURGING");assertThat(row.getLong(2)).isEqualTo(1);assertThat(row.getLong(3)).isEqualTo(1);
                }
            } finally {st.execute("DROP TRIGGER test_fail_purge ON auth.service_user");st.execute("DROP FUNCTION auth.test_fail_purge()");}
        }
        b.get("/api/v1/auth/me",401);assertThat(privacy.runOnce().purged()).isEqualTo(1);
    }
    @Test void runtimeGuardRejectsMigrationOwnerEvenWithoutDatabaseCreatePrivilege() throws Exception {
        try(var c=DriverManager.getConnection(URL,"ytp_codex","")){
            assertThatThrownBy(()->com.youtopia.security.RuntimeDataSourceGuard.verify(c)).isInstanceOf(IllegalStateException.class);
        }
    }
    @Test void oversizedJsonCannotReachAuthenticationService() throws Exception {
        var result=new Browser().post("/api/v1/auth/login",Map.of("login",EMAIL,"password","x".repeat(40000)),413);
        assertThat(result.path("code").asText()).isEqualTo("REQUEST_TOO_LARGE");
    }

    @Test void auditFailureCannotFinalizeUserLoginAndAdminFailureRemainsReconciliable() throws Exception {
        var member=new Browser();member.signup();
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("synthetic audit outage"))
            .when(audit).write(org.mockito.ArgumentMatchers.eq("LOGIN_SUCCESS"),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any());
        member.post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),503);member.get("/api/v1/auth/me",401);
        org.mockito.Mockito.reset(audit);
        var admin=new Browser();org.mockito.Mockito.doThrow(new org.springframework.dao.DataAccessResourceFailureException("synthetic audit outage"))
            .when(audit).write(org.mockito.ArgumentMatchers.eq("ADMIN_LOGIN"),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any());
        admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),503);admin.get("/api/v1/admin/auth/me",401);
        org.mockito.Mockito.reset(audit);assertThat(lifecycle.reconcilePending().completed()).isEqualTo(1);
        admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
    }
    @Test void actualSignupIntermediateFailureRollsBackAllMandatoryRowsAndSignupCounter() throws Exception {
        try(var connection=DriverManager.getConnection(URL,"postgres","");var st=connection.createStatement()){
            st.execute("CREATE FUNCTION auth.test_signup_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic intermediate failure'; END $$");
            st.execute("CREATE TRIGGER test_signup_failure BEFORE INSERT ON auth.analytics_identity FOR EACH ROW EXECUTE FUNCTION auth.test_signup_failure()");
            try{
                new Browser().post("/api/v1/auth/signup",Map.of("email",EMAIL,"password",PASSWORD),503);
                for(String table:List.of("auth.service_user","auth.user_credential","auth.analytics_identity","service.user_setting","service.signup_daily_count"))
                    try(var rows=st.executeQuery("SELECT count(*) FROM "+table)){rows.next();assertThat(rows.getLong(1)).as(table).isZero();}
            }finally{st.execute("DROP TRIGGER test_signup_failure ON auth.analytics_identity");st.execute("DROP FUNCTION auth.test_signup_failure()");}
        }
    }
    @Test void historicalSearchConversionOnlyCountsSelectionsByReportingEndDay() throws Exception {
        var day=clock.instant().atZone(ZoneId.of("Asia/Seoul")).toLocalDate().minusDays(2);UUID session=UUID.randomUUID(),context=UUID.randomUUID();
        try(var connection=DriverManager.getConnection(URL,"postgres","")){
            try(var insert=connection.prepareStatement("INSERT INTO telemetry.product_event(analytics_session_key,client_event_id,event_type,action_key,environment,recorded_at,search_context_id,total_result_count,payload_fingerprint) VALUES(?,?,'SEARCH_EXECUTED','games.search.execute','LOCAL',?,?,1,decode(repeat('aa',32),'hex'))")){
                insert.setObject(1,session);insert.setObject(2,UUID.randomUUID());insert.setTimestamp(3,Timestamp.from(day.atTime(12,0).atZone(ZoneId.of("Asia/Seoul")).toInstant()));insert.setObject(4,context);insert.executeUpdate();
            }
            try(var insert=connection.prepareStatement("INSERT INTO telemetry.product_event(analytics_session_key,client_event_id,event_type,action_key,environment,recorded_at,search_context_id,app_id,source_code,result_position,payload_fingerprint) VALUES(?,?,'GAME_VIEW','game.detail.view','LOCAL',?,?,570,'SEARCH_RESULT',1,decode(repeat('ab',32),'hex'))")){
                insert.setObject(1,session);insert.setObject(2,UUID.randomUUID());insert.setTimestamp(3,Timestamp.from(day.plusDays(1).atTime(12,0).atZone(ZoneId.of("Asia/Seoul")).toInstant()));insert.setObject(4,context);insert.executeUpdate();
            }
        }
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        assertThat(admin.get("/api/v1/admin/usage?from="+day+"&to="+day,200).at("/searchConversion/0/selectedContexts").asLong()).isZero();
        assertThat(admin.get("/api/v1/admin/usage?from="+day+"&to="+day.plusDays(1),200).at("/searchConversion/0/selectedContexts").asLong()).isEqualTo(1);
    }

    @Test void selfProfileIsPrivateCannotSelectAnotherUserAndNeverClaimsEmailVerification() throws Exception {
        var guest=new Browser();guest.get("/api/v1/me/account",401);var member=new Browser();member.signup();member.login();
        var profile=member.get("/api/v1/me/account",200);assertThat(profile.path("loginEmail").asText()).isEqualTo(EMAIL);
        assertThat(profile.path("emailVerified").asBoolean()).isFalse();assertThat(profile.toString()).doesNotContain("passwordHash","authVersion","recoveryCode");
        member.get("/api/v1/me/account?userId="+UUID.randomUUID(),400);
    }

    @Test void typedEventsMatchActualDatabaseConstraintsAndSearchRequiresAuthenticReceipt() throws Exception {
        var browser=new Browser();browser.token();
        var definitions=List.of(
            Map.of("clientEventId",UUID.randomUUID(),"eventType","SORT_CHANGED","actionKey","games.sort.change","properties",Map.of("sortKey","currentCcu","direction","DESC")),
            Map.of("clientEventId",UUID.randomUUID(),"eventType","FILTER_CHANGED","actionKey","games.filter.change","properties",Map.of("filterKey","platform","filterValue","STEAM")),
            Map.of("clientEventId",UUID.randomUUID(),"eventType","ANALYSIS_VIEW","actionKey","analysis.view","properties",Map.of("appId",570,"analysisType","STEAM")),
            Map.of("clientEventId",UUID.randomUUID(),"eventType","PERIOD_CHANGED","actionKey","analysis.period.change","properties",Map.of("fromPeriod","7d","toPeriod","30d")));
        for(var event:definitions)browser.post("/api/v1/events",event,204);
        String encoded=browser.cookie.substring(browser.cookie.indexOf('=')+1);String id=new String(Base64.getDecoder().decode(encoded),java.nio.charset.StandardCharsets.UTF_8);
        var saved=sessions.findById(id);UUID analytics=UUID.randomUUID();saved.setAttribute("youtopia.analyticsSession",analytics);sessions.save(saved);
        UUID eventId=UUID.randomUUID();var properties=Map.of("totalResultCount",2,"searchContextId",UUID.randomUUID().toString(),"filterKeys",List.of("platform"),"sortKey","currentCcu");
        var event=new com.youtopia.telemetry.ProductEvent(eventId,"SEARCH_EXECUTED","games.search.execute",json.valueToTree(properties),null);
        // This is a synthetic successful-source fixture, not a claim of a connected real game search API.
        String receipt=searchReceipts.issue(analytics,eventId,eventCatalog.validate(event));
        browser.post("/api/v1/events",Map.of("clientEventId",eventId,"eventType","SEARCH_EXECUTED","actionKey","games.search.execute","properties",properties,"searchReceipt",receipt),204);
        browser.post("/api/v1/events",Map.of("clientEventId",UUID.randomUUID(),"eventType","SEARCH_EXECUTED","actionKey","games.search.execute","properties",properties,"searchReceipt",receipt),400);
    }

    @Test void themeDefaultsWithoutRowAndOnlyApprovedAtomicChangesAreAccepted() throws Exception {
        var b=new Browser();b.signup();b.login();var original=b.get("/api/v1/me/settings",200);
        assertThat(original.at("/values/theme").asText()).isEqualTo("system");
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var row=st.executeQuery("SELECT count(*) FROM service.user_setting")){row.next();assertThat(row.getLong(1)).isZero();}
        b.token();var headers=new HttpHeaders();headers.setContentType(MediaType.APPLICATION_JSON);headers.set("Cookie",b.cookie);headers.set("X-CSRF-TOKEN",b.csrf);
        for(var invalid:List.of(json.readTree("{\"theme\":null}"),json.readTree("{\"theme\":7}"),json.readTree("{\"theme\":\"blue\"}"),json.readTree("{\"theme\":\"dark\",\"notifications\":true}"),json.readTree("{\"activeWindowSeconds\":300}"))){
            var response=http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",0,"changes",invalid),headers),String.class);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
        assertThat(b.get("/api/v1/me/settings",200).at("/values/theme").asText()).isEqualTo("system");
        var saved=http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",0,"changes",Map.of("theme","light")),headers),String.class);
        assertThat(saved.getStatusCode().value()).isEqualTo(200);
        var omitted=http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",1,"changes",Map.of()),headers),String.class);
        assertThat(omitted.getStatusCode().value()).isEqualTo(200);assertThat(b.get("/api/v1/me/settings",200).at("/values/theme").asText()).isEqualTo("light");
    }
    @Test void activeSessionExactOpenClosedBoundaryUsesServerTimeAndExcludesFutureEvents() throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","")){
            c.setAutoCommit(false);UUID inside=UUID.randomUUID();
            try(var insert=c.prepareStatement("INSERT INTO telemetry.product_event(analytics_session_key,client_event_id,event_type,action_key,environment,recorded_at,route_key,payload_fingerprint) VALUES(?,?,'PAGE_VIEW','route.view','LOCAL',current_timestamp+?*interval '1 microsecond','game.list',decode(repeat('aa',32),'hex'))")){
                long[] offsets={-300000000L,-299999999L,0,1,-100000000L,1000000L};
                for(int i=0;i<offsets.length;i++){insert.setObject(1,i==1||i>=4?inside:UUID.randomUUID());insert.setObject(2,UUID.randomUUID());insert.setLong(3,offsets[i]);insert.executeUpdate();}
            }
            var source=new org.springframework.jdbc.datasource.SingleConnectionDataSource(c,true);
            var repository=new com.youtopia.reporting.UsageRepository(new org.springframework.jdbc.core.JdbcTemplate(source));
            assertThat(repository.activeSessions("LOCAL",300)).isEqualTo(2);c.rollback();
        }
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);
        admin.post("/api/v1/events",pageEvent(UUID.randomUUID(),"dashboard"),403);
        var empty=admin.get("/api/v1/admin/usage",200);admin.get("/api/v1/admin/usage",200);
        assertThat(empty.path("activeSessions").asLong(-1)).isZero();assertThat(empty.path("activeSessionWindowSeconds").asInt()).isEqualTo(300);
        assertThat(empty.path("activeSessionLabel").asText()).isEqualTo("최근 5분 활동 세션");assertThat(empty.path("activeSessionAsOf").asText()).isNotBlank();
        try(var c=DriverManager.getConnection(URL,"postgres","");var st=c.createStatement();var row=st.executeQuery("SELECT count(*) FROM telemetry.product_event")){row.next();assertThat(row.getLong(1)).isZero();}
    }
    @Test void unapprovedRetentionPolicyCannotEnableNewDeletionOrReactivateExpiredPendingAccount() throws Exception {
        var b=new Browser();b.signup();b.login();
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_control_test","postgres","");var st=c.createStatement()) {st.execute("UPDATE restore_control.policy_item SET approval_status='REVIEW'");}
        b.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",true),503);
        b.get("/api/v1/auth/me",200);
        expireAccountWithRecoveredHistory();b.get("/api/v1/auth/me",401);
        assertThatThrownBy(()->privacy.runOnce()).isInstanceOf(IllegalStateException.class);
    }

    private org.springframework.jdbc.core.JdbcTemplate rootJdbc(String database) {
        var source=new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:postgresql://127.0.0.1:25432/"+database,"postgres","");
        return new org.springframework.jdbc.core.JdbcTemplate(source);
    }
    private com.youtopia.restore.RestoreCoordinator restoreCoordinator(){
        var main=rootJdbc("youtopia_auth_test");var control=rootJdbc("youtopia_control_test");
        return new com.youtopia.restore.RestoreCoordinator(journal,control,main,
            new org.springframework.jdbc.support.JdbcTransactionManager(control.getDataSource()),
            new org.springframework.jdbc.support.JdbcTransactionManager(main.getDataSource()));
    }
    private void isolatedDockerCommand(Path input,Path output,String... arguments) throws Exception {
        var command=new ArrayList<>(List.of("docker","--host=unix:///var/run/docker.sock","exec","-i","youtopia-bootstrap-pg"));
        command.addAll(List.of(arguments));var process=new ProcessBuilder(command);
        if(input!=null)process.redirectInput(input.toFile());
        if(output!=null)process.redirectOutput(output.toFile());else process.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        Path error=Files.createTempFile("youtopia-isolated-restore-error-",".txt");process.redirectError(error.toFile());
        var running=process.start();
        try {assertThat(running.waitFor(30,java.util.concurrent.TimeUnit.SECONDS)).isTrue();assertThat(running.exitValue()).as("isolated PostgreSQL backup/restore command").isZero();}
        finally {running.destroyForcibly();Files.deleteIfExists(error);}
    }
    @Test void stalePostgresBackupReplaysIndependentDeletionStateIdempotentlyBeforeReopening() throws Exception {
        var purged=new Browser();UUID purgedId=UUID.fromString(purged.signup().path("userId").asText());purged.login();
        purged.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200);
        var pending=new Browser();UUID pendingId=UUID.fromString(pending.post("/api/v1/auth/signup",Map.of("email","pending@example.invalid","password",PASSWORD),201).path("userId").asText());
        pending.post("/api/v1/auth/login",Map.of("login","pending@example.invalid","password",PASSWORD),200);
        purged.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204);
        var active=new Browser();UUID activeId=UUID.fromString(active.post("/api/v1/auth/signup",Map.of("email","active@example.invalid","password",PASSWORD),201).path("userId").asText());
        active.post("/api/v1/auth/login",Map.of("login","active@example.invalid","password",PASSWORD),200);
        String staleCode=active.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200).path("codes").get(0).asText();
        Path backup=Files.createTempFile("youtopia-fake-personal-data-backup-",".dump");
        try {
            isolatedDockerCommand(null,backup,"pg_dump","-U","postgres","-Fc","--schema=auth","--schema=service","--schema=security","--schema=telemetry","youtopia_auth_test");
            var main=rootJdbc("youtopia_auth_test");
            // A post-backup session can have the same integer authVersion as backupVersion+1.
            main.update("UPDATE auth.service_user SET auth_version=auth_version+1,row_version=row_version+1 WHERE user_id=?",activeId);
            var coincidentEpoch=new Browser();coincidentEpoch.post("/api/v1/auth/login",Map.of("login","active@example.invalid","password",PASSWORD),200);
            // Seed an already elapsed request with fake data; do not weaken the immutable-deadline trigger.
            var elapsed=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.support.JdbcTransactionManager(main.getDataSource()));
            UUID deleteOperation=UUID.randomUUID();
            Instant requested=main.queryForObject("SELECT current_timestamp-interval '73 hours'",java.sql.Timestamp.class).toInstant();
            long version=main.queryForObject("SELECT auth_version+1 FROM auth.service_user WHERE user_id=?",Long.class,purgedId);
            elapsed.executeWithoutResult(tx->{
                journal.intent(deleteOperation,purgedId,"DELETE_INTENT",requested,requested.plusSeconds(72*3600),version);
                main.update("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1 WHERE user_id=?",purgedId);
                main.update("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) VALUES(?,?,?)",purgedId,Timestamp.from(requested),Timestamp.from(requested.plusSeconds(72*3600)));
            });
            journal.commit(deleteOperation,purgedId,"DELETION_REQUESTED",requested,requested.plusSeconds(72*3600),version);
            assertThat(privacy.runOnce().purged()).isEqualTo(1);
            var deadline=pending.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",true),200).path("recoverUntil").asText();
            long externalCount=rootJdbc("youtopia_control_test").queryForObject("SELECT count(*) FROM restore_control.deletion_journal",Long.class);
            var coordinator=restoreCoordinator();UUID run=coordinator.begin("synthetic-old-backup");
            assertThat(journal.servingAllowed()).isFalse();assertThat(http.getForEntity("/api/v1/auth/csrf",String.class).getStatusCode().value()).isEqualTo(503);
            main.execute("DROP SCHEMA auth,service,security,telemetry CASCADE");
            isolatedDockerCommand(backup,null,"pg_restore","-U","postgres","-d","youtopia_auth_test","--exit-on-error");
            assertThat(main.queryForObject("SELECT count(*) FROM auth.service_user",Long.class)).isEqualTo(3);
            assertThat(rootJdbc("youtopia_control_test").queryForObject("SELECT count(*) FROM restore_control.deletion_journal",Long.class)).isEqualTo(externalCount);
            assertThat(journal.servingAllowed()).isFalse();
            coordinator.replay(run);
            long restoredVersion=main.queryForObject("SELECT auth_version FROM auth.service_user WHERE user_id=?",Long.class,activeId);
            coordinator.replay(run);
            assertThat(main.queryForObject("SELECT auth_version FROM auth.service_user WHERE user_id=?",Long.class,activeId)).isEqualTo(restoredVersion);
            assertThat(main.queryForObject("SELECT count(*) FROM auth.recovery_code WHERE user_id=? AND consumed_at IS NULL AND revoked_at IS NULL",Long.class,activeId)).isZero();
            assertThat(main.queryForObject("SELECT count(*) FROM auth.service_user WHERE user_id=?",Long.class,purgedId)).isZero();
            assertThat(main.queryForObject("SELECT account_status FROM auth.service_user WHERE user_id=?",String.class,pendingId)).isEqualTo("PENDING_DELETION");
            assertThat(main.queryForObject("SELECT recover_until_at FROM auth.deletion_request WHERE user_id=?",java.sql.Timestamp.class,pendingId).toInstant()).isEqualTo(Instant.parse(deadline));
            for(String table:List.of("auth.user_credential","auth.analytics_identity","auth.recovery_code","service.user_setting"))assertThat(main.queryForObject("SELECT count(*) FROM "+table+" WHERE user_id=?",Long.class,purgedId)).isZero();
            assertThat(main.queryForObject("SELECT count(*) FROM telemetry.product_event",Long.class)).isZero();
            assertThat(main.queryForObject("SELECT count(*) FROM security.security_audit_event WHERE actor_kind='USER' AND actor_id=? OR subject_user_id=?",Long.class,purgedId,purgedId)).isZero();
            assertThat(journal.servingAllowed()).isFalse();coordinator.verify(run,true);assertThat(journal.servingAllowed()).isFalse();coordinator.open(run);assertThat(journal.servingAllowed()).isTrue();
            active.get("/api/v1/auth/me",401);coincidentEpoch.get("/api/v1/auth/me",401);
            new Browser().post("/api/v1/auth/password-reset",Map.of("requestKey",UUID.randomUUID(),"email","active@example.invalid","recoveryCode",staleCode,"newPassword","fake restored stale code attempt 5678"),401);
            new Browser().post("/api/v1/auth/login",Map.of("login","pending@example.invalid","password",PASSWORD),401);
            assertThat(rootJdbc("youtopia_control_test").queryForObject("SELECT bool_and(octet_length(subject_tag)=32) FROM restore_control.deletion_journal",Boolean.class)).isTrue();
        } finally {Files.deleteIfExists(backup);}
    }
    @Test void restoreFailuresWrongKeyAndUnresolvedIntentsKeepEveryApiFenced() throws Exception {
        var b=new Browser();b.signup();
        var main=rootJdbc("youtopia_auth_test");var control=rootJdbc("youtopia_control_test");
        UUID user=main.queryForObject("SELECT user_id FROM auth.service_user",UUID.class);
        journal.intent(UUID.randomUUID(),user,"PURGE_INTENT",null,null,2);
        var coordinator=restoreCoordinator();UUID run=coordinator.begin("synthetic-unresolved-backup");
        assertThatThrownBy(()->coordinator.replay(run)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->coordinator.open(run)).isInstanceOf(IllegalStateException.class);
        assertThat(control.queryForObject("SELECT state FROM restore_control.service_fence WHERE service_key='p0-test'",String.class)).isEqualTo("BLOCKED");
        assertThat(http.getForEntity("/api/v1/steam/apps/570/ccu",String.class).getStatusCode().value()).isEqualTo(503);
        control.update("UPDATE restore_control.service_fence SET key_fingerprint=decode(repeat('ff',32),'hex') WHERE service_key='p0-test'");
        assertThatThrownBy(()->coordinator.begin("synthetic-wrong-key")).isInstanceOf(IllegalStateException.class);
        assertThat(journal.servingAllowed()).isFalse();
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_control_test","ytp_test_control_app","");var s=c.createStatement()){
            assertThatThrownBy(()->s.execute("UPDATE restore_control.service_fence SET state='OPEN'")).isInstanceOf(SQLException.class);
            assertThatThrownBy(()->s.execute("DELETE FROM restore_control.deletion_journal")).isInstanceOf(SQLException.class);
        }
    }
    @Test void rolledBackDeletionIntentCancelsOnlyItsAttemptAndUnverifiedRestoreCannotOpen() throws Exception {
        var b=new Browser();UUID user=UUID.fromString(b.signup().path("userId").asText());
        var main=rootJdbc("youtopia_auth_test");var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.support.JdbcTransactionManager(main.getDataSource()));
        UUID operation=UUID.randomUUID();
        tx.executeWithoutResult(status->{journal.intent(operation,user,"PURGE_INTENT",null,null,2);status.setRollbackOnly();});
        assertThat(journal.servingAllowed()).isTrue();
        journal.intent(operation,user,"PURGE_INTENT",null,null,2);assertThat(journal.servingAllowed()).isFalse();
        // A cancelled older attempt must never cancel a new in-flight attempt sharing the business operation.
        assertThat(journal.fence().pending()).isTrue();
        var coordinator=restoreCoordinator();UUID run=coordinator.begin("synthetic-no-verification");
        assertThatThrownBy(()->coordinator.verify(run,false)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->coordinator.open(run)).isInstanceOf(IllegalStateException.class);
        assertThat(journal.servingAllowed()).isFalse();
    }

    @Test void settingsAreOwnUserOnlyCsrfProtectedAndConcurrentRevisionCannotLoseUpdates() throws Exception {
        new Browser().get("/api/v1/me/settings",401);
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);admin.get("/api/v1/me/settings",403);
        var user=new Browser();user.signup();user.login();user.token();
        var h=new HttpHeaders();h.set("Cookie",user.cookie);h.setContentType(MediaType.APPLICATION_JSON);
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",0,"changes",Map.of("theme","dark")),h),String.class).getStatusCode().value()).isEqualTo(403);
        h.set("X-CSRF-TOKEN",user.csrf);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var dark=pool.submit(()->http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",0,"changes",Map.of("theme","dark")),h),String.class).getStatusCode().value());
            var light=pool.submit(()->http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(Map.of("expectedVersion",0,"changes",Map.of("theme","light")),h),String.class).getStatusCode().value());
            assertThat(List.of(dark.get(),light.get())).containsExactlyInAnyOrder(200,409);
        }
        assertThat(user.get("/api/v1/me/settings",200).path("version").asLong()).isEqualTo(1);
        var other=new Browser();other.post("/api/v1/auth/signup",Map.of("email","other@example.invalid","password",PASSWORD),201);other.post("/api/v1/auth/login",Map.of("login","other@example.invalid","password",PASSWORD),200);
        assertThat(other.get("/api/v1/me/settings",200).at("/values/theme").asText()).isEqualTo("system");
        user.get("/api/v1/me/settings?userId="+UUID.randomUUID(),400);
    }
    @Test void latestDeletionStateUsesAuthEpochAndOldBackupCannotReviveRecoveredCredentials() throws Exception {
        var b=new Browser();UUID user=UUID.fromString(b.signup().path("userId").asText());b.login();
        String code=b.post("/api/v1/auth/recovery-codes",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD),200).path("codes").get(0).asText();
        b.post("/api/v1/me/deletion",Map.of("requestKey",UUID.randomUUID(),"currentPassword",PASSWORD,"confirmed",true),200);
        new Browser().post("/api/v1/auth/account-recovery",Map.of("requestKey",UUID.randomUUID(),"email",EMAIL,"recoveryCode",code,"newPassword","new recovered synthetic password 6789"),200);
        Instant old=Instant.now().minusSeconds(1).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        journal.commit(UUID.randomUUID(),user,"DELETION_REQUESTED",old,old.plusSeconds(72*3600),2);
        assertThat(journal.latestCommitted()).hasSize(1);assertThat(journal.latestCommitted().getFirst().phase()).isEqualTo("ACCOUNT_RECOVERED");
        var coordinator=restoreCoordinator();UUID run=coordinator.begin("synthetic-stale-credentials");
        assertThatThrownBy(()->coordinator.replay(run)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->coordinator.open(run)).isInstanceOf(IllegalStateException.class);assertThat(journal.servingAllowed()).isFalse();
    }

    @Test void signupWindowsUseKstCalendarBoundariesAndExcludeFutureCounts() throws Exception {
        var main=rootJdbc("youtopia_auth_test");
        main.update("INSERT INTO service.signup_daily_count(day_kst,signups) SELECT (current_timestamp AT TIME ZONE 'Asia/Seoul')::date+offset_day,amount FROM (VALUES(0,2),(-6,3),(-7,5),(-29,7),(-30,11),(1,13)) fixture(offset_day,amount)");
        var repository=new com.youtopia.reporting.UsageRepository(rootJdbc("youtopia_auth_test"));
        var windows=repository.signupWindows();assertThat(windows.today()).isEqualTo(2);assertThat(windows.last7KstDays()).isEqualTo(5);assertThat(windows.last30KstDays()).isEqualTo(17);
        // Future fixture counts and the day before each inclusive KST window are excluded.
    }

    @Test void independentEventStoreFailureNeverReportsSuccessOrBreaksAccountFlow() throws Exception {
        var member=new Browser();member.signup();member.login();var main=rootJdbc("youtopia_auth_test");
        main.execute("CREATE FUNCTION telemetry.synthetic_event_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic event store error' USING ERRCODE='53000'; END $$");
        main.execute("CREATE TRIGGER synthetic_event_failure BEFORE INSERT ON telemetry.product_event FOR EACH ROW EXECUTE FUNCTION telemetry.synthetic_event_failure()");
        try {
            member.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),503);
            member.get("/api/v1/me/account",200);new Browser().login();
            assertThat(main.queryForObject("SELECT count(*) FROM telemetry.product_event",Long.class)).isZero();
            assertThat(main.queryForObject("SELECT count(*) FROM auth.service_user",Long.class)).isEqualTo(1);
        } finally {main.execute("DROP TRIGGER synthetic_event_failure ON telemetry.product_event");main.execute("DROP FUNCTION telemetry.synthetic_event_failure()");}
    }

    private boolean awaitBlockedSql(String pattern) throws Exception {
        long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
        while(System.nanoTime()<deadline){
            if(Boolean.TRUE.equals(rootJdbc("youtopia_auth_test").queryForObject("SELECT EXISTS(SELECT FROM pg_stat_activity WHERE datname='youtopia_auth_test' AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE ?)",Boolean.class,pattern)))return true;
            Thread.sleep(20);
        }
        return false;
    }
    @Test void deletionWinningRaceRejectsOldAuthenticatedEventBeforeMemberLinkCanBeStored() throws Exception {
        var b=new Browser();b.signup();b.login();
        try(var c=DriverManager.getConnection(URL,"postgres","");var pool=java.util.concurrent.Executors.newSingleThreadExecutor()){
            c.setAutoCommit(false);
            try(var s=c.createStatement()){
                s.execute("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1");
                s.execute("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) SELECT user_id,current_timestamp,current_timestamp+interval '72 hours' FROM auth.service_user");
            }
            var pending=pool.submit(()->b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),401));
            try {assertThat(awaitBlockedSql("%analytics_identity%FOR SHARE OF u%")).isTrue();}
            finally {c.commit();}
            pending.get(10,java.util.concurrent.TimeUnit.SECONDS);
            assertThat(rootJdbc("youtopia_auth_test").queryForObject("SELECT count(*) FROM telemetry.product_event",Long.class)).isZero();
        }
    }
    @Test void eventWinningRaceCommitsBeforeDeletionCanProceedAndPurgeLeavesNoLateLinkedEvent() throws Exception {
        var b=new Browser();b.signup();b.login();var main=rootJdbc("youtopia_auth_test");
        var inserted=new java.util.concurrent.CountDownLatch(1);var release=new java.util.concurrent.CountDownLatch(1);
        org.mockito.Mockito.doAnswer(call->{Object result=call.callRealMethod();inserted.countDown();if(!release.await(5,java.util.concurrent.TimeUnit.SECONDS))throw new IllegalStateException("synthetic timing barrier expired");return result;})
            .when(eventPersistence).insert(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any());
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var event=pool.submit(()->b.post("/api/v1/events",pageEvent(UUID.randomUUID(),"game.list"),204));
            assertThat(inserted.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            var deletion=pool.submit(()->{
                var tx=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.support.JdbcTransactionManager(main.getDataSource()));
                tx.executeWithoutResult(state->{
                    main.update("UPDATE auth.service_user SET account_status='PENDING_DELETION',auth_version=auth_version+1,row_version=row_version+1");
                    main.update("INSERT INTO auth.deletion_request(user_id,requested_at,recover_until_at) SELECT user_id,current_timestamp-interval '73 hours',current_timestamp-interval '1 hour' FROM auth.service_user");
                });
            });
            try {assertThat(awaitBlockedSql("UPDATE auth.service_user SET account_status='PENDING_DELETION'%")).isTrue();}
            finally {release.countDown();}
            event.get(10,java.util.concurrent.TimeUnit.SECONDS);deletion.get(10,java.util.concurrent.TimeUnit.SECONDS);
            org.mockito.Mockito.reset(eventPersistence);
            assertThat(privacy.runOnce().purged()).isEqualTo(1);
            assertThat(main.queryForObject("SELECT count(*) FROM telemetry.product_event",Long.class)).isZero();
        } finally {release.countDown();org.mockito.Mockito.reset(eventPersistence);}
    }

    @Test void runtimeIdentitiesCannotCreateAlterDropOrEscalateServicePrivileges() throws Exception {
        for(String role:List.of("ytp_test_member","ytp_test_admin","ytp_test_event","ytp_test_audit","ytp_test_report","ytp_test_directory","ytp_test_privacy")){
            try(var c=DriverManager.getConnection(URL,role,"");var statement=c.createStatement()){
                c.setAutoCommit(false);
                for(String forbidden:List.of("CREATE SCHEMA synthetic_forbidden_schema","CREATE TABLE service.synthetic_forbidden_table(id integer)","ALTER TABLE auth.service_user ADD COLUMN synthetic_forbidden_column integer","DROP TABLE auth.service_user")){
                    Throwable error=catchThrowable(()->statement.execute(forbidden));c.rollback();
                    assertThat(error).as("Forbidden service DDL for %s",role).isInstanceOf(SQLException.class);
                    assertThat(((SQLException)error).getSQLState()).isEqualTo("42501");
                }
            }
        }
        try(var c=DriverManager.getConnection(URL,"ytp_test_member","");var statement=c.createStatement()){
            c.setAutoCommit(false);
            // PostgreSQL can return a warning for an ineffective GRANT: verify the effective privilege.
            statement.execute("GRANT SELECT ON auth.service_user TO ytp_test_audit");
            try(var row=statement.executeQuery("SELECT has_table_privilege('ytp_test_audit','auth.service_user','SELECT')")){row.next();assertThat(row.getBoolean(1)).isFalse();}
            c.rollback();
        }
    }

    private void gameFixtures() throws Exception {
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=c.createStatement()){
            statement.execute("TRUNCATE service.game_catalog_fixture,collector.ccu_fixture");
            statement.execute("INSERT INTO service.game_catalog_fixture(app_id,steam_name,developers,steam_tracked) VALUES(570,'Synthetic Arena','[\"Synthetic Studio\"]',true),(730,'Synthetic Arena',null,false),(900,'100%_literal',null,true)");
            try(var insert=c.prepareStatement("INSERT INTO collector.ccu_fixture(observation_id,app_id,scheduled_at,observed_at,player_count) VALUES(?,?,?,?,?)")){
                long[] ids={570,730,570,570};long[] counts={0,200,5000,7000};long[] seconds={-10,-30,10,-90000};
                for(int i=0;i<ids.length;i++){insert.setLong(1,i+1);insert.setLong(2,ids[i]);insert.setTimestamp(3,Timestamp.from(clock.now.plusSeconds(seconds[i])));insert.setTimestamp(4,Timestamp.from(clock.now.plusSeconds(seconds[i])));insert.setLong(5,counts[i]);insert.executeUpdate();}
            }
        }
    }
    @Test void gameListAndDetailUseActualRestrictedQueryStablePaginationAndRealZero() throws Exception {
        gameFixtures();var b=new Browser();b.signup();b.login();
        var result=b.get("/api/v1/games?sort=currentCcu&direction=DESC&size=1",200);
        assertThat(result.path("content").get(0).path("steamAppId").asLong()).isEqualTo(730);
        assertThat(result.path("page").path("totalElements").asLong()).isEqualTo(3);
        var second=b.get("/api/v1/games?sort=name&size=1&page=1",200);assertThat(second.path("content").get(0).path("steamAppId").asLong()).isEqualTo(570);
        var detail=b.get("/api/v1/games/steam:570",200);
        assertThat(detail.at("/game/currentCcu/value").asLong(-1)).isZero();assertThat(detail.at("/game/peak24h/value").asLong(-1)).isZero();
        assertThat(detail.at("/game/newYoutubeVideos/availability").asText()).isEqualTo("UNAVAILABLE");assertThat(detail.at("/steamPreview/days").asInt()).isEqualTo(30);
        assertThat(b.get("/api/v1/games?q=100%_literal",200).path("content").size()).isEqualTo(1);
        assertThat(b.get("/api/v1/games?page=2147483647",200).path("content").size()).isZero();
        b.get("/api/v1/games/steam:999",404);b.get("/api/v1/games/steam:4294967296",400);
        for(String query:List.of("sort=password_hash","platform=YOUTUBE","q=a&q=b","size=101","page=-1","direction=DESC%3BDROP"))b.get("/api/v1/games?"+query,400);
        assertThat(b.get("/api/v1/games?connectionStatus=CONNECTED",200).path("page").path("totalElements").asLong()).isEqualTo(2);
    }
    @Test void gameSearchProofIsIssuedByRealQueryAndNeverContainsKeywordOrStoresAnEventAutomatically() throws Exception {
        gameFixtures();var b=new Browser();b.signup();b.login();UUID id=UUID.randomUUID();
        var found=b.post("/api/v1/games/search",Map.of("q","Synthetic","clientEventId",id),200);
        assertThat(found.at("/searchTracking/availability").asText()).isEqualTo("AVAILABLE");
        assertThat(found.at("/searchTracking/properties/totalResultCount").asInt()).isEqualTo(2);
        try(var c=DriverManager.getConnection(URL,"postgres","");var statement=c.createStatement();var row=statement.executeQuery("SELECT count(*) FROM telemetry.product_event")){row.next();assertThat(row.getLong(1)).isZero();}
        var tracking=found.path("searchTracking");
        b.post("/api/v1/events",Map.of("clientEventId",id,"eventType","SEARCH_EXECUTED","actionKey","games.search.execute","properties",tracking.path("properties"),"searchReceipt",tracking.path("receipt").asText()),204);
        var empty=b.post("/api/v1/games/search",Map.of("q","never matches this synthetic game","clientEventId",UUID.randomUUID()),200);
        assertThat(empty.path("content").isEmpty()).isTrue();assertThat(empty.at("/searchTracking/properties/totalResultCount").asInt(-1)).isZero();
        var other=new Browser();other.post("/api/v1/auth/login",Map.of("login",EMAIL,"password",PASSWORD),200);
        var unrecorded=empty.path("searchTracking");
        other.post("/api/v1/events",Map.of("clientEventId",unrecorded.path("clientEventId").asText(),"eventType","SEARCH_EXECUTED","actionKey","games.search.execute","properties",unrecorded.path("properties"),"searchReceipt",unrecorded.path("receipt").asText()),400);
    }
    @Test void publicGameReadsKeepPersonalAuthorizationAndSourceFailureDistinct() throws Exception {
        gameFixtures();var guest=new Browser();guest.get("/api/v1/games",200);guest.get("/api/v1/me/settings",401);
        var admin=new Browser();admin.post("/api/v1/admin/auth/login",Map.of("login","operator","password",PASSWORD),200);admin.get("/api/v1/games",200);admin.get("/api/v1/me/settings",403);
        var b=new Browser();b.signup();b.login();
        assertThat(http.postForEntity("/api/v1/games/search",Map.of("q","Synthetic","clientEventId",UUID.randomUUID()),String.class).getStatusCode().value()).isEqualTo(403);
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=c.createStatement()){
            statement.execute("REVOKE SELECT ON service.v_game_catalog FROM ytp_test_data_ro");
            try{guest.get("/api/v1/games",503);b.get("/api/v1/games",503);b.get("/api/v1/me/account",200);}
            finally{statement.execute("GRANT SELECT ON service.v_game_catalog TO ytp_test_data_ro");}
        }
    }

    private Instant chartFixtures() throws Exception {
        gameFixtures();Instant first=clock.now.truncatedTo(java.time.temporal.ChronoUnit.MICROS).minusSeconds(4*604800L);
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=c.createStatement()){
            statement.execute("TRUNCATE collector.video_chart_fixture,service.app_type_fixture,service.ranking_chart_fixture");
            statement.execute("INSERT INTO service.app_type_fixture VALUES(570,'game'),(570,'game'),(730,'dlc'),(900,null)");
            try(var insert=c.prepareStatement("INSERT INTO collector.video_chart_fixture VALUES(?,?,?,?,?)")){
                for(int i=0;i<3;i++){insert.setLong(1,i+1);insert.setString(2,"abcdefghijk");insert.setTimestamp(3,Timestamp.from(clock.now.plusSeconds(i==0?-7200:i==1?-600:10)));insert.setTimestamp(4,Timestamp.from(clock.now.plusSeconds(i==0?-7190:i==1?-590:11)));insert.setLong(5,i==0?200:i==1?150:9000);insert.executeUpdate();}
            }
            try(var insert=c.prepareStatement("INSERT INTO collector.ccu_fixture VALUES(100,null,570,?,?,100)")){insert.setTimestamp(1,Timestamp.from(clock.now.minusSeconds(86410)));insert.setTimestamp(2,Timestamp.from(clock.now.minusSeconds(86410)));insert.executeUpdate();}
            try(var insert=c.prepareStatement("INSERT INTO service.ranking_chart_fixture VALUES(?,?,?,?,?,?,?,?,?,?)")){
                for(int week=0;week<3;week++)for(int app=1;app<=(week==0?2:3);app++){
                    insert.setLong(1,week+1);insert.setString(2,"weekly_native");insert.setString(3,"KR");insert.setString(4,"sales");insert.setTimestamp(5,Timestamp.from(first.plusSeconds(week*604800L)));insert.setTimestamp(6,Timestamp.from(first.plusSeconds((week+1)*604800L)));insert.setTimestamp(7,Timestamp.from(first.plusSeconds((week+1)*604800L+1)));insert.setLong(8,app);insert.setString(9,"Synthetic ranking app");insert.setInt(10,app==1?10-week:app==2?20+week:30+week);insert.executeUpdate();
                }
                for(int app=1;app<=2;app++){insert.setLong(1,10);insert.setNull(3,Types.VARCHAR);insert.setLong(8,app);insert.setInt(10,app==1?5:22);insert.executeUpdate();}
            }
        }
        return first;
    }
    @Test void observedChartsUseRealCanonicalQueriesAndNeverFillMissingComparisons() throws Exception {
        chartFixtures();var b=new Browser();b.signup();b.login();
        var ccu=b.get("/api/v1/charts/steam/ccu?appIds=570,730",200);
        assertThat(ccu.at("/exact24Hours/down").asInt()).isEqualTo(1);assertThat(ccu.at("/exact24Hours/excluded").asInt()).isEqualTo(1);
        var video=b.get("/api/v1/youtube/videos/abcdefghijk/observations",200);
        assertThat(video.at("/comparison/first/views").asLong()).isEqualTo(200);assertThat(video.at("/comparison/last/views").asLong()).isEqualTo(150);assertThat(video.at("/comparison/cumulativeDifference").asLong()).isEqualTo(-50);
        assertThat(video.path("mappingBasis").asText()).isEqualTo("NATIVE_VIDEO_ID_NO_GAME_MAPPING");
        var types=b.get("/api/v1/charts/steam/app-types",200);assertThat(types.at("/composition/total").asLong()).isEqualTo(3);assertThat(types.at("/composition/unknown").asLong()).isEqualTo(1);
        for(String path:List.of("/api/v1/charts/steam/ccu?appIds=570,570","/api/v1/charts/steam/ccu?appIds=0","/api/v1/charts/steam/ccu?appIds=570&days=1","/api/v1/youtube/videos/not-valid/observations"))b.get(path,400);
        new Browser().get("/api/v1/charts/steam/app-types",200);
    }
    @Test void rankingEndpointKeepsCountriesPeriodsAndAllEightChartResultsConsistent() throws Exception {
        Instant first=chartFixtures();var b=new Browser();b.signup();b.login();String base="/api/v1/charts/steam/rankings?source=weekly_native&category=sales&from="+first+"&to="+first.plusSeconds(2*604800L);
        var report=b.get(base,200);var charts=report.path("charts");
        assertThat(report.path("calculationVersion").asText()).isEqualTo("source-weekly-rank-v1");
        assertThat(charts.path("weeks").size()).isEqualTo(3);assertThat(charts.path("lastThreeWeekTrends").size()).isEqualTo(2);
        assertThat(charts.at("/weeks/2/kr/up").asInt()).isEqualTo(1);assertThat(charts.at("/weeks/2/kr/down").asInt()).isEqualTo(2);
        assertThat(charts.at("/weeks/2/unspecified/country").asText()).isEqualTo("UNSPECIFIED");assertThat(charts.at("/weeks/2/pairs").size()).isEqualTo(2);
        assertThat(charts.at("/top20Continuity/0/everyWeekTop20").asLong()).isEqualTo(1);
        b.get("/api/v1/charts/steam/rankings?source=weekly_native&category=sales&from=2026-10-01&to=2026-10-08",400);
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=c.createStatement()){
            statement.execute("REVOKE SELECT ON service.v_weekly_rank_observation FROM ytp_test_data_ro");
            try{b.get(base,503);}finally{statement.execute("GRANT SELECT ON service.v_weekly_rank_observation TO ytp_test_data_ro");}
        }
    }

    @Test void youtubeQueryAssociationsDeduplicateLinksAndKeepAccelerationPolicyUnavailable() throws Exception {
        chartFixtures();var b=new Browser();b.signup();b.login();
        try(var c=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=c.createStatement()){
            statement.execute("TRUNCATE service.video_association_fixture");
            statement.execute("INSERT INTO service.video_association_fixture VALUES(570,'abcdefghijk',current_timestamp-interval '1 day',current_timestamp),(570,'abcdefghijk',current_timestamp-interval '1 day',current_timestamp),(570,'missing1234',current_timestamp-interval '1 day',current_timestamp)");
        }
        var result=b.get("/api/v1/charts/youtube/query-associations?appIds=570,730",200);
        assertThat(result.at("/content/0/queryAssociatedVideos").asLong()).isEqualTo(2);assertThat(result.at("/content/0/comparableVideos").asLong()).isEqualTo(1);
        assertThat(result.at("/content/0/comparableRatio").asDouble()).isEqualTo(0.5);assertThat(result.at("/content/1/comparableRatio").isNull()).isTrue();
        assertThat(result.path("relevanceVerification").asText()).isEqualTo("UNASSESSED");assertThat(result.path("accelerationAvailability").asText()).isEqualTo("UNAVAILABLE");
    }

    @Test void malformedChartSourceIsServiceFailureRatherThanBadClientInputOrEmptyData() throws Exception {
        Instant first=chartFixtures();var browser=new Browser();browser.signup();browser.login();
        String ranking="/api/v1/charts/steam/rankings?source=weekly_native&category=sales&from="+first+"&to="+first.plusSeconds(2*604800L);
        try(var connection=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:25432/youtopia_test","postgres","");var statement=connection.createStatement()){
            statement.execute("INSERT INTO service.app_type_fixture VALUES(570,'dlc')");
            browser.get("/api/v1/charts/steam/app-types",503);
            statement.execute("DELETE FROM service.app_type_fixture WHERE app_id=570 AND app_type='dlc'");
            browser.get("/api/v1/charts/steam/app-types",200);
            statement.execute("UPDATE service.ranking_chart_fixture SET country_code=null WHERE ranking_run_id=1 AND app_id=1");
            browser.get(ranking,503);
        }
        browser.get("/api/v1/me/account",200);
    }

    @Test void staleTabCannotReadOrUpdateAnotherAccountsSettings() throws Exception {
        var browser=new Browser();browser.signup();String id=browser.login().path("id").asText();browser.token();
        var headers=new HttpHeaders();headers.set("Cookie",browser.cookie);headers.set("X-CSRF-TOKEN",browser.csrf);headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(AccountContext.HEADER,UUID.randomUUID().toString());
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.GET,new HttpEntity<>(headers),String.class).getStatusCode().value()).isEqualTo(409);
        var patch=Map.of("expectedVersion",0,"changes",Map.of("theme","dark"));
        var denied=http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(patch,headers),String.class);
        assertThat(denied.getStatusCode().value()).isEqualTo(409);assertThat(json.readTree(denied.getBody()).path("code").asText()).isEqualTo("ACCOUNT_CONTEXT_CHANGED");
        assertThat(browser.get("/api/v1/me/settings",200).at("/values/theme").asText()).isEqualTo("system");
        headers.set(AccountContext.HEADER,id);
        assertThat(http.exchange("/api/v1/me/settings",HttpMethod.PATCH,new HttpEntity<>(patch,headers),String.class).getStatusCode().value()).isEqualTo(200);
        headers.set(AccountContext.HEADER,"invalid");assertThat(http.exchange("/api/v1/me/settings",HttpMethod.GET,new HttpEntity<>(headers),String.class).getStatusCode().value()).isEqualTo(400);
    }

    @Test void rankingPeriodChoicesComeOnlyFromObservedRestrictedSourceDimensions() throws Exception {
        chartFixtures();var browser=new Browser();browser.signup();browser.login();
        var choices=browser.get("/api/v1/charts/steam/ranking-periods",200);assertThat(choices.path("content")).hasSize(3);
        for(var period:choices.path("content")){assertThat(period.path("source").asText()).isEqualTo("weekly_native");assertThat(period.path("category").asText()).isEqualTo("sales");assertThat(period.path("start").asText()).endsWith("Z");}
        browser.get("/api/v1/charts/steam/ranking-periods?source=fabricated",400);new Browser().get("/api/v1/charts/steam/ranking-periods",200);
    }

    @Test void anonymousPublicSearchAndChartsDoNotGrantPersonalOrAdminAccessAndSurviveLogout() throws Exception {
        Instant first=chartFixtures();var guest=new Browser();
        assertThat(guest.get("/api/v1/games",200).path("content")).isNotEmpty();
        assertThat(guest.get("/api/v1/games/steam:570",200).at("/game/steamAppId").asLong()).isEqualTo(570);
        assertThat(guest.post("/api/v1/games/search",Map.of("q","Synthetic","clientEventId",UUID.randomUUID()),200).path("content")).isNotEmpty();
        for(String path:List.of("/api/v1/charts/steam/ranking-periods","/api/v1/charts/steam/ccu?appIds=570",
            "/api/v1/charts/steam/app-types","/api/v1/youtube/videos/abcdefghijk/observations",
            "/api/v1/charts/steam/rankings?source=weekly_native&category=sales&from="+first+"&to="+first.plusSeconds(2*604800L)))guest.get(path,200);
        for(String path:List.of("/api/v1/me/settings","/api/v1/me/account","/api/v1/admin/members","/api/v1/auth/me",
            "/api/v1/charts/youtube/query-associations?appIds=570"))guest.get(path,401);
        guest.signup();guest.login();guest.get("/api/v1/me/settings",200);
        guest.post("/api/v1/auth/logout",Map.of(),204);
        guest.get("/api/v1/auth/me",401);guest.get("/api/v1/me/settings",401);guest.get("/api/v1/games",200);
    }

}
