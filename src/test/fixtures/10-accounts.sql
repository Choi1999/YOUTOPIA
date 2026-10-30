-- SYNTHETIC TEST ONLY: repository SQL contracts, not production DDL.
DO $$ BEGIN
 IF current_database()<>'youtopia_auth_test' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic account database required'; END IF;
END $$;
CREATE SCHEMA auth AUTHORIZATION ytp_test_owner;
CREATE SCHEMA service AUTHORIZATION ytp_test_owner;
CREATE SCHEMA security AUTHORIZATION ytp_test_owner;
CREATE SCHEMA telemetry AUTHORIZATION ytp_test_owner;
SET ROLE ytp_test_owner;
CREATE TABLE auth.service_user(
 user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), login_email text NOT NULL UNIQUE,
 account_status text NOT NULL DEFAULT 'ACTIVE', auth_version bigint NOT NULL DEFAULT 1,
 row_version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth.user_credential(user_id uuid PRIMARY KEY REFERENCES auth.service_user ON DELETE CASCADE,
 password_hash text NOT NULL,password_changed_at timestamptz NOT NULL DEFAULT now());
-- Storage contract exercised by password-change/reset and old-session denial tests.
CREATE FUNCTION auth.synthetic_password_epoch() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN UPDATE auth.service_user SET auth_version=auth_version+1,row_version=row_version+1,updated_at=now() WHERE user_id=NEW.user_id; RETURN NEW; END $$;
CREATE TRIGGER synthetic_password_epoch AFTER UPDATE OF password_hash ON auth.user_credential
 FOR EACH ROW WHEN(OLD.password_hash IS DISTINCT FROM NEW.password_hash) EXECUTE FUNCTION auth.synthetic_password_epoch();
CREATE TABLE auth.analytics_identity(user_id uuid PRIMARY KEY REFERENCES auth.service_user ON DELETE CASCADE,
 analytics_user_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),revoked_at timestamptz);
CREATE TABLE auth.recovery_code(code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.service_user ON DELETE CASCADE,
 batch_id uuid NOT NULL,code_hmac bytea NOT NULL,hmac_key_version int NOT NULL,consumed_at timestamptz,revoked_at timestamptz,UNIQUE(user_id,code_hmac));
CREATE TABLE auth.deletion_request(request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.service_user ON DELETE SET NULL,
 requested_at timestamptz NOT NULL,recover_until_at timestamptz NOT NULL,
 request_state text NOT NULL DEFAULT 'PENDING',purge_attempts int NOT NULL DEFAULT 0,last_error_code text,closed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),CHECK(recover_until_at=requested_at+interval '72 hours'));
