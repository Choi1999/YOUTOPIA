package com.youtopia.restore;

import com.youtopia.account.AccountSecrets;
import com.youtopia.security.OperatorCommandSupport;
import com.zaxxer.hikari.HikariDataSource;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;

/** Explicit restore operator process; not a web endpoint or an application startup hook. */
public final class RestoreCommand {
    private RestoreCommand() {}

    public static void main(String[] args) {
        OperatorCommandSupport.execute("RESTORE", () -> run(args));
    }

    private static void run(String[] args) throws Exception {
        if (args.length < 1 || args.length > 3) throw new IllegalArgumentException("Restore operation required");
        Map<String, String> env = System.getenv();
        com.youtopia.security.ControlDatabasePolicy.verifyEndpoint(required(env,"YOUTOPIA_CONTROL_MANAGER_JDBC_URL"),
                required(env,"YOUTOPIA_CONTROL_RESTORE_SCOPE"),required(env,"YOUTOPIA_CONTROL_CONNECTION_POLICY"));
        if(!required(env,"YOUTOPIA_RESTORE_JDBC_URL").equals("jdbc:postgresql://127.0.0.1:5432/youtopia?sslmode=disable"))
            throw new IllegalArgumentException("Reviewed host-loopback service database required");
        if(!required(env,"YOUTOPIA_RESTORE_EXPECTED_DB").equals("youtopia")
                ||!required(env,"YOUTOPIA_CONTROL_MANAGER_EXPECTED_DB").equals("youtopia_control")
                ||!required(env,"YOUTOPIA_CONTROL_MANAGER_DB_USER").equals("ytp_restore_manager"))
            throw new IllegalArgumentException("Reviewed service and control database targets required");
        try (var main = source(env, "YOUTOPIA_RESTORE");
             var control = source(env, "YOUTOPIA_CONTROL_MANAGER")) {
            var target = new JdbcTemplate(main);
            var manager = new JdbcTemplate(control);
            try(var connection=control.getConnection()){com.youtopia.security.RuntimeDataSourceGuard.verify(connection);}
            if(!Boolean.TRUE.equals(manager.queryForObject("SELECT session_user=current_user AND current_user='ytp_restore_manager' AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication) FROM pg_roles WHERE rolname=current_user",Boolean.class)))
                throw new IllegalStateException("Restricted actual restore-manager login required");
            if (!Boolean.TRUE.equals(manager.queryForObject(
                    "SELECT has_table_privilege(current_user,'restore_control.service_fence','UPDATE')", Boolean.class))) {
                throw new IllegalStateException("Separate restore manager credentials required");
            }
            var journal = new DeletionJournal(manager, target, new JdbcTransactionManager(control),
                    new AccountSecrets(required(env, "YOUTOPIA_CONTROL_HMAC_KEY")),
                    required(env, "YOUTOPIA_CONTROL_SERVICE_KEY"));
            var coordinator = new RestoreCoordinator(journal, manager, target,
                    new JdbcTransactionManager(control), new JdbcTransactionManager(main));
            switch (args[0]) {
                case "inspect" -> {
                    if(args.length!=1)throw new IllegalArgumentException("Unexpected inspection arguments");
                    for(String table:new String[]{"service_fence","deletion_journal","restore_run"})
                        manager.queryForList("SELECT 1 FROM restore_control."+table+" LIMIT 0");
                    journal.marker();
                    System.out.println("RESTORE_TARGETS_VERIFIED_SERVICE_DATABASE_ONLY; no state changed");
                }
                case "enroll" -> {
                    if (args.length != 1) throw new IllegalArgumentException("Unexpected enrollment arguments");
                    // Enrollment never grants permission to serve. A restore verification run is required first.
                    manager.update("INSERT INTO restore_control.service_fence(service_key,state,generation,key_fingerprint) VALUES(?,'BLOCKED',?,?)",
                            journal.service(), journal.marker().generation(), journal.fingerprint());
                    System.out.println("RESTORE_ENROLLED_BLOCKED");
                }
                case "begin" -> {
                    if (args.length != 2) throw new IllegalArgumentException("Opaque backup reference required");
                    System.out.println("RESTORE_RUN " + coordinator.begin(args[1]));
                }
                case "replay" -> {
                    if (args.length != 2) throw new IllegalArgumentException("Run identifier required");
                    coordinator.replay(UUID.fromString(args[1]));
                    System.out.println("RESTORE_REPLAYED_FENCED");
                }
                case "verify" -> {
                    if (args.length != 3 || !args[2].equals("--credential-state-reviewed")) {
                        throw new IllegalArgumentException("Independent current credential-state review required");
                    }
                    coordinator.verify(UUID.fromString(args[1]), true);
                    System.out.println("RESTORE_VERIFIED_FENCED");
                }
                case "open" -> {
                    if (args.length != 2) throw new IllegalArgumentException("Run identifier required");
                    coordinator.open(UUID.fromString(args[1]));
                    System.out.println("RESTORE_OPEN");
                }
                default -> throw new IllegalArgumentException("Unsupported restore operation");
            }
        }
    }

    private static HikariDataSource source(Map<String, String> env, String prefix) throws Exception {
        var pool = new HikariDataSource();
        try {
            pool.setJdbcUrl(OperatorCommandSupport.jdbcUrl(required(env, prefix + "_JDBC_URL")));
            pool.setUsername(required(env, prefix + "_DB_USER"));
            pool.setPassword(required(env, prefix + "_DB_PASSWORD"));
            pool.setMaximumPoolSize(1);
            pool.setConnectionTimeout(5000);
            pool.addDataSourceProperty("connectTimeout", "5");
            pool.addDataSourceProperty("socketTimeout", "15");
            pool.addDataSourceProperty("options", "-c statement_timeout=10000 -c lock_timeout=3000");
            try (var connection = pool.getConnection()) {
                if (!connection.getCatalog().equals(required(env, prefix + "_EXPECTED_DB"))) {
                    throw new IllegalStateException("Unexpected restore database target");
                }
            }
            return pool;
        } catch (Exception failure) {
            pool.close();
            throw failure;
        }
    }

    private static String required(Map<String, String> env, String key) {
        String value = env.get(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing " + key);
        return value;
    }
}
