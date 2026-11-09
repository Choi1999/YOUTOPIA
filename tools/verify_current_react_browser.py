#!/usr/bin/env python3
"""Opt-in Chromium smoke for current React /account/server and isolated packaged Spring.

Only the caller-provided React checkout and the existing owned loopback Spring
JAR are used. The packaged-session harness has already seeded a synthetic
member. No API provider, production database, user accounts or secrets.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "build/reports/packaged-sessions"
REPORTS.mkdir(parents=True, exist_ok=True)

def port(name):
    raw = os.environ.get(name, "")
    if not re.fullmatch(r"[0-9]{4,5}", raw) or not 1024 <= int(raw) <= 65535:
        raise RuntimeError("Explicit isolated loopback port required")
    return int(raw)

def main():
    if len(sys.argv) != 2:
        raise RuntimeError("Provide an explicit current React frontend directory")
    frontend = Path(sys.argv[1]).resolve(strict=True)
    required = (
        "package.json",
        "vite.config.ts",
        "src/pages/auth/ServerAccountPage.tsx",
        "src/features/server-session/serverMemberSession.ts",
    )
    if not frontend.is_dir() or not all((frontend / item).is_file() for item in required):
        raise RuntimeError("Current React account page checkout is required")
    package = json.loads((frontend / "package.json").read_text(encoding="utf-8"))
    if package.get("name") != "youtopia-frontend":
        raise RuntimeError("Unexpected React frontend package")
    if not (frontend / "node_modules/@playwright/test").exists():
        raise RuntimeError("Install the current frontend pnpm dependencies and Chromium first")

    spring_port, web_port = port("YOUTOPIA_LOCAL_AUTH_PORT"), port("YOUTOPIA_TEST_WEB_PORT")
    if spring_port == web_port:
        raise RuntimeError("Vite and Spring ports must differ")
    if os.environ.get("VITE_R04AO_LOCAL_AUTH_PROXY") != "enabled":
        raise RuntimeError("Explicit same-origin local auth proxy flag is missing")
    if os.environ.get("YOUTOPIA_E2E_MEMBER_EMAIL") != "packaged@example.invalid":
        raise RuntimeError("Only the existing isolated synthetic member is allowed")
    if os.environ.get("YOUTOPIA_E2E_MEMBER_PASSWORD") != "fake packaged test password 1234":
        raise RuntimeError("Only the isolated synthetic member password is allowed")

    url = "http://127.0.0.1:" + str(web_port) + "/account/server"
    # Preserve CI-approved network proxy / CA settings for tool execution, but
    # block the browser from ever making requests off 127.0.0.1.
    command = ["pnpm", "exec", "vite", "--host", "127.0.0.1",
               "--strictPort", "--port", str(web_port)]
    logfile = REPORTS / "current-react-vite.log"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with logfile.open("w", encoding="utf-8") as stream:
        server = subprocess.Popen(command, cwd=frontend, env=os.environ.copy(),
                                  stdout=stream, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 50
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    raise RuntimeError("Local Vite stopped before becoming ready")
                try:
                    with opener.open(url, timeout=2) as response:
                        if response.status == 200:
                            break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(.5)
            else:
                raise RuntimeError("Local Vite startup timed out")

            script = (ROOT / "tools/e2e/current_react_spring_account.mjs").read_text(
                encoding="utf-8")
            result = subprocess.run(
                ["node", "--input-type=module", "--eval", script],
                cwd=frontend, env=os.environ.copy(), timeout=135,
                check=True, text=True, capture_output=True,
            )
            # Script output is intentionally only one non-sensitive PASS record.
            outcome = json.loads(result.stdout.strip())
            if outcome.get("status") != "PASS" or outcome.get("transport") != "REAL_SPRING_SYNTHETIC_LOOPBACK":
                raise RuntimeError("Unexpected Chromium smoke result")
            (REPORTS / "result-current-react-browser.json").write_text(
                json.dumps(outcome, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(outcome))
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=3)

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        # Do not print the command, environment, browser traces or credentials.
        raise SystemExit("Current React / Spring browser E2E failed: " + type(exc).__name__)
