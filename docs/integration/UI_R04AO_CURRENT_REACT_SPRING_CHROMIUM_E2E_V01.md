# UI-R04-AO — current React /account/server + real packaged Spring browser acceptance

## Scope and immutable revisions
- Frontend: `frontend@1ff56eab78091692a08c47888590aca036a2a6a4`, **independently** checked out under `current-react/frontend` in CI.
- Backend: the tested PR HEAD based on `feat/backend-bootstrap@89bfd2ba0289900d7664e6d383736e8d10fb14f2`, including PR #112's test-only profile fix.
- This gate is separate from the backend branch's historical `frontend/` Playwright project.
- PR #109 is an independent Draft for a fail-closed metadata **capabilities** endpoint. This test does **not** merge PR #109 or exercise provider metadata.
- No live YouTube/provider requests, actual credentials, production database, remote deployment or security bypass. `POLICY_HOLD` remains.

## Real server + real Chromium, synthetic account
`tools/test_services.py verify --current-frontend <absolute-path-to-current-react-frontend>` is an opt-in extension to the existing isolated runner. The normal `verify` behavior remains intact.

The command:
1. Uses the existing owned, labeled, disposable loopback PostgreSQL 16 / Redis 7 fixtures.
2. Runs full Gradle `check bootJar`.
3. Starts the real packaged Spring JAR with the existing synthetic account/restore-control fixtures.
4. Seeds the existing `packaged@example.invalid` synthetic member with a fixed non-real test password.
5. Launches a Vite dev server on a dynamically selected loopback port, enabling **only** the existing `VITE_R04AO_LOCAL_AUTH_PROXY` opt-in; the proxy itself allows only `/api/v1/auth/{csrf,login,me,logout}`.
6. Uses Chromium on `/account/server` to check no eager auth requests, backend 401 guest state, CSRF -> real login -> real /me, USER identity and Secure/HttpOnly/Lax cookie, password not in browser storage, reload/session recovery, server logout and 401.
7. Verifies that all browser HTTP requests stay on 127.0.0.1; the test is not an external provider smoke.
8. Stops Vite/JAR and disposes its **owned** test containers/volumes in `finally`, even on failure. It writes a non-sensitive summary at `build/reports/packaged-sessions/result-current-react-browser.json`.

Requires Linux, Java 21, Docker unix socket, Python 3, Node 24, pnpm 12.9.1, frontend `pnpm install --frozen-lockfile`, and Playwright Chromium installed. The default runner does not silently skip missing prerequisites.

## Run (Ubuntu)
```bash
cd ~/projects/YOUTOPIA-BACKEND-E2E
# Use the reviewed PR HEAD; do not edit frontend or backend operating branches.
test ! -e build/test-services.json
# Checkout the latest React frontend into a separate local checkout (not a Windows gitfile worktree).
python3 tools/test_services.py verify --current-frontend "$HOME/projects/YOUTOPIA-CURRENT-FRONTEND/frontend"
```

The frontend path must already contain current React source and node_modules. No files are copied into or modified in the original frontend source except Vite's usual local transient cache. No credentials are persisted into reports.

## Evidence boundary
GitHub CI must report `R04AO_CURRENT_REACT_SPRING_E2E_PASS` on the exact PR head. This is a **synthetic-data real HTTP/Chromium** run; it does not establish deployed HTTPS acceptance, real-world account configuration or live API approval. `POLICY_HOLD` remains unchanged.
