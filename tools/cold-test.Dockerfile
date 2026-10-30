# Optional Linux cold-start acceptance runner, never a deployment image.
FROM docker:28.4.0-dind
RUN --mount=type=secret,id=proxy_ca \
    cp /etc/ssl/cert.pem /tmp/cold-original-ca && \
    if [ -f /run/secrets/proxy_ca ]; then cat /run/secrets/proxy_ca >> /etc/ssl/cert.pem; fi && \
    apk add --no-cache openjdk21-jdk python3 && \
    cp /tmp/cold-original-ca /etc/ssl/cert.pem && rm /tmp/cold-original-ca
WORKDIR /project
COPY gradlew build.gradle settings.gradle gradle.lockfile ./
COPY gradle ./gradle
COPY src ./src
COPY tools ./tools
RUN chmod +x gradlew
ENV DOCKER_TLS_CERTDIR="" GRADLE_USER_HOME=/tmp/cold-gradle
ENTRYPOINT ["sh", "tools/cold-test-entrypoint.sh"]
