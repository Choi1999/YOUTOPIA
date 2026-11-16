FROM qwe1asd/youtopia-collector@sha256:d43c2d8e749841c1b746d5841fbde7d4d9c4bde8204ba6d35c2a1ddfc622d594
USER root
ARG YOUTOPIA_OVERLAY_SOURCE_SHA=uncommitted
LABEL org.opencontainers.image.revision=$YOUTOPIA_OVERLAY_SOURCE_SHA com.youtopia.collector.overlay="new-release-v1"
COPY tools/collector_readiness /opt/youtopia-next/collector_readiness
ENV PYTHONPATH=/opt/youtopia-next
RUN chmod -R a+rX /opt/youtopia-next && python -B -m collector_readiness.patch_image --package-root /usr/local/lib/python3.13/site-packages/youtopia_collector
USER 10001:10001
# Legacy entrypoint retained. Both new features are off until explicitly configured.
ENV YOUTOPIA_STEAM_GUARD_ENABLED=0 YOUTOPIA_NEW_RELEASES_ENABLED=0
