package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** R04-V — actual native DPAPI, ONLY in isolated synthetic Windows temp. */
class WindowsSyntheticEnrollmentSessionTest {
    private static boolean windows() {
        return System.getProperty("os.name", "").startsWith("Windows");
    }

    private static Path root() {
        return Path.of(System.getProperty("java.io.tmpdir"),
                "youtopia-r04u-synthetic-" + UUID.randomUUID());
    }

    private static byte[] marker() {
        return ("R04U_SYNTHETIC_" + UUID.randomUUID())
                .getBytes(StandardCharsets.US_ASCII);
    }

    private static void cleanup(Path p) throws Exception {
        // Only files in a newly generated test-only folder. Never touch
        // LOCALAPPDATA or any real credential path.
        if (Files.isDirectory(p)) {
            try (var files = Files.list(p)) {
                for (Path f : files.toList()) {
                    assertTrue(f.getFileName().toString().equals("metadata-synthetic.dpapi") ||
                            f.getFileName().toString().matches("tmp-[a-f0-9-]+\\.dpapi"));
                    Files.deleteIfExists(f);
                }
            }
            Files.deleteIfExists(p);
        }
    }

    private static void denied(String code, org.junit.jupiter.api.function.Executable action) {
        assertEquals("UI_R04V_SYNTHETIC_" + code,
                assertThrows(IllegalStateException.class, action).getMessage());
    }

    @Test
    void enrollmentRotationDeletionAndSameUserReopenAreSyntheticOnly() throws Exception {
        assumeTrue(windows());
        Path p = root();
        byte[] one = marker();
        byte[] two = marker();
        try {
            var session = WindowsSyntheticEnrollmentSession.open(p);
            var empty = session.snapshot();
            assertEquals(WindowsSyntheticEnrollmentSession.State.ABSENT_SYNTHETIC, empty.state());
            assertEquals(0, empty.revision());
            assertEquals("POLICY_HOLD", empty.policy());
            assertFalse(empty.realCredentialAdmitted());
            assertFalse(empty.firstLiveMetadataCallAuthorized());
            assertFalse(empty.externalRequestsMade());

            var enroll = session.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC);
            assertFalse(enroll.isConsumed());
            var enrolled = session.commit(enroll, one);
            assertEquals(WindowsSyntheticEnrollmentSession.State.PRESENT_SYNTHETIC, enrolled.state());
            assertEquals(1, enrolled.revision());
            assertTrue(enroll.isConsumed());
            denied("TICKET_REPLAY", () -> session.commit(enroll, one));
            denied("ALREADY_ENROLLED", () ->
                    session.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC));

