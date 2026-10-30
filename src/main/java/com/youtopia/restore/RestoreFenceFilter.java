package com.youtopia.restore;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.api.ApiProblems;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @Order(Ordered.HIGHEST_PRECEDENCE+2)
@ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.control.enabled:false}")
public class RestoreFenceFilter extends OncePerRequestFilter {
    private final DeletionJournal journal;private final ObjectMapper json;
    public RestoreFenceFilter(DeletionJournal journal,ObjectMapper json){this.journal=journal;this.json=json;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException{
        boolean allowed;try{allowed=journal.servingAllowed();}catch(RuntimeException e){allowed=false;}
        if(!allowed){response.setStatus(503);response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);json.writeValue(response.getOutputStream(),ApiProblems.create(HttpStatus.SERVICE_UNAVAILABLE,"RESTORE_VERIFICATION_REQUIRED","Service is unavailable until independent restoration checks complete.",request));return;}
        chain.doFilter(request,response);
    }
}
