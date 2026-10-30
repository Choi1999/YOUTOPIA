package com.youtopia.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.api.ApiProblems;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfException;

@Configuration
public class SecurityConfiguration {
    @org.springframework.beans.factory.annotation.Autowired
    org.springframework.beans.factory.ObjectProvider<com.youtopia.account.AccountSessionFilter> accountFilter;

    @Bean
    org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer rejectedRequests(ObjectMapper mapper) {
        return web -> web.requestRejectedHandler((request,response,error) ->
            write(mapper,request,response,HttpStatus.BAD_REQUEST,"INVALID_REQUEST","Request parameters are invalid."));
    }

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ObjectMapper mapper) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf", "/api/v1/steam/apps/*/ccu").permitAll()
                // Approved public observations only. Personal/admin routes and unknown writes stay protected.
                .requestMatchers(HttpMethod.GET, "/api/v1/games", "/api/v1/games/*",
                    "/api/v1/charts/steam/ranking-periods", "/api/v1/charts/steam/rankings",
                    "/api/v1/charts/steam/ccu", "/api/v1/charts/steam/app-types",
                    "/api/v1/youtube/videos/*/observations").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/games/search").permitAll()
                 .requestMatchers(HttpMethod.POST,"/api/v1/events","/api/v1/auth/signup","/api/v1/auth/login","/api/v1/admin/auth/login","/api/v1/auth/password-reset","/api/v1/auth/account-recovery").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/auth/activity","/api/v1/auth/logout").authenticated()
                .requestMatchers("/api/v1/games","/api/v1/games/**","/api/v1/charts/**","/api/v1/youtube/**","/api/v1/auth/me","/api/v1/me/**","/api/v1/auth/recovery-codes","/api/v1/auth/password").hasRole("USER")
                .anyRequest().denyAll())
            // CSRF and session fixation protection remain enabled; no Basic/JWT fallback.
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> write(mapper, request, response,
                    HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Authentication is required."))
                .accessDeniedHandler((request, response, error) -> write(mapper, request, response,
                    HttpStatus.FORBIDDEN, error instanceof CsrfException ? "CSRF_INVALID" : "ACCESS_DENIED",
                    "The request is not allowed.")));
        var filter=accountFilter.getIfAvailable();
        if(filter!=null)http.addFilterBefore(filter,org.springframework.security.web.access.intercept.AuthorizationFilter.class);
        return http.build();
    }

    private static void write(ObjectMapper mapper, HttpServletRequest request, HttpServletResponse response,
                              HttpStatus status, String code, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ApiProblems.create(status, code, detail, request));
    }
}
