package com.youtopia.telemetry;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
public class ProductEventController {
    private final ProductEventService service;
    public ProductEventController(ProductEventService service){this.service=service;}
    @Configuration @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
    static class Config {
        @Bean @ConfigurationProperties("youtopia.events.datasource")
        HikariDataSource eventDataSource(){var p=new HikariDataSource();p.setPoolName("product-event-writer");p.setMaximumPoolSize(3);p.setConnectionTimeout(5000);p.addDataSourceProperty("options","-c statement_timeout=5000 -c lock_timeout=3000");return p;}
        @Bean JdbcTemplate eventJdbc(@Qualifier("eventDataSource")HikariDataSource source){return new JdbcTemplate(source);}
        @Bean JdbcTransactionManager eventTx(@Qualifier("eventDataSource")HikariDataSource source){return new JdbcTransactionManager(source);}
    }
    @PostMapping("/api/v1/events") @ResponseStatus(HttpStatus.NO_CONTENT)
    void record(@Valid @RequestBody ProductEvent event,HttpServletRequest request,HttpServletResponse response){response.setHeader("Cache-Control","no-store");if(request.getHeader(com.youtopia.account.AccountContext.HEADER)!=null)com.youtopia.account.AccountContext.require(request);service.record(event,request);}
}
