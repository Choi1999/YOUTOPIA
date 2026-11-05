package com.youtopia.youtube.metadata;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.UserPrincipal;
import java.util.List;

/**
 * UI-R04-V — read-only preview of an intended user-local production vault
 * location. This class NEVER creates that vault, stores a secret, or exposes
 * paths, Windows identity, or native errors in its returned report.
 *
 * The candidate comes from LOCALAPPDATA and is UNTRUSTED: it cannot be
 * considered a verified Known Folder or an identity attestation. This is
 * strictly a defense-in-depth checklist before a future separate key
 * enrollment implementation and independent operator review.
 */
final class WindowsMetadataCredentialPathPreflight {
    static final String SCHEMA = "YOUTOPIA_R04V_WINDOWS_CREDENTIAL_LOCATION_V01";
    static final String RELATIVE = "YOUTOPIA/security/youtube-metadata";
    static final String SEALED_FILENAME = "youtube-data-v3.dpapi";
    private static final LinkOption NOFOLLOW = LinkOption.NOFOLLOW_LINKS;

    record Report(String schema, String status, String policy,
                  boolean windowsProcessObserved,
                  boolean profileOwnerMatchesCurrentProcess,
                  boolean privateVaultDirectoryAlreadyExists,
                  boolean candidatePathReadOnlyInspected,
                  boolean futureKeyProvisioningAuthorized,
                  boolean actualKeyRead,
                  boolean actualKeyWritten,
                  boolean liveMetadataReadAuthorized,
                  int actualProviderRequests) {}

    private WindowsMetadataCredentialPathPreflight() {}

    static Report inspect() {
        if (!System.getProperty("os.name", "").startsWith("Windows"))
            return result("WINDOWS_REQUIRED", false, false, false, false);
        // LOCALAPPDATA is environment-controlled, not a trusted Known Folder
        // lookup. This inspection MUST NOT authorize a production location.
        String location = System.getenv("LOCALAPPDATA");
        if (location == null || location.isBlank())
            return result("LOCALAPPDATA_UNAVAILABLE", true, false, false, false);

        Path profile;
        try {
            profile = Path.of(location).toAbsolutePath().normalize();
        } catch (RuntimeException invalid) {
            return result("PROFILE_PATH_UNTRUSTED", true, false, false, false);
        }
        if (!profile.isAbsolute() || !Files.isDirectory(profile, NOFOLLOW))
            return result("PROFILE_PATH_UNTRUSTED", true, false, false, false);

        Path probe = null;
        try {
            if (unsafeReparse(profile))
                return result("PROFILE_REPARSE_UNTRUSTED", true, false, false, false);

            Path tempRoot = Path.of(System.getProperty("java.io.tmpdir"))
                    .toAbsolutePath().normalize();
            probe = Files.createTempFile(tempRoot, "r04v-owner-", ".probe");
            UserPrincipal currentUser = Files.getOwner(probe, NOFOLLOW);
            UserPrincipal profileOwner = Files.getOwner(profile, NOFOLLOW);
            boolean matching = currentUser.equals(profileOwner);
            if (!matching)
                return result("PROFILE_OWNER_MISMATCH", true, false, false, true);

            Path candidate = profile;
            for (String segment : List.of("YOUTOPIA", "security", "youtube-metadata")) {
                candidate = candidate.resolve(segment);
                if (Files.notExists(candidate, NOFOLLOW)) {
                    // Never create directories or any operational secret file.
                    return result("VAULT_LOCATION_NOT_PROVISIONED",
                            true, true, false, true);
                }
                if (unsafeReparse(candidate) || !Files.isDirectory(candidate, NOFOLLOW))
                    return result("VAULT_PATH_UNTRUSTED", true, true, true, true);
                if (!Files.getOwner(candidate, NOFOLLOW).equals(currentUser))
                    return result("VAULT_OWNER_MISMATCH", true, true, true, true);
                if (!ownerOnlyAcl(candidate, currentUser))
                    return result("VAULT_ACL_NOT_PRIVATE", true, true, true, true);
            }
            Path sealed = candidate.resolve(SEALED_FILENAME);
            if (Files.exists(sealed, NOFOLLOW)) {
                if (unsafeReparse(sealed) ||
                        !Files.isRegularFile(sealed, NOFOLLOW) ||
                        !Files.getOwner(sealed, NOFOLLOW).equals(currentUser) ||
                        !ownerOnlyAcl(sealed, currentUser))
                    return result("SEALED_FILE_UNTRUSTED", true, true, true, true);
                // Does NOT decrypt, read bytes or attest origin.
                return result("SEALED_FILE_PRESENT_NOT_AUTHORIZED",
                        true, true, true, true);
            }
            return result("EMPTY_PRIVATE_LOCATION_REQUIRES_OPERATOR_REVIEW",
                    true, true, true, true);
        } catch (IOException | SecurityException failure) {
            // Suppress local path/SID/ACL details; access errors fail closed.
            return result("LOCAL_PROFILE_EVIDENCE_UNAVAILABLE",
                    true, false, false, false);
        } finally {
            if (probe != null) {
                try { Files.deleteIfExists(probe); } catch (IOException ignored) {
                    // No secret data was written; only a zero-content probe.
                }
            }
        }
    }

    /** Reparse points, symlinks, junctions and unknown file types are denied. */
    private static boolean unsafeReparse(Path path) throws IOException {
        if (Files.isSymbolicLink(path)) return true;
        return Files.readAttributes(path, BasicFileAttributes.class, NOFOLLOW).isOther();
    }

    private static boolean ownerOnlyAcl(Path path, UserPrincipal owner) throws IOException {
        var view = Files.getFileAttributeView(path, AclFileAttributeView.class, NOFOLLOW);
        if (view == null) return false;
        boolean hasOwner = false;
        for (var ace : view.getAcl()) {
            if (ace.type() == AclEntryType.ALLOW) {
                if (!ace.principal().equals(owner)) return false;
                hasOwner = true;
            }
        }
        return hasOwner;
    }

    private static Report result(String status, boolean windows, boolean owner,
                                 boolean exists, boolean inspected) {
        return new Report(SCHEMA, status, "POLICY_HOLD", windows, owner,
                exists, inspected, false, false, false, false, 0);
    }
}
