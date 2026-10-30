package com.youtopia.charts;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import com.youtopia.steam.domain.CcuObservation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class JdbcObservationChartRepository {
    private final JdbcTemplate jdbc;
    public JdbcObservationChartRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Map<Long,List<CcuObservation>> ccu(SortedSet<Long> appIds,int days,Instant now){
        var args=new ArrayList<Object>(appIds);args.add(Timestamp.from(now.minusSeconds(days*86400L)));args.add(Timestamp.from(now));args.add(Timestamp.from(now));
        var groups=new TreeMap<Long,List<CcuObservation>>();
        var rows=jdbc.query("SELECT app_id,observation_id,scheduled_at,observed_at,player_count FROM collector.v_steam_ccu_canonical WHERE app_id IN("+String.join(",",Collections.nCopies(appIds.size(),"?"))+") AND scheduled_at BETWEEN ? AND ? AND observed_at<=? ORDER BY app_id,scheduled_at,observed_at,observation_id LIMIT 100001",(r,n)->{
            Long count=r.getObject(5,Long.class);if(count==null||count<0)throw new DataRetrievalFailureException("Invalid canonical observation");
            Long appId=r.getObject(1,Long.class),observationId=r.getObject(2,Long.class);
            Timestamp slot=r.getTimestamp(3),observed=r.getTimestamp(4);
            if(appId==null||appId<1||appId>4294967295L||observationId==null||observationId<1||slot==null||observed==null)
                throw new DataRetrievalFailureException("Invalid canonical observation identity or timestamp");
            var point=new CcuObservation(observationId,slot.toInstant(),observed.toInstant(),count);return Map.entry(appId,point);
        },args.toArray());if(rows.size()>100000)throw new DataRetrievalFailureException("Chart input exceeds bound");
        rows.forEach(e->groups.computeIfAbsent(e.getKey(),id->new ArrayList<>()).add(e.getValue()));
        return Collections.unmodifiableMap(groups);
    }
    public List<ObservationAnalytics.VideoPoint> video(String videoId,Instant from,Instant now){
        var rows=jdbc.query("SELECT stats_result_id,scheduled_at,artifact_received_at,view_count FROM collector.v_youtube_stats_canonical WHERE video_id=? AND scheduled_at BETWEEN ? AND ? AND artifact_received_at<=? ORDER BY scheduled_at,artifact_received_at,stats_result_id LIMIT 10001",(r,n)->{
            Long id=r.getObject(1,Long.class),views=r.getObject(4,Long.class);Timestamp slot=r.getTimestamp(2),received=r.getTimestamp(3);
            if(id==null||id<1||slot==null||received==null||views==null||views<0)throw new DataRetrievalFailureException("Invalid video observation");
            return new ObservationAnalytics.VideoPoint(id,slot.toInstant(),received.toInstant(),views);
        },videoId,Timestamp.from(from),Timestamp.from(now),Timestamp.from(now));
        if(rows.size()>10000)throw new DataRetrievalFailureException("Video input exceeds bound");
        return List.copyOf(rows);
    }
    public List<ObservationAnalytics.AppType> types(){
        var rows=jdbc.query("SELECT app_id,app_type FROM service.v_tracked_app_types ORDER BY app_id LIMIT 100001",(r,n)->{
            Long id=r.getObject(1,Long.class);if(id==null||id<1||id>4294967295L)throw new DataRetrievalFailureException("Invalid app type identity");
            return new ObservationAnalytics.AppType(id,r.getString(2));});
        if(rows.size()>100000)throw new DataRetrievalFailureException("App population exceeds bound");
        return List.copyOf(rows);
    }
}
