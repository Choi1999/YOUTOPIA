package com.youtopia.steam.repository;

import com.youtopia.steam.domain.CcuObservation;
import java.time.Instant;
import java.util.List;

public interface CcuRepository {
    List<CcuObservation> findObservations(long appId, Instant from, Instant to);
}
