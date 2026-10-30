package com.youtopia.integration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class FixtureIsolationIntegrationTest {
    @Test void actualTestJvmHasNoProductionBindingsAndUsesTheSyntheticPostgres()throws Exception {
        assertThat(System.getenv().keySet()).noneMatch(k->k.startsWith("DB_")||k.startsWith("PG")||k.startsWith("YOUTOPIA_"));
        try(var c=DriverManager.getConnection(IsolatedTestServices.url("youtopia_test"),"postgres","");var s=c.createStatement();
            var r=s.executeQuery("SELECT current_database(),current_setting('server_version_num')::int")){
            assertThat(r.next()).isTrue();assertThat(r.getString(1)).isEqualTo("youtopia_test");assertThat(r.getInt(2)).isBetween(160000,169999);
        }
    }
    @Test void seedRejectsWrongDatabaseAndMissingRunnerMarkerBeforeAnyDdl()throws Exception {
        String fixture=Files.readString(Path.of("src/test/fixtures/10-accounts.sql"));
        try(var c=DriverManager.getConnection(IsolatedTestServices.url("youtopia_test"),"postgres","");var s=c.createStatement()){
            s.execute("SET youtopia.synthetic_test='fixture-v1'");
            assertThatThrownBy(()->s.execute(fixture)).isInstanceOf(SQLException.class).extracting(e->((SQLException)e).getSQLState()).isEqualTo("P0001");
            try(var r=s.executeQuery("SELECT to_regclass('auth.user_credential') IS NULL")){r.next();assertThat(r.getBoolean(1)).isTrue();}
        }
        try(var c=DriverManager.getConnection(IsolatedTestServices.url("youtopia_auth_test"),"postgres","");var s=c.createStatement()){
            assertThatThrownBy(()->s.execute(fixture)).isInstanceOf(SQLException.class).extracting(e->((SQLException)e).getSQLState()).isEqualTo("P0001");
            try(var r=s.executeQuery("SELECT to_regclass('auth.user_credential') IS NOT NULL")){r.next();assertThat(r.getBoolean(1)).isTrue();}
        }
    }
}
