package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

/** Only synthetic markers. No Cloud, YouTube, credential UI or real keys. */
class WindowsDpapiSyntheticVaultTest {
    private static boolean windows() {
        return System.getProperty("os.name", "").startsWith("Windows");
    }
    private static Path newRoot() {
        return Path.of(System.getProperty("java.io.tmpdir"),
                "youtopia-r04u-synthetic-" + UUID.randomUUID());
    }
    private static byte[] marker() {
        return ("R04U_SYNTHETIC_" + UUID.randomUUID()).getBytes(StandardCharsets.US_ASCII);
    }
    private static void clear(byte[] bytes) { Arrays.fill(bytes, (byte) 0); }

    @Test
    void directJavaDpapiRoundtripNeverOutputsPlaintextToCiphertextOrLeavesSecretInCallback()
            throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        byte[] expected = marker();
        AtomicReference<byte[]> captured = new AtomicReference<>();
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            assertFalse(vault.present());
            vault.replaceSynthetic(expected);
            assertTrue(vault.present());

            byte[] disk = Files.readAllBytes(vault.syntheticFileForTest());
            assertTrue(disk.length >= 9);
            assertTrue(disk.length <= 4096);
            assertNotEquals(new String(expected, StandardCharsets.US_ASCII),
                    new String(disk, StandardCharsets.ISO_8859_1));
            assertFalse(new String(disk, StandardCharsets.ISO_8859_1)
                    .contains(new String(expected, StandardCharsets.US_ASCII)));

