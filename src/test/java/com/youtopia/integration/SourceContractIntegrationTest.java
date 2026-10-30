package com.youtopia.integration;

import com.youtopia.verification.SourceReadinessVerifier;
import java.sql.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/** Requires the separately prepared synthetic producer fixture. Never accepts production environment variables. */
class SourceContractIntegrationTest {
    private Connection reader()throws SQLException {
        var connection=DriverManager.getConnection(IsolatedTestServices.url("youtopia_source_test")+"?connectTimeout=5&socketTimeout=10","ytp_test_source_reader","");
        connection.setReadOnly(true);connection.setAutoCommit(false);return connection;
    }
    @Test void dedicatedReaderAllowsOnlyApprovedProjectionsAndColumns()throws Exception {
        try(var connection=reader()){
            var result=new SourceReadinessVerifier().verify(connection,"youtopia_source_test","ytp_test_source_reader");
            assertThat(result.ready()).isTrue();assertThat(result.probes()).hasSize(15);
            assertThat(result.probes().stream().filter(p->p.expected().equals("DENY_SELECT"))).allMatch(p->p.status().equals("PASS")&&p.sqlState().equals("42501"));connection.rollback();
        }
    }
    @Test void producerCatalogRejectsIneligibleNonGameAndNamelessCandidates()throws Exception {
        try(var connection=reader();var query=connection.createStatement();var rows=query.executeQuery("SELECT app_id,steam_name FROM service.v_game_catalog ORDER BY app_id")){
            assertThat(rows.next()).isTrue();assertThat(rows.getLong(1)).isEqualTo(1);assertThat(rows.getString(2)).isEqualTo("Synthetic Game");assertThat(rows.next()).isFalse();
        }
    }
    @Test void producerPreservesNativePositionsEmptyRunsAndCompleteArtifactBoundary()throws Exception {
        try(var connection=reader();var query=connection.createStatement()){
            try(var row=query.executeQuery("SELECT result_position FROM service.v_weekly_rank_observation WHERE ranking_run_id=1")){assertThat(row.next()).isTrue();assertThat(row.getInt(1)).isEqualTo(5);assertThat(row.next()).isFalse();}
            try(var row=query.executeQuery("SELECT app_id IS NULL FROM service.v_weekly_rank_observation WHERE ranking_run_id=2")){assertThat(row.next()).isTrue();assertThat(row.getBoolean(1)).isTrue();}
            try(var row=query.executeQuery("SELECT count(*) FROM service.v_weekly_rank_observation WHERE ranking_run_id=3")){row.next();assertThat(row.getInt(1)).isZero();}
        }
    }
    @Test void probeRejectsWritableConnectionsAndWrongExpectedIdentity()throws Exception {
        try(var connection=reader()){
            assertThatThrownBy(()->new SourceReadinessVerifier().verify(connection,"youtopia","ytp_codex")).isInstanceOf(IllegalArgumentException.class);
            connection.rollback();connection.setAutoCommit(true);connection.setReadOnly(false);
            assertThatThrownBy(()->new SourceReadinessVerifier().verify(connection,"youtopia_source_test","ytp_test_source_reader")).isInstanceOf(IllegalArgumentException.class);
        }
    }
    @Test void probeDetectsUnapprovedCollectorAccessBeyondTheFiveNegativeExamples()throws Exception {
        try(var owner=DriverManager.getConnection(IsolatedTestServices.url("youtopia_source_test"),"postgres","");var query=owner.createStatement()){
            try(var before=query.executeQuery("SELECT has_table_privilege('ytp_test_source_reader','collector.youtube_query','SELECT')")){before.next();assertThat(before.getBoolean(1)).isFalse();}
            query.execute("GRANT SELECT ON collector.youtube_query TO ytp_test_source_reader");
            try(var connection=reader()){
                var result=new SourceReadinessVerifier().verify(connection,"youtopia_source_test","ytp_test_source_reader");
                assertThat(result.ready()).isFalse();assertThat(result.probes()).anyMatch(p->p.name().equals("all_other_source_member_security_columns")&&p.status().equals("UNEXPECTED_ACCESS"));
            }finally{query.execute("REVOKE SELECT ON collector.youtube_query FROM ytp_test_source_reader");}
        }
    }
    @Test void probeDetectsSchemaCreateEvenWithoutOwnershipOrRoleMembership()throws Exception {
        try(var owner=DriverManager.getConnection(IsolatedTestServices.url("youtopia_source_test"),"postgres","");var query=owner.createStatement()){
            try(var before=query.executeQuery("SELECT has_schema_privilege('ytp_test_source_reader','service','CREATE')")){before.next();assertThat(before.getBoolean(1)).isFalse();}
            query.execute("GRANT CREATE ON SCHEMA service TO ytp_test_source_reader");
            try(var connection=reader()){
                var result=new SourceReadinessVerifier().verify(connection,"youtopia_source_test","ytp_test_source_reader");assertThat(result.ready()).isFalse();assertThat(result.probes()).anyMatch(p->p.name().equals("database_and_schema_create")&&p.status().equals("UNEXPECTED_PRIVILEGE"));
            }finally{query.execute("REVOKE CREATE ON SCHEMA service FROM ytp_test_source_reader");}
        }
    }
}
