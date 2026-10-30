package com.youtopia.account;

import com.youtopia.api.PageResult;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.directory.enabled:false}")
public class AdminDirectoryService {
    private final AdminDirectoryRepository repository;private final SecurityAudit audit;
    public record Member(UUID userId,String maskedEmail,String accountStatus,Instant createdAt,Instant recoverUntil) {}
    public AdminDirectoryService(AdminDirectoryRepository repository,SecurityAudit audit){this.repository=repository;this.audit=audit;}
    @Transactional(transactionManager="directoryTx",readOnly=true,isolation=Isolation.REPEATABLE_READ,timeout=8)
    public PageResult<Member> list(int page,int size,String status,String query,UUID actor){
        PageResult.validate(page,size);if(!java.util.Set.of("ACTIVE","PENDING_DELETION").contains(status)||query.length()>100)throw new IllegalArgumentException("Invalid directory filter");
        long total=repository.count(status,query);var rows=repository.list(page,size,status,query).stream().map(this::view).toList();
        audit.write("ADMIN_MEMBER_READ","ADMIN",actor,"SUCCESS",UUID.randomUUID());return PageResult.of(rows,page,size,total);
    }
    @Transactional(transactionManager="directoryTx",readOnly=true,timeout=8)
    public Member detail(UUID id,UUID actor){
        var row=repository.detail(id).orElseThrow(()->new AccountProblem(HttpStatus.NOT_FOUND,"MEMBER_NOT_FOUND","The member was not found."));
        audit.write("ADMIN_MEMBER_READ","ADMIN",actor,"SUCCESS",UUID.randomUUID(),id);return view(row);
    }
    private Member view(AdminDirectoryRepository.Row r){return new Member(r.id(),r.email(),r.status(),r.created(),r.deadline());}
}
