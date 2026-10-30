package com.youtopia.restore;

import com.youtopia.account.AccountSecrets;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;

@Configuration @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.control.enabled:false}")
public class ControlConfiguration {
    @Bean @ConfigurationProperties("youtopia.control.datasource")
    HikariDataSource controlDataSource(){var p=new HikariDataSource();p.setPoolName("independent-deletion-journal");p.setMaximumPoolSize(3);p.setConnectionTimeout(5000);p.addDataSourceProperty("options","-c statement_timeout=5000 -c lock_timeout=3000");return p;}
    @Bean JdbcTemplate controlJdbc(@Qualifier("controlDataSource")HikariDataSource source){return new JdbcTemplate(source);}
    @Bean JdbcTransactionManager controlTx(@Qualifier("controlDataSource")HikariDataSource source){return new JdbcTransactionManager(source);}
    @Bean("journalSecrets") AccountSecrets journalSecrets(@Value("${youtopia.control.hmac-key}")String key){return new AccountSecrets(key);}
}
