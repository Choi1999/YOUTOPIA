package com.youtopia.chat;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatServiceTest {
    @Test void missingDisabledOrInvalidConfigurationDoesNotOpenBudgetOrCallProvider(){
        var budget=mock(ChatBudget.class);var provider=mock(ChatProvider.class);var owner=java.util.UUID.randomUUID();
        for(var settings:java.util.List.of(new ChatSettings("false","synthetic","gpt-6-luna","",""),new ChatSettings("true","","gpt-6-luna","",""),new ChatSettings("true","synthetic","","",""))){
            var service=new ChatService(settings,budget,provider);assertThat(service.readiness(owner)).isEqualTo("MAINTENANCE");
            assertThatThrownBy(()->service.answer(owner,ChatQuestion.CCU_BASICS,java.util.UUID.randomUUID())).isInstanceOf(ChatFailure.class);
            assertThat(settings.toString()).doesNotContain("synthetic");
        }
        verifyNoInteractions(budget,provider);
    }
}
