package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.security.*;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/** Explicit offline budget enrollment. Does not start Spring, HTTP, DB pools or an LLM client. */
public final class ChatBudgetOperatorCommand {
    private ChatBudgetOperatorCommand(){}
    public static void main(String[] args){OperatorCommandSupport.execute("CHAT_BUDGET",()->{
        var env=System.getenv();
        if(args.length!=2||!args[0].equals("initialize")||!args[1].equals("--reviewed-new-budget")||System.console()==null
           ||!"PRODUCTION".equals(env.get("YOUTOPIA_ENVIRONMENT"))||!"false".equals(env.get("YOUTOPIA_CHAT_ENABLED"))
           ||!"127.0.0.1".equals(env.get("YOUTOPIA_SESSION_REDIS_HOST"))||!"6379".equals(env.get("YOUTOPIA_SESSION_REDIS_PORT"))
           ||!"false".equals(env.get("YOUTOPIA_SESSION_REDIS_TLS"))||!"youtopia".equals(env.get("YOUTOPIA_SESSION_REDIS_USERNAME")))throw new IllegalStateException();
        var config=new RedisStandaloneConfiguration("127.0.0.1",6379);config.setUsername("youtopia");config.setPassword(env.get("YOUTOPIA_SESSION_REDIS_PASSWORD"));
        var factory=new LettuceConnectionFactory(config);factory.afterPropertiesSet();factory.start();
        try{
            var settings=new ChatSettings("false","","",env.getOrDefault("YOUTOPIA_CHAT_BUDGET_EPOCH",""),env.getOrDefault("YOUTOPIA_CHAT_BUDGET_FILE",""));
            var budget=new ChatBudget(new StringRedisTemplate(factory),new ObjectMapper(),new RedisKeyspace("youtopia:sessions"),settings,java.time.Clock.systemUTC());
            budget.initializeReviewedNewBudget();System.out.println("CHAT_BUDGET_INITIALIZED_NEW_EPOCH; provider calls=0; limit=30");
        }finally{factory.destroy();}
    });}
}
