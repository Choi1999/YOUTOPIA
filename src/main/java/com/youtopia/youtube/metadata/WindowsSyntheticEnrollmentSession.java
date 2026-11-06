package com.youtopia.youtube.metadata;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;

/**
 * UI-R04-V — non-Spring, package-private, synthetic-only operator enrollment
 * simulation. Tickets are in-memory, single use, scoped to this Java instance
 * and its monotonically changing revision. Nothing here can enroll a real key
 * or connect the resulting bytes to a provider transport.
 *
 * Crash consistency, cross-process locking, production enrollment UI and
 * persistent audit/quota are deliberately NOT implemented and NOT approved.
 */
final class WindowsSyntheticEnrollmentSession {
    enum Action { ENROLL_SYNTHETIC, ROTATE_SYNTHETIC, DELETE_SYNTHETIC }
    enum State { ABSENT_SYNTHETIC, PRESENT_SYNTHETIC }

    static final String POLICY = "POLICY_HOLD";
    static final boolean REAL_CREDENTIAL_ADMISSION = false;
    static final boolean FIRST_LIVE_METADATA_CALL_AUTHORIZED = false;

    static final class Ticket {
        private final WindowsSyntheticEnrollmentSession owner;
        private final UUID oneTimeToken;
        private final long revision;
        private final Action action;
        private boolean consumed;

        private Ticket(WindowsSyntheticEnrollmentSession owner,
                       long revision, Action action) {
            this.owner = owner;
            this.revision = revision;
            this.action = action;
            this.oneTimeToken = UUID.randomUUID();
        }

        Action action() { return action; }
        boolean isConsumed() { return consumed; }
        // Ticket ID is deliberately not exposed through this class.
    }

    record Snapshot(State state, long revision, String policy,
                    boolean realCredentialAdmitted,
                    boolean firstLiveMetadataCallAuthorized,
                    boolean externalRequestsMade) {}

    private final WindowsDpapiSyntheticVault vault;
    private long revision;
    private boolean closed;

    private WindowsSyntheticEnrollmentSession(Path testOnlyRoot) throws IOException {
        vault = WindowsDpapiSyntheticVault.open(testOnlyRoot);
    }

    static WindowsSyntheticEnrollmentSession open(Path testOnlyRoot) throws IOException {
        return new WindowsSyntheticEnrollmentSession(testOnlyRoot);
    }

    private void ensureOpen() {
        if (closed) throw rejected("CLOSED");
    }

    private static IllegalStateException rejected(String reason) {
        return new IllegalStateException("UI_R04V_SYNTHETIC_" + reason);
    }

    synchronized Snapshot snapshot() throws IOException {
        ensureOpen();
        return new Snapshot(vault.present() ? State.PRESENT_SYNTHETIC
                : State.ABSENT_SYNTHETIC, revision, POLICY,
                false, false, false);
    }

    /**
     * Preview is not an authorization. No caller-supplied Boolean, string,
     * role header, credential, Cloud proof or real key may be used as an
     * elevation path.
     */
    synchronized Ticket preview(Action action) throws IOException {
        ensureOpen();
        if (action == null) throw rejected("INVALID_ACTION");
        checkPrecondition(action);
        return new Ticket(this, revision, action);
    }

    /**
     * Commit one SYNTHETIC marker in an isolated OS-TEMP-only vault.
     * ENROLL and ROTATE require marker bytes; DELETE must receive null.
     * Ticket is consumed BEFORE trying a native DPAPI operation so failures
     * cannot be silently retried using the same ticket.
     */
    synchronized Snapshot commit(Ticket ticket, byte[] syntheticMarker)
            throws IOException {
        ensureOpen();
        if (ticket == null || ticket.owner != this) throw rejected("WRONG_SESSION");
        if (ticket.consumed) throw rejected("TICKET_REPLAY");
        ticket.consumed = true;
        if (ticket.revision != revision) throw rejected("STALE_REVISION");
        checkPrecondition(ticket.action);

        if (ticket.action == Action.DELETE_SYNTHETIC) {
            if (syntheticMarker != null) throw rejected("DELETE_HAS_PAYLOAD");
            vault.erase();
        } else {
            if (syntheticMarker == null) throw rejected("MISSING_SYNTHETIC_MARKER");
            vault.replaceSynthetic(syntheticMarker);
        }
        revision++;
        return snapshot();
    }

    /** Callback plaintext is zeroed by the underlying native DPAPI vault. */
    synchronized void inspectSynthetic(java.util.function.Consumer<byte[]> check)
            throws IOException {
        ensureOpen();
        vault.withSynthetic(Objects.requireNonNull(check));
    }

    synchronized void close() {
        // Closing the Java session never deletes or exposes a secret.
        // Tests must call DELETE separately or dispose isolated temp files.
        closed = true;
    }

    private void checkPrecondition(Action action) throws IOException {
        boolean exists = vault.present();
        if (action == Action.ENROLL_SYNTHETIC && exists)
            throw rejected("ALREADY_ENROLLED");
        if ((action == Action.ROTATE_SYNTHETIC ||
                action == Action.DELETE_SYNTHETIC) && !exists)
            throw rejected("NOT_ENROLLED");
    }
}
