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
    @Test void actualAssignedServiceAndIndependentControlLoginsAreAccepted()throws Exception {
        RuntimeDataSourceGuard.verifyPoolIdentity(login("ytp_app_audit","ytp_app_audit","youtopia",false),"auditDataSource","PRODUCTION");
        RuntimeDataSourceGuard.verifyPoolIdentity(login("ytp_control_app","ytp_control_app","operator_selected_control",false),"controlDataSource","PRODUCTION");
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
        for(String database:new String[]{"youtopia","postgres","template1","template_backup"}){
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
}
