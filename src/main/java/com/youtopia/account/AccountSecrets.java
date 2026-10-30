package com.youtopia.account;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@org.springframework.context.annotation.Primary
@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountSecrets {
    private final byte[] key;
    private final SecureRandom random=new SecureRandom();
    public AccountSecrets(@Value("${youtopia.accounts.hmac-key}") String encoded) {
        try { key=Base64.getDecoder().decode(encoded); } catch(IllegalArgumentException e) { throw new IllegalStateException("Account HMAC key must be base64 encoded"); }
        if(key.length<32) throw new IllegalStateException("Account HMAC key needs at least 256 bits");
    }
    public byte[] tag(String domain,String input) {
        try {
            Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(key,"HmacSHA256"));
            return mac.doFinal((domain+"\0"+input).getBytes(StandardCharsets.UTF_8));
        } catch(GeneralSecurityException e) { throw new IllegalStateException("HMAC unavailable"); }
    }
    public String opaque(String domain,String input) { return HexFormat.of().formatHex(tag(domain,input)); }
    public String recoveryCode() {
        byte[] b=new byte[16];random.nextBytes(b);String s=HexFormat.of().formatHex(b);
        return String.join("-",s.substring(0,8),s.substring(8,16),s.substring(16,24),s.substring(24,32));
    }
    public byte[] recoveryHash(UUID userId,String code) {
        String canonical=code==null?"":code.replace("-","").toLowerCase(Locale.ROOT);
        if(!canonical.matches("[a-f0-9]{32}")) throw AccountProblem.invalid();
        return tag("recovery-v1",userId+":"+canonical);
    }
    public UUID operationId(UUID account,UUID request,String action,String payload) {
        // Do not introduce a fast secondary verifier for passwords inside an idempotency payload.
        var spec=new javax.crypto.spec.PBEKeySpec(payload.toCharArray(),tag("operation-salt-v1",account+":"+request+":"+action),310000,128);
        try {
            byte[] bytes=javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            var buffer=java.nio.ByteBuffer.wrap(bytes);return new UUID(buffer.getLong(),buffer.getLong());
        }catch(GeneralSecurityException exception){throw new IllegalStateException("Operation fingerprint derivation unavailable");}
        finally{spec.clearPassword();}

    }
}
