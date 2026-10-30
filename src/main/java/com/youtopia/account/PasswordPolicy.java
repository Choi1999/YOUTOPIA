package com.youtopia.account;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class PasswordPolicy {
    private final Set<String> compromised;
    public PasswordPolicy(@Value("${youtopia.accounts.password-blocklist}") String file) throws IOException {
        Path path=Path.of(file);
        if(Files.size(path)>256L*1024*1024) throw new IllegalStateException("Password blocklist exceeds configured bound");
        try(var lines=Files.lines(path,StandardCharsets.US_ASCII)) {
            compromised=lines.filter(s->!s.isBlank()).map(s->s.toLowerCase(Locale.ROOT)).collect(java.util.stream.Collectors.toUnmodifiableSet());
        }
        if(compromised.isEmpty() || compromised.stream().anyMatch(s->!s.matches("[0-9a-f]{64}")))
            throw new IllegalStateException("A nonempty SHA-256 password blocklist is required");
    }
    public void validate(String password) {
        if(password==null || password.codePointCount(0,password.length())<15 || password.codePointCount(0,password.length())>128
            || compromised.contains(hash(password)))
            throw new AccountProblem(HttpStatus.BAD_REQUEST,"PASSWORD_POLICY_VIOLATION","The password does not meet the password policy.");
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
