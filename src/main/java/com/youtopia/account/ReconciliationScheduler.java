package com.youtopia.account;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.*;

@Configuration @EnableScheduling
@ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.accounts.reconciliation-enabled:false}")
public class ReconciliationScheduler {
    @Bean Job reconciliationJob(AccountLifecycleService service){return new Job(service);}
    public static class Job {
        private final AccountLifecycleService service;
        Job(AccountLifecycleService service){this.service=service;}
        @Scheduled(fixedDelayString="${youtopia.accounts.reconciliation-delay-ms:60000}")
        public void run(){service.reconcilePending();}
    }
}
