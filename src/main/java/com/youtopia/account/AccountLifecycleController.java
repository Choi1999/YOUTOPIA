package com.youtopia.account;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountLifecycleController {
    private final AccountLifecycleService service;
    public AccountLifecycleController(AccountLifecycleService service){this.service=service;}
    public record Change(@NotNull UUID requestKey,@NotNull @Size(max=512) String currentPassword,@NotNull @Size(max=512) String newPassword) {
        public String toString(){return "Change[redacted]";}
    }
    public record Issue(@NotNull UUID requestKey,@NotNull @Size(max=512) String currentPassword) {
        public String toString(){return "Issue[redacted]";}
    }
    public record Delete(@NotNull UUID requestKey,@NotNull @Size(max=512) String currentPassword,boolean confirmed) {
        public String toString(){return "Delete[redacted]";}
    }
    public record Recover(@NotNull UUID requestKey,@NotBlank @Size(max=254) String email,@NotBlank @Size(max=64) String recoveryCode,@NotNull @Size(max=512) String newPassword) {
        public String toString(){return "Recover[redacted]";}
    }
    @PostMapping({"/api/v1/auth/password","/api/v1/admin/auth/password"})
    AccountLifecycleService.Outcome password(@Valid @RequestBody Change input,HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return service.changePassword(AccountContext.require(request),input.requestKey(),input.currentPassword(),input.newPassword());
    }
    @PostMapping("/api/v1/auth/recovery-codes")
    AccountLifecycleService.Codes codes(@Valid @RequestBody Issue input,HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return service.issueCodes(AccountContext.require(request),input.requestKey(),input.currentPassword());
    }
    public record DeletionNotice(int recoveryHours,boolean currentPasswordRequired,boolean explicitConfirmationRequired,
        boolean recoveryCodeRequiredForRecovery,boolean deletionAllowedWithoutRecoveryCode,String deadlineDisplayTimezone,String retentionPolicyStatus) {}
    @GetMapping("/api/v1/me/deletion-policy")
    DeletionNotice notice(HttpServletResponse response){response.setHeader("Cache-Control","no-store");return new DeletionNotice(72,true,true,true,true,"Asia/Seoul","REQUIRES_APPROVED_PLAN");}
    @PostMapping("/api/v1/me/deletion")
    AccountLifecycleService.Outcome deletion(@Valid @RequestBody Delete input,HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return service.requestDeletion(AccountContext.require(request),input.requestKey(),input.currentPassword(),input.confirmed());
    }
    @PostMapping("/api/v1/auth/password-reset")
    AccountLifecycleService.Outcome reset(@Valid @RequestBody Recover input,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return service.recover(input.email(),input.requestKey(),input.recoveryCode(),input.newPassword(),false);
    }
    @PostMapping("/api/v1/auth/account-recovery")
    AccountLifecycleService.Outcome recover(@Valid @RequestBody Recover input,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return service.recover(input.email(),input.requestKey(),input.recoveryCode(),input.newPassword(),true);
    }
}
