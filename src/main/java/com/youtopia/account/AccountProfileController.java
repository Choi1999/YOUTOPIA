package com.youtopia.account;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountProfileController {
    private final AccountProfileService service;
    public record Profile(UUID userId,String loginEmail,boolean emailVerified,String accountStatus,Instant createdAt) {}
    public AccountProfileController(AccountProfileService service){this.service=service;}
    @GetMapping("/api/v1/me/account")
    Profile get(HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request);var profile=service.own(AccountContext.require(request));response.setHeader("Cache-Control","no-store");
        return new Profile(profile.id(),profile.email(),false,profile.status(),profile.createdAt());
    }
}
