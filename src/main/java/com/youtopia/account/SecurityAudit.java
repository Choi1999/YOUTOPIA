package com.youtopia.account;

import java.util.UUID;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class SecurityAudit {
    private final JdbcTemplate jdbc;
    private final String environment;
    public SecurityAudit(@Qualifier("auditJdbc") JdbcTemplate jdbc,@Value("${youtopia.environment:LOCAL}") String environment) {
        if(!java.util.Set.of("LOCAL","STAGING","PRODUCTION").contains(environment))throw new IllegalArgumentException("Invalid environment");
        this.jdbc=jdbc;this.environment=environment;
    }
    public void write(String event,String kind,UUID actor,String result,UUID correlation) {write(event,kind,actor,result,correlation,null);}
    public void write(String event,String kind,UUID actor,String result,UUID correlation,UUID subject) {
        jdbc.update("INSERT INTO security.security_audit_event(audit_event_id,event_type,actor_kind,actor_id,result_code,correlation_id,environment,subject_user_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",UUID.nameUUIDFromBytes((actor+":"+correlation+":"+event).getBytes(java.nio.charset.StandardCharsets.US_ASCII)),event,kind,actor,result,correlation,environment,subject);
    }
}
