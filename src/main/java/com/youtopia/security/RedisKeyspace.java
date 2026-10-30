package com.youtopia.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Session and limiter keys share one environment-scoped ACL prefix. */
@Component
public final class RedisKeyspace {
    private final String prefix;
    public RedisKeyspace(@Value("${spring.session.data.redis.namespace:youtopia:sessions}")String namespace){
        if(namespace==null||!namespace.matches("[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}"))throw new IllegalArgumentException("Invalid Redis namespace");
        this.prefix=namespace+":";
    }
    public String key(String purpose){return prefix+purpose;}
}