CREATE TABLE auth.admin_account(admin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_login_name text NOT NULL UNIQUE,
 password_hash text NOT NULL,account_status text NOT NULL DEFAULT 'ACTIVE',auth_version bigint NOT NULL DEFAULT 1,row_version bigint NOT NULL DEFAULT 0,
 password_changed_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth.admin_active_session(admin_id uuid PRIMARY KEY REFERENCES auth.admin_account ON DELETE CASCADE,
 session_tag_hmac bytea NOT NULL,session_generation bigint NOT NULL DEFAULT 1,activated_at timestamptz NOT NULL,absolute_expires_at timestamptz NOT NULL);
CREATE TABLE auth.security_operation(operation_id uuid PRIMARY KEY,account_kind text NOT NULL,principal_id uuid,operation_type text NOT NULL,request_key uuid NOT NULL,
 operation_state text NOT NULL DEFAULT 'PENDING',committed_auth_version bigint,attempts int NOT NULL DEFAULT 0,error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(account_kind,principal_id,operation_type,request_key));
ALTER TABLE auth.security_operation ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_member ON auth.security_operation TO ytp_test_member USING(account_kind='USER') WITH CHECK(account_kind='USER');
CREATE POLICY synthetic_admin ON auth.security_operation TO ytp_test_admin USING(account_kind='ADMIN') WITH CHECK(account_kind='ADMIN');
CREATE POLICY synthetic_privacy ON auth.security_operation TO ytp_test_privacy USING(account_kind='USER') WITH CHECK(account_kind='USER');
CREATE TABLE service.user_setting(user_id uuid PRIMARY KEY REFERENCES auth.service_user ON DELETE CASCADE,
 preferences jsonb NOT NULL DEFAULT '{}',row_version bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE service.restore_marker(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),generation uuid NOT NULL DEFAULT gen_random_uuid(),journal_sequence bigint NOT NULL DEFAULT 0);
INSERT INTO service.restore_marker DEFAULT VALUES;
CREATE TABLE service.signup_daily_count(day_kst date PRIMARY KEY,signups bigint NOT NULL DEFAULT 0);
CREATE FUNCTION service.synthetic_signup_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 BEGIN INSERT INTO service.signup_daily_count VALUES((NEW.created_at AT TIME ZONE 'Asia/Seoul')::date,1)
 ON CONFLICT(day_kst) DO UPDATE SET signups=service.signup_daily_count.signups+1; RETURN NEW; END $$;
CREATE TRIGGER synthetic_signup_count AFTER INSERT ON auth.service_user FOR EACH ROW EXECUTE FUNCTION service.synthetic_signup_count();
CREATE TABLE security.security_audit_event(audit_event_id uuid PRIMARY KEY,event_type text NOT NULL,actor_kind text NOT NULL,actor_id uuid,
 result_code text NOT NULL,correlation_id uuid,environment text NOT NULL,subject_user_id uuid,recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE telemetry.product_event(event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_event_id uuid NOT NULL UNIQUE,event_type text NOT NULL,
 action_key text NOT NULL,analytics_session_key uuid NOT NULL,analytics_user_key uuid,environment text NOT NULL,payload_fingerprint bytea NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),route_key text,app_id bigint,source_code text,search_context_id uuid,result_position int,total_result_count int,
 sort_key text,filter_keys text[],sort_direction text,filter_key text,filter_value_code text,analysis_type text,from_period text,to_period text,keyword_id text,game_event_key text);
CREATE VIEW auth.v_admin_member_directory WITH(security_barrier=true) AS
 SELECT u.user_id,left(split_part(u.login_email,'@',1),1)||'***@'||split_part(u.login_email,'@',2) AS masked_email,u.account_status,u.created_at,
 (SELECT max(d.recover_until_at) FROM auth.deletion_request d WHERE d.user_id=u.user_id AND d.request_state='PENDING') AS recover_until_at FROM auth.service_user u;
CREATE VIEW auth.v_signup_daily AS SELECT * FROM service.signup_daily_count;
RESET ROLE;
GRANT USAGE ON SCHEMA auth,service TO ytp_test_member;
GRANT SELECT ON auth.service_user,auth.user_credential,auth.analytics_identity,auth.recovery_code,auth.deletion_request,service.user_setting,service.restore_marker TO ytp_test_member;
GRANT INSERT(login_email) ON auth.service_user TO ytp_test_member;
GRANT UPDATE(account_status,auth_version,row_version,updated_at) ON auth.service_user TO ytp_test_member;
GRANT INSERT(user_id,password_hash),UPDATE(password_hash,password_changed_at) ON auth.user_credential TO ytp_test_member;
GRANT INSERT(user_id),UPDATE(revoked_at) ON auth.analytics_identity TO ytp_test_member;
GRANT INSERT(user_id,batch_id,code_hmac,hmac_key_version),UPDATE(consumed_at,revoked_at) ON auth.recovery_code TO ytp_test_member;
GRANT INSERT(user_id,requested_at,recover_until_at),UPDATE(request_state,purge_attempts,last_error_code,closed_at,updated_at) ON auth.deletion_request TO ytp_test_member;
GRANT INSERT(user_id,preferences),UPDATE(preferences,row_version,updated_at) ON service.user_setting TO ytp_test_member;
GRANT UPDATE(journal_sequence) ON service.restore_marker TO ytp_test_member;
GRANT USAGE ON SCHEMA auth TO ytp_test_admin,ytp_test_directory;
GRANT SELECT ON auth.admin_account TO ytp_test_admin;
GRANT UPDATE(password_hash,password_changed_at,auth_version,row_version,updated_at) ON auth.admin_account TO ytp_test_admin;
GRANT SELECT,INSERT,DELETE ON auth.admin_active_session TO ytp_test_admin;
GRANT UPDATE(session_tag_hmac,session_generation,activated_at,absolute_expires_at) ON auth.admin_active_session TO ytp_test_admin;
GRANT SELECT,INSERT ON auth.security_operation TO ytp_test_member,ytp_test_admin;
GRANT UPDATE(operation_state,committed_auth_version,attempts,error_code,updated_at,completed_at) ON auth.security_operation TO ytp_test_member,ytp_test_admin;
GRANT SELECT ON auth.v_admin_member_directory TO ytp_test_directory;
GRANT USAGE ON SCHEMA security TO ytp_test_audit;
GRANT INSERT ON security.security_audit_event TO ytp_test_audit;
GRANT USAGE ON SCHEMA telemetry TO ytp_test_event;
GRANT INSERT(client_event_id,event_type,action_key,analytics_session_key,analytics_user_key,environment,payload_fingerprint,route_key,app_id,source_code,
 search_context_id,result_position,total_result_count,sort_key,filter_keys,sort_direction,filter_key,filter_value_code,analysis_type,from_period,to_period,keyword_id,game_event_key) ON telemetry.product_event TO ytp_test_event;
GRANT SELECT(event_id,client_event_id,analytics_session_key,payload_fingerprint) ON telemetry.product_event TO ytp_test_event;
-- Synthetic privacy-worker permissions exercise the application's disabled-by-default maintenance tests only.
GRANT USAGE ON SCHEMA auth,service,security,telemetry TO ytp_test_privacy;
GRANT SELECT,DELETE ON auth.service_user,telemetry.product_event TO ytp_test_privacy;
GRANT UPDATE(account_status,auth_version,row_version,updated_at) ON auth.service_user TO ytp_test_privacy;
GRANT SELECT ON auth.deletion_request,auth.analytics_identity,auth.security_operation,service.restore_marker TO ytp_test_privacy;
GRANT UPDATE(request_state,purge_attempts,last_error_code,closed_at,updated_at) ON auth.deletion_request TO ytp_test_privacy;
GRANT SELECT,INSERT ON security.security_audit_event TO ytp_test_privacy;
GRANT UPDATE(actor_id,subject_user_id) ON security.security_audit_event TO ytp_test_privacy;
GRANT UPDATE(principal_id) ON auth.security_operation TO ytp_test_privacy;
GRANT UPDATE(journal_sequence) ON service.restore_marker TO ytp_test_privacy;
