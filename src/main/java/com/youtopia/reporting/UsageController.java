package com.youtopia.reporting;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import java.time.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.reporting.enabled:false}")
public class UsageController {
    private final UsageService service;private final Clock clock;
    public UsageController(UsageService service,Clock clock){this.service=service;this.clock=clock;}
    @GetMapping("/api/v1/admin/usage")
    UsageService.Usage get(@RequestParam(required=false)LocalDate from,@RequestParam(required=false)LocalDate to,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"from","to");LocalDate end=to==null?LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul"))):to;
        LocalDate start=from==null?end.minusDays(6):from;response.setHeader("Cache-Control","no-store");return service.get(start,end);
    }
}
