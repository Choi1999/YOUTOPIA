package com.youtopia.security;

/** The reviewed same-instance topology protects a service-database-only logical restore. */
public final class ControlDatabasePolicy {
    public static final String SCOPE="SERVICE_DATABASE_ONLY";
    public static final String BASE="jdbc:postgresql://127.0.0.1:5432/youtopia_control";
    private ControlDatabasePolicy() {}
    public static void verifyEndpoint(String url,String scope,String policy) {
        if(!SCOPE.equals(scope))throw new IllegalStateException("Explicit service-database-only restore scope required");
        boolean approved=switch(policy) {
            // This exception is an explicit host-loopback policy, never a remote TLS fallback.
            case "HOST_LOOPBACK" -> (BASE+"?sslmode=disable").equals(url);
            case "VERIFY_FULL" -> (BASE+"?sslmode=verify-full&sslrootcert=/etc/youtopia-app/control-ca.crt").equals(url);
            default -> false;
        };
        if(!approved)throw new IllegalStateException("Control connection differs from its reviewed database/transport policy");
    }
}
