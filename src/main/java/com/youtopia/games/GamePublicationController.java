package com.youtopia.games;

import com.youtopia.api.*;
import com.youtopia.steam.service.CcuRequestBudget;
import java.time.*;
import java.util.*;
import jakarta.servlet.http.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GamePublicationController {
    public record Day(LocalDate date,long observedVideos,boolean inProgress) {}
    public record Result(long appId,int days,Instant asOf,String timezone,String dataStatus,String coverage,List<Day> points,
                         Long missingPublishedAt,LocalDate selectedDate,PageResult<GameVideoRepository.Video> videos) {}
    private final GameVideoRepository repository;private final GameRepository games;private final Clock clock;private final CcuRequestBudget budget;
    public GamePublicationController(GameVideoRepository repository,GameRepository games,Clock clock,CcuRequestBudget budget){this.repository=repository;this.games=games;this.clock=clock;this.budget=budget;}
    @GetMapping("/api/v1/games/{gameId}/youtube-publications")
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Result get(@PathVariable String gameId,@RequestParam(defaultValue="30")int days,@RequestParam(required=false)LocalDate date,
                      @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"days","date","page","size");response.setHeader("Cache-Control","no-store");
        PageResult.validate(page,size);if(days!=7&&days!=30)throw new IllegalArgumentException("Invalid period");
        long id=GameQuery.appId(gameId);budget.acquire();Instant now=clock.instant();
        if(games.detail(id,now)==null)throw new com.youtopia.account.AccountProblem(org.springframework.http.HttpStatus.NOT_FOUND,"GAME_NOT_FOUND","The game was not found.");
        var today=now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();var start=today.minusDays(days-1);var selected=date==null?today:date;
        if(selected.isBefore(start)||selected.isAfter(today))throw new IllegalArgumentException("Date outside selected period");
        String status=repository.status();if(!status.equals("AVAILABLE"))return new Result(id,days,now,"Asia/Seoul",status,"UNASSESSED",List.of(),null,selected,null);
        var videos=repository.videos(id,now);var counts=new TreeMap<LocalDate,Long>();long missing=0;
        var selectedVideos=new ArrayList<GameVideoRepository.Video>();
        for(var v:videos){if(v.publishedAt()==null){missing++;continue;}if(v.publishedAt().isAfter(now))continue;
            var d=v.publishedAt().atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
            if(!d.isBefore(start)&&!d.isAfter(today))counts.merge(d,1L,Long::sum);
            if(d.equals(selected))selectedVideos.add(v);
        }
        var points=new ArrayList<Day>();for(var d=start;!d.isAfter(today);d=d.plusDays(1))points.add(new Day(d,counts.getOrDefault(d,0L),d.equals(today)));
        long offset=(long)page*size;var content=offset>=selectedVideos.size()?List.<GameVideoRepository.Video>of():selectedVideos.subList((int)offset,(int)Math.min(offset+size,selectedVideos.size()));
        return new Result(id,days,now,"Asia/Seoul",counts.isEmpty()?"EMPTY":"AVAILABLE","UNASSESSED",List.copyOf(points),missing,selected,PageResult.of(content,page,size,selectedVideos.size()));
    }
}
