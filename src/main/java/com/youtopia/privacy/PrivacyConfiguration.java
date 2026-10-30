package com.youtopia.privacy;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;

@Configuration @ConditionalOnProperty(name="youtopia.privacy.enabled",havingValue="true")
public class PrivacyConfiguration {
    @Bean @ConfigurationProperties("youtopia.privacy.datasource")
    HikariDataSource privacyDataSource(){var p=new HikariDataSource();p.setPoolName("privacy-worker");p.setMaximumPoolSize(2);p.setConnectionTimeout(5000);p.addDataSourceProperty("options","-c statement_timeout=10000 -c lock_timeout=3000");return p;}
    @Bean JdbcTemplate privacyJdbc(@Qualifier("privacyDataSource")HikariDataSource source){return new JdbcTemplate(source);}
    @Bean JdbcTransactionManager privacyTx(@Qualifier("privacyDataSource")HikariDataSource source){return new JdbcTransactionManager(source);}
}
