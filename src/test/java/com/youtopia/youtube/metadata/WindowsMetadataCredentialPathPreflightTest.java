package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** No operating secret is ever read or provisioned in this test. */
class WindowsMetadataCredentialPathPreflightTest {
    @Test
    void readOnlyInspectionNeverCreatesProductionVaultOrMakesCredentialClaims()
            throws Exception {
        String localAppData = System.getenv("LOCALAPPDATA");
        Path candidate = localAppData == null || localAppData.isBlank()
                ? null : Path.of(localAppData, "YOUTOPIA", "security", "youtube-metadata");
        boolean existed = candidate != null &&
                Files.exists(candidate, LinkOption.NOFOLLOW_LINKS);
        var report = WindowsMetadataCredentialPathPreflight.inspect();

        assertEquals("YOUTOPIA_R04V_WINDOWS_CREDENTIAL_LOCATION_V01", report.schema());
        assertEquals("POLICY_HOLD", report.policy());
        assertFalse(report.futureKeyProvisioningAuthorized());
        assertFalse(report.actualKeyRead());
        assertFalse(report.actualKeyWritten());
        assertFalse(report.liveMetadataReadAuthorized());
        assertEquals(0, report.actualProviderRequests());
        assertNotNull(report.status());
        assertTrue(report.status().length() > 0);
        if (candidate != null)
            assertEquals(existed, Files.exists(candidate, LinkOption.NOFOLLOW_LINKS));
    }

    @Test
    void localUserOrProfilePathIsNeverEmittedInReport() {
        var result = WindowsMetadataCredentialPathPreflight.inspect();
        String representation = result.toString();
        for (String sensitive : new String[]{
                System.getProperty("user.name", ""),
                System.getProperty("user.home", ""),
                System.getenv("LOCALAPPDATA") == null ? "" : System.getenv("LOCALAPPDATA")
        }) {
            if (sensitive != null && !sensitive.isBlank())
                assertFalse(representation.contains(sensitive),
                        "An identity or path should never be returned");
        }
        assertFalse(representation.contains("youtube-data-v3.dpapi"));
    }

    @Test
    void operatingVaultNameIsFixedButCannotBeInitializedHere() {
        assertEquals("YOUTOPIA/security/youtube-metadata",
                WindowsMetadataCredentialPathPreflight.RELATIVE);
        assertEquals("youtube-data-v3.dpapi",
                WindowsMetadataCredentialPathPreflight.SEALED_FILENAME);
        assertTrue(java.util.Arrays.stream(
                WindowsMetadataCredentialPathPreflight.class.getDeclaredMethods())
                .noneMatch(m -> m.getName().matches(
                        "(?i)enroll|register|install|provision|rotate|delete|openSecret|authorize")));
    }

    @Test
    void nonWindowsIsDeniedWithoutAnyLocalProfileWork() {
        if (System.getProperty("os.name", "").startsWith("Windows")) return;
        var result = WindowsMetadataCredentialPathPreflight.inspect();
        assertEquals("WINDOWS_REQUIRED", result.status());
        assertFalse(result.windowsProcessObserved());
        assertFalse(result.candidatePathReadOnlyInspected());
        assertFalse(result.actualKeyRead());
        assertFalse(result.actualKeyWritten());
    }

    @Test
    void reportIsNotAnAuthenticationOrCloudApproval() {
        var report = WindowsMetadataCredentialPathPreflight.inspect();
        assertEquals("POLICY_HOLD", report.policy());
        assertFalse(report.futureKeyProvisioningAuthorized());
        assertFalse(report.liveMetadataReadAuthorized());
        assertFalse(WindowsDpapiVaultReadiness.LIVE_METADATA_READ_AUTHORIZED);
        assertFalse(MetadataApprovalPreflight.LIVE_METADATA_READ_AUTHORIZED);
        assertEquals(0, WindowsMetadataCredentialPathPreflight.class.getAnnotations().length);
    }
}
