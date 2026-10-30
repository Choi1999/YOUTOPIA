package com.youtopia.settings;

import com.fasterxml.jackson.databind.*;
import com.youtopia.account.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class SettingsService {
    private final SettingsConfiguration policy;private final SettingsRepository repository;private final LifecycleStore accounts;private final ObjectMapper json;
    public record View(long version,JsonNode values) {}
    public SettingsService(SettingsConfiguration policy,SettingsRepository repository,LifecycleStore accounts,ObjectMapper json){this.policy=policy;this.repository=repository;this.accounts=accounts;this.json=json;}
    @Transactional(transactionManager="memberTx",readOnly=true,timeout=8)
    public View get(SessionIdentity identity){return view(repository.find(identity.id()));}
    @Transactional(transactionManager="memberTx",timeout=8)
    public View patch(SessionIdentity identity,long expected,JsonNode changes){
        if(expected<0||changes==null||!changes.isObject()||changes.size()>1)throw new IllegalArgumentException("Invalid settings patch");
        changes.properties().forEach(entry->{
            if(!entry.getKey().equals("theme")||!entry.getValue().isTextual()||!policy.themes().contains(entry.getValue().textValue()))throw new IllegalArgumentException("Invalid setting");
        });
        var account=accounts.lock(identity);if(account==null||!account.status().equals("ACTIVE")||account.authVersion()!=identity.authVersion())throw AccountProblem.invalid();
        var stored=repository.find(identity.id());var current=view(stored);
        if(current.version()!=expected)throw AccountProblem.conflict("SETTING_VERSION_CONFLICT");
        if(changes.isEmpty()||(changes.has("theme")&&changes.get("theme").equals(current.values().get("theme"))))return current;
        repository.ensureRow(identity.id());
        if(!repository.patch(identity.id(),expected,changes.toString()))throw AccountProblem.conflict("SETTING_VERSION_CONFLICT");
        return view(repository.find(identity.id()));
    }
    private View view(SettingsRepository.Stored stored){
        try{
            JsonNode all=stored==null?json.createObjectNode():json.readTree(stored.json());
            String theme="system";
            if(all.has("theme")){
                if(!all.get("theme").isTextual()||!policy.themes().contains(all.get("theme").textValue()))throw new org.springframework.dao.DataRetrievalFailureException("Invalid stored theme");
                theme=all.get("theme").textValue();
            }
            return new View(stored==null?0:stored.version(),json.createObjectNode().put("theme",theme));
        }catch(com.fasterxml.jackson.core.JsonProcessingException exception){throw new org.springframework.dao.DataRetrievalFailureException("Invalid stored settings");}
    }
}
