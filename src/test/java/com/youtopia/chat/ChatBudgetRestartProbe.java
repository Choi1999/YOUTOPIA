package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.security.RedisKeyspace;
import java.time.*;
import java.util.UUID;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/** Test JVM only: the provider is an in-process counter, never an HTTP implementation. */
public final class ChatBudgetRestartProbe {
    public static void main(String[] args){
        if(args.length!=7||!args[1].startsWith("youtopia:chat-test:"))throw new IllegalArgumentException();
        int port=Integer.parseInt(args[0]);if(port<1024||port>65535)throw new IllegalArgumentException();
        var factory=new LettuceConnectionFactory("127.0.0.1",port);factory.afterPropertiesSet();factory.start();
        try{
            var settings=new ChatSettings("true","synthetic-only-no-http-provider","gpt-6-luna",args[2],args[3]);
            var budget=new ChatBudget(new StringRedisTemplate(factory),new ObjectMapper(),new RedisKeyspace(args[1]),settings,Clock.fixed(Instant.parse(args[6]),ZoneOffset.UTC));
            var calls=new java.util.concurrent.atomic.AtomicInteger();var service=new ChatService(settings,budget,q->{calls.incrementAndGet();return "일반적인 모킹 설명";});
            var result=service.answer(UUID.fromString(args[4]),ChatQuestion.CCU_BASICS,UUID.fromString(args[5]));
            System.out.println("MOCK_CALLS="+calls.get()+";REPLAY="+result.replayed());
        }finally{factory.destroy();}
    }
}
