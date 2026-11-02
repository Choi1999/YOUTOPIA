package com.youtopia.chat;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class ChatController {
    public record Question(ChatQuestion questionId,String text) {}
    public record Status(boolean available,String state,String message,List<Question> questions,String accessPolicy) {}
    public record Request(@NotNull ChatQuestion questionId,@NotNull UUID requestId) {}
    private final ChatService service;private final ChatAccessPolicy access;
    public ChatController(ChatService service,ChatAccessPolicy access){this.service=service;this.access=access;}
    @GetMapping("/api/v1/chat/status")
    public Status status(HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request);response.setHeader("Cache-Control","no-store");var owner=access.require(request);
        String state=service.readiness(owner);boolean ready=state.equals("READY");
        String message=switch(state){case "READY"->"일반적인 지표 설명을 제공합니다.";case "TOTAL_LIMIT"->"전체 시연 누적 호출 한도에 도달했습니다.";case "ADMIN_RATE_LIMIT"->"분당 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.";case "BUSY"->"다른 응답을 처리 중입니다. 잠시 후 다시 확인해 주세요.";default->ChatFailure.MAINTENANCE;};
        return new Status(ready,state,message,
            Arrays.stream(ChatQuestion.values()).map(q->new Question(q,q.text)).toList(),"TEMPORARY_ADMIN_DEMO");
    }
    @PostMapping("/api/v1/chat/answers")
    public ChatService.Answer answer(@Valid @RequestBody Request body,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.answer(access.require(request),body.questionId(),body.requestId());
    }
}
