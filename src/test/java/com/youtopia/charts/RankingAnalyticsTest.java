package com.youtopia.charts;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RankingAnalyticsTest {
    final Instant first=Instant.parse("2026-10-05T00:00:00Z"),now=Instant.parse("2026-10-30T00:00:00Z");
    RankingAnalytics.Entry entry(long id,int position){return new RankingAnalytics.Entry(id,"same synthetic name",position);}
    RankingAnalytics.Run run(long id,String country,int week,RankingAnalytics.Entry...entries){Instant start=first.plusSeconds(week*604800L);return new RankingAnalytics.Run(id,country,start,start.plusSeconds(604800),start.plusSeconds(604800+id),List.of(entries));}
    @Test void positionChangeUsesPreviousMinusCurrentAndDenominatorExcludesNewEntries(){
        var report=RankingAnalytics.calculate(List.of(run(1,"KR",-1,entry(1,100),entry(2,2)),run(2,"KR",0,entry(1,10),entry(2,20),entry(3,30))),first,first,now);
        var r=report.weeks().getFirst().kr();assertThat(r.up()).isEqualTo(1);assertThat(r.down()).isEqualTo(1);assertThat(r.comparable()).isEqualTo(2);
        assertThat(r.uncomparable()).isEqualTo(1);assertThat(r.upRatio()).isEqualByComparingTo("0.5");assertThat(r.deltaHistogram()).containsEntry(90,1L).containsEntry(-18,1L);
        assertThat(r.excluded().getFirst().reason()).isEqualTo("APP_ABSENT_PREVIOUS_PERIOD");
    }
    @Test void latestWholeRunReplacesOldRunWithoutCarryingMissingGamesForward(){
        var report=RankingAnalytics.calculate(List.of(run(1,"KR",0,entry(1,1),entry(2,2)),run(2,"KR",0,entry(2,10))),first,first,now);
        assertThat(report.weeks().getFirst().kr().observedEntries()).isEqualTo(1);assertThat(report.top20Continuity().getFirst().enteredTop20()).isEqualTo(1);
    }
    @Test void countriesPairByExactIdAndSourcePeriodAndNeverBySameName(){
        var r=RankingAnalytics.calculate(List.of(run(1,"KR",0,entry(1,1),entry(2,5)),run(2,null,0,entry(1,10),entry(3,2))),first,first,now).weeks().getFirst();
        assertThat(r.pairs()).hasSize(1);assertThat(r.pairs().getFirst().appId()).isEqualTo(1);assertThat(r.pairs().getFirst().absoluteGap()).isEqualTo(9);
        assertThat(r.unspecified().country()).isEqualTo("UNSPECIFIED");
    }
    @Test void missingWeekCannotBecomeEveryWeekTop20OrAThreeWeekTrend(){
        var r=RankingAnalytics.calculate(List.of(run(1,"KR",0,entry(1,1)),run(2,"KR",2,entry(1,2))),first,first.plusSeconds(2*604800L),now);
        assertThat(r.lastThreeWeekTrends()).isEmpty();assertThat(r.top20Continuity().getFirst().observedWeeks()).isEqualTo(2);
        assertThat(r.top20Continuity().getFirst().everyWeekTop20()).isNull();assertThat(r.top20Continuity().getFirst().availability()).isEqualTo("PARTIAL");
    }
    @Test void completeThreeWeekHistoryRetainsOriginalPositionsAndTop20Threshold(){
        var r=RankingAnalytics.calculate(List.of(run(1,"KR",0,entry(1,20),entry(2,21)),run(2,"KR",1,entry(1,19),entry(2,1)),run(3,"KR",2,entry(1,18),entry(2,2))),first,first.plusSeconds(2*604800L),now);
        assertThat(r.rankOneAtTop()).isTrue();assertThat(r.lastThreeWeekTrends()).hasSize(2);assertThat(r.top20Continuity().getFirst().enteredTop20()).isEqualTo(2);assertThat(r.top20Continuity().getFirst().everyWeekTop20()).isEqualTo(1);
        assertThat(r.lastThreeWeekTrends().getFirst().points().stream().map(RankingAnalytics.Point::position)).containsExactly(20,19,18);
    }
    @Test void topTenUsesStableNativeKeyWhenMovementTies(){
        var previous=new ArrayList<RankingAnalytics.Entry>();var current=new ArrayList<RankingAnalytics.Entry>();
        for(int i=12;i>=1;i--){previous.add(entry(i,i+1));current.add(entry(i,i));}
        var r=RankingAnalytics.calculate(List.of(run(1,"KR",-1,previous.toArray(RankingAnalytics.Entry[]::new)),run(2,"KR",0,current.toArray(RankingAnalytics.Entry[]::new))),first,first,now);
        assertThat(r.weeks().getFirst().kr().topRisers().stream().map(RankingAnalytics.Move::appId)).containsExactly(1L,2L,3L,4L,5L,6L,7L,8L,9L,10L);
    }
    @Test void futureOrIncompleteSourcePeriodDoesNotCreateAReportedComparison(){
        var future=new RankingAnalytics.Run(2,"KR",first,first.plusSeconds(604800),now.plusSeconds(1),List.of(entry(1,1)));
        var r=RankingAnalytics.calculate(List.of(future),first,first,now);assertThat(r.weeks().getFirst().kr().availability()).isEqualTo("UNAVAILABLE");assertThat(r.weeks().getFirst().kr().upRatio()).isNull();
    }
    @Test void duplicateIdentitiesAndNonWeeklyRequestBoundsFailInsteadOfGuessing(){
        assertThatThrownBy(()->RankingAnalytics.calculate(List.of(run(1,"KR",0,entry(1,1),entry(1,2))),first,first,now)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->RankingAnalytics.calculate(List.of(),first,first.plusSeconds(100),now)).isInstanceOf(IllegalArgumentException.class);
    }
}
