package com.youtopia.account;

import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;

class AccountPolicyTest {
    @TempDir Path temporary;
    @Test @DisplayName("REQ-AUTH-002/037: Unicode 15–128 code points; no mandatory character mix or whitespace mutation")
    void passwordBoundariesAndPreservedWhitespace() throws Exception {
        Path file=temporary.resolve("blocklist");Files.writeString(file,PasswordPolicy.hash("passwordpassword"));var policy=new PasswordPolicy(file.toString());
        policy.validate("x".repeat(15));policy.validate("😀".repeat(128));policy.validate(" "+"x".repeat(13)+" ");
        assertThatThrownBy(()->policy.validate("😀".repeat(129))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->policy.validate("x".repeat(14))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->policy.validate("passwordpassword")).isInstanceOf(AccountProblem.class);
    }
    @Test void emptyOrMalformedBlocklistCannotSilentlyDisableScreening() throws Exception {
        Path file=temporary.resolve("empty");Files.writeString(file,"");assertThatThrownBy(()->new PasswordPolicy(file.toString())).isInstanceOf(IllegalStateException.class);
        Files.writeString(file,"not-a-hash");assertThatThrownBy(()->new PasswordPolicy(file.toString())).isInstanceOf(IllegalStateException.class);
    }
    @Test @DisplayName("REQ-SESSION-004..007: exact idle and absolute boundaries")
    void exactSessionBoundaries() {
        var now=Instant.parse("2026-10-29T00:00:00Z");
        for(var kind:Account.Kind.values()) {
            long idle=kind==Account.Kind.USER?3600:900,absolute=kind==Account.Kind.USER?86400:28800;
            var id=new SessionIdentity(kind,UUID.randomUUID(),1,now,now,0);
            assertThat(id.expired(now.plusSeconds(idle-1))).isFalse();assertThat(id.expired(now.plusSeconds(idle))).isTrue();
            var active=id.activeAt(now.plusSeconds(absolute-1));
            assertThat(active.expired(now.plusSeconds(absolute-1))).isFalse();assertThat(active.expired(now.plusSeconds(absolute))).isTrue();
        }
    }
    @Test void recoveryHashIsBoundToAccountAndDeterministicOperationIdsDetectChangedContents() {
        var secrets=new AccountSecrets(java.util.Base64.getEncoder().encodeToString(new byte[32]));
        UUID user=UUID.randomUUID(),other=UUID.randomUUID(),request=UUID.randomUUID();String code=secrets.recoveryCode();
        assertThat(secrets.recoveryHash(user,code)).hasSize(32).isNotEqualTo(secrets.recoveryHash(other,code));
        assertThat(secrets.operationId(user,request,"PASSWORD_CHANGE","a")).isEqualTo(secrets.operationId(user,request,"PASSWORD_CHANGE","a"))
            .isNotEqualTo(secrets.operationId(user,request,"PASSWORD_CHANGE","b"));
    }
    @Test void secretInputsHaveRedactedDiagnosticRepresentation() {
        assertThat(new AuthenticationController.Login("fake@example.invalid","synthetic-password").toString()).doesNotContain("synthetic-password","fake@");
        assertThat(new AccountLifecycleController.Recover(UUID.randomUUID(),"fake@example.invalid","synthetic-code","synthetic-password").toString()).doesNotContain("synthetic-code","synthetic-password");
    }
    @org.junit.jupiter.api.Test void enabledAccountApplicationCannotStartWithoutIndependentRestoreControl() {
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
            .withUserConfiguration(AccountConfiguration.Accounts.class)
            .withPropertyValues("youtopia.accounts.enabled=true","youtopia.control.enabled=false")
            .run(context->{
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalStateException.class)
                    .rootCause().hasMessageContaining("Independent deletion control is required");
            });
    }

}
