package com.youtopia.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.youtopia.account.AuthenticationController;
import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class SettingsController {
    private final SettingsService service;
    public record Patch(@NotNull @Min(0) Long expectedVersion,@NotNull JsonNode changes) {}
    public SettingsController(SettingsService service){this.service=service;}
    @GetMapping("/api/v1/me/settings")
    SettingsService.View get(HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.get(com.youtopia.account.AccountContext.require(request));}
    @PatchMapping("/api/v1/me/settings")
    SettingsService.View patch(@Valid @RequestBody Patch input,HttpServletRequest request,HttpServletResponse response){response.setHeader("Cache-Control","no-store");return service.patch(com.youtopia.account.AccountContext.require(request),input.expectedVersion(),input.changes());}
}
