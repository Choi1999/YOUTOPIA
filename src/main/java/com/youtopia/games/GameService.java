package com.youtopia.games;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.api.PageResult;
import com.youtopia.account.AccountProblem;
import com.youtopia.steam.service.*;
import com.youtopia.steam.api.CcuResponse;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameService {
    public record Metric(String availability,Long value,Instant observedAt) {}
    public record Field<T>(String availability,T value) {}
    public record Evidence(String steam,String youtube,String completeness,int days,int group,Instant latestDataAt) {}
    public record Game(String gameId,long steamAppId,String name,Field<List<String>> developers,Field<Instant> releaseAt,String sourceLanguage,
        Instant metadataObservedAt,String steamConnection,String youtubeConnection,Metric currentCcu,Metric peak24h,
        Metric newYoutubeVideos,String reviewAvailability,String analysisAvailability,String gameEventAvailability,String freshness,Evidence evidence) {}
    public record Listing(List<Game> content,PageResult.Page page,Instant asOf,String catalogScope,String dataStatus,String freshness) {}
    public record Detail(Game game,Instant asOf,CcuResponse steamPreview,String youtubePreviewAvailability) {}
    private final GameRepository repository;private final Clock clock;private final CcuRequestBudget budget;private final CcuService ccu;private final ObjectMapper json;
    public GameService(GameRepository repository,Clock clock,CcuRequestBudget budget,CcuService ccu,ObjectMapper json){this.repository=repository;this.clock=clock;this.budget=budget;this.ccu=ccu;this.json=json;}
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Listing list(GameQuery query){
        budget.acquire();Instant now=clock.instant();long total=repository.count(query);
        var rows=(long)query.page()*query.size()>=total?List.<GameRepository.Row>of():repository.find(query,now);
        var page=PageResult.of(rows.stream().map(row->game(row,query.days())).toList(),query.page(),query.size(),total);
        return new Listing(page.content(),page.page(),now,"COLLECTOR_ELIGIBLE_READY_GAME_CANDIDATES",total==0?"EMPTY":"AVAILABLE","UNASSESSED");
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Detail detail(String gameId){
        long id=GameQuery.appId(gameId);budget.acquire();Instant now=clock.instant();var found=repository.detail(id,now);
        if(found==null)throw new AccountProblem(HttpStatus.NOT_FOUND,"GAME_NOT_FOUND","The game was not found.");
        return new Detail(game(found,30),now,ccu.get(id,30),found.youtubeStatus());
    }
    private Game game(GameRepository.Row row,int days){
        List<String> developers=null;
        if(row.developersJson()!=null)try{
            var node=json.readTree(row.developersJson());if(!node.isArray())throw new IllegalArgumentException();var names=new ArrayList<String>();
            for(var name:node){if(!name.isTextual()||name.asText().isBlank())throw new IllegalArgumentException();names.add(name.asText());}developers=List.copyOf(names);
        }catch(Exception e){throw new org.springframework.dao.DataRetrievalFailureException("Invalid developer source field");}
        return new Game("steam:"+row.appId(),row.appId(),row.name(),new Field<>(developers==null?"UNAVAILABLE":developers.isEmpty()?"EMPTY":"AVAILABLE",developers),
            new Field<>(row.releaseAt()==null?"UNAVAILABLE":"AVAILABLE",row.releaseAt()),row.language(),row.metadataAt(),row.steamTracked()==null?"UNKNOWN":row.steamTracked()?"CONNECTED":"UNAVAILABLE",row.youtubeStatus().equals("AVAILABLE")?"CONNECTED":row.youtubeStatus(),
            metric(row.currentCcu(),row.currentAt()),metric(row.peak24h(),row.peakAt()),new Metric(row.youtubeStatus().equals("AVAILABLE")?(row.youtubePeriodCount()>0?"AVAILABLE":"EMPTY"):row.youtubeStatus(),row.youtubePeriodCount(),row.youtubePeriodLast()),"UNAVAILABLE","UNAVAILABLE","UNAVAILABLE","UNASSESSED",evidence(row,days));
    }
    private Evidence evidence(GameRepository.Row row,int days){
        boolean steam=row.steamPeriodCount()>0,youtube=row.youtubePeriodCount()!=null&&row.youtubePeriodCount()>0;
        boolean history=row.currentAt()!=null||row.youtubeHistoryLast()!=null;
        Instant latest=row.steamPeriodLast();
        if(row.youtubePeriodLast()!=null&&(latest==null||row.youtubePeriodLast().isAfter(latest)))latest=row.youtubePeriodLast();
        if(!steam&&!youtube){latest=row.currentAt();if(row.youtubeHistoryLast()!=null&&(latest==null||row.youtubeHistoryLast().isAfter(latest)))latest=row.youtubeHistoryLast();}
        return new Evidence(steam?"IN_PERIOD":row.currentAt()!=null?"HISTORICAL_ONLY":"EMPTY",
            !row.youtubeStatus().equals("AVAILABLE")?row.youtubeStatus():youtube?"IN_PERIOD":row.youtubeHistoryLast()!=null?"HISTORICAL_ONLY":"EMPTY",
            row.youtubeStatus().equals("AVAILABLE")?"COMPLETE":"PARTIAL",days,steam&&youtube?1:steam||youtube?2:history?3:4,latest);
    }
    private Metric metric(Long value,Instant at){if((value==null)!=(at==null))throw new org.springframework.dao.DataRetrievalFailureException("Observation timestamp missing");return new Metric(value==null?"EMPTY":"AVAILABLE",value,at);}
}
