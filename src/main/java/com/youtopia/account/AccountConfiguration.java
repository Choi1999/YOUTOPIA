package com.youtopia.account;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AccountConfiguration {
    @Bean @Primary @ConfigurationProperties("spring.datasource")
    DataSourceProperties dataProperties() { return new DataSourceProperties(); }
    @Bean @Primary @ConfigurationProperties("spring.datasource.hikari")
    HikariDataSource dataSource(@Qualifier("dataProperties") DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }
    @Bean @Primary
    JdbcTemplate jdbcTemplate(@Qualifier("dataSource") DataSource source) { return new JdbcTemplate(source); }
    @Bean @Primary
    JdbcTransactionManager transactionManager(@Qualifier("dataSource") DataSource source) { return new JdbcTransactionManager(source); }

    @Configuration @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
    static class Accounts {
        Accounts(@org.springframework.beans.factory.annotation.Value("${youtopia.control.enabled:false}") boolean controlEnabled) {
            if(!controlEnabled)throw new IllegalStateException("Independent deletion control is required for enabled account APIs");
        }
        @Bean @ConfigurationProperties("youtopia.accounts.member")
        HikariDataSource memberDataSource() { return pool("member"); }
        @Bean @ConfigurationProperties("youtopia.accounts.admin")
        HikariDataSource adminDataSource() { return pool("admin"); }
        @Bean @ConfigurationProperties("youtopia.accounts.audit")
        HikariDataSource auditDataSource() { return pool("audit"); }
        @Bean JdbcTemplate memberJdbc(@Qualifier("memberDataSource") DataSource source) { return new JdbcTemplate(source); }
        @Bean JdbcTemplate adminJdbc(@Qualifier("adminDataSource") DataSource source) { return new JdbcTemplate(source); }
        @Bean JdbcTemplate auditJdbc(@Qualifier("auditDataSource") DataSource source) { return new JdbcTemplate(source); }
        @Bean JdbcTransactionManager memberTx(@Qualifier("memberDataSource") DataSource source) { return new JdbcTransactionManager(source); }
        @Bean JdbcTransactionManager adminTx(@Qualifier("adminDataSource") DataSource source) { return new JdbcTransactionManager(source); }
        @Bean
        org.springframework.boot.web.servlet.FilterRegistrationBean<AccountSessionFilter> accountFilterRegistration(AccountSessionFilter filter) {
            var bean=new org.springframework.boot.web.servlet.FilterRegistrationBean<>(filter);bean.setEnabled(false);return bean;
        }
        @Bean PasswordEncoder passwordEncoder() { return AccountPasswordEncoders.create(); }
        private HikariDataSource pool(String name) {
            var pool=new HikariDataSource(); pool.setPoolName("account-"+name); pool.setMaximumPoolSize(3);
            pool.setConnectionTimeout(5000); pool.addDataSourceProperty("connectTimeout","5");
            pool.addDataSourceProperty("socketTimeout","10");
            pool.addDataSourceProperty("options","-c statement_timeout=5000 -c lock_timeout=3000");
            return pool;
        }
    }
}
