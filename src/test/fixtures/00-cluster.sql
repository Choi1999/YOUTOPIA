-- SYNTHETIC TEST ONLY. Independent fixture for the public test contracts.
-- Not a production schema, migration, permission plan, or policy approval.
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
 OR current_setting('youtopia.synthetic_test',true) IS DISTINCT FROM 'fixture-v1'
 THEN RAISE EXCEPTION 'Synthetic runner required'; END IF;
END $$;
CREATE ROLE ytp_test_owner NOLOGIN;
-- Regression principal: the runtime guard must reject this known migration identity.
CREATE ROLE ytp_codex LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE ytp_test_data_ro LOGIN NOINHERIT;
CREATE ROLE ytp_test_member LOGIN NOINHERIT;
CREATE ROLE ytp_test_admin LOGIN NOINHERIT;
CREATE ROLE ytp_test_audit LOGIN NOINHERIT;
CREATE ROLE ytp_test_directory LOGIN NOINHERIT;
CREATE ROLE ytp_test_event LOGIN NOINHERIT;
CREATE ROLE ytp_test_report LOGIN NOINHERIT;
CREATE ROLE ytp_test_privacy LOGIN NOINHERIT;
CREATE ROLE ytp_test_control_app LOGIN NOINHERIT;
CREATE ROLE ytp_test_restore_manager LOGIN NOINHERIT;
CREATE ROLE ytp_test_source_reader LOGIN NOINHERIT;
CREATE DATABASE youtopia_test;
CREATE DATABASE youtopia_auth_test;
CREATE DATABASE youtopia_control_test;
CREATE DATABASE youtopia_source_test;
