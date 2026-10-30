package com.youtopia.charts;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import java.time.OffsetDateTime;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class RankingChartController {
    private final RankingChartService service;
    public RankingChartController(RankingChartService service){this.service=service;}
    @GetMapping("/api/v1/charts/steam/ranking-periods")
    RankingChartService.Periods periods(HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.periods();
    }
    @GetMapping("/api/v1/charts/steam/rankings")
    RankingChartService.Result get(@RequestParam String source,@RequestParam(required=false) String category,@RequestParam String from,@RequestParam String to,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"source","category","from","to");response.setHeader("Cache-Control","no-store");return service.get(source,category,parse(from),parse(to));
    }
    private java.time.Instant parse(String value){try{return OffsetDateTime.parse(value).toInstant();}catch(java.time.DateTimeException e){throw new IllegalArgumentException("Explicit UTC offset required");}}
}
