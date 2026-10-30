package com.youtopia.charts;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.youtopia.steam.service.CcuRequestBudget;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnExpression("${youtopia.games.enabled:false} && ${youtopia.games.video-associations-enabled:false}")
public class VideoAssociationService {
    public record Count(long appId,long queryAssociatedVideos,long comparableVideos,BigDecimal comparableRatio,String availability) {}
    public record Result(Instant from,Instant to,String mappingBasis,String relevanceVerification,String accelerationAvailability,String accelerationReason,List<Count> content) {
        public String getCalculationVersion(){return "query-association-eligibility-v1";}
    }
    private final VideoAssociationRepository repository;private final Clock clock;private final CcuRequestBudget budget;
    public VideoAssociationService(VideoAssociationRepository repository,Clock clock,CcuRequestBudget budget){this.repository=repository;this.clock=clock;this.budget=budget;}
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Result get(SortedSet<Long> ids,int days){
        if(ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(x->x<1||x>4294967295L)||days!=7&&days!=30)throw new IllegalArgumentException("Invalid association scope");
        budget.acquire();Instant to=clock.instant(),from=to.minusSeconds(days*86400L);var rows=repository.eligibility(ids,from,to);var counts=new ArrayList<Count>();
        for(long id:ids){long total=rows.stream().filter(v->v.appId()==id).count(),compared=rows.stream().filter(v->v.appId()==id&&v.validSlots()>=2).count();counts.add(new Count(id,total,compared,ObservationAnalytics.ratio(compared,total),total==0?"EMPTY":"AVAILABLE"));}
        return new Result(from,to,"EXPLICIT_QUERY_BINDING_VALID_AT_SEARCH_OBSERVATION","UNASSESSED","UNAVAILABLE","ACCELERATION_INTERVAL_POLICY_PENDING",List.copyOf(counts));
    }
}
