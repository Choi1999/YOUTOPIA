package com.youtopia.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.youtopia.steam.service.CcuRequestBudget;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.assertj.core.api.Assertions.*;

/** Deliberately fixed, loopback-only disposable test endpoints. No production env variables. */
@org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BackendIntegrationTest {
    static final String URL = "jdbc:postgresql://127.0.0.1:25432/youtopia_test";
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    @Autowired SessionRepository<? extends Session> sessions;
    @Autowired StringRedisTemplate redis;
    @Autowired CcuRequestBudget budget;

    @DynamicPropertySource
    static void isolatedServices(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> URL);
        properties.add("spring.datasource.username", () -> "ytp_test_data_ro");
        properties.add("spring.datasource.password", () -> "");
        properties.add("spring.data.redis.host", () -> "127.0.0.1");
        properties.add("spring.data.redis.port", () -> 26379);
        properties.add("spring.data.redis.username", () -> "");
        properties.add("spring.data.redis.password", () -> "");
        properties.add("spring.data.redis.ssl.enabled", () -> false);
        properties.add("spring.session.data.redis.namespace", () -> "youtopia:bootstrap-integration");
        properties.add("youtopia.ccu.requests-per-minute", () -> 4);
    }

    @BeforeEach
    void fixture() throws SQLException {
        redis.delete("youtopia:bootstrap-integration:limits:ccu");
        try (var connection = DriverManager.getConnection(URL, "postgres", ""); var sql = connection.createStatement()) {
            assertThat(connection.getMetaData().getDatabaseMajorVersion()).isEqualTo(16);
            assertThat(connection.getCatalog()).isEqualTo("youtopia_test");
            sql.execute("TRUNCATE collector.ccu_fixture");
            sql.execute("""
                INSERT INTO collector.ccu_fixture VALUES
                (1,1,570,now()-interval '2 hours',now()-interval '119 minutes',10),
                (2,1,570,now()-interval '2 hours',now()-interval '118 minutes',20),
                (3,1,570,now()-interval '1 hour',now()-interval '59 minutes',0),
                (4,1,570,now()+interval '1 hour',now()+interval '61 minutes',999),
                (5,1,570,now()-interval '31 days',now()-interval '31 days',999),
                (6,1,730,now()-interval '1 hour',now()-interval '59 minutes',999),
                (7,1,570,now()-interval '2 hours',now()-interval '118 minutes',21)
                """);
        }
    }

    @Test
    void realPostgresQueryKeepsLatestSlotObservationAndActualZero() throws Exception {
        var response = http.getForEntity("/api/v1/steam/apps/570/ccu?days=7", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var json = mapper.readTree(response.getBody());
        assertThat(json.path("points").size()).isEqualTo(2);
        assertThat(json.at("/points/0/playerCount").asLong()).isEqualTo(21);
        assertThat(json.at("/points/1/playerCount").asLong()).isZero();
        assertThat(json.at("/peak24h/value").asLong()).isEqualTo(21);
        assertThat(json.at("/latestObservedCcu/value").asLong()).isZero();
        assertThat(json.path("lastObservedAt").asText()).endsWith("Z");
    }

    @Test
    void emptySeriesDoesNotClaimThatUnknownGameDoesNotExist() throws Exception {
        var response = http.getForEntity("/api/v1/steam/apps/999999999/ccu", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mapper.readTree(response.getBody()).path("dataStatus").asText()).isEqualTo("EMPTY");
    }

    @Test
    void leastPrivilegeRoleCannotReadSourcesOrAccountsOrChangeDataOrSchema() throws SQLException {
        try (var connection = DriverManager.getConnection(URL, "ytp_test_data_ro", "")) {
            assertThat(connection.getMetaData().getUserName()).isEqualTo("ytp_test_data_ro");
            assertForbidden(connection, "SELECT * FROM collector.ccu_fixture");
            assertForbidden(connection, "SELECT artifact_id FROM collector.v_steam_ccu_canonical");
            assertForbidden(connection, "SELECT * FROM raw.test_private");
            assertForbidden(connection, "SELECT * FROM auth.service_user");
            assertForbidden(connection, "INSERT INTO collector.ccu_fixture(observation_id) VALUES(999)");
            assertForbidden(connection, "UPDATE collector.ccu_fixture SET player_count=1");
            assertForbidden(connection, "DELETE FROM collector.ccu_fixture");
            assertForbidden(connection, "TRUNCATE collector.ccu_fixture");
            assertForbidden(connection, "CREATE TABLE collector.forbidden(id int)");
            assertForbidden(connection, "ALTER VIEW collector.v_steam_ccu_canonical RENAME TO forbidden");
            assertForbidden(connection, "DROP VIEW collector.v_steam_ccu_canonical");
        }
    }

    @Test
    void corruptCanonicalValueIsServiceFailureRatherThanFabricatedZero() throws Exception {
        try (var connection = DriverManager.getConnection(URL, "postgres", ""); var sql = connection.createStatement()) {
            sql.execute("UPDATE collector.ccu_fixture SET player_count=NULL WHERE observation_id=3");
        }
        var response = http.getForEntity("/api/v1/steam/apps/570/ccu", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(mapper.readTree(response.getBody()).path("code").asText()).isEqualTo("DATA_SOURCE_ERROR");
    }

    @Test
    void sharedRedisBudgetIsAtomicUnderConcurrentRequests() throws Exception {
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(8)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            var futures = java.util.stream.IntStream.range(0,8).mapToObj(i -> executor.submit(() -> {
                start.await();
                try { budget.acquire(); return true; }
                catch (CcuRequestBudget.BudgetExceededException exception) {
                    assertThat(exception.retryAfter()).isBetween(1L,60L);
                    return false;
                }
            })).toList();
            start.countDown();
            int accepted=0;
            for (var future : futures) if (future.get(5,java.util.concurrent.TimeUnit.SECONDS)) accepted++;
            assertThat(accepted).isEqualTo(4);
            assertThat(redis.getExpire("youtopia:bootstrap-integration:limits:ccu")).isBetween(1L,60L);
        }
    }

    @Test
    void csrfSessionLivesInRealRedisAndCookieHasProductionProtection() throws Exception {
        var response = http.getForEntity("/api/v1/auth/csrf", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String cookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("YOUTOPIA_SESSION=", "HttpOnly", "Secure", "SameSite=Lax");
        String encodedId = cookie.substring(cookie.indexOf('=') + 1, cookie.indexOf(';'));
        String id = new String(java.util.Base64.getDecoder().decode(encodedId), java.nio.charset.StandardCharsets.UTF_8);
        Session stored = sessions.findById(id);
        assertThat(stored).isNotNull();
        assertThat(stored.getMaxInactiveInterval()).isEqualTo(java.time.Duration.ofMinutes(60));
        var headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE, cookie.split(";", 2)[0]);
        var resumed = http.exchange("/api/v1/auth/csrf", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(resumed.getStatusCode()).isEqualTo(HttpStatus.OK);
        // XOR CSRF rendering can change, but both requests use the same persisted session.
        assertThat(resumed.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).isNull();
        sessions.deleteById(id);
    }

    private void assertForbidden(Connection connection, String sql) {
        assertThatThrownBy(() -> {
            try (var statement = connection.createStatement()) { statement.execute(sql); }
        }).isInstanceOf(SQLException.class).extracting(e -> ((SQLException)e).getSQLState()).isEqualTo("42501");
    }
    @Test void independentlyConfiguredRedisNamespacesDoNotConsumeEachOthersBudget() {
        var first=new com.youtopia.security.RedisKeyspace("youtopia:namespace-first-"+java.util.UUID.randomUUID());
        var second=new com.youtopia.security.RedisKeyspace("youtopia:namespace-second-"+java.util.UUID.randomUUID());
        var a=new CcuRequestBudget(redis,1,first);var b=new CcuRequestBudget(redis,1,second);
        try {
            a.acquire();b.acquire();
            assertThatThrownBy(a::acquire).isInstanceOf(CcuRequestBudget.BudgetExceededException.class);
            assertThatThrownBy(b::acquire).isInstanceOf(CcuRequestBudget.BudgetExceededException.class);
            assertThat(redis.getExpire(first.key("limits:ccu"))).isBetween(1L,60L);
            assertThat(redis.getExpire(second.key("limits:ccu"))).isBetween(1L,60L);
        } finally {redis.delete(java.util.List.of(first.key("limits:ccu"),second.key("limits:ccu")));}
    }

}
