package com.youtopia.games;

import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class JdbcGameRepository implements GameRepository {
    private final JdbcTemplate jdbc;private final GameVideoRepository videos;
    public JdbcGameRepository(JdbcTemplate jdbc,GameVideoRepository videos){this.jdbc=jdbc;this.videos=videos;}
    private String predicate(GameQuery q,List<Object> args){
        var s=new StringBuilder(" WHERE true");
        if(!q.q().isEmpty()){s.append(" AND g.steam_name ILIKE ? ESCAPE '\\'");args.add("%"+q.q().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");}
        if(q.connectionStatus().equals("UNKNOWN"))s.append(" AND g.steam_tracked IS NULL");
        else if(!q.connectionStatus().equals("ALL")){s.append(" AND g.steam_tracked=?");args.add(q.connectionStatus().equals("CONNECTED"));}
        return s.toString();
    }
    public long count(GameQuery q){var args=new ArrayList<Object>();return jdbc.queryForObject("SELECT count(*) FROM service.v_game_catalog g"+predicate(q,args),Long.class,args.toArray());}
    private List<Row> query(GameQuery q,Instant now,Long id){
        String videoStatus=videos.status();boolean available=videoStatus.equals("AVAILABLE");var args=new ArrayList<Object>();
        String filter=predicate(q,args);if(id!=null){filter+=" AND g.app_id=?";args.add(id);}
        Instant from=now.minusSeconds(q.days()*86400L);
        // CCU period is scheduled time, matching the CCU chart. YouTube uses inclusive KST calendar dates.
        Instant videoFrom=now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate().minusDays(q.days()-1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        args.add(Timestamp.from(from));args.add(Timestamp.from(from));args.add(Timestamp.from(now.minusSeconds(86400)));args.add(Timestamp.from(now.minusSeconds(86400)));
        args.add(Timestamp.from(now));args.add(Timestamp.from(now));
        String videoCte="SELECT NULL::bigint app_id,NULL::bigint period_count,NULL::timestamptz period_last,NULL::bigint history_count,NULL::timestamptz history_last WHERE false";
        if(available){videoCte="SELECT v.app_id,count(*) FILTER(WHERE published_at>=?) period_count,max(published_at) FILTER(WHERE published_at>=?) period_last,count(*) history_count,max(published_at) history_last FROM ("+GameVideoRepository.videosSql()+") v JOIN catalog g USING(app_id) WHERE published_at<=? GROUP BY v.app_id";
            args.add(Timestamp.from(videoFrom));args.add(Timestamp.from(videoFrom));args.add(Timestamp.from(now));args.add(Timestamp.from(now));}
        String sql="""
            WITH catalog AS MATERIALIZED (SELECT g.* FROM service.v_game_catalog g %s),
            steam AS (SELECT c.app_id,(array_agg(player_count ORDER BY observed_at DESC,observation_id DESC))[1] current_ccu,
             max(observed_at) current_at,count(*) FILTER(WHERE scheduled_at>=?) period_count,
             max(observed_at) FILTER(WHERE scheduled_at>=?) period_last,
             (array_agg(player_count ORDER BY player_count DESC,observed_at DESC,observation_id DESC) FILTER(WHERE observed_at>=?))[1] peak24h,
             (array_agg(observed_at ORDER BY player_count DESC,observed_at DESC,observation_id DESC) FILTER(WHERE observed_at>=?))[1] peak_at
             FROM collector.v_steam_ccu_canonical c JOIN catalog g USING(app_id) WHERE scheduled_at<=? AND observed_at<=? GROUP BY c.app_id),
            youtube AS (%s), enriched AS (
             SELECT g.app_id,g.steam_name,g.developers::text,g.release_at,g.source_language,g.metadata_observed_at,g.steam_tracked,
              s.current_ccu,s.current_at,s.peak24h,s.peak_at,coalesce(s.period_count,0) steam_period_count,s.period_last,
              %s youtube_period_count,y.period_last youtube_period_last,%s youtube_history_count,y.history_last youtube_history_last,
              CASE WHEN s.period_count>0 AND y.period_count>0 THEN 1 WHEN s.period_count>0 OR y.period_count>0 THEN 2
               WHEN s.current_at IS NOT NULL OR y.history_last IS NOT NULL THEN 3 ELSE 4 END evidence_group,
              CASE WHEN s.period_count>0 OR y.period_count>0 THEN greatest(s.period_last,y.period_last) ELSE greatest(s.current_at,y.history_last) END evidence_at
             FROM catalog g LEFT JOIN steam s USING(app_id) LEFT JOIN youtube y USING(app_id)) SELECT * FROM enriched
            """.formatted(filter,videoCte,available?"coalesce(y.period_count,0)":"NULL::bigint",available?"coalesce(y.history_count,0)":"NULL::bigint");
        String key=switch(q.sort()){case "name"->"steam_name COLLATE \"C\"";case "currentCcu"->"current_ccu";case "peak24h"->"peak24h";case "lastObservedAt"->"current_at";case "dataAvailable"->"evidence_group ASC,evidence_at DESC NULLS LAST,steam_name COLLATE \"C\"";default->throw new IllegalArgumentException();};
        sql+=" ORDER BY "+key+(q.sort().equals("dataAvailable")?" ASC": " "+q.direction())+" NULLS LAST,app_id ASC LIMIT ? OFFSET ?";args.add(q.size());args.add((long)q.page()*q.size());
        return jdbc.query(sql,(r,n)->row(r,videoStatus),args.toArray());
    }
    public List<Row> find(GameQuery q,Instant now){return query(q,now,null);}
    public Row detail(long id,Instant now){var rows=query(new GameQuery("",0,1,"name","ASC","ALL","ALL"),now,id);return rows.isEmpty()?null:rows.getFirst();}
    private Row row(ResultSet r,String status)throws SQLException {
        long id=r.getLong(1);String name=r.getString(2);Long current=r.getObject(8,Long.class),peak=r.getObject(10,Long.class);
        if(id<1||id>4294967295L||name==null||name.isBlank()||current!=null&&current<0||peak!=null&&peak<0)throw new org.springframework.dao.DataRetrievalFailureException("Invalid game source data");
        return new Row(id,name,r.getString(3),instant(r,4),r.getString(5),instant(r,6),r.getObject(7,Boolean.class),current,instant(r,9),peak,instant(r,11),r.getLong(12),instant(r,13),r.getObject(14,Long.class),instant(r,15),r.getObject(16,Long.class),instant(r,17),status);
    }
    private Instant instant(ResultSet r,int column)throws SQLException {Timestamp t=r.getTimestamp(column);return t==null?null:t.toInstant();}
}
