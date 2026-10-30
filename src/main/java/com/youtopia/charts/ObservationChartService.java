package com.youtopia.charts;

import java.time.*;
import java.util.*;
import com.youtopia.steam.service.CcuRequestBudget;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class ObservationChartService {
    public record CcuReport(Instant asOf,int days,String population,String freshness,List<ObservationAnalytics.Change> recent,ObservationAnalytics.DirectionCounts exact24Hours) {
        public String getCalculationVersion(){return "observed-ccu-v1";}
    }
    public record VideoReport(Instant from,Instant to,String mappingBasis,String freshness,ObservationAnalytics.VideoComparison comparison,List<ObservationAnalytics.VideoPoint> observations) {
        public String getCalculationVersion(){return "native-video-observation-v1";}
    }
    public record TypesReport(Instant asOf,String population,String dataStatus,ObservationAnalytics.Composition composition) {
        public String getCalculationVersion(){return "active-steam-app-types-v1";}
    }
    private final JdbcObservationChartRepository repository;private final Clock clock;private final CcuRequestBudget budget;
    public ObservationChartService(JdbcObservationChartRepository repository,Clock clock,CcuRequestBudget budget){this.repository=repository;this.clock=clock;this.budget=budget;}
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public CcuReport ccu(SortedSet<Long> appIds,int days){
        if(appIds.isEmpty()||appIds.size()>100||appIds.stream().anyMatch(x->x<1||x>4294967295L)||days!=7&&days!=30)throw new IllegalArgumentException("Invalid chart scope");
        budget.acquire();Instant now=clock.instant();var groups=repository.ccu(appIds,days,now);
        return new CcuReport(now,days,"EXPLICIT_REQUESTED_STEAM_APP_IDS","UNASSESSED",appIds.stream().map(id->ObservationAnalytics.recent(id,groups.getOrDefault(id,List.of()),now)).toList(),ObservationAnalytics.exact24Hours(appIds,groups,now));
    }
    @Transactional(readOnly=true,timeout=8)
    public VideoReport video(String videoId,int days){
        if(!videoId.matches("[A-Za-z0-9_-]{11}")||days!=7&&days!=30)throw new IllegalArgumentException("Invalid video or period");
        budget.acquire();Instant now=clock.instant(),from=now.minusSeconds(days*86400L);
        var rows=ObservationAnalytics.videoObservations(repository.video(videoId,from,now),from,now);
        return new VideoReport(from,now,"NATIVE_VIDEO_ID_NO_GAME_MAPPING","UNASSESSED",ObservationAnalytics.video(videoId,rows,from,now),List.copyOf(rows));
    }
    @Transactional(readOnly=true,timeout=8)
    public TypesReport types(){
        budget.acquire();var rows=repository.types();
        try {
            return new TypesReport(clock.instant(),"ACTIVE_STEAM_CCU_TARGETS",rows.isEmpty()?"EMPTY":"AVAILABLE",ObservationAnalytics.composition(rows));
        } catch (IllegalArgumentException invalidSource) {
            throw new DataRetrievalFailureException("Conflicting source app types");
        }
    }
}
