package com.youtopia.steam.domain;

import java.time.Instant;

public record CcuObservation(long observationId, Instant scheduledAt, Instant observedAt, long playerCount) {
    public CcuObservation {
        if (observationId <= 0 || scheduledAt == null || observedAt == null || playerCount < 0) {
            throw new IllegalArgumentException("Invalid canonical CCU observation");
        }
    }
}
