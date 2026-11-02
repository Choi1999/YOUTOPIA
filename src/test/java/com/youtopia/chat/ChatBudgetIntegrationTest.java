package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.integration.IsolatedTestServices;
import com.youtopia.security.RedisKeyspace;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import static org.assertj.core.api.Assertions.*;

class ChatBudgetIntegrationTest {
    @TempDir Path root;private LettuceConnectionFactory factory;private StringRedisTemplate redis;private ChatSettings settings;private ChatBudget budget;private final ObjectMapper json=new ObjectMapper();
    private Instant now=Instant.parse("2026-11-02T15:00:00Z");private final Clock clock=new Clock(){public java.time.ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(java.time.ZoneId z){return this;}public Instant instant(){return now;}};
    private RedisKeyspace keys;private UUID owner;
    @BeforeEach void setup(){factory=new LettuceConnectionFactory("127.0.0.1",IsolatedTestServices.redisPort());factory.afterPropertiesSet();factory.start();redis=new StringRedisTemplate(factory);
        settings=new ChatSettings("true","synthetic-not-a-real-key","gpt-6-luna",UUID.randomUUID().toString(),root.resolve("receipt.json").toString());keys=new RedisKeyspace("youtopia:chat-test:"+UUID.randomUUID());budget=new ChatBudget(redis,json,keys,settings,clock);budget.initializeReviewedNewBudget();owner=UUID.randomUUID();}
    @AfterEach void close(){redis.delete(budget.key());factory.destroy();}
    @Test void deduplicationRateAndThirtyCallBudgetSurviveNewInstancesAndLogouts(){
        var calls=new AtomicInteger();ChatProvider provider=q->{calls.incrementAndGet();return "일반적인 지표 설명";};var service=new ChatService(settings,budget,provider);var request=UUID.randomUUID();
        assertThat(service.answer(owner,ChatQuestion.CCU_BASICS,request).replayed()).isFalse();assertThat(service.answer(owner,ChatQuestion.CCU_BASICS,request).replayed()).isTrue();assertThat(calls.get()).isEqualTo(1);
        assertThatThrownBy(()->service.answer(UUID.randomUUID(),ChatQuestion.CCU_BASICS,request)).hasMessageContaining("conflicts");
        assertThatThrownBy(()->service.answer(owner,ChatQuestion.VIDEO_VOLUME,request)).hasMessageContaining("conflicts");
        service.answer(owner,ChatQuestion.VIDEO_VOLUME,UUID.randomUUID());service.answer(owner,ChatQuestion.JOINT_SIGNALS,UUID.randomUUID());
        assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID())).isInstanceOf(com.youtopia.account.AccountProblem.class);assertThat(calls.get()).isEqualTo(3);
        for(int n=3;n<30;n++){now=now.plusSeconds(61);new ChatService(settings,new ChatBudget(redis,json,keys,settings,clock),provider).answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID());}
        assertThat(calls.get()).isEqualTo(30);assertThat(service.readiness(UUID.randomUUID())).isEqualTo("TOTAL_LIMIT");
        assertThatThrownBy(()->service.answer(UUID.randomUUID(),ChatQuestion.CCU_BASICS,UUID.randomUUID())).isInstanceOf(com.youtopia.account.AccountProblem.class);
        assertThat(service.answer(owner,ChatQuestion.CCU_BASICS,request).replayed()).isTrue();assertThat(calls.get()).isEqualTo(30);
        assertThat(redis.getExpire(budget.key())).isEqualTo(-1L);
    }
    @Test void concurrentInstancesAllowOnlyOneExternalCall()throws Exception {
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);var calls=new AtomicInteger();var provider=(ChatProvider)q->{calls.incrementAndGet();entered.countDown();try{release.await(5,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException();}return "설명";};
        var executor=Executors.newSingleThreadExecutor();var service=new ChatService(settings,budget,provider);var id=UUID.randomUUID();
        try{var response=executor.submit(()->service.answer(owner,ChatQuestion.CCU_BASICS,id));assertThat(entered.await(3,TimeUnit.SECONDS)).isTrue();
            var second=new ChatService(settings,new ChatBudget(redis,json,keys,settings,clock),provider);
            assertThatThrownBy(()->second.answer(owner,ChatQuestion.VIDEO_VOLUME,UUID.randomUUID())).isInstanceOf(com.youtopia.account.AccountProblem.class);
            assertThatThrownBy(()->second.answer(owner,ChatQuestion.CCU_BASICS,id)).isInstanceOf(com.youtopia.account.AccountProblem.class);
            assertThat(calls.get()).isEqualTo(1);release.countDown();assertThat(response.get(5,TimeUnit.SECONDS).text()).isEqualTo("설명");
        }finally{release.countDown();executor.shutdownNow();}
    }
    @Test void redisLossRollbackLocalReceiptLossOrCorruptionFailsClosed()throws Exception {
        String initial=redis.opsForValue().get(budget.key());var service=new ChatService(settings,budget,q->"説明");service.answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID());
        String current=redis.opsForValue().get(budget.key());redis.opsForValue().set(budget.key(),initial);assertThat(service.readiness(owner)).isEqualTo("MAINTENANCE");
        assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID())).isInstanceOf(ChatFailure.class);
        redis.opsForValue().set(budget.key(),current);Files.delete(Path.of(settings.file));assertThat(service.readiness(owner)).isEqualTo("MAINTENANCE");
        assertThatThrownBy(()->budget.initializeReviewedNewBudget()).isInstanceOf(ChatFailure.class);
    }
    @Test void ambiguousFailureIsChargedOnceAndLatchesGlobalGateWithoutAutomaticRefund(){
        var calls=new AtomicInteger();var service=new ChatService(settings,budget,q->{calls.incrementAndGet();throw new ChatFailure("PROVIDER_TIMEOUT");});var id=UUID.randomUUID();
        for(int n=0;n<2;n++)assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,id)).isInstanceOf(ChatFailure.class);
        assertThat(service.readiness(owner)).isEqualTo("MAINTENANCE");assertThatThrownBy(()->service.answer(UUID.randomUUID(),ChatQuestion.VIDEO_VOLUME,UUID.randomUUID())).isInstanceOf(ChatFailure.class);
        assertThat(calls.get()).isEqualTo(1);assertThat(redis.opsForValue().get(budget.key())).contains("AMBIGUOUS",id.toString());
    }
    @Test void definiteProviderFailuresAreNotCachedAsSuccessfulAnswersOrRefunded(){
        var calls=new AtomicInteger();var service=new ChatService(settings,budget,q->{calls.incrementAndGet();throw new ChatFailure("PROVIDER_QUOTA");});var id=UUID.randomUUID();
        for(int n=0;n<2;n++)assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,id)).isInstanceOf(ChatFailure.class);
        assertThat(calls.get()).isEqualTo(1);assertThat(redis.opsForValue().get(budget.key())).contains("FAILED").doesNotContain("SUCCESS");
    }
    @Test void actualExistingAclAllowsBudgetCasWithoutAnyAdditionalPermissions()throws Exception {
        String name="chat_fixture_"+UUID.randomUUID().toString().replace("-","");String password="synthetic-chat-acl-password-only-123456789";
        var process=new ProcessBuilder("python3","deploy/coexist/make-redis-acl.py").start();process.getOutputStream().write(password.getBytes(java.nio.charset.StandardCharsets.UTF_8));process.getOutputStream().close();String acl=new String(process.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);assertThat(process.waitFor()).isZero();
        String line=acl.lines().filter(x->x.startsWith("user youtopia ")).findFirst().orElseThrow();
        var args=new ArrayList<byte[]>();for(String value:("SETUSER "+name+" "+line.substring("user youtopia ".length())).split(" "))args.add(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        try(var connection=factory.getConnection()){connection.execute("ACL",args.toArray(byte[][]::new));}
        var config=new org.springframework.data.redis.connection.RedisStandaloneConfiguration("127.0.0.1",IsolatedTestServices.redisPort());config.setUsername(name);config.setPassword(password);
        var restricted=new LettuceConnectionFactory(config);restricted.afterPropertiesSet();restricted.start();
        try{
            var store=new ChatBudget(new StringRedisTemplate(restricted),json,keys,settings,clock);var service=new ChatService(settings,store,q->"일반 설명");
            assertThat(service.answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID()).text()).isEqualTo("일반 설명");
        }finally{restricted.destroy();try(var connection=factory.getConnection()){connection.execute("ACL","SETUSER".getBytes(),name.getBytes(),"off".getBytes());}}
    }
    @Test void unavailableRedisAndCorruptStateNeverCallProvider()throws Exception {
        var failing=org.mockito.Mockito.mock(StringRedisTemplate.class);org.mockito.Mockito.when(failing.opsForValue()).thenThrow(new org.springframework.data.redis.RedisConnectionFailureException("synthetic failure"));var calls=new AtomicInteger();
        var service=new ChatService(settings,new ChatBudget(failing,json,keys,settings,clock),q->{calls.incrementAndGet();return "bad";});
        assertThat(service.readiness(owner)).isEqualTo("MAINTENANCE");assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,UUID.randomUUID())).isInstanceOf(ChatFailure.class);assertThat(calls.get()).isZero();
        redis.opsForValue().set(budget.key(),"{}");Files.writeString(Path.of(settings.file),"{}");
        assertThat(new ChatService(settings,budget,q->"bad").readiness(owner)).isEqualTo("MAINTENANCE");
    }

    @Test void realSeparateJvmRestartPreservesReservationAndReplaysWithoutAnotherProviderCall()throws Exception {
        String classpath=System.getProperty("youtopia.test.runtimeClasspath");assertThat(classpath).isNotBlank();
        String namespace=keys.key("");namespace=namespace.substring(0,namespace.length()-1);
        var request=UUID.randomUUID();
        for(int run=0;run<2;run++){
            var process=new ProcessBuilder(Path.of(System.getProperty("java.home"),"bin","java").toString(),"-Xmx128m","-XX:ActiveProcessorCount=2","-cp",classpath,
                ChatBudgetRestartProbe.class.getName(),Integer.toString(IsolatedTestServices.redisPort()),namespace,settings.epoch,settings.file,owner.toString(),request.toString(),now.toString()).redirectErrorStream(true).start();
            try{assertThat(process.waitFor(20,TimeUnit.SECONDS)).isTrue();String output=new String(process.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
                assertThat(process.exitValue()).withFailMessage("Synthetic restart probe failed").isZero();assertThat(output).contains("MOCK_CALLS="+(run==0?1:0)+";REPLAY="+(run!=0));
            }finally{process.destroyForcibly();}
        }
        var stored=json.readValue(redis.opsForValue().get(budget.key()),ChatBudget.State.class);assertThat(stored.attempts()).hasSize(1);
    }

}
