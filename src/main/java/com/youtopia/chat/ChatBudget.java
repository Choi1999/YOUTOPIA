package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.security.RedisKeyspace;
import java.nio.channels.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** Redis CAS plus a durable local receipt. Neither store is initialized by the web process. */
@Component
public class ChatBudget {
    public record Attempt(UUID requestId,UUID owner,ChatQuestion question,long at,String state,String answer,String failure) {}
    public record State(int version,String epoch,List<Attempt> attempts,UUID active) {}
    private static final DefaultRedisScript<Long> CAS=new DefaultRedisScript<>("if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end;redis.call('SET',KEYS[1],ARGV[2]);return 1",Long.class);
    private final StringRedisTemplate redis;private final ObjectMapper json;private final RedisKeyspace keys;private final ChatSettings settings;private final Clock clock;
    public ChatBudget(StringRedisTemplate redis,ObjectMapper json,RedisKeyspace keys,ChatSettings settings,Clock clock){this.redis=redis;this.json=json;this.keys=keys;this.settings=settings;this.clock=clock;}
    String key(){return keys.key("chat-budget:"+settings.epoch);}
    private Path path(){return Path.of(settings.file);}
    private static final Set<PosixFilePermission> MODE=Set.of(PosixFilePermission.OWNER_READ,PosixFilePermission.OWNER_WRITE);
    private static void protectedFile(Path file)throws Exception {
        if(!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS)||!Files.getPosixFilePermissions(file,LinkOption.NOFOLLOW_LINKS).equals(MODE)
           ||!Files.getOwner(file,LinkOption.NOFOLLOW_LINKS).getName().equals(System.getProperty("user.name")))throw new IllegalStateException();
    }
    public Lease open(){
        FileChannel channel=null;FileLock lock=null;
        try{
            protectedFile(path());var lockPath=Path.of(settings.file+".lock");protectedFile(lockPath);
            channel=FileChannel.open(lockPath,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);
            try{lock=channel.tryLock();}catch(OverlappingFileLockException e){throw ChatFailure.limit("BUSY");}
            if(lock==null)throw ChatFailure.limit("BUSY");
            if(Files.size(path())>1048576)throw new IllegalStateException();
            String local=Files.readString(path()),remote=redis.opsForValue().get(key());
            if(!local.equals(remote))throw new IllegalStateException();
            State state=json.readValue(local,State.class);validate(state);
            return new Lease(channel,lock,local,state);
        }catch(com.youtopia.account.AccountProblem error){close(lock,channel);throw error;}
        catch(Exception error){close(lock,channel);throw new ChatFailure("BUDGET_STATE");}
    }
    private void validate(State state){
        if(state==null||state.version()!=1||!settings.epoch.equals(state.epoch())||state.attempts()==null||state.attempts().size()>30)throw new IllegalStateException();
        var ids=new HashSet<UUID>();int active=0;
        for(var a:state.attempts()){
            if(a.requestId()==null||!ids.add(a.requestId())||a.owner()==null||a.question()==null||a.at()<0||!Set.of("RESERVED","SUCCESS","FAILED","AMBIGUOUS").contains(a.state()))throw new IllegalStateException();
            if(a.state().equals("SUCCESS")?(a.answer()==null||a.answer().isBlank()||a.answer().length()>8000||a.failure()!=null):(a.answer()!=null))throw new IllegalStateException();
            if(Set.of("FAILED","AMBIGUOUS").contains(a.state())&&(a.failure()==null||!a.failure().matches("[A-Z_]{1,60}")))throw new IllegalStateException();
            if(Set.of("RESERVED","AMBIGUOUS").contains(a.state())){active++;if(!a.requestId().equals(state.active()))throw new IllegalStateException();}
        }
        if((state.active()==null?0:1)!=active)throw new IllegalStateException();
    }
    public final class Lease implements AutoCloseable {
        private final FileChannel channel;private final FileLock lock;private String encoded;private State state;
        private Lease(FileChannel channel,FileLock lock,String encoded,State state){this.channel=channel;this.lock=lock;this.encoded=encoded;this.state=state;}
        public Attempt find(UUID requestId,UUID owner,ChatQuestion question){
            for(var a:state.attempts())if(a.requestId().equals(requestId)){
                if(!a.owner().equals(owner)||a.question()!=question)throw com.youtopia.account.AccountProblem.conflict("CHAT_REQUEST_CONFLICT");return a;
            }return null;
        }
        public boolean idle(){return state.active()==null;}
        public boolean exhausted(){return state.attempts().size()>=30;}
        public boolean rateLimited(UUID owner){long now=clock.instant().getEpochSecond();return state.attempts().stream().filter(a->a.owner().equals(owner)&&a.at()>now-60).count()>=3;}
        public void reserve(UUID requestId,UUID owner,ChatQuestion question){
            if(state.active()!=null)throw new ChatFailure("BUDGET_UNCERTAIN");
            if(state.attempts().size()>=30)throw ChatFailure.limit("TOTAL_LIMIT");
            long now=clock.instant().getEpochSecond();
            if(state.attempts().stream().filter(a->a.owner().equals(owner)&&a.at()>now-60).count()>=3)throw ChatFailure.limit("ADMIN_RATE_LIMIT");
            var attempts=new ArrayList<>(state.attempts());attempts.add(new Attempt(requestId,owner,question,now,"RESERVED",null,null));
            write(new State(1,settings.epoch,List.copyOf(attempts),requestId));
        }
        public void finish(UUID requestId,String answer,ChatFailure failure){
            if(!requestId.equals(state.active()))throw new ChatFailure("BUDGET_STATE");
            var attempts=new ArrayList<Attempt>();for(var a:state.attempts())attempts.add(a.requestId().equals(requestId)?
                new Attempt(a.requestId(),a.owner(),a.question(),a.at(),failure==null?"SUCCESS":failure.ambiguous()?"AMBIGUOUS":"FAILED",answer,failure==null?null:failure.category):a);
            write(new State(1,settings.epoch,List.copyOf(attempts),failure!=null&&failure.ambiguous()?requestId:null));
        }
        private void write(State next){
            try{
                validate(next);String value=json.writeValueAsString(next);
                Long changed=redis.execute(CAS,List.of(key()),encoded,value);if(changed==null||changed!=1)throw new IllegalStateException();
                durableWrite(path(),value);encoded=value;state=next;
            }catch(Exception error){throw new ChatFailure("BUDGET_STATE");}
        }
        public void close(){ChatBudget.close(lock,channel);}
    }
    private static void close(FileLock lock,FileChannel channel){try{if(lock!=null)lock.close();}catch(Exception ignored){}try{if(channel!=null)channel.close();}catch(Exception ignored){}}
    private static void durableWrite(Path path,String text)throws Exception {
        Path temp=Files.createTempFile(path.getParent(),".chat-receipt-",".tmp");
        try{
            Files.setPosixFilePermissions(temp,MODE);
            try(var file=FileChannel.open(temp,StandardOpenOption.WRITE)){var bytes=ByteBuffer.wrap(text.getBytes(StandardCharsets.UTF_8));while(bytes.hasRemaining())file.write(bytes);file.force(true);}
            Files.move(temp,path,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
            try(var directory=FileChannel.open(path.getParent(),StandardOpenOption.READ)){directory.force(true);}
        }finally{Files.deleteIfExists(temp);}
    }
    /** Trusted offline operator only. New epoch/file only; never resets an existing budget. */
    public void initializeReviewedNewBudget(){
        try{
            var file=path();var lock=Path.of(settings.file+".lock");
            if(!settings.epoch.matches("[0-9a-f-]{36}")||Files.exists(file,LinkOption.NOFOLLOW_LINKS)||Files.exists(lock,LinkOption.NOFOLLOW_LINKS)||!Files.isDirectory(file.getParent(),LinkOption.NOFOLLOW_LINKS))throw new IllegalStateException();
            String encoded=json.writeValueAsString(new State(1,settings.epoch,List.of(),null));
            if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key(),encoded)))throw new IllegalStateException();
            Files.createFile(lock);Files.setPosixFilePermissions(lock,MODE);durableWrite(file,encoded);
        }catch(Exception error){throw new ChatFailure("BUDGET_INITIALIZATION");}
    }
}
