#!/usr/bin/env bash
# R04-AQ: provision exact Gradle 8.14.3 for two pinned, synthetic Spring
# HTTP CI jobs, without depending on the GitHub release ZIP redirect.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: bash tools/ci/prepare-r04-pinned-gradle.sh <owned-test-checkout>" >&2
  exit 2
fi

case "$1" in
  _r04x_backend) expected_head="5069a81979fd8ef10123e32d00fa35900b450944" ;;
  _r04ag_backend) expected_head="2a7836472efe154e78e5ac597f8c7a9dd67aaf9e" ;;
  *) echo "Unrecognized synthetic Spring checkout; refusing Gradle preparation" >&2; exit 2 ;;
esac

checkout="$1"
props="$checkout/gradle/wrapper/gradle-wrapper.properties"
test -f "$props"
test "$(git -C "$checkout" rev-parse HEAD)" = "$expected_head"
test "$(uname -m)" = "x86_64"
test -n "$RUNNER_TEMP"
test -n "$GITHUB_ENV"

# Confirm the original Gradle wrapper contract, without modifying it.
grep -Fxq 'distributionUrl=https\://downloads.gradle.org/distributions/gradle-8.14.3-bin.zip' "$props"
grep -Fxq 'distributionSha256Sum=bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531' "$props"

# Official Gradle image, pinned to the immutable manifest digest observed in
# successful synthetic run 42583214487. This digest is for the container,
# distinct from the Gradle distribution ZIP SHA-256 above.
image='docker.io/library/gradle:8.14.3-jdk21@sha256:21bd311ed01360c189b8870c6b6e988199ff10f72d445d02fb39d3cff9da91d7'
for attempt in 1 2 3; do
  if docker pull --platform linux/amd64 "$image"; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "Immutable Gradle image unavailable; fail closed" >&2
    exit 1
  fi
  sleep 5
done

# Use only the returned container ID; never prune or remove by name prefix.
container="$(docker create --platform linux/amd64 "$image")"
trap 'docker rm "$container" >/dev/null 2>&1 || true' EXIT

dest="$RUNNER_TEMP/youtopia-r04-gradle-8.14.3"
if [ -e "$dest" ]; then
  echo "Gradle destination unexpectedly exists; refusing replacement" >&2
  exit 1
fi

docker cp "$container:/opt/gradle" "$dest"
test -x "$dest/bin/gradle"
java_version="$(java -version 2>&1)"
case "$java_version" in
  *'version "21.'*) ;;
  *) echo "Java 21 required" >&2; exit 1 ;;
esac

# Version check is mandatory: do not use any unverified Gradle on PATH.
"$dest/bin/gradle" --version | grep -Fxq 'Gradle 8.14.3'
printf 'R04_PINNED_GRADLE=%s/bin/gradle\n' "$dest" >> "$GITHUB_ENV"
echo 'R04_GRADLE_8143_IMMUTABLE_IMAGE_READY'
