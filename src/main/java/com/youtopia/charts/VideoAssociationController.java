package com.youtopia.charts;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnExpression("${youtopia.games.enabled:false} && ${youtopia.games.video-associations-enabled:false}")
public class VideoAssociationController {
    private final VideoAssociationService service;
    public VideoAssociationController(VideoAssociationService service){this.service=service;}
    @GetMapping("/api/v1/charts/youtube/query-associations")
    VideoAssociationService.Result get(@RequestParam String appIds,@RequestParam(defaultValue="7")int days,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"appIds","days");response.setHeader("Cache-Control","no-store");
        if(appIds.length()>1100)throw new IllegalArgumentException("Too many app IDs");var ids=new TreeSet<Long>();
        for(String value:appIds.split(",",-1)){if(!value.matches("[1-9][0-9]{0,9}")||!ids.add(Long.parseLong(value)))throw new IllegalArgumentException("Invalid or repeated app ID");}
        return service.get(Collections.unmodifiableSortedSet(ids),days);
    }
}
