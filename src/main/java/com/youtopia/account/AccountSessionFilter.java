package com.youtopia.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.api.ApiProblems;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountSessionFilter extends OncePerRequestFilter {
    private final AccountRepository repository;
    private final com.youtopia.restore.DeletionJournal journal;
    private final AccountSecrets secrets;
    private final Clock clock;
    private final ObjectMapper mapper;
    public AccountSessionFilter(AccountRepository repository,com.youtopia.restore.DeletionJournal journal,AccountSecrets secrets,Clock clock,ObjectMapper mapper) {
        this.repository=repository;this.journal=journal;this.secrets=secrets;this.clock=clock;this.mapper=mapper;
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        try {
            var session=request.getSession(false);
            if(session!=null && session.getAttribute(SessionIdentity.ATTRIBUTE) instanceof SessionIdentity id) {
                if(!Boolean.TRUE.equals(session.getAttribute("youtopia.authFinalized")) || !journal.marker().generation().equals(session.getAttribute("youtopia.authGeneration")) || id.expired(clock.instant()) || !repository.current(id,session.getId(),secrets)) {
                    session.invalidate();SecurityContextHolder.clearContext();
                }
            } else if(SecurityContextHolder.getContext().getAuthentication()!=null) {
                SecurityContextHolder.clearContext();
            }
        } catch(RuntimeException e) {
            SecurityContextHolder.clearContext();response.setStatus(503);response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            mapper.writeValue(response.getOutputStream(),ApiProblems.create(HttpStatus.SERVICE_UNAVAILABLE,"AUTH_STATE_UNAVAILABLE","Authentication state could not be verified.",request));return;
        }
        chain.doFilter(request,response);
    }
}
