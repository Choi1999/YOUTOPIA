#!/usr/bin/env python3
"""Explicit online check of locked public Maven coordinates against OSV.

Does not run as part of offline unit tests. No source code, credentials or private
configuration are sent. A failed lookup is unverified, never a passing result.
"""
import json
from pathlib import Path
import sys
import urllib.request


def main():
    root = Path(__file__).resolve().parent.parent
    queries = []
    for line in (root / "gradle.lockfile").read_text().splitlines():
        if line.startswith("#") or ":" not in line:
            continue
        group, artifact, version = line.split("=", 1)[0].split(":")
        queries.append({"package": {"name": group + ":" + artifact, "ecosystem": "Maven"}, "version": version})
    report = {"scope": "Locked Maven dependencies including test dependencies", "count": len(queries), "findings": []}
    try:
        for start in range(0, len(queries), 75):
            batch = queries[start:start + 75]
            request = urllib.request.Request("https://api.osv.dev/v1/querybatch",
                data=json.dumps({"queries": batch}).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=20) as response:
                results = json.load(response)["results"]
            if len(results) != len(batch):
                raise ValueError("Incomplete response")
            for package, result in zip(batch, results):
                if result.get("vulns"):
                    report["findings"].append({"package": package, "advisories": result["vulns"]})
        report["status"] = "FAIL" if report["findings"] else "PASS"
    except Exception as failure:
        report.update(status="UNVERIFIED", error_type=type(failure).__name__)
    destination = root / "build/reports/security/maven-osv.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print("Maven OSV check: " + report["status"] + "; dependencies=" + str(len(queries)) + "; findings=" + str(len(report["findings"])))
    return 0 if report["status"] == "PASS" else 2 if report["status"] == "UNVERIFIED" else 1


if __name__ == "__main__":
    sys.exit(main())
