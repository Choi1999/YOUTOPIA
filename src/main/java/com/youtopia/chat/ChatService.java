package com.youtopia.chat;

import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ChatService {
    public record Answer(UUID requestId,ChatQuestion questionId,String text,boolean replayed,String basis) {}
    private final ChatSettings settings;private final ChatBudget budget;private final ChatProvider provider;
    public ChatService(ChatSettings settings,ChatBudget budget,ChatProvider provider){this.settings=settings;this.budget=budget;this.provider=provider;}
    public String readiness(UUID owner){
        if(!settings.configured())return "MAINTENANCE";
        try(var lease=budget.open()){
            if(!lease.idle())return "MAINTENANCE";
            if(lease.exhausted())return "TOTAL_LIMIT";
            if(lease.rateLimited(owner))return "ADMIN_RATE_LIMIT";
            return "READY";
        }catch(com.youtopia.account.AccountProblem error){return "BUSY";}
        catch(RuntimeException error){return "MAINTENANCE";}
    }
    public Answer answer(UUID owner,ChatQuestion question,UUID request){
        if(!settings.configured())throw new ChatFailure("CONFIGURATION");
        try(var lease=budget.open()){
            var previous=lease.find(request,owner,question);
            if(previous!=null){
                if(previous.state().equals("SUCCESS"))return new Answer(request,question,previous.answer(),true,"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA");
                if(previous.failure()!=null)throw new ChatFailure(previous.failure());
                throw com.youtopia.account.AccountProblem.conflict("CHAT_REQUEST_IN_PROGRESS");
            }
            lease.reserve(request,owner,question);
            String answer;
            try{answer=provider.answer(question);if(answer==null||answer.isBlank()||answer.length()>8000||answer.contains(settings.key))throw new ChatFailure("PROVIDER_EMPTY");}
            catch(ChatFailure error){lease.finish(request,null,error);throw error;}
            catch(RuntimeException error){var failure=new ChatFailure("PROVIDER_TRANSPORT");lease.finish(request,null,failure);throw failure;}
            lease.finish(request,answer,null);
            return new Answer(request,question,answer,false,"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA");
        }
    }
}