            session.inspectSynthetic(clear -> assertTrue(MessageDigest.isEqual(one, clear)));
            var rotate = session.preview(WindowsSyntheticEnrollmentSession.Action.ROTATE_SYNTHETIC);
            var staleDelete = session.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC);
            var rotated = session.commit(rotate, two);
            assertEquals(2, rotated.revision());
            denied("STALE_REVISION", () -> session.commit(staleDelete, null));
            assertTrue(staleDelete.isConsumed());
            session.inspectSynthetic(clear -> assertTrue(MessageDigest.isEqual(two, clear)));

            session.close();
            denied("CLOSED", () -> session.preview(
                    WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC));
            var reopened = WindowsSyntheticEnrollmentSession.open(p);
            assertEquals(WindowsSyntheticEnrollmentSession.State.PRESENT_SYNTHETIC,
                    reopened.snapshot().state());
            reopened.inspectSynthetic(clear -> assertTrue(MessageDigest.isEqual(two, clear)));
            var deleting = reopened.preview(
                    WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC);
            var erased = reopened.commit(deleting, null);
            assertEquals(WindowsSyntheticEnrollmentSession.State.ABSENT_SYNTHETIC, erased.state());
            assertFalse(erased.firstLiveMetadataCallAuthorized());
            denied("NOT_ENROLLED", () ->
                    reopened.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC));
        } finally {
            Arrays.fill(one, (byte) 0);
            Arrays.fill(two, (byte) 0);
            cleanup(p);
        }
    }

    @Test
    void oneTimeTicketCannotBeReplayedOrBorrowedByAnotherSession() throws Exception {
        assumeTrue(windows());
        Path p = root();
        byte[] value = marker();
        try {
            var a = WindowsSyntheticEnrollmentSession.open(p);
            var b = WindowsSyntheticEnrollmentSession.open(p);
            var ticket = a.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC);
            denied("WRONG_SESSION", () -> b.commit(ticket, value));
            assertFalse(ticket.isConsumed());
            a.commit(ticket, value);
            denied("TICKET_REPLAY", () -> a.commit(ticket, value));
            // B sees the disk state even though its in-memory version is 0.
            denied("ALREADY_ENROLLED", () ->
                    b.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC));
            b.commit(b.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC), null);
            assertEquals(WindowsSyntheticEnrollmentSession.State.ABSENT_SYNTHETIC,
                    a.snapshot().state());
        } finally {
            Arrays.fill(value, (byte) 0);
            cleanup(p);
        }
    }

    @Test
    void realShapedKeyIsDeniedAndTicketConsumedBeforeAnyRotation() throws Exception {
        assumeTrue(windows());
        Path p = root();
        byte[] fakeRealKey = "AIza-REAL_KEY_PROHIBITED_IN_TEST"
                .getBytes(StandardCharsets.US_ASCII);
        byte[] synthetic = marker();
        try {
            var s = WindowsSyntheticEnrollmentSession.open(p);
            var ticket = s.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC);
            assertEquals("UI_R04U_VAULT_REAL_KEY_NOT_ACCEPTED",
                    assertThrows(IllegalStateException.class,
                            () -> s.commit(ticket, fakeRealKey)).getMessage());
            assertTrue(ticket.isConsumed());
            denied("TICKET_REPLAY", () -> s.commit(ticket, synthetic));
            assertEquals(WindowsSyntheticEnrollmentSession.State.ABSENT_SYNTHETIC,
                    s.snapshot().state());
            s.commit(s.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC), synthetic);
            var delete = s.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC);
            denied("DELETE_HAS_PAYLOAD", () -> s.commit(delete, synthetic));
            assertEquals(WindowsSyntheticEnrollmentSession.State.PRESENT_SYNTHETIC,
                    s.snapshot().state());
            s.commit(s.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC), null);
        } finally {
            Arrays.fill(fakeRealKey, (byte) 0);
            Arrays.fill(synthetic, (byte) 0);
            cleanup(p);
        }
    }

    @Test
    void wrongOperationsNeverInventMissingVaultOrPermitNullPayload() throws Exception {
        assumeTrue(windows());
        Path p = root();
        try {
            var s = WindowsSyntheticEnrollmentSession.open(p);
            denied("INVALID_ACTION", () -> s.preview(null));
            denied("NOT_ENROLLED", () ->
                    s.preview(WindowsSyntheticEnrollmentSession.Action.ROTATE_SYNTHETIC));
            denied("NOT_ENROLLED", () ->
                    s.preview(WindowsSyntheticEnrollmentSession.Action.DELETE_SYNTHETIC));
            var ticket = s.preview(WindowsSyntheticEnrollmentSession.Action.ENROLL_SYNTHETIC);
            denied("MISSING_SYNTHETIC_MARKER", () -> s.commit(ticket, null));
            assertTrue(ticket.isConsumed());
            denied("TICKET_REPLAY", () -> s.commit(ticket, marker()));
            denied("WRONG_SESSION", () -> s.commit(null, marker()));
        } finally {
            cleanup(p);
        }
    }

    @Test
    void nonWindowsCannotCreateEnrollmentSession() throws Exception {
        assumeTrue(!windows());
        assertEquals("UI_R04U_VAULT_WINDOWS_REQUIRED",
                assertThrows(IllegalStateException.class,
                        () -> WindowsSyntheticEnrollmentSession.open(root())).getMessage());
    }

    @Test
    void coreIsNotSpringServiceOrGeneralCredentialInputSurface() {
        assertEquals(0, WindowsSyntheticEnrollmentSession.class.getAnnotations().length);
        assertFalse(java.lang.reflect.Modifier.isPublic(
                WindowsSyntheticEnrollmentSession.class.getModifiers()));
        assertFalse(WindowsSyntheticEnrollmentSession.REAL_CREDENTIAL_ADMISSION);
        assertFalse(WindowsSyntheticEnrollmentSession.FIRST_LIVE_METADATA_CALL_AUTHORIZED);
        assertTrue(java.util.Arrays.stream(
                WindowsSyntheticEnrollmentSession.class.getDeclaredMethods())
                .noneMatch(m -> m.getName().matches(
                        "(?i)storeRealKey|readRealKey|authorize|executeLive|fetch|publish|send")));
    }
}
