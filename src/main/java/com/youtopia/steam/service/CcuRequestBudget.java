package com.youtopia.steam.service;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** Shared global query budget: no IP addresses, search text, or session identifiers are stored. */
@Component
public class CcuRequestBudget {
    private static final DefaultRedisScript<Long> ACQUIRE = new DefaultRedisScript<>("""
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
        if count > tonumber(ARGV[1]) then return math.max(redis.call('TTL', KEYS[1]), 1) end
        return 0
        """, Long.class);
    private final StringRedisTemplate redis;
    private final long limit;
    private final com.youtopia.security.RedisKeyspace keys;

    public CcuRequestBudget(StringRedisTemplate redis,
                            @Value("${youtopia.ccu.requests-per-minute:120}") long limit,com.youtopia.security.RedisKeyspace keys) {
        if (limit < 1) throw new IllegalArgumentException("CCU query budget must be positive");
        this.redis = redis;
        this.limit = limit;
        this.keys = keys;
    }

    public void acquire() {
        final Long retryAfter;
        try {
            retryAfter = redis.execute(ACQUIRE, List.of(keys.key("limits:ccu")), Long.toString(limit));
        } catch (DataAccessException exception) {
            throw new BudgetUnavailableException();
        }
        if (retryAfter == null) throw new BudgetUnavailableException();
        if (retryAfter > 0) throw new BudgetExceededException(retryAfter);
    }

    public static final class BudgetExceededException extends RuntimeException {
        private final long retryAfter;
        public BudgetExceededException(long retryAfter) { this.retryAfter = retryAfter; }
        public long retryAfter() { return retryAfter; }
    }
    public static final class BudgetUnavailableException extends RuntimeException {}
}
