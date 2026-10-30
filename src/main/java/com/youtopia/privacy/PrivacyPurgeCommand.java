package com.youtopia.privacy;

import com.zaxxer.hikari.HikariDataSource;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import com.youtopia.security.RuntimeDataSourceGuard;

/** Explicit operator process. Refuses to run without a reviewed retention plan and a non-owner DB login. */
public final class PrivacyPurgeCommand {
    private PrivacyPurgeCommand() {}
    public static void main(String[] args){com.youtopia.security.OperatorCommandSupport.execute("PRIVACY_PURGE",PrivacyPurgeCommand::run);}
    private static void run()throws Exception {
        Map<String,String> env=System.getenv();
        try(var source=new HikariDataSource();var control=new HikariDataSource()){
            source.setJdbcUrl(com.youtopia.security.OperatorCommandSupport.jdbcUrl(required(env,"YOUTOPIA_PRIVACY_JDBC_URL")));source.setUsername(required(env,"YOUTOPIA_PRIVACY_DB_USER"));source.setPassword(required(env,"YOUTOPIA_PRIVACY_DB_PASSWORD"));
            source.setMaximumPoolSize(1);source.setConnectionTimeout(5000);source.addDataSourceProperty("options","-c statement_timeout=10000 -c lock_timeout=3000");
            try(var connection=source.getConnection()){if(!connection.getCatalog().equals(env.getOrDefault("YOUTOPIA_PRIVACY_EXPECTED_DB","youtopia")))throw new IllegalStateException("Unexpected privacy database target");RuntimeDataSourceGuard.verify(connection);}
            control.setJdbcUrl(com.youtopia.security.OperatorCommandSupport.jdbcUrl(required(env,"YOUTOPIA_CONTROL_JDBC_URL")));control.setUsername(required(env,"YOUTOPIA_CONTROL_DB_USER"));control.setPassword(required(env,"YOUTOPIA_CONTROL_DB_PASSWORD"));control.setMaximumPoolSize(1);control.setConnectionTimeout(5000);
            var journal=new com.youtopia.restore.DeletionJournal(new JdbcTemplate(control),new JdbcTemplate(source),new JdbcTransactionManager(control),new com.youtopia.account.AccountSecrets(required(env,"YOUTOPIA_CONTROL_HMAC_KEY")),required(env,"YOUTOPIA_CONTROL_SERVICE_KEY"));
            var service=new PrivacyPurgeService(new PurgeRepository(new JdbcTemplate(source)),new JdbcTransactionManager(source),
                required(env,"YOUTOPIA_RETENTION_APPROVAL_REF"),required(env,"YOUTOPIA_RETENTION_PLAN"),3,required(env,"YOUTOPIA_ENVIRONMENT"),journal);
            var result=service.runOnce();System.out.println("PRIVACY_BATCH claimed="+result.claimed()+" purged="+result.purged()+" failed="+result.failed());
            if(result.failed()>0)throw new IllegalStateException("Privacy batch requires operator attention");
        }
    }
    private static String required(Map<String,String> values,String key){String v=values.get(key);if(v==null||v.isEmpty())throw new IllegalArgumentException("Missing "+key);return v;}
}
