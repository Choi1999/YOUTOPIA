package com.youtopia.account;

import com.youtopia.api.*;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.servlet.http.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.directory.enabled:false}")
public class AdminDirectory {
    private final AdminDirectoryService service;
    @Configuration @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.directory.enabled:false}")
    static class Config {
        @Bean @ConfigurationProperties("youtopia.directory.datasource")
        HikariDataSource directoryDataSource(){var p=new HikariDataSource();p.setPoolName("admin-directory");p.setMaximumPoolSize(3);p.setReadOnly(true);p.setConnectionTimeout(5000);p.addDataSourceProperty("options","-c statement_timeout=5000");return p;}
        @Bean JdbcTemplate directoryJdbc(@Qualifier("directoryDataSource") HikariDataSource source){return new JdbcTemplate(source);}
        @Bean JdbcTransactionManager directoryTx(@Qualifier("directoryDataSource") HikariDataSource source){return new JdbcTransactionManager(source);}
    }
    public AdminDirectory(AdminDirectoryService service){this.service=service;}
    @GetMapping("/api/v1/admin/members")
    PageResult<AdminDirectoryService.Member> list(@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,
        @RequestParam(defaultValue="ACTIVE")String status,@RequestParam(defaultValue="")String q,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"page","size","status","q");
        for(String key:java.util.List.of("page","size","status"))if(request.getParameter(key)!=null&&request.getParameter(key).isBlank())throw new IllegalArgumentException("Empty directory parameter");
        response.setHeader("Cache-Control","no-store");return service.list(page,size,status,q,AuthenticationController.identity(request).id());
    }
    @GetMapping("/api/v1/admin/members/{userId}")
    AdminDirectoryService.Member detail(@PathVariable UUID userId,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.detail(userId,AuthenticationController.identity(request).id());
    }
}
