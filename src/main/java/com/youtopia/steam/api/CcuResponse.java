package com.youtopia.steam.api;

import java.time.Instant;
import java.util.List;

public record CcuResponse(long appId, int days, Instant from, Instant to, String dataStatus,
                          String freshnessStatus,
                          Instant lastObservedAt, Metric latestObservedCcu, Metric peak24h,
                          String steamReviewAvailability, List<Point> points) {
    public record Metric(String availability, Long value, Instant observedAt) {}
    public record Point(Instant scheduledAt, Instant observedAt, long playerCount) {}
}