            vault.withSynthetic(clear -> {
                assertTrue(MessageDigest.isEqual(expected, clear));
                captured.set(clear); // test-only: verify memory is wiped afterwards.
            });
            assertNotNull(captured.get());
            assertTrue(allZero(captured.get()));
            assertTrue(vault.present());
            vault.erase();
            assertFalse(vault.present());
        } finally {
            clear(expected);
            Files.deleteIfExists(root.resolve("metadata-synthetic.dpapi"));
            Files.deleteIfExists(root);
        }
    }

    @Test
    void rotationUsesAtomicReplaceAndReopenWorksForCurrentUser() throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        byte[] original = marker();
        byte[] replacement = marker();
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            vault.replaceSynthetic(original);
            vault.withSynthetic(clear -> assertTrue(MessageDigest.isEqual(original, clear)));
            vault.replaceSynthetic(replacement);
            vault.withSynthetic(clear -> assertTrue(MessageDigest.isEqual(replacement, clear)));
            assertFalse(Files.list(root).anyMatch(p -> p.getFileName().toString().startsWith("tmp-")));
            var reopened = WindowsDpapiSyntheticVault.open(root);
            reopened.withSynthetic(clear -> assertTrue(MessageDigest.isEqual(replacement, clear)));
            reopened.erase();
            reopened.erase(); // deletion is idempotent, no silent re-provisioning
        } finally {
            clear(original);
            clear(replacement);
            Files.deleteIfExists(root.resolve("metadata-synthetic.dpapi"));
            Files.deleteIfExists(root);
        }
    }

    @Test
    void rejectsRealKeyShapedInputsWithoutReplacingExistingEncryptedData() throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        byte[] original = marker();
        byte[] realShaped = "AIza-not-a-real-test-key-material".getBytes(StandardCharsets.US_ASCII);
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            vault.replaceSynthetic(original);
            var error = assertThrows(IllegalStateException.class,
                    () -> vault.replaceSynthetic(realShaped));
            assertEquals("UI_R04U_VAULT_REAL_KEY_NOT_ACCEPTED", error.getMessage());
            vault.withSynthetic(clear -> assertTrue(MessageDigest.isEqual(original, clear)));
            vault.erase();
        } finally {
            clear(original);
            clear(realShaped);
            Files.deleteIfExists(root.resolve("metadata-synthetic.dpapi"));
            Files.deleteIfExists(root);
        }
    }

    @Test
    void corruptedCiphertextFailsClosedWithNoResponseOrProviderRequest() throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        byte[] expected = marker();
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            vault.replaceSynthetic(expected);
            var file = vault.syntheticFileForTest();
            var corrupted = Files.readAllBytes(file);
            corrupted[corrupted.length - 1] ^= (byte) 0x6d;
            Files.write(file, corrupted, StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
            var denied = assertThrows(IllegalStateException.class,
                    () -> vault.withSynthetic(clear -> fail("corruption was accepted")));
            assertEquals("UI_R04U_VAULT_DPAPI_UNPROTECT_FAILED", denied.getMessage());
            vault.erase();
        } finally {
            clear(expected);
            Files.deleteIfExists(root.resolve("metadata-synthetic.dpapi"));
            Files.deleteIfExists(root);
        }
    }

    @Test
    void rejectsSymlinkVaultRootOrUnknownOutputDirectory() throws Exception {
        assumeTrue(windows());
        Path bad = Path.of(System.getProperty("java.io.tmpdir"), "not-a-youtopia-vault");
        var error = assertThrows(IllegalStateException.class,
                () -> WindowsDpapiSyntheticVault.open(bad));
        assertEquals("UI_R04U_VAULT_SYNTHETIC_SCOPE_ONLY", error.getMessage());

        Path nested = Path.of(System.getProperty("java.io.tmpdir"),
                "youtopia-r04u-synthetic-" + UUID.randomUUID(), "nested");
        assertThrows(IllegalStateException.class,
                () -> WindowsDpapiSyntheticVault.open(nested));
    }

    @Test
    void fileAclsNeverGrantExplicitAllowToOtherPrincipals() throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        byte[] expected = marker();
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            vault.replaceSynthetic(expected);
            var dirAcl = Files.getFileAttributeView(root, AclFileAttributeView.class,
                    LinkOption.NOFOLLOW_LINKS);
            var fileAcl = Files.getFileAttributeView(vault.syntheticFileForTest(),
                    AclFileAttributeView.class, LinkOption.NOFOLLOW_LINKS);
            var owner = Files.getOwner(root, LinkOption.NOFOLLOW_LINKS);
            assertNotNull(dirAcl);
            assertNotNull(fileAcl);
            assertTrue(dirAcl.getAcl().stream()
                    .filter(a -> a.type() == AclEntryType.ALLOW)
                    .allMatch(a -> a.principal().equals(owner)));
            assertTrue(fileAcl.getAcl().stream()
                    .filter(a -> a.type() == AclEntryType.ALLOW)
                    .allMatch(a -> a.principal().equals(owner)));
            vault.erase();
        } finally {
            clear(expected);
            Files.deleteIfExists(root.resolve("metadata-synthetic.dpapi"));
            Files.deleteIfExists(root);
        }
    }

    @Test
    void absentVaultNeverInventsSecretOrSilentlyFallsBack() throws Exception {
        assumeTrue(windows());
        Path root = newRoot();
        try {
            var vault = WindowsDpapiSyntheticVault.open(root);
            assertFalse(vault.present());
            assertEquals("UI_R04U_VAULT_MISSING",
                    assertThrows(IllegalStateException.class,
                            () -> vault.withSynthetic(clear -> fail("no vault"))).getMessage());
        } finally {
            Files.deleteIfExists(root);
        }
    }

    @Test
    void offWindowsOperatingSystemsCannotRunNativeCredentialStore() throws Exception {
        assumeTrue(!windows());
        assertEquals("UI_R04U_VAULT_WINDOWS_REQUIRED",
                assertThrows(IllegalStateException.class,
                        () -> WindowsDpapiSyntheticVault.open(newRoot())).getMessage());
    }

    @Test
    void sourceClassIsNotAServiceControllerOrExportedCredentialReader() throws Exception {
        assertEquals(0, WindowsDpapiSyntheticVault.class.getAnnotations().length);
        assertFalse(java.lang.reflect.Modifier.isPublic(
                WindowsDpapiSyntheticVault.class.getModifiers()));
        assertTrue(java.util.Arrays.stream(
                WindowsDpapiSyntheticVault.class.getDeclaredMethods())
                .noneMatch(m -> m.getName().matches(
                        "(?i)execute|fetch|send|publish|authorize|readRealKey|provisionRealKey")));
        assertFalse(WindowsDpapiVaultReadiness.LIVE_METADATA_READ_AUTHORIZED);
    }

    private static boolean allZero(byte[] bytes) {
        for (byte b : bytes) if (b != 0) return false;
        return true;
    }
}
