package com.youtopia.games;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Least-privilege adapter contract. Never falls back to RAW or grants privileges. */
@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameVideoRepository {
    static final String VIEW="service.v_game_published_video";
    private final JdbcTemplate jdbc;
    public GameVideoRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public String status(){
        return jdbc.queryForObject("""
            SELECT CASE WHEN to_regclass(?) IS NULL THEN 'PENDING_CONTRACT'
             WHEN (SELECT count(*)=6 AND bool_and(has_column_privilege(a.attrelid,a.attnum,'SELECT'))
               FROM pg_attribute a WHERE a.attrelid=to_regclass(?) AND a.attname IN
               ('app_id','video_id','title','published_at','first_observed_at','last_observed_at') AND NOT a.attisdropped)
             THEN 'AVAILABLE' ELSE 'PERMISSION_UNCONFIRMED' END
            """,String.class,VIEW,VIEW);
    }
    // Repeated queries/search receipts must not multiply videos. As-of excludes future discoveries.
    static String videosSql(){return """
        SELECT DISTINCT ON(app_id,video_id) app_id,video_id,title,published_at,first_observed_at
        FROM service.v_game_published_video WHERE first_observed_at<=?
        ORDER BY app_id,video_id,first_observed_at,published_at NULLS LAST,title COLLATE "C" NULLS LAST
        """;}
    public record Video(String videoId,String title,Instant publishedAt,Instant firstObservedAt) {}
    public List<Video> videos(long appId,Instant now){
        var rows=jdbc.query("SELECT video_id,title,published_at,first_observed_at FROM ("+videosSql()+") v WHERE app_id=? ORDER BY published_at DESC NULLS LAST,video_id COLLATE \"C\" LIMIT 10001",
            (r,n)->{String id=r.getString(1);if(id==null||!id.matches("[A-Za-z0-9_-]{11}"))throw new org.springframework.dao.DataRetrievalFailureException("Invalid video identity");
                Timestamp published=r.getTimestamp(3),first=r.getTimestamp(4);if(first==null)throw new org.springframework.dao.DataRetrievalFailureException("Missing discovery time");
                return new Video(id,r.getString(2),published==null?null:published.toInstant(),first.toInstant());},Timestamp.from(now),appId);
        if(rows.size()>10000)throw new org.springframework.dao.DataRetrievalFailureException("Publication population exceeds query bound");return List.copyOf(rows);
    }
}
