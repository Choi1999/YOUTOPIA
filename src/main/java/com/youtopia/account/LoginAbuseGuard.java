package com.youtopia.account;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class LoginAbuseGuard {
    private final StringRedisTemplate redis;
    private final AccountSecrets secrets;
    private final SecurityAudit audit;
    private final String[] limits;
    private final com.youtopia.security.RedisKeyspace keyspace;
    private static final DefaultRedisScript<Long> CHECK=new DefaultRedisScript<>("return math.max(redis.call('TTL',KEYS[1]),redis.call('TTL',KEYS[2]),0)",Long.class);
    private static final DefaultRedisScript<Long> FAILURE=new DefaultRedisScript<>("""
        local combo=redis.call('INCR',KEYS[1]);if combo==1 then redis.call('EXPIRE',KEYS[1],tonumber(ARGV[1])) end
        local ip=redis.call('INCR',KEYS[2]);if ip==1 then redis.call('EXPIRE',KEYS[2],tonumber(ARGV[2])) end
        if combo>tonumber(ARGV[3]) then redis.call('SET',KEYS[3],1,'EX',tonumber(ARGV[5])) end
        if ip>tonumber(ARGV[4]) then redis.call('SET',KEYS[4],1,'EX',tonumber(ARGV[5])) end
        return 1
        """,Long.class);
    public LoginAbuseGuard(StringRedisTemplate redis,AccountSecrets secrets,SecurityAudit audit,com.youtopia.security.RedisKeyspace keyspace,
        @org.springframework.beans.factory.annotation.Value("${youtopia.auth-abuse.combo-window-seconds:900}")int comboWindow,
        @org.springframework.beans.factory.annotation.Value("${youtopia.auth-abuse.ip-window-seconds:600}")int ipWindow,
        @org.springframework.beans.factory.annotation.Value("${youtopia.auth-abuse.combo-failures:5}")int comboFailures,
        @org.springframework.beans.factory.annotation.Value("${youtopia.auth-abuse.ip-failures:30}")int ipFailures,
        @org.springframework.beans.factory.annotation.Value("${youtopia.auth-abuse.ban-seconds:900}")int banSeconds){
        this.redis=redis;this.secrets=secrets;this.audit=audit;this.keyspace=keyspace;
        if(java.util.stream.IntStream.of(comboWindow,ipWindow,comboFailures,ipFailures,banSeconds).anyMatch(v->v<1))throw new IllegalArgumentException("Invalid login limiter configuration");
        limits=java.util.stream.IntStream.of(comboWindow,ipWindow,comboFailures,ipFailures,banSeconds).mapToObj(Integer::toString).toArray(String[]::new);
    }
    public void check(String login,String ip) {
        var keys=keys(login,ip);Long wait=redis.execute(CHECK,List.of(keys.get(2),keys.get(3)));
        if(wait==null)throw new IllegalStateException("Authentication limiter unavailable");
        if(wait>0){audit.write("AUTH_RATE_LIMITED","GUEST",null,"DENIED",java.util.UUID.randomUUID());throw new AccountProblem(HttpStatus.TOO_MANY_REQUESTS,"AUTH_RATE_LIMITED","Authentication temporarily limited.",wait);}
    }
    public void failed(String login,String ip) {
        if(redis.execute(FAILURE,keys(login,ip),(Object[])limits)==null)throw new IllegalStateException("Authentication limiter unavailable");
    }
    private List<String> keys(String login,String ip) {
        String prefix=keyspace.key("auth-abuse:{login}:");
        String combo=secrets.opaque("login-ip",login+"\0"+ip),address=secrets.opaque("ip",ip);
        return List.of(prefix+"combo:"+combo,prefix+"ip:"+address,prefix+"combo-ban:"+combo,prefix+"ip-ban:"+address);
    }
}
