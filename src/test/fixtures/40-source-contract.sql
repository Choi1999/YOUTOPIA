-- SYNTHETIC TEST ONLY. A tiny independent producer with rejected candidates/runs.
DO $$ BEGIN
 IF current_database()<>'youtopia_source_test' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic source database required'; END IF;
END $$;
CREATE SCHEMA raw;
CREATE SCHEMA collector;
CREATE SCHEMA service;
CREATE SCHEMA auth;
CREATE SCHEMA security;
CREATE TABLE auth.user_credential(password_hash text);
CREATE TABLE security.security_audit_event(id bigint);
CREATE TABLE collector.youtube_query(query_id bigint);
CREATE TABLE collector.steam_app_candidate(app_id bigint PRIMARY KEY,steam_name text,app_type text,name_status text,eligibility_status text);
INSERT INTO collector.steam_app_candidate VALUES(1,'Synthetic Game','game','READY','ELIGIBLE'),(2,'Excluded','game','READY','INELIGIBLE'),(3,'Synthetic DLC','dlc','READY','ELIGIBLE'),(4,NULL,'game','PENDING','ELIGIBLE');
CREATE VIEW service.v_game_catalog WITH(security_barrier=true) AS
 SELECT app_id,steam_name,'[]'::jsonb AS developers,NULL::timestamptz AS release_at FROM collector.steam_app_candidate
 WHERE name_status='READY' AND eligibility_status='ELIGIBLE' AND app_type='game' AND steam_name IS NOT NULL;
CREATE TABLE raw.synthetic_run(ranking_run_id bigint PRIMARY KEY,complete boolean);
INSERT INTO raw.synthetic_run VALUES(1,true),(2,true),(3,false);
CREATE TABLE raw.steam_ranking_result(ranking_run_id bigint,app_id bigint,result_position int);
INSERT INTO raw.steam_ranking_result VALUES(1,1,5),(1,3,1),(2,3,1),(3,1,1);
CREATE VIEW service.v_weekly_rank_observation WITH(security_barrier=true) AS
 SELECT r.ranking_run_id,'synthetic'::text AS ranking_source,'KR'::text AS country_code,
 now()-interval '14 days' AS period_start,now()-interval '7 days' AS period_end,x.app_id,x.result_position
 FROM raw.synthetic_run r LEFT JOIN LATERAL(SELECT e.app_id,e.result_position FROM raw.steam_ranking_result e JOIN service.v_game_catalog c USING(app_id) WHERE e.ranking_run_id=r.ranking_run_id)x ON true WHERE r.complete;
CREATE VIEW service.v_tracked_app_types AS SELECT app_id,app_type FROM collector.steam_app_candidate;
CREATE TABLE collector.synthetic_ccu(observation_id bigint,app_id bigint,scheduled_at timestamptz,observed_at timestamptz,player_count bigint,artifact_id bigint);
CREATE VIEW collector.v_steam_ccu_canonical AS SELECT * FROM collector.synthetic_ccu;
CREATE TABLE collector.synthetic_video(stats_result_id bigint,video_id text,scheduled_at timestamptz,artifact_received_at timestamptz,view_count bigint);
CREATE VIEW collector.v_youtube_stats_canonical AS SELECT * FROM collector.synthetic_video;
GRANT USAGE ON SCHEMA collector,service TO ytp_test_source_reader;
GRANT SELECT ON service.v_game_catalog,service.v_tracked_app_types,service.v_weekly_rank_observation TO ytp_test_source_reader;
GRANT SELECT(observation_id,app_id,scheduled_at,observed_at,player_count) ON collector.v_steam_ccu_canonical TO ytp_test_source_reader;
GRANT SELECT(stats_result_id,video_id,scheduled_at,artifact_received_at,view_count) ON collector.v_youtube_stats_canonical TO ytp_test_source_reader;
