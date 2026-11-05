package com.youtopia.youtube.metadata;

import com.sun.jna.platform.win32.Crypt32Util;
import com.sun.jna.platform.win32.WinCrypt;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryFlag;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.UserPrincipal;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * UI-R04-U: actual Windows CurrentUser DPAPI via JNA, for isolated SYNTHETIC
 * markers only. No Spring Bean, HTTP endpoint, CLI, or real API-key admission.
 *
 * The sealed bytes live only under a random folder of java.io.tmpdir during
 * QA. The production key-store path and credential enrollment are NOT wired.
 * The caller owns and must zero the supplied plaintext byte[].
 */
final class WindowsDpapiSyntheticVault {
    private static final byte[] MAGIC = new byte[] { 'Y', 'T', 'P', 'D' };
    private static final byte[] SYNTHETIC_PREFIX =
            new byte[] { 'R', '0', '4', 'U', '_', 'S', 'Y', 'N', 'T', 'H', 'E', 'T', 'I', 'C', '_' };
    private static final int MAX_BLOB = 4096;
    private static final String FILENAME = "metadata-synthetic.dpapi";
    private static final int FLAGS = WinCrypt.CRYPTPROTECT_UI_FORBIDDEN; // No LOCAL_MACHINE flag.

    private final Path root;
    private final Path file;
    private final UserPrincipal owner;

    private WindowsDpapiSyntheticVault(Path candidate) throws IOException {
        if (!System.getProperty("os.name", "").startsWith("Windows"))
            throw denied("WINDOWS_REQUIRED");
        Path tempRoot = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        Path p = candidate.toAbsolutePath().normalize();
        if (!p.getParent().equals(tempRoot) ||
                !p.getFileName().toString().matches("^youtopia-r04u-synthetic-[a-f0-9-]{36}$"))
            throw denied("SYNTHETIC_SCOPE_ONLY");
        if (Files.isSymbolicLink(p)) throw denied("SYMLINK_DENIED");
        if (Files.notExists(p, LinkOption.NOFOLLOW_LINKS)) Files.createDirectory(p);
        if (!Files.isDirectory(p, LinkOption.NOFOLLOW_LINKS)) throw denied("DIRECTORY_INVALID");
        this.root = p;
        this.file = p.resolve(FILENAME);
        this.owner = Files.getOwner(p, LinkOption.NOFOLLOW_LINKS);
        restrictToOwner(root, true);
        inspectFile();
    }

    /** Tests create a fresh name, then call open() without side-effectful globals. */
    static WindowsDpapiSyntheticVault open(Path directory) throws IOException {
        return new WindowsDpapiSyntheticVault(directory);
    }

    private static IllegalStateException denied(String code) {
        // No caller-supplied path, SID, native exception or secret in reports.
        return new IllegalStateException("UI_R04U_VAULT_" + code);
    }

    private void restrictToOwner(Path target, boolean directory) throws IOException {
        var view = Files.getFileAttributeView(
                target, AclFileAttributeView.class, LinkOption.NOFOLLOW_LINKS);
        if (view == null) throw denied("NTFS_ACL_REQUIRED");
        var builder = AclEntry.newBuilder()
                .setType(AclEntryType.ALLOW)
                .setPrincipal(owner)
                .setPermissions(EnumSet.allOf(AclEntryPermission.class));
        if (directory) builder.setFlags(
                AclEntryFlag.DIRECTORY_INHERIT, AclEntryFlag.FILE_INHERIT);
        view.setAcl(List.of(builder.build()));
        for (AclEntry ace : view.getAcl()) {
            if (ace.type() == AclEntryType.ALLOW && !ace.principal().equals(owner))
                throw denied("ACL_NOT_OWNER_ONLY");
        }
    }

