package com.youtopia.verification;

import java.sql.*;
import java.util.*;

/** Bounded SELECT-only verification; no migration, test data or privilege mutation. */
public final class SourceReadinessVerifier {
    public record Probe(String name,String expected,String status,String sqlState) {}
    public record Result(String database,String user,boolean readOnly,String serverVersion,boolean temporaryObjectsPossible,boolean ready,List<Probe> probes) {}
    public Result verify(Connection connection,String expectedDatabase,String expectedUser)throws SQLException {
        if(!connection.isReadOnly()||connection.getAutoCommit())throw new IllegalArgumentException("An explicit read-only transaction is required");
        String database,user,version;boolean readOnly,temporaryObjectsPossible;
        try(var query=connection.createStatement()){
            query.setQueryTimeout(8);
            try(var row=query.executeQuery("SELECT current_database(),current_user,current_setting('transaction_read_only'),current_setting('server_version'),has_database_privilege(current_user,current_database(),'TEMP')")){
                row.next();database=row.getString(1);user=row.getString(2);readOnly="on".equals(row.getString(3));version=row.getString(4);temporaryObjectsPossible=row.getBoolean(5);
            }
        }
        if(!expectedDatabase.equals(database)||!expectedUser.equals(user)||!readOnly)throw new IllegalArgumentException("Unexpected verification identity or transaction mode");
        List<Probe> probes=new ArrayList<>();
        try(var query=connection.createStatement();var row=query.executeQuery("SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=pg_roles.oid) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=pg_roles.oid) FROM pg_roles WHERE rolname=current_user")){
            row.next();probes.add(new Probe("runtime_role_flags_and_memberships","RESTRICTED",row.getBoolean(1)?"UNEXPECTED_PRIVILEGE":"PASS",null));
        }
        Map<String,String> allowed=new LinkedHashMap<>();
        allowed.put("game_catalog","SELECT app_id,steam_name,developers,release_at FROM service.v_game_catalog LIMIT 0");
        allowed.put("steam_canonical","SELECT observation_id,app_id,scheduled_at,observed_at,player_count FROM collector.v_steam_ccu_canonical LIMIT 0");
        allowed.put("video_canonical","SELECT stats_result_id,video_id,scheduled_at,artifact_received_at,view_count FROM collector.v_youtube_stats_canonical LIMIT 0");
        allowed.put("weekly_rank_projection","SELECT ranking_run_id,ranking_source,country_code,period_start,period_end,app_id,result_position FROM service.v_weekly_rank_observation LIMIT 0");
        allowed.put("active_app_types","SELECT app_id,app_type FROM service.v_tracked_app_types LIMIT 0");
        for(var item:allowed.entrySet())probes.add(probe(connection,item.getKey(),item.getValue(),false));
        Map<String,String> forbidden=new LinkedHashMap<>();
        forbidden.put("raw_ranking","SELECT app_id FROM raw.steam_ranking_result LIMIT 0");
        forbidden.put("collector_candidate","SELECT app_id FROM collector.steam_app_candidate LIMIT 0");
        forbidden.put("member_credentials","SELECT password_hash FROM auth.user_credential LIMIT 0");
        forbidden.put("security_audit","SELECT * FROM security.security_audit_event LIMIT 0");
        forbidden.put("unapproved_canonical_column","SELECT artifact_id FROM collector.v_steam_ccu_canonical LIMIT 0");
        for(var item:forbidden.entrySet())probes.add(probe(connection,item.getKey(),item.getValue(),true));
        try(var query=connection.createStatement()){
            query.setQueryTimeout(8);
            String columns="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname IN('raw','collector','auth','service','security','telemetry') AND c.relkind IN('r','p','v','m') AND has_column_privilege(current_user,c.oid,a.attnum,'SELECT') AND NOT (n.nspname='service' AND c.relkind='v' AND c.relname IN('v_game_catalog','v_tracked_app_types','v_weekly_rank_observation') OR n.nspname='collector' AND (c.relname='v_steam_ccu_canonical' AND a.attname IN('observation_id','app_id','scheduled_at','observed_at','player_count') OR c.relname='v_youtube_stats_canonical' AND a.attname IN('stats_result_id','video_id','scheduled_at','artifact_received_at','view_count')))";
            try(var row=query.executeQuery(columns)){row.next();probes.add(new Probe("all_other_source_member_security_columns","NO_EFFECTIVE_SELECT",row.getLong(1)==0?"PASS":"UNEXPECTED_ACCESS",null));}
            String functions="SELECT count(*) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname IN('raw','collector') AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_function_privilege(current_user,f.oid,'EXECUTE')";
            try(var row=query.executeQuery(functions)){row.next();probes.add(new Probe("source_function_execution","NO_UNAPPROVED_FUNCTION_EXECUTE",row.getLong(1)==0?"PASS":"UNEXPECTED_ACCESS",null));}
            String ddl="SELECT has_database_privilege(current_user,current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast_temp_%' AND has_schema_privilege(current_user,oid,'CREATE'))";
            try(var row=query.executeQuery(ddl)){row.next();probes.add(new Probe("database_and_schema_create","NO_CREATE",row.getBoolean(1)?"UNEXPECTED_PRIVILEGE":"PASS",null));}
            String writes="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('raw','collector','auth','service','security','telemetry','public') AND c.relkind IN('r','p','v','m') AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES'))";
            try(var row=query.executeQuery(writes)){row.next();probes.add(new Probe("effective_table_and_column_writes","NO_DML",row.getLong(1)==0?"PASS":"UNEXPECTED_PRIVILEGE",null));}
        }
        return new Result(database,user,true,version,temporaryObjectsPossible,probes.stream().allMatch(p->p.status().equals("PASS")),List.copyOf(probes));
    }
    private Probe probe(Connection connection,String name,String sql,boolean denial)throws SQLException {
        Savepoint before=connection.setSavepoint();
        try(var query=connection.createStatement()){
            query.setQueryTimeout(8);try(var result=query.executeQuery(sql)){while(result.next()){ /* LIMIT 0: validates access without extracting data. */ }}
            return new Probe(name,denial?"DENY_SELECT":"ALLOW_SELECT",denial?"UNEXPECTED_ACCESS":"PASS",null);
        }catch(SQLException error){
            connection.rollback(before);String state=error.getSQLState();
            return new Probe(name,denial?"DENY_SELECT":"ALLOW_SELECT",denial&&"42501".equals(state)?"PASS":"UNVERIFIED",state);
        }finally{connection.releaseSavepoint(before);}
    }
}
