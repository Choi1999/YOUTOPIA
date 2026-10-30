package com.youtopia.charts;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class ObservationChartController {
    private final ObservationChartService service;
    public ObservationChartController(ObservationChartService service){this.service=service;}
    @GetMapping("/api/v1/charts/steam/ccu")
    ObservationChartService.CcuReport ccu(@RequestParam String appIds,@RequestParam(defaultValue="7")int days,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"appIds","days");response.setHeader("Cache-Control","no-store");
        if(appIds.length()>1100)throw new IllegalArgumentException("Too many app IDs");var ids=new TreeSet<Long>();
        for(String value:appIds.split(",",-1)){if(!value.matches("[1-9][0-9]{0,9}")||!ids.add(Long.parseLong(value)))throw new IllegalArgumentException("Invalid or repeated app ID");}
        return service.ccu(Collections.unmodifiableSortedSet(ids),days);
    }
    @GetMapping("/api/v1/youtube/videos/{videoId}/observations")
    ObservationChartService.VideoReport video(@PathVariable String videoId,@RequestParam(defaultValue="7")int days,HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request,"days");response.setHeader("Cache-Control","no-store");return service.video(videoId,days);}
    @GetMapping("/api/v1/charts/steam/app-types")
    ObservationChartService.TypesReport types(HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.types();}
}