    private void inspectFile() throws IOException {
        if (Files.isSymbolicLink(root) || Files.isSymbolicLink(file))
            throw denied("SYMLINK_DENIED");
        if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS))
            throw denied("DIRECTORY_INVALID");
        if (Files.exists(file, LinkOption.NOFOLLOW_LINKS) &&
                !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS))
            throw denied("FILE_INVALID");
        if (Files.exists(file, LinkOption.NOFOLLOW_LINKS)) {
            var view = Files.getFileAttributeView(file,
                    AclFileAttributeView.class, LinkOption.NOFOLLOW_LINKS);
            if (view == null) throw denied("NTFS_ACL_REQUIRED");
            for (AclEntry ace : view.getAcl()) {
                if (ace.type() == AclEntryType.ALLOW && !ace.principal().equals(owner))
                    throw denied("ACL_NOT_OWNER_ONLY");
            }
        }
    }

    /** Atomic create or rotate, with encrypted temporary file and restricted ACL. */
    synchronized void replaceSynthetic(byte[] plaintext) throws IOException {
        inspectFile();
        if (!syntheticOnly(plaintext)) throw denied("REAL_KEY_NOT_ACCEPTED");
        byte[] sealed;
        try {
            sealed = Crypt32Util.cryptProtectData(plaintext, FLAGS);
        } catch (RuntimeException failed) {
            throw denied("DPAPI_PROTECT_FAILED");
        }
        Path temporary = root.resolve("tmp-" + UUID.randomUUID() + ".dpapi");
        try {
            if (sealed == null || sealed.length < 1 || sealed.length > MAX_BLOB - 8)
                throw denied("BLOB_LIMIT");
            try (FileChannel out = FileChannel.open(temporary,
                    Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE,
                            LinkOption.NOFOLLOW_LINKS))) {
                restrictToOwner(temporary, false);
                ByteBuffer payload = ByteBuffer.allocate(8 + sealed.length);
                payload.put(MAGIC).putInt(sealed.length).put(sealed).flip();
                try {
                    while (payload.hasRemaining()) out.write(payload);
                    out.force(true);
                } finally {
                    Arrays.fill(payload.array(), (byte) 0);
                }
            }
            inspectFile();
            Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
            inspectFile();
        } finally {
            Arrays.fill(sealed, (byte) 0);
            Files.deleteIfExists(temporary);
        }
    }

    synchronized boolean present() throws IOException {
        inspectFile();
        return Files.exists(file, LinkOption.NOFOLLOW_LINKS);
    }

    /**
     * The callback sees one short-lived byte[], always cleared in finally.
     * Caller MUST NOT store a reference or convert it to String/log/URL.
     * No auto-fallback if missing, malformed, or DPAPI rejects ciphertext.
     */
    synchronized void withSynthetic(Consumer<byte[]> consumer) throws IOException {
        inspectFile();
        if (!Files.exists(file, LinkOption.NOFOLLOW_LINKS)) throw denied("MISSING");
        byte[] bytes;
        try (FileChannel in = FileChannel.open(file,
                Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS))) {
            if (in.size() < 9 || in.size() > MAX_BLOB) throw denied("BLOB_INVALID");
            bytes = new byte[(int) in.size()];
            ByteBuffer payload = ByteBuffer.wrap(bytes);
            while (payload.hasRemaining()) {
                if (in.read(payload) == -1) throw denied("BLOB_INVALID");
            }
        }
        byte[] sealed = null;
        byte[] clear = null;
        try {
            ByteBuffer payload = ByteBuffer.wrap(bytes);
            for (byte magic : MAGIC) {
                if (payload.get() != magic) throw denied("BLOB_INVALID");
            }
            int len = payload.getInt();
            if (len < 1 || len != payload.remaining()) throw denied("BLOB_INVALID");
            sealed = new byte[len];
            payload.get(sealed);
            try {
                clear = Crypt32Util.cryptUnprotectData(sealed, FLAGS);
            } catch (RuntimeException failed) {
                throw denied("DPAPI_UNPROTECT_FAILED");
            }
            if (!syntheticOnly(clear)) throw denied("REAL_KEY_NOT_ACCEPTED");
            consumer.accept(clear);
        } finally {
            Arrays.fill(bytes, (byte) 0);
            if (sealed != null) Arrays.fill(sealed, (byte) 0);
            if (clear != null) Arrays.fill(clear, (byte) 0);
        }
    }

    synchronized void erase() throws IOException {
        inspectFile();
        Files.deleteIfExists(file);
        // File deletion is not forensic secure erasure or DPAPI master-key revocation.
    }

    Path syntheticRootForTest() { return root; }
    Path syntheticFileForTest() { return file; }

    private static boolean syntheticOnly(byte[] value) {
        if (value == null || value.length != SYNTHETIC_PREFIX.length + 36)
            return false;
        byte[] prefix = Arrays.copyOf(value, SYNTHETIC_PREFIX.length);
        try {
            if (!MessageDigest.isEqual(prefix, SYNTHETIC_PREFIX)) return false;
        } finally {
            Arrays.fill(prefix, (byte) 0);
        }
        for (int i = SYNTHETIC_PREFIX.length; i < value.length; i++) {
            byte b = value[i];
            if (!((b >= '0' && b <= '9') || (b >= 'a' && b <= 'f') || b == '-'))
                return false;
        }
        return true;
    }
}
