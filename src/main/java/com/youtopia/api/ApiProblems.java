package com.youtopia.api;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

public final class ApiProblems {
    private ApiProblems() {}

    public static ProblemDetail create(HttpStatus status, String code, String detail,
                                       HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("urn:youtopia:problem:" + code.toLowerCase(java.util.Locale.ROOT).replace('_', '-')));
        // Do not include query strings or rejected values in error responses.
        try { problem.setInstance(URI.create(request.getRequestURI())); }
        catch(IllegalArgumentException rejectedPath) { problem.setInstance(URI.create("/")); }
        problem.setProperty("code", code);
        problem.setProperty("traceId", request.getAttribute(TraceFilter.ATTRIBUTE));
        problem.setProperty("fieldErrors", Map.of());
        return problem;
    }
}
