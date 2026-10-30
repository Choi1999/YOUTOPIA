package com.youtopia.account;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AuthenticationController {
    private final AuthenticationService service;
    private final Clock clock;
    public AuthenticationController(AuthenticationService service,Clock clock) {this.service=service;this.clock=clock;}
    public record Signup(@NotBlank @Email @Size(max=254) String email,@NotNull @Size(max=512) String password) {
        public Signup { email=AuthenticationService.normalize(email); }
        @Override public String toString(){return "Signup[redacted]";}
    }
    public record Login(@NotBlank @Size(max=254) String login,@NotNull @Size(max=512) String password) {
        @Override public String toString(){return "Login[redacted]";}
    }
    public record Created(UUID userId,String nextRoute,boolean emailVerified) {}
    public record Identity(String kind,UUID id,boolean emailVerified) {}
    @PostMapping("/api/v1/auth/signup")
    ResponseEntity<Created> signup(@Valid @RequestBody Signup input) {
        UUID id=service.signup(input.email(),input.password());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(new Created(id,"/login",false));
    }
    @PostMapping("/api/v1/auth/login")
    Identity login(@Valid @RequestBody Login input,HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return view(service.login(Account.Kind.USER,input.login(),input.password(),request,response));
    }
    @PostMapping("/api/v1/admin/auth/login")
    Identity adminLogin(@Valid @RequestBody Login input,HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return view(service.login(Account.Kind.ADMIN,input.login(),input.password(),request,response));
    }
    @GetMapping({"/api/v1/auth/me","/api/v1/admin/auth/me"})
    Identity me(HttpServletRequest request,HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");return view(identity(request));
    }
    @PostMapping("/api/v1/auth/activity")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void activity(HttpServletRequest request) {
        var session=request.getSession(false);var identity=AccountContext.require(request);
        session.setAttribute(SessionIdentity.ATTRIBUTE,identity.activeAt(clock.instant()));
    }
    @PostMapping("/api/v1/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) {service.logout(request);}
    public static SessionIdentity identity(HttpServletRequest request) {
        var session=request.getSession(false);
        if(session==null || !(session.getAttribute(SessionIdentity.ATTRIBUTE) instanceof SessionIdentity identity))throw AccountProblem.invalid();
        return identity;
    }
    private Identity view(SessionIdentity id) {return new Identity(id.kind().name(),id.id(),false);}
}
