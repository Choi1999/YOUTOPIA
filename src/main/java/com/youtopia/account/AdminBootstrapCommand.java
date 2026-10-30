package com.youtopia.account;

import java.sql.*;
import java.util.Map;
import org.springframework.security.crypto.password.*;

/** Explicit one-time operator command; never invoked by application startup. */
public final class AdminBootstrapCommand {
    private AdminBootstrapCommand() {}
    public static void main(String[] args){com.youtopia.security.OperatorCommandSupport.execute("ADMIN_BOOTSTRAP",AdminBootstrapCommand::run);}
    private static void run() throws Exception {
        Map<String,String> env=System.getenv();
        var policy=new PasswordPolicy(required(env,"YOUTOPIA_PASSWORD_BLOCKLIST"));
        try(var connection=DriverManager.getConnection(com.youtopia.security.OperatorCommandSupport.jdbcUrl(required(env,"YOUTOPIA_BOOTSTRAP_JDBC_URL")),
                required(env,"YOUTOPIA_BOOTSTRAP_DB_USER"),required(env,"YOUTOPIA_BOOTSTRAP_DB_PASSWORD"))) {
            if(!connection.getCatalog().equals(env.getOrDefault("YOUTOPIA_BOOTSTRAP_EXPECTED_DB","youtopia")))throw new IllegalStateException("Unexpected bootstrap database target");
            boolean created=initialize(connection,required(env,"YOUTOPIA_INITIAL_ADMIN_LOGIN"),
                required(env,"YOUTOPIA_INITIAL_ADMIN_PASSWORD"),policy,AccountPasswordEncoders.create());
            System.out.println(created?"ADMIN_INITIALIZED":"ADMIN_ALREADY_INITIALIZED");
        }
    }
    public static boolean initialize(Connection connection,String login,String password,PasswordPolicy policy,PasswordEncoder encoder) throws SQLException {
        login=AuthenticationService.normalize(login);
        if(!login.matches("[a-z0-9][a-z0-9._-]{2,79}"))throw new IllegalArgumentException("Invalid administrator login format");
        policy.validate(password);String hash=encoder.encode(password);
        connection.setAutoCommit(false);
        try {
            try(var statement=connection.createStatement()) {
                statement.execute("SET LOCAL lock_timeout='5s'");statement.execute("SET LOCAL statement_timeout='10s'");
                statement.execute("SELECT pg_advisory_xact_lock(hashtextextended('youtopia-initial-admin',0))");
                try(var result=statement.executeQuery("SELECT EXISTS(SELECT admin_id FROM auth.admin_account)")) {
                    result.next();if(result.getBoolean(1)){connection.rollback();return false;}
                }
            }
            try(var insert=connection.prepareStatement("INSERT INTO auth.admin_account(admin_login_name,password_hash) VALUES(?,?)")) {
                insert.setString(1,login);insert.setString(2,hash);insert.executeUpdate();
            }
            connection.commit();return true;
        } catch(RuntimeException|SQLException e) {connection.rollback();throw e;}
    }
    private static String required(Map<String,String> env,String key) {
        String value=env.get(key);if(value==null||value.isEmpty())throw new IllegalArgumentException("Missing "+key);return value;
    }
}
