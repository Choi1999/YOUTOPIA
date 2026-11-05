package com.youtopia.youtube.metadata.synthetic;

import java.net.InetAddress;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.server.ConfigurableWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Strictly test-classpath Spring Boot server:
 * not a production class, no application migration, no database, no Redis,
 * no real metadata transport, no real credentials or account session.
 *
 * Run only using the explicitly named test-only Gradle JavaExec task.
 * The server listens on LOOPBACK, port 8765 and serves ONLY synthetic GETs.
 * All other routes and writes are denied.
 */
@SpringBootApplication(
        scanBasePackageClasses = MetadataSyntheticLoopbackApplication.class,
        excludeName = {
            "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration",
            "org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration",
            "org.springframework.boot.data.redis.autoconfigure.DataRedisRepositoriesAutoConfiguration",
            "org.springframework.boot.session.autoconfigure.SessionAutoConfiguration"
        })
public class MetadataSyntheticLoopbackApplication {
    public static void main(String[] args) {
        if (args.length != 0)
            throw new IllegalArgumentException("R04X_NO_COMMAND_LINE_OPTIONS");
        SpringApplication app = new SpringApplication(MetadataSyntheticLoopbackApplication.class);
        app.setAddCommandLineProperties(false);
        app.setDefaultProperties(Map.of(
                "spring.profiles.active", "metadata-offline-test",
                "youtopia.metadata.synthetic-http.enabled", "true",
                "server.address", "127.0.0.1",
                "server.port", "8765",
                "spring.main.banner-mode", "off"));
        app.run();
    }

    /** Last customizer enforces loopback even if a default server property differs. */
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    WebServerFactoryCustomizer<ConfigurableWebServerFactory> onlyLoopback() {
        return server -> {
            try {
                server.setAddress(InetAddress.getByName("127.0.0.1"));
            } catch (java.net.UnknownHostException impossible) {
                throw new IllegalStateException("R04X_LOOPBACK_UNAVAILABLE");
            }
        };
    }

    @Bean
    SecurityFilterChain syntheticOnlySecurity(HttpSecurity http) throws Exception {
        // GET synthetic endpoints are public on *loopback only* so the
        // local Vite proxy can run without production accounts/DB/Redis.
        // Every other request has denied access, including real YouTube reads.
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET,
                    "/api/v1/youtube/metadata/synthetic/videos/*",
                    "/api/v1/youtube/metadata/synthetic/channels/*",
                    "/api/v1/youtube/metadata/synthetic/handles/*").permitAll()
                .anyRequest().denyAll())
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable);
        return http.build();
    }
}
