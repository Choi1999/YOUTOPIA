package com.youtopia.account;

import java.util.Map;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;

/** A versioned encoding permits future cost upgrades without silently changing stored-hash semantics. */
public final class AccountPasswordEncoders {
    private AccountPasswordEncoders() {}

    public static PasswordEncoder create() {
        var pbkdf2 = new Pbkdf2PasswordEncoder("", 16, 600_000, 256);
        pbkdf2.setAlgorithm(Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256);
        var encoder = new DelegatingPasswordEncoder("pbkdf2-sha256-v1", Map.of("pbkdf2-sha256-v1", pbkdf2));
        // Unrecognized or unversioned stored encodings never become a plaintext/fast-hash fallback.
        encoder.setDefaultPasswordEncoderForMatches(new PasswordEncoder() {
            public String encode(CharSequence raw) { throw new UnsupportedOperationException(); }
            public boolean matches(CharSequence raw, String encoded) { return false; }
        });
        return encoder;
    }
}
