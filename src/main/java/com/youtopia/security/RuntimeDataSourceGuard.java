package com.youtopia.security;

import java.sql.*;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Runtime pools must never reuse the migration owner or an administrative principal. */
@Component
public class RuntimeDataSourceGuard implements ApplicationRunner {
    private static final Map<String,String> PRODUCTION_ROLES=Map.of(
        "dataSource","ytp_app_data_ro","memberDataSource","ytp_app_member",
        "adminDataSource","ytp_app_admin_auth","auditDataSource","ytp_app_audit",
        "eventDataSource","ytp_app_event","directoryDataSource","ytp_app_directory",
        "reportDataSource","ytp_app_report","controlDataSource","ytp_control_app",
        "privacyDataSource","ytp_app_privacy");
    private final Map<String,DataSource> sources;
    private final String environment;
    public RuntimeDataSourceGuard(Map<String,DataSource> sources,@Value("${youtopia.environment:LOCAL}") String environment){this.sources=Map.copyOf(sources);this.environment=environment;}
    @Override public void run(ApplicationArguments ignored)throws SQLException {
        for(var entry:sources.entrySet()){
            DataSource source=entry.getValue();
            if(source instanceof com.zaxxer.hikari.HikariDataSource hikari){
                String url=hikari.getJdbcUrl();
                if(url!=null&&java.util.regex.Pattern.compile("(?i)(password|token|secret)=").matcher(url).find())
                    throw new IllegalStateException("Database credentials must be provided separately from JDBC URLs");
            }
            try(var connection=source.getConnection()){
                verifyPoolIdentity(connection,entry.getKey(),environment);
                verify(connection);
                if(source instanceof com.zaxxer.hikari.HikariDataSource hikari&&"independent-deletion-journal".equals(hikari.getPoolName()))try(var query=connection.createStatement();var row=query.executeQuery("SELECT has_table_privilege(current_user,'restore_control.service_fence','UPDATE') OR has_table_privilege(current_user,'restore_control.deletion_journal','DELETE')")){
                    row.next();if(row.getBoolean(1))throw new IllegalStateException("Web control credentials must not open restore fences or delete the independent journal");
                }
            }
        }
        org.slf4j.LoggerFactory.getLogger(RuntimeDataSourceGuard.class).info("Runtime database pool identity checks passed: {}",sources.size());
    }
    /** No credential/URL logging. A valid restricted login can still be the wrong pool identity. */
    public static void verifyPoolIdentity(Connection connection,String beanName,String environment)throws SQLException {
        try(var query=connection.createStatement()){
            query.setQueryTimeout(5);
            try(var row=query.executeQuery("SELECT session_user,current_user,current_database(),(SELECT datistemplate FROM pg_database WHERE datname=current_database())")){
                if(!row.next()||!row.getString(1).equals(row.getString(2)))
                    throw new IllegalStateException("Runtime pools must use their actual login without SET ROLE");
                if(!"PRODUCTION".equals(environment))return;
                if(!row.getString(2).equals(PRODUCTION_ROLES.get(beanName)))
                    throw new IllegalStateException("Production pool identity does not match its assigned role");
                String database=row.getString(3);
                if(beanName.equals("controlDataSource")){
                    if(row.getBoolean(4)||database.equals("youtopia")||database.equals("postgres")||database.startsWith("template"))
                        throw new IllegalStateException("Production control pool requires the explicitly provisioned control database");
                }else if(!database.equals("youtopia"))throw new IllegalStateException("Production service pools require the service database");
            }
        }
    }
    public static void verify(Connection connection)throws SQLException {
        try(var query=connection.createStatement()){
            query.setQueryTimeout(5);
            try(var row=query.executeQuery("SELECT current_user='ytp_codex' OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR has_database_privilege(current_user,current_database(),'CREATE') FROM pg_roles WHERE rolname=current_user")){
                if(!row.next()||row.getBoolean(1))throw new IllegalStateException("A privileged DB identity cannot be used by an application runtime pool");
            }
            try(var rows=query.executeQuery("SELECT EXISTS(SELECT FROM pg_namespace n WHERE n.nspname IN('auth','service','security','telemetry','raw','collector','restore_control','public') AND (pg_has_role(current_user,n.nspowner,'MEMBER') OR has_schema_privilege(current_user,n.oid,'CREATE')))")){
                rows.next();if(rows.getBoolean(1))throw new IllegalStateException("Runtime DB identities must not own application/source schemas or have CREATE privileges");
            }
            try(var rows=query.executeQuery("SELECT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','service','security','telemetry','raw','collector','restore_control') AND pg_has_role(current_user,c.relowner,'MEMBER'))")){
                rows.next();if(rows.getBoolean(1))throw new IllegalStateException("Runtime DB identities must not own application/source objects");
            }
        }
    }
}
