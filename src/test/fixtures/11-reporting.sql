-- SYNTHETIC TEST ONLY. Small aggregate adapters for the public UsageRepository contract.
DO $$ BEGIN
 IF current_database()<>'youtopia_auth_test' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic account database required'; END IF;
END $$;
SET ROLE ytp_test_owner;
CREATE VIEW telemetry.v_usage_daily AS SELECT (recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,environment,
 count(*) AS event_count,count(*) FILTER(WHERE event_type='PAGE_VIEW') AS page_views,
 count(DISTINCT analytics_user_key) AS login_users,count(DISTINCT analytics_session_key) AS sessions,
 count(*) FILTER(WHERE event_type='SEARCH_EXECUTED') AS searches,count(*) FILTER(WHERE event_type='SEARCH_EXECUTED' AND total_result_count=0) AS zero_result_searches,max(recorded_at) AS last_recorded_at
 FROM telemetry.product_event GROUP BY 1,2;
CREATE VIEW telemetry.v_route_daily AS SELECT (recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,environment,route_key,
 count(*) AS page_views,count(DISTINCT analytics_user_key) AS login_users,count(DISTINCT analytics_session_key) AS sessions FROM telemetry.product_event WHERE event_type='PAGE_VIEW' GROUP BY 1,2,3;
CREATE VIEW telemetry.v_game_daily AS SELECT (recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,environment,app_id,
 count(*) AS game_views,count(DISTINCT analytics_user_key) AS login_users,count(DISTINCT analytics_session_key) AS sessions FROM telemetry.product_event WHERE event_type='GAME_VIEW' GROUP BY 1,2,3;
CREATE VIEW telemetry.v_action_daily AS SELECT (recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,environment,event_type,
 sort_key,filter_key,filter_value_code,analysis_type,from_period,to_period,count(*) AS event_count,sort_direction
 FROM telemetry.product_event GROUP BY 1,2,3,4,5,6,7,8,9,11;
CREATE VIEW telemetry.v_usage_windows AS SELECT environment,
 count(DISTINCT analytics_user_key) FILTER(WHERE recorded_at>=date_trunc('day',now(), 'Asia/Seoul')) AS dau,
 count(DISTINCT analytics_user_key) FILTER(WHERE recorded_at>=date_trunc('day',now(), 'Asia/Seoul')-interval '6 days') AS wau,
 count(DISTINCT analytics_user_key) FILTER(WHERE recorded_at>=date_trunc('day',now(), 'Asia/Seoul')-interval '29 days') AS mau,
 count(*) AS observed_event_rows,max(recorded_at) AS last_recorded_at FROM telemetry.product_event WHERE recorded_at<=now() GROUP BY environment;
CREATE VIEW telemetry.v_session_activity_histogram AS
 WITH x AS(SELECT environment,analytics_session_key,max(recorded_at) AS last_activity_at FROM telemetry.product_event WHERE recorded_at<=now() GROUP BY 1,2)
 SELECT environment,last_activity_at,count(*) AS session_count FROM x GROUP BY 1,2;
CREATE VIEW telemetry.v_new_returning_daily AS
 WITH days AS(SELECT DISTINCT environment,analytics_user_key,(recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst FROM telemetry.product_event WHERE analytics_user_key IS NOT NULL),
 x AS(SELECT *,min(day_kst) OVER(PARTITION BY environment,analytics_user_key) AS first_day FROM days)
 SELECT day_kst,environment,count(*) FILTER(WHERE day_kst=first_day) AS new_observed_users,count(*) FILTER(WHERE day_kst>first_day) AS returning_observed_users FROM x GROUP BY 1,2;
CREATE VIEW telemetry.v_search_conversion_daily AS
 WITH s AS(SELECT environment,analytics_session_key,search_context_id,min(recorded_at) AS searched_at FROM telemetry.product_event WHERE event_type='SEARCH_EXECUTED' GROUP BY 1,2,3),
 x AS(SELECT (s.searched_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,s.environment,
 (SELECT (min(v.recorded_at) AT TIME ZONE 'Asia/Seoul')::date FROM telemetry.product_event v WHERE v.event_type='GAME_VIEW' AND v.source_code='SEARCH_RESULT'
 AND v.environment=s.environment AND v.analytics_session_key=s.analytics_session_key AND v.search_context_id=s.search_context_id AND v.recorded_at>=s.searched_at) AS selected_day_kst FROM s)
 SELECT day_kst,environment,count(*) AS searched_contexts,count(*) FILTER(WHERE selected_day_kst IS NOT NULL) AS selected_contexts,selected_day_kst FROM x GROUP BY 1,2,5;
CREATE VIEW security.v_audit_daily_counts AS SELECT (recorded_at AT TIME ZONE 'Asia/Seoul')::date AS day_kst,environment,event_type,result_code,count(*) AS event_count FROM security.security_audit_event GROUP BY 1,2,3,4;
RESET ROLE;
GRANT USAGE ON SCHEMA auth,telemetry,security TO ytp_test_report;
GRANT SELECT ON telemetry.v_usage_daily,telemetry.v_route_daily,telemetry.v_game_daily,telemetry.v_action_daily,telemetry.v_usage_windows,
 telemetry.v_session_activity_histogram,telemetry.v_new_returning_daily,telemetry.v_search_conversion_daily,auth.v_signup_daily,security.v_audit_daily_counts TO ytp_test_report;
