package com.youtopia.steam.repository;

import com.youtopia.steam.domain.CcuObservation;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.dao.DataRetrievalFailureException;

@Repository
public class JdbcCcuRepository implements CcuRepository {
    private final JdbcTemplate jdbc;

    public JdbcCcuRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.jdbc.setQueryTimeout(5);
    }

    @Override
    public List<CcuObservation> findObservations(long appId, Instant from, Instant to) {
        // Only the approved canonical view. Parameters never select SQL identifiers.
        // Repeated observations of a slot resolve deterministically to the latest receipt.
        var points = jdbc.query("""
            SELECT observation_id, scheduled_at, observed_at, player_count
              FROM (
                SELECT DISTINCT ON (scheduled_at) observation_id, scheduled_at, observed_at, player_count
                  FROM collector.v_steam_ccu_canonical
                 WHERE app_id = ? AND scheduled_at >= ? AND scheduled_at <= ? AND observed_at <= ?
                 ORDER BY scheduled_at, observed_at DESC, observation_id DESC
              ) canonical
             ORDER BY scheduled_at, observation_id
             LIMIT 10001
            """, (rs, row) -> {
                long players = rs.getLong("player_count");
                if (rs.wasNull() || players < 0) {
                    throw new DataRetrievalFailureException("Invalid canonical observation");
                }
                var scheduled = rs.getTimestamp("scheduled_at");
                var observed = rs.getTimestamp("observed_at");
                long id = rs.getLong("observation_id");
                if (rs.wasNull() || id <= 0 || scheduled == null || observed == null) {
                    throw new DataRetrievalFailureException("Invalid canonical observation identity or time");
                }
                return new CcuObservation(id, scheduled.toInstant(), observed.toInstant(), players);
            }, appId, Timestamp.from(from), Timestamp.from(to), Timestamp.from(to));
        if (points.size() > 10000) {
            throw new DataRetrievalFailureException("Canonical series exceeds the supported point limit");
        }
        return List.copyOf(points);
    }
}
