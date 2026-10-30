package com.youtopia.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CsrfController {
    public record TokenResponse(String headerName, String parameterName, String token) {}

    @GetMapping("/api/v1/auth/csrf")
    TokenResponse csrf(CsrfToken csrfToken, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return new TokenResponse(csrfToken.getHeaderName(), csrfToken.getParameterName(), csrfToken.getToken());
    }
}
