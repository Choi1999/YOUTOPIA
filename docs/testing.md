# Reproducing the test environment

These fixtures are independent, synthetic adapters for the public repository and
test contracts. They are not production migrations, permission scripts, source
data, internal design exports, or legal approval. The application never executes
them at startup, and they are not packaged in the application JAR.

Use Linux, a local Docker Engine at `/var/run/docker.sock`, Java 21 and Python 3
(standard library only). The frontend additionally needs Node 24+, pnpm 12.9.1
and Playwright Chromium. Initial setup needs access to the pinned public container
images, the Gradle distribution/plugin portal, Maven Central and, for frontend
checks, npm/Playwright downloads. Preserve approved proxies and CA trust.

## What `check` runs

`./gradlew check` depends on **test, integrationTest and testFixtureTools**. It
does not skip integration tests when Docker or fixtures are missing: it fails
with preparation instructions. `./gradlew test` remains the Java unit/MVC test
command and needs no test servers. `bootJar` is a separate build task.
Integration results are never considered up to date or loaded from Gradle's
build cache, because mutable PostgreSQL/Redis state is not a file input.

The disposable services must be started explicitly; `check` does not provision
databases as a hidden side effect. The complete backend verification command is:

```sh
python3 tools/test_services.py verify
```

This pulls pinned PostgreSQL 16/Redis 7 images, creates new owned containers,
seeds only the committed synthetic fixtures, runs `./gradlew check bootJar`,
checks the actual JAR's two-instance sessions/restart/logout, and removes its
containers/anonymous volumes in `finally`, including when verification fails.

For iterative work:

```sh
python3 tools/test_services.py start
./gradlew check bootJar
python3 tools/verify_packaged_sessions.py
python3 tools/test_services.py stop
```

`status` validates the resource labels, project identity and loopback bindings.
`start` never resets an existing environment. If fixtures change, their fingerprint
invalidates the state: explicitly stop and start again. `stop` validates ownership
of all resources before deleting any, ignores missing owned resources, and is
idempotent. It never prunes Docker or deletes containers/volumes by a name prefix.
The generated `build/test-services.json` is local, non-secret, and untracked.
Do not copy it between checkouts.

The tool uses new random container names and dynamically assigned ports bound
only to `127.0.0.1`. Different checkouts can coexist with old containers. JDBC
targets are built from validated test metadata and an allowlist of four synthetic
database names; tests have no production-variable fallback.
Gradle also removes runtime `DB_*`, `PG*`, `YOUTOPIA_*` bindings and Docker endpoint
selectors from test/fixture child processes, retaining the approved proxy and CA
settings. A test JVM with runtime DB bindings fails the isolation guard; parent
bindings are never modified. PostgreSQL trust
authentication and Redis without authentication are confined to disposable fake
data and loopback. Never expose their ports or use these fixtures as deployment
configuration. All seed files also require the synthetic runner session marker,
the expected test database, and the fixture administrator.

## Complete frontend and browser verification

```sh
(cd frontend && pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm exec playwright install chromium)
python3 tools/test_services.py verify --with-browser
(cd frontend && pnpm exec playwright test --config=playwright.config.ts)
```

The service browser profile explicitly opts into synthetic visitor events. Its
API uses disposable database/Redis resources, random JAR HTTP ports and a random
Vite port. Playwright refuses to reuse an existing server. The Vite proxy gets
the API port from the runner; it is always a loopback destination. The
preserved demo profile uses a separate port and disables product events.

The database integration suite performs real restricted-role queries,
transactions, RLS/negative privilege checks and a backup/restore of synthetic
data. It does not establish production DDL equivalence, real source quality,
operator permissions, external API availability or deployment acceptance.

The ranking regressions include a source NULL category beside literal `null` and
`UNSPECIFIED` categories, and daily rows sharing a weekly source/category. They
verify exact category separation and exclude nonweekly observations. The browser
suite also selects an uncategorized source as a guest and checks that the request
omits `category` while the response retains JSON `null`.

## Read-only production evidence

Synthetic success does not replace actual-login checks. Use each configured
application identity directly for its approved SELECT allow/deny checks; do not
substitute an owner or `SET ROLE`. Keep operational SQL and captured database
metadata outside Git. Never run provisioning from this test runner against a
real database.

Repository SELECT queries and pure analysis functions can be checked with the
dedicated reader in an explicit read-only transaction. This validates only that
database/query path. Public HTTP requests also use the shared Redis request
budget; account/session paths additionally require their configured stores and
control service. Missing runtime dependencies must be recorded as unexecuted
checks. Disabling the budget or replacing production dependencies with a local
test service does not verify production HTTP, login or logout.

A before/after catalog fingerprint compares only the metadata included in that
capture, such as owners, ACLs and definitions. Even an exact match does not prove
that live source rows remained unchanged.

## Acceptance with empty caches

The optional cold runner creates its own **nested Docker daemon** with no host
socket or cache mounted. It asserts empty images/containers and empty
Gradle/Wrapper caches before running the complete backend verifier. Only public
source and synthetic fixtures enter the image; `.dockerignore` excludes Git,
build results, dependency stores and unlisted files. The runner needs a Linux
Docker host supporting privileged DinD. Never mount the host socket/data directory
or production secrets into it.

```sh
docker build -f tools/cold-test.Dockerfile -t youtopia-cold-test .
docker run --rm --privileged --cpus=2 --memory=3g youtopia-cold-test
docker image rm youtopia-cold-test
```

In a managed environment, use its supported local Docker endpoint and preserve
the configured container proxy defaults. If the proxy uses a session CA, add
`--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` to the build and a read-only mount
`--mount type=bind,src="$CODEX_PROXY_CERT",dst=/run/proxy-ca.pem,readonly` to run.
The build restores its original CA bundle within the same layer; runtime CA and
Java trust changes live only in the disposable container. Do not disable TLS
verification. Cold acceptance intentionally downloads images, Wrapper and Maven
dependencies rather than relying on the host caches.
