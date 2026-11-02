package com.youtopia.chat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class ChatSettings {
    final String key,model,epoch,file;private final String enabled;
    public ChatSettings(@Value("${youtopia.chat.enabled:false}")String enabled,
                        @Value("${youtopia.chat.api-key:}")String key,@Value("${youtopia.chat.model:}")String model,
                        @Value("${youtopia.chat.budget-epoch:}")String epoch,@Value("${youtopia.chat.budget-file:}")String file){
        this.enabled=enabled;this.key=key;this.model=model;this.epoch=epoch;this.file=file;
    }
    public boolean configured(){return enabled.equals("true")&&!key.isBlank()&&key.chars().allMatch(c->c>32&&c<127)
        &&model.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,99}")&&epoch.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        &&file.startsWith("/")&&!file.contains("\n");}
    @Override public String toString(){return "ChatSettings[redacted]";}
}
