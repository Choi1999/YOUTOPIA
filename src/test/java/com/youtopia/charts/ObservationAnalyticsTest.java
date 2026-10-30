package com.youtopia.charts;

import com.youtopia.steam.domain.CcuObservation;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ObservationAnalyticsTest {
    final Instant now=Instant.parse("2026-10-30T00:00:00Z");
    CcuObservation point(long id,long seconds,long count){return new CcuObservation(id,now.plusSeconds(seconds),now.plusSeconds(seconds),count);}
    @Test void recentRateUsesLastTwoDistinctSlotsAndReportsActualElapsedTime(){
        var result=ObservationAnalytics.recent(570,List.of(point(1,-7200,100),point(2,-1800,125),point(3,1,9000)),now);
        assertThat(result.percent()).isEqualByComparingTo("25");assertThat(result.elapsedSeconds()).isEqualTo(5400);
    }
    @Test void zeroBaselineIsUnavailablePercentageWhileActualZeroDirectionIsComparable(){
        var map=Map.of(570L,List.of(point(1,-86400,0),point(2,0,0)));
        var result=ObservationAnalytics.exact24Hours(new TreeSet<>(Set.of(570L)),map,now);
        assertThat(result.same()).isEqualTo(1);assertThat(result.comparable()).isEqualTo(1);assertThat(result.comparisons().getFirst().percent()).isNull();
        assertThat(result.comparisons().getFirst().reason()).isEqualTo("ZERO_BASELINE");
    }
    @Test void twentyFourHourComparisonNeverSubstitutesNearestOrMissingSlot(){
        var data=Map.of(1L,List.of(point(1,-86399,100),point(2,0,120)),2L,List.of(point(3,-86400,200),point(4,0,100)));
        var result=ObservationAnalytics.exact24Hours(new TreeSet<>(Set.of(1L,2L,3L)),data,now);
        assertThat(result.down()).isEqualTo(1);assertThat(result.excluded()).isEqualTo(2);assertThat(result.up()).isZero();
    }
    @Test void duplicateInputSlotsResolveDeterministicallyAndLargeCountsDoNotOverflow(){
        var values=List.of(point(1,-60,Long.MAX_VALUE),point(2,0,Long.MAX_VALUE),point(3,0,0));
        var result=ObservationAnalytics.recent(1,values,now);assertThat(result.percent()).isEqualByComparingTo("-100");assertThat(result.difference()).isEqualTo(-Long.MAX_VALUE);
    }
    @Test void firstAndLastVideoCountsRemainCumulativeAndNegativeCorrectionIsPreserved(){
        var values=List.of(new ObservationAnalytics.VideoPoint(1,now.minusSeconds(7200),now.minusSeconds(7190),200),new ObservationAnalytics.VideoPoint(2,now.minusSeconds(600),now.minusSeconds(590),150));
        var result=ObservationAnalytics.video("abcdefghijk",values,now.minusSeconds(86400),now);
        assertThat(result.cumulativeDifference()).isEqualTo(-50);assertThat(result.elapsedSeconds()).isEqualTo(6600);
        assertThat(result.first().views()).isEqualTo(200);assertThat(result.last().views()).isEqualTo(150);
    }
    @Test void oneVideoObservationDoesNotBecomeZeroGrowth(){
        var result=ObservationAnalytics.video("abcdefghijk",List.of(new ObservationAnalytics.VideoPoint(1,now,now,0)),now.minusSeconds(1),now);
        assertThat(result.availability()).isEqualTo("UNAVAILABLE");assertThat(result.cumulativeDifference()).isNull();assertThat(result.last()).isNull();
    }
    @Test void appCompositionCountsAppsOnceAndKeepsUnknownSeparateFromNonGame(){
        var result=ObservationAnalytics.composition(List.of(new ObservationAnalytics.AppType(1,"game"),new ObservationAnalytics.AppType(1,"game"),new ObservationAnalytics.AppType(2,"dlc"),new ObservationAnalytics.AppType(3,null)));
        assertThat(result.total()).isEqualTo(3);assertThat(result.games()).isEqualTo(1);assertThat(result.nonGames()).isEqualTo(1);assertThat(result.unknown()).isEqualTo(1);
        assertThat(ObservationAnalytics.composition(List.of()).gameRatio()).isNull();
    }
    @Test void conflictingSourceTypesAndInvalidMeasurementsAreRejected(){
        assertThatThrownBy(()->ObservationAnalytics.composition(List.of(new ObservationAnalytics.AppType(1,"game"),new ObservationAnalytics.AppType(1,"dlc")))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->ObservationAnalytics.recent(1,List.of(point(1,0,-1)),now)).isInstanceOf(IllegalArgumentException.class);
    }
}
