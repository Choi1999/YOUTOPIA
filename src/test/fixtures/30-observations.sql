-- SYNTHETIC TEST ONLY. Flat producer adapters; fixtures contain no production rows.
DO $$ BEGIN
 IF current_database()<>'youtopia_test' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic observation database required'; END IF;
END $$;
CREATE SCHEMA raw;
CREATE SCHEMA collector;
CREATE SCHEMA auth;
CREATE SCHEMA service;
CREATE TABLE raw.test_private(id bigint);
CREATE TABLE auth.service_user(id uuid);
CREATE TABLE collector.ccu_fixture(observation_id bigint PRIMARY KEY,artifact_id bigint,app_id bigint,scheduled_at timestamptz,observed_at timestamptz,player_count bigint);
CREATE VIEW collector.v_steam_ccu_canonical AS SELECT * FROM collector.ccu_fixture;
CREATE TABLE service.game_catalog_fixture(app_id bigint PRIMARY KEY,steam_name text NOT NULL,app_type text NOT NULL DEFAULT 'game',developers jsonb,release_at timestamptz,
 source_language text,metadata_observed_at timestamptz,steam_tracked boolean NOT NULL);
CREATE VIEW service.v_game_catalog AS SELECT * FROM service.game_catalog_fixture;
CREATE TABLE collector.video_chart_fixture(stats_result_id bigint PRIMARY KEY,video_id text,scheduled_at timestamptz,artifact_received_at timestamptz,view_count bigint);
CREATE VIEW collector.v_youtube_stats_canonical AS SELECT * FROM collector.video_chart_fixture;
CREATE TABLE service.app_type_fixture(app_id bigint,app_type text);
CREATE VIEW service.v_tracked_app_types AS SELECT * FROM service.app_type_fixture;
CREATE TABLE service.ranking_chart_fixture(ranking_run_id bigint,ranking_source text,country_code text,category_key text,period_start timestamptz,period_end timestamptz,
 received_at timestamptz,app_id bigint,game_name text,result_position int);
CREATE VIEW service.v_weekly_rank_observation AS SELECT * FROM service.ranking_chart_fixture;
CREATE TABLE service.video_association_fixture(app_id bigint,video_id text,first_observed_at timestamptz,last_observed_at timestamptz);
CREATE VIEW service.v_game_video_association AS SELECT * FROM service.video_association_fixture;
GRANT USAGE ON SCHEMA collector,service TO ytp_test_data_ro;
GRANT SELECT(observation_id,app_id,scheduled_at,observed_at,player_count) ON collector.v_steam_ccu_canonical TO ytp_test_data_ro;
GRANT SELECT(stats_result_id,video_id,scheduled_at,artifact_received_at,view_count) ON collector.v_youtube_stats_canonical TO ytp_test_data_ro;
GRANT SELECT ON service.v_game_catalog,service.v_tracked_app_types,service.v_weekly_rank_observation,service.v_game_video_association TO ytp_test_data_ro;
