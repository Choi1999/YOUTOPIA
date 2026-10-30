package com.youtopia.steam.service;

import com.youtopia.steam.api.CcuResponse;
import com.youtopia.steam.api.CcuResponse.Metric;
import com.youtopia.steam.domain.CcuObservation;
import com.youtopia.steam.repository.CcuRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.Comparator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CcuService {
    private final CcuRepository repository;
    private final Clock clock;
    private final CcuRequestBudget budget;

    public CcuService(CcuRepository repository, Clock clock, CcuRequestBudget budget) {
        this.repository = repository;
        this.clock = clock;
        this.budget = budget;
    }

    @Transactional(readOnly = true, timeout = 8)
    public CcuResponse get(long appId, int days) {
        if (appId <= 0 || (days != 7 && days != 30)) {
            throw new IllegalArgumentException("Only positive Steam app IDs and 7/30 days are supported");
        }
        budget.acquire();
        var to = clock.instant();
        var from = to.minus(Duration.ofDays(days));
        var observations = repository.findObservations(appId, from, to);
        var byTime = Comparator.comparing(CcuObservation::observedAt).thenComparingLong(CcuObservation::observationId);
        var latest = observations.stream().max(byTime);
        var peak = observations.stream().filter(p -> !p.observedAt().isBefore(to.minus(Duration.ofHours(24))))
            .max(Comparator.comparingLong(CcuObservation::playerCount).thenComparing(byTime));
        return new CcuResponse(appId, days, from, to, observations.isEmpty() ? "EMPTY" : "AVAILABLE", "UNASSESSED",
            latest.map(CcuObservation::observedAt).orElse(null), metric(latest.orElse(null)), metric(peak.orElse(null)),
            "UNAVAILABLE", observations.stream().map(p ->
                new CcuResponse.Point(p.scheduledAt(), p.observedAt(), p.playerCount())).toList());
    }

    private Metric metric(CcuObservation point) {
        return point == null ? new Metric("EMPTY", null, null)
            : new Metric("AVAILABLE", point.playerCount(), point.observedAt());
    }
}
