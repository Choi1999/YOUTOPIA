package com.youtopia.account;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountBudget {
    private final StringRedisTemplate redis;
    private final AccountSecrets secrets;
    private final com.youtopia.security.RedisKeyspace keys;
    private static final DefaultRedisScript<Long> SCRIPT=new DefaultRedisScript<>("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",Long.class);
    public AccountBudget(StringRedisTemplate redis,AccountSecrets secrets,com.youtopia.security.RedisKeyspace keys) {this.redis=redis;this.secrets=secrets;this.keys=keys;}
    public void acquire(String operation,String identifier) {
        Long global=redis.execute(SCRIPT,List.of(keys.key("account-budget:"+operation+":global")));
        Long account=redis.execute(SCRIPT,List.of(keys.key("account-budget:"+operation+":"+secrets.opaque("rate",identifier))));
        if(global==null || account==null) throw new IllegalStateException("Account request budget unavailable");
        if(global>60 || account>5) throw new AccountProblem(HttpStatus.TOO_MANY_REQUESTS,"AUTH_RATE_LIMITED","Retry after the request window.");
    }
}
