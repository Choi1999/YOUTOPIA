package com.youtopia.reporting;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;

@Configuration @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.reporting.enabled:false}")
public class ReportingConfiguration {
    @Bean @ConfigurationProperties("youtopia.reporting.datasource")
    HikariDataSource reportDataSource(){var p=new HikariDataSource();p.setPoolName("aggregate-reader");p.setMaximumPoolSize(3);p.setReadOnly(true);p.setConnectionTimeout(5000);p.addDataSourceProperty("options","-c statement_timeout=5000");return p;}
    @Bean JdbcTemplate reportJdbc(@Qualifier("reportDataSource")HikariDataSource source){return new JdbcTemplate(source);}
    @Bean JdbcTransactionManager reportTx(@Qualifier("reportDataSource")HikariDataSource source){return new JdbcTransactionManager(source);}
}
