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
    /** Distinct query-associated videos discovered by asOf; discovery time is not source freshness. */
    public record Summary(String population,long observedVideos,long publishedVideos,long periodVideos,
                          long missingPublishedAt,long futurePublishedAt,Instant latestFirstObservedAt) {}
    public record Result(long appId,int days,Instant asOf,String timezone,String dataStatus,String coverage,List<Day> points,
                         Long missingPublishedAt,LocalDate selectedDate,PageResult<GameVideoRepository.Video> videos,
                         String videoScope,Summary summary) {}
    private final GameVideoRepository repository;private final GameRepository games;private final Clock clock;private final CcuRequestBudget budget;
    public GamePublicationController(GameVideoRepository repository,GameRepository games,Clock clock,CcuRequestBudget budget){this.repository=repository;this.games=games;this.clock=clock;this.budget=budget;}
    @GetMapping("/api/v1/games/{gameId}/youtube-publications")
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Result get(@PathVariable String gameId,@RequestParam(defaultValue="30")int days,@RequestParam(required=false)LocalDate date,
                      @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,
                      @RequestParam(defaultValue="date")String scope,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"days","date","page","size","scope");response.setHeader("Cache-Control","no-store");
        PageResult.validate(page,size);if(days!=7&&days!=30)throw new IllegalArgumentException("Invalid period");
        if(!Set.of("date","period").contains(scope)||request.getParameter("scope")!=null&&request.getParameter("scope").isBlank()
            ||scope.equals("period")&&request.getParameterMap().containsKey("date"))throw new IllegalArgumentException("Invalid video scope");
        long id=GameQuery.appId(gameId);Instant now=clock.instant();
        var today=now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();var start=today.minusDays(days-1);
        LocalDate selected=scope.equals("period")?null:date==null?today:date;
        if(selected!=null&&(selected.isBefore(start)||selected.isAfter(today)))throw new IllegalArgumentException("Date outside selected period");
        budget.acquire();
        if(!games.exists(id))throw new com.youtopia.account.AccountProblem(org.springframework.http.HttpStatus.NOT_FOUND,"GAME_NOT_FOUND","The game was not found.");
        String status=repository.status();if(!status.equals("AVAILABLE"))return new Result(id,days,now,"Asia/Seoul",status,"UNASSESSED",List.of(),null,selected,null,scope,null);
        var videos=repository.videos(id,now);var counts=new TreeMap<LocalDate,Long>();long missing=0,future=0,published=0,period=0;
        Instant latestDiscovery=null;
        var selectedVideos=new ArrayList<GameVideoRepository.Video>();
        for(var v:videos){
            if(latestDiscovery==null||v.firstObservedAt().isAfter(latestDiscovery))latestDiscovery=v.firstObservedAt();
            if(v.publishedAt()==null){missing++;continue;}if(v.publishedAt().isAfter(now)){future++;continue;}
            published++;
            var d=v.publishedAt().atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
            boolean inPeriod=!d.isBefore(start)&&!d.isAfter(today);
            if(inPeriod){counts.merge(d,1L,Long::sum);period++;}
            if(scope.equals("period")?inPeriod:d.equals(selected))selectedVideos.add(v);
        }
        selectedVideos.sort(Comparator.comparing(GameVideoRepository.Video::publishedAt).reversed().thenComparing(GameVideoRepository.Video::videoId));
        var points=new ArrayList<Day>();for(var d=start;!d.isAfter(today);d=d.plusDays(1))points.add(new Day(d,counts.getOrDefault(d,0L),d.equals(today)));
        long offset=(long)page*size;var content=offset>=selectedVideos.size()?List.<GameVideoRepository.Video>of():selectedVideos.subList((int)offset,(int)Math.min(offset+size,selectedVideos.size()));
        var summary=new Summary("QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF",videos.size(),published,period,missing,future,latestDiscovery);
        return new Result(id,days,now,"Asia/Seoul",counts.isEmpty()?"EMPTY":"AVAILABLE","UNASSESSED",List.copyOf(points),missing,selected,PageResult.of(content,page,size,selectedVideos.size()),scope,summary);
    }
}
