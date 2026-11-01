package com.youtopia.security;

import java.sql.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RuntimePoolIdentityTest {
    private Connection login(String session,String effective,String database,boolean template)throws Exception {
        var connection=mock(Connection.class);var statement=mock(Statement.class);var row=mock(ResultSet.class);
        when(connection.createStatement()).thenReturn(statement);when(statement.executeQuery(anyString())).thenReturn(row);
        when(row.next()).thenReturn(true);when(row.getString(1)).thenReturn(session);when(row.getString(2)).thenReturn(effective);
        when(row.getString(3)).thenReturn(database);when(row.getBoolean(4)).thenReturn(template);return connection;
    }
    @Test void actualAssignedServiceAndSeparateControlDatabaseLoginsAreAccepted()throws Exception {
        RuntimeDataSourceGuard.verifyPoolIdentity(login("ytp_app_audit","ytp_app_audit","youtopia",false),"auditDataSource","PRODUCTION");
        RuntimeDataSourceGuard.verifyPoolIdentity(login("ytp_control_app","ytp_control_app","youtopia_control",false),"controlDataSource","PRODUCTION");
    }
    @Test void anotherRestrictedRoleCannotBeSubstitutedForAnAuditPool()throws Exception {
        var connection=login("ytp_app_member","ytp_app_member","youtopia",false);
        assertThatThrownBy(()->RuntimeDataSourceGuard.verifyPoolIdentity(connection,"auditDataSource","PRODUCTION")).isInstanceOf(IllegalStateException.class).hasMessageContaining("assigned role");
    }
    @Test void servicePoolsCannotSilentlyConnectToADifferentDatabase()throws Exception {
        var connection=login("ytp_app_data_ro","ytp_app_data_ro","another_service",false);
        assertThatThrownBy(()->RuntimeDataSourceGuard.verifyPoolIdentity(connection,"dataSource","PRODUCTION")).isInstanceOf(IllegalStateException.class).hasMessageContaining("service database");
    }
    @Test void businessSystemAndTemplateDatabasesCannotActAsProductionControl()throws Exception {
        for(String database:new String[]{"youtopia","postgres","template1","template_backup","staging","operator_selected_control"}){
            var connection=login("ytp_control_app","ytp_control_app",database,false);
            assertThatThrownBy(()->RuntimeDataSourceGuard.verifyPoolIdentity(connection,"controlDataSource","PRODUCTION")).isInstanceOf(IllegalStateException.class).hasMessageContaining("control database");
        }
        var template=login("ytp_control_app","ytp_control_app","custom_template",true);
        assertThatThrownBy(()->RuntimeDataSourceGuard.verifyPoolIdentity(template,"controlDataSource","PRODUCTION")).isInstanceOf(IllegalStateException.class);
    }
    @Test void setRoleCannotStandInForAnActualLogin()throws Exception {
        var connection=login("postgres","ytp_app_data_ro","youtopia",false);
        assertThatThrownBy(()->RuntimeDataSourceGuard.verifyPoolIdentity(connection,"dataSource","PRODUCTION")).isInstanceOf(IllegalStateException.class).hasMessageContaining("actual login");
    }
    @Test void isolatedLocalNamesAreKeptSeparateFromProductionRolePolicy()throws Exception {
        RuntimeDataSourceGuard.verifyPoolIdentity(login("synthetic_reader","synthetic_reader","isolated_fixture",false),"dataSource","LOCAL");
    }
    @Test void sameInstanceTransportIsExplicitAndCannotClaimFullInstanceRecovery() {
        String base=ControlDatabasePolicy.BASE;
        ControlDatabasePolicy.verifyEndpoint(base+"?sslmode=disable","SERVICE_DATABASE_ONLY","HOST_LOOPBACK");
        ControlDatabasePolicy.verifyEndpoint(base+"?sslmode=verify-full&sslrootcert=/etc/youtopia-app/control-ca.crt","SERVICE_DATABASE_ONLY","VERIFY_FULL");
        for(String scope:new String[]{"UNREVIEWED","WHOLE_INSTANCE","VM"})
            assertThatThrownBy(()->ControlDatabasePolicy.verifyEndpoint(base+"?sslmode=disable",scope,"HOST_LOOPBACK")).isInstanceOf(IllegalStateException.class);
        for(String url:new String[]{base.replace("127.0.0.1","control.example.invalid")+"?sslmode=disable",base.replace("youtopia_control","staging")+"?sslmode=disable",base+"?sslmode=prefer",base+"?sslmode=disable&password=",base+"?sslmode=disable&sslmode=verify-full"})
            assertThatThrownBy(()->ControlDatabasePolicy.verifyEndpoint(url,"SERVICE_DATABASE_ONLY","HOST_LOOPBACK")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->ControlDatabasePolicy.verifyEndpoint(base+"?sslmode=disable","SERVICE_DATABASE_ONLY","VERIFY_FULL")).isInstanceOf(IllegalStateException.class);
    }
    @Test void aLargerControlPoolIsRejectedBeforeOpeningAnyConnection() {
        try(var pool=new com.zaxxer.hikari.HikariDataSource()){
            pool.setJdbcUrl(ControlDatabasePolicy.BASE+"?sslmode=disable");pool.setMaximumPoolSize(4);
            var guard=new RuntimeDataSourceGuard(java.util.Map.of("controlDataSource",pool),"PRODUCTION","SERVICE_DATABASE_ONLY","HOST_LOOPBACK");
            assertThatThrownBy(()->guard.run(null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("three connections");
            assertThat(pool.isRunning()).isFalse();
        }
    }
}
