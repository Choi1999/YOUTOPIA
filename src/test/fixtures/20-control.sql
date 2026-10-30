-- SYNTHETIC TEST ONLY. Independent journal/fence adapter, with fake policy rows.
DO $$ BEGIN
 IF current_database()<>'youtopia_control_test' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic control database required'; END IF;
END $$;
CREATE SCHEMA restore_control AUTHORIZATION ytp_test_owner;
SET ROLE ytp_test_owner;
CREATE TABLE restore_control.service_fence(service_key text PRIMARY KEY,state text NOT NULL,generation uuid NOT NULL,
 key_fingerprint bytea NOT NULL,verified_sequence bigint,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE restore_control.deletion_journal(sequence_id bigserial PRIMARY KEY,event_id uuid NOT NULL UNIQUE,operation_id uuid NOT NULL,
 attempt_id uuid NOT NULL,service_key text NOT NULL,subject_tag bytea NOT NULL CHECK(octet_length(subject_tag)=32),phase text NOT NULL,
 requested_at timestamptz,recover_until_at timestamptz,minimum_auth_version bigint NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(service_key,operation_id,attempt_id,phase));
CREATE TABLE restore_control.restore_run(run_id uuid PRIMARY KEY,service_key text NOT NULL,backup_ref text NOT NULL,state text NOT NULL,
 replay_sequence bigint,failure_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE restore_control.policy_item(item_key text PRIMARY KEY,purpose text NOT NULL,legal_basis text,duration_rule text,separate_storage_ref text,
 disposal_method text,approval_status text NOT NULL DEFAULT 'REVIEW',approval_ref text,approved_at timestamptz);
INSERT INTO restore_control.policy_item(item_key,purpose,disposal_method)
 SELECT x,'SYNTHETIC TEST ONLY','synthetic disposal' FROM unnest(ARRAY['MEMBER_CREDENTIALS','RECOVERY_CODES','USER_SETTINGS','ANALYTICS_LINK','PRODUCT_EVENTS','SECURITY_AUDIT','BACKUPS','DELETION_JOURNAL']) x;
RESET ROLE;
GRANT USAGE ON SCHEMA restore_control TO ytp_test_control_app,ytp_test_restore_manager;
GRANT SELECT ON restore_control.service_fence,restore_control.deletion_journal,restore_control.policy_item TO ytp_test_control_app;
GRANT INSERT ON restore_control.deletion_journal TO ytp_test_control_app;
GRANT USAGE,SELECT ON SEQUENCE restore_control.deletion_journal_sequence_id_seq TO ytp_test_control_app;
GRANT SELECT,INSERT,UPDATE ON restore_control.service_fence,restore_control.restore_run TO ytp_test_restore_manager;
GRANT SELECT ON restore_control.deletion_journal TO ytp_test_restore_manager;
