package com.youtopia.steam;

import com.youtopia.steam.domain.CcuObservation;
import com.youtopia.steam.repository.CcuRepository;
import com.youtopia.steam.service.CcuService;
import com.youtopia.steam.service.CcuRequestBudget;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CcuServiceTest {
    private final Instant now = Instant.parse("2026-10-29T10:00:00Z");
    private final CcuRepository repository = mock(CcuRepository.class);
    private final CcuRequestBudget budget = mock(CcuRequestBudget.class);
    private final CcuService service = new CcuService(repository, Clock.fixed(now, ZoneOffset.UTC), budget);

    @Test
    void preservesRealZeroAndDoesNotInventUnsupportedReviewData() {
        when(repository.findObservations(anyLong(), any(), any())).thenReturn(List.of(
            new CcuObservation(1, now.minusSeconds(7200), now.minusSeconds(7100), 20),
            new CcuObservation(2, now.minusSeconds(3600), now.minusSeconds(3500), 0)));
        var response = service.get(570, 7);
        assertThat(response.latestObservedCcu().value()).isZero();
        assertThat(response.latestObservedCcu().availability()).isEqualTo("AVAILABLE");
        assertThat(response.peak24h().value()).isEqualTo(20);
        assertThat(response.steamReviewAvailability()).isEqualTo("UNAVAILABLE");
        assertThat(response.lastObservedAt()).isEqualTo(now.minusSeconds(3500));
        verify(repository).findObservations(570, now.minusSeconds(7 * 86400), now);
    }

    @Test
    void missingObservationsAreEmptyRatherThanZero() {
        when(repository.findObservations(anyLong(), any(), any())).thenReturn(List.of());
        var response = service.get(570, 30);
        assertThat(response.dataStatus()).isEqualTo("EMPTY");
        assertThat(response.latestObservedCcu().value()).isNull();
        assertThat(response.peak24h().value()).isNull();
        assertThat(response.points()).isEmpty();
    }

    @Test
    void oldActualObservationDoesNotBecomeA24HourPeakOrInventFreshnessThreshold() {
        when(repository.findObservations(anyLong(), any(), any())).thenReturn(List.of(
            new CcuObservation(1, now.minusSeconds(90000), now.minusSeconds(89900), 25)));
        var response = service.get(570, 7);
        assertThat(response.latestObservedCcu().value()).isEqualTo(25);
        assertThat(response.peak24h().availability()).isEqualTo("EMPTY");
        assertThat(response.peak24h().value()).isNull();
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 1, 14, 31, Integer.MAX_VALUE})
    void refusesUnsupportedPeriodsBeforeQuery(int days) {
        assertThatThrownBy(() -> service.get(570, days)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void refusesInvalidAppIdBeforeQuery() {
        assertThatThrownBy(() -> service.get(0, 7)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }

    @ParameterizedTest @ValueSource(longs={-1,4294967296L,Long.MAX_VALUE})
    void refusesOutsideNativeSteamIdBoundsBeforeBudgetOrQuery(long id){
        assertThatThrownBy(()->service.get(id,7)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository,budget);
    }

    @Test void acceptsTheLargestNativeSteamIdWithoutNarrowingIt(){
        when(repository.findObservations(anyLong(),any(),any())).thenReturn(List.of());
        assertThat(service.get(4294967295L,7).appId()).isEqualTo(4294967295L);
        verify(repository).findObservations(eq(4294967295L),any(),any());
    }

    @Test
    void exhaustedOrUnavailableBudgetNeverQueriesPostgres() {
        doThrow(new CcuRequestBudget.BudgetExceededException(20)).when(budget).acquire();
        assertThatThrownBy(() -> service.get(570, 7)).isInstanceOf(CcuRequestBudget.BudgetExceededException.class);
        verifyNoInteractions(repository);
    }
}
