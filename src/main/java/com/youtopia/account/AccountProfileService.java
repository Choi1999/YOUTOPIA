package com.youtopia.account;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class AccountProfileService {
    private final AccountRepository repository;
    public AccountProfileService(AccountRepository repository){this.repository=repository;}
    @Transactional(transactionManager="memberTx",readOnly=true,timeout=8)
    public AccountProfile own(SessionIdentity identity){
        var profile=repository.profile(identity.id(),identity.authVersion());if(profile==null)throw AccountProblem.invalid();return profile;
    }
}
