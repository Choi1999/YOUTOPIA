package com.youtopia.settings;

import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/** P0 approved persisted preferences. Runtime configuration cannot add account/security settings. */
@Configuration @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class SettingsConfiguration {
    public Set<String> themes(){return Set.of("system","light","dark");}
}
