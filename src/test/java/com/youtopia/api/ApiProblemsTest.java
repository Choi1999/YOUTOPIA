package com.youtopia.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.*;

class ApiProblemsTest {
    @Test void aRejectedMalformedPathStillProducesAProblemWithoutIncludingQuerySecrets(){
        var request=new MockHttpServletRequest("GET","/api/v1/rejected\\path");
        request.setQueryString("password=synthetic-sensitive-input");
        request.setAttribute(TraceFilter.ATTRIBUTE,"server-generated-test-trace");
        var result=ApiProblems.create(HttpStatus.BAD_REQUEST,"INVALID_REQUEST","Invalid request.",request);
        assertThat(result.getStatus()).isEqualTo(400);
        assertThat(result.getInstance().toString()).isEqualTo("/");
        assertThat(result.getProperties()).containsEntry("traceId","server-generated-test-trace");
        assertThat(result.toString()).doesNotContain("synthetic-sensitive-input","rejected\\path");
    }
}
