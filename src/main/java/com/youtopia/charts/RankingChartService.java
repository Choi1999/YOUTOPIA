package com.youtopia.charts;

import java.time.*;
import com.youtopia.steam.service.CcuRequestBudget;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class RankingChartService {
    public record Result(String source,String category,Instant fromPeriod,Instant toPeriod,Instant asOf,String population,String freshness,RankingAnalytics.Report charts) {
        public String getCalculationVersion(){return "source-weekly-rank-v1";}
    }
    private final JdbcRankingRepository repository;private final Clock clock;private final CcuRequestBudget budget;
    public RankingChartService(JdbcRankingRepository repository,Clock clock,CcuRequestBudget budget){this.repository=repository;this.clock=clock;this.budget=budget;}
    public record Periods(Instant asOf,String dataStatus,String periodBasis,java.util.List<JdbcRankingRepository.Period> content) {}
    @Transactional(readOnly=true,timeout=8)
    public Periods periods(){
        budget.acquire();Instant now=clock.instant();var periods=repository.periods(now);
        return new Periods(now,periods.isEmpty()?"EMPTY":"AVAILABLE","OBSERVED_SOURCE_PERIODS_UTC",periods);
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Result get(String source,String category,Instant from,Instant to){
        Instant now=clock.instant();long span=Duration.between(from,to).getSeconds();
        if(!source.matches("[A-Za-z0-9_.:-]{1,80}")||!category.matches("[A-Za-z0-9_.:-]{1,80}")||from.isAfter(to)||span>12*604800L||span%604800!=0||!from.plusSeconds(span).equals(to)||to.isAfter(now))throw new IllegalArgumentException("Invalid source periods");
        budget.acquire();var runs=repository.runs(source,category,from,to,now);
        try{return new Result(source,category,from,to,now,"ELIGIBLE_CONFIRMED_GAME_ENTRIES_FROM_COMPLETE_RUNS","UNASSESSED",RankingAnalytics.calculate(runs,from,to,now));}
        catch(IllegalArgumentException error){throw new DataRetrievalFailureException("Ranking source contract mismatch");}
    }
}
