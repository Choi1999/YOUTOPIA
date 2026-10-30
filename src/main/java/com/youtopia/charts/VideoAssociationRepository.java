package com.youtopia.charts;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnExpression("${youtopia.games.enabled:false} && ${youtopia.games.video-associations-enabled:false}")
public class VideoAssociationRepository {
    public record Eligibility(long appId,String videoId,long validSlots) {}
    private final JdbcTemplate jdbc;
    public VideoAssociationRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<Eligibility> eligibility(SortedSet<Long> ids,Instant from,Instant now){
        var args=new ArrayList<Object>(ids);args.add(Timestamp.from(now));args.add(Timestamp.from(from));args.add(Timestamp.from(now));args.add(Timestamp.from(now));
        var values=jdbc.query("WITH links AS(SELECT DISTINCT app_id,video_id FROM service.v_game_video_association WHERE app_id IN("+String.join(",",Collections.nCopies(ids.size(),"?"))+") AND first_observed_at<=?) SELECT l.app_id,l.video_id,count(DISTINCT s.scheduled_at) FILTER(WHERE s.view_count IS NOT NULL AND s.view_count>=0) AS valid_slots FROM links l LEFT JOIN collector.v_youtube_stats_canonical s ON s.video_id=l.video_id AND s.scheduled_at BETWEEN ? AND ? AND s.artifact_received_at<=? GROUP BY l.app_id,l.video_id ORDER BY l.app_id,l.video_id LIMIT 50001",(r,n)->new Eligibility(r.getLong(1),r.getString(2),r.getLong(3)),args.toArray());
        if(values.size()>50000)throw new DataRetrievalFailureException("Association population exceeds bound");return List.copyOf(values);
    }
}
