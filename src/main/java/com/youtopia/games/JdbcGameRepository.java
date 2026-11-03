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
    private String predicate(GameQuery q,List<Object> args,Instant now){
        var s=new StringBuilder(" WHERE true");
        if(!q.q().isEmpty()){s.append(" AND g.steam_name ILIKE ? ESCAPE '\\'");args.add("%"+q.q().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");}
        if(q.connectionStatus().equals("UNKNOWN"))s.append(" AND g.steam_tracked IS NULL");
        else if(!q.connectionStatus().equals("ALL")){s.append(" AND g.steam_tracked=?");args.add(q.connectionStatus().equals("CONNECTED"));}
        if(!q.classification().equals("ALL")){
            var parts=GameClassifications.parts(q.classification());
            s.append(" AND EXISTS(SELECT 1 FROM service.v_weekly_rank_observation r WHERE r.app_id=g.app_id AND r.ranking_source=? AND r.category_key IS NOT DISTINCT FROM ? AND r.period_end>r.period_start AND r.period_end<=? AND r.received_at<=?)");
            args.add(parts[0]);args.add(parts[1]);args.add(Timestamp.from(now));args.add(Timestamp.from(now));
        }
        return s.toString();
    }
    public long count(GameQuery q){return count(q,Instant.now());}
    public long count(GameQuery q,Instant now){var sql=countSql(q,now);return jdbc.queryForObject(sql.text(),Long.class,sql.args().toArray());}
    record Sql(String text,List<Object> args) {}
    Sql countSql(GameQuery q,Instant now){var args=new ArrayList<Object>();String sql="SELECT count(*) FROM service.v_game_catalog g"+predicate(q,args,now);return new Sql(sql,Collections.unmodifiableList(args));}
    // Package-visible for real PostgreSQL plan/timing verification. Never exposed by HTTP.
    Sql listingSql(GameQuery q,Instant now,Long id,String videoStatus){
        boolean available=videoStatus.equals("AVAILABLE");var args=new ArrayList<Object>();
        String filter=predicate(q,args,now);if(id!=null){filter+=" AND g.app_id=?";args.add(id);}
        boolean namePage=q.sort().equals("name");
        if(namePage){filter+=" ORDER BY g.steam_name COLLATE \"C\" "+q.direction()+",g.app_id ASC LIMIT ? OFFSET ?";args.add(q.size());args.add((long)q.page()*q.size());}
        Instant from=now.minusSeconds(q.days()*86400L),day=now.minusSeconds(86400);
        Instant videoFrom=now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate().minusDays(q.days()-1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        args.add(Timestamp.from(now));args.add(Timestamp.from(now));
        args.add(Timestamp.from(from));args.add(Timestamp.from(day));
        args.add(Timestamp.from(from));args.add(Timestamp.from(from));args.add(Timestamp.from(day));
        String videoCte="SELECT NULL::bigint app_id,NULL::bigint period_count,NULL::timestamptz period_last,NULL::bigint history_count,NULL::timestamptz history_last WHERE false";
        if(available){videoCte="SELECT v.app_id,count(*) FILTER(WHERE published_at>=?) period_count,max(published_at) FILTER(WHERE published_at>=?) period_last,count(*) history_count,max(published_at) history_last FROM ("+GameVideoRepository.videosSql()+") v JOIN catalog g USING(app_id) WHERE published_at<=? GROUP BY v.app_id";
            args.add(Timestamp.from(videoFrom));args.add(Timestamp.from(videoFrom));args.add(Timestamp.from(now));args.add(Timestamp.from(now));}
        String sql="""
            WITH catalog AS MATERIALIZED (SELECT g.app_id,g.steam_name,g.developers,g.release_at,g.source_language,g.metadata_observed_at,g.steam_tracked FROM service.v_game_catalog g %s),
            observations AS MATERIALIZED (SELECT c.app_id,c.observation_id,c.player_count,c.scheduled_at,c.observed_at
             FROM catalog g CROSS JOIN LATERAL (SELECT c.app_id,c.observation_id,c.player_count,c.scheduled_at,c.observed_at
              FROM collector.v_steam_ccu_canonical c WHERE c.app_id=g.app_id AND c.scheduled_at<=? AND c.observed_at<=? OFFSET 0) c),
            latest AS (SELECT DISTINCT ON(app_id) app_id,player_count current_ccu,observed_at current_at FROM observations ORDER BY app_id,observed_at DESC,observation_id DESC),
            recent AS MATERIALIZED (SELECT * FROM observations WHERE scheduled_at>=? OR observed_at>=?),
            steam AS (SELECT app_id,count(*) FILTER(WHERE scheduled_at>=?) period_count,max(observed_at) FILTER(WHERE scheduled_at>=?) period_last FROM recent GROUP BY app_id),
            peak AS (SELECT DISTINCT ON(app_id) app_id,player_count peak24h,observed_at peak_at FROM recent WHERE observed_at>=? ORDER BY app_id,player_count DESC,observed_at DESC,observation_id DESC),
            youtube AS (%s), enriched AS (
             SELECT g.app_id,g.steam_name,g.developers::text,g.release_at,g.source_language,g.metadata_observed_at,g.steam_tracked,
              l.current_ccu,l.current_at,p.peak24h,p.peak_at,coalesce(s.period_count,0) steam_period_count,s.period_last,
              %s youtube_period_count,y.period_last youtube_period_last,%s youtube_history_count,y.history_last youtube_history_last,
              CASE WHEN s.period_count>0 AND y.period_count>0 THEN 1 WHEN s.period_count>0 OR y.period_count>0 THEN 2
               WHEN l.current_at IS NOT NULL OR y.history_last IS NOT NULL THEN 3 ELSE 4 END evidence_group,
              CASE WHEN s.period_count>0 OR y.period_count>0 THEN greatest(s.period_last,y.period_last) ELSE greatest(l.current_at,y.history_last) END evidence_at
             FROM catalog g LEFT JOIN latest l USING(app_id) LEFT JOIN steam s USING(app_id) LEFT JOIN peak p USING(app_id) LEFT JOIN youtube y USING(app_id)) SELECT * FROM enriched
            """.formatted(filter,videoCte,available?"coalesce(y.period_count,0)":"NULL::bigint",available?"coalesce(y.history_count,0)":"NULL::bigint");
        String key=switch(q.sort()){case "name"->"steam_name COLLATE \"C\" "+q.direction();case "currentCcu"->"current_ccu "+q.direction()+" NULLS LAST";case "peak24h"->"peak24h "+q.direction()+" NULLS LAST";case "lastObservedAt"->"current_at "+q.direction()+" NULLS LAST";case "dataAvailable"->"evidence_group ASC,evidence_at DESC NULLS LAST";default->throw new IllegalArgumentException();};
        sql+=" ORDER BY "+key+",steam_name COLLATE \"C\" ASC,app_id ASC";
        if(!namePage){sql+=" LIMIT ? OFFSET ?";args.add(q.size());args.add((long)q.page()*q.size());}
        return new Sql(sql,Collections.unmodifiableList(args));
    }
    private List<Row> query(GameQuery q,Instant now,Long id){String status=videos.status();var sql=listingSql(q,now,id,status);return jdbc.query(sql.text(),(r,n)->row(r,status),sql.args().toArray());}
    public List<Row> find(GameQuery q,Instant now){return query(q,now,null);}
    public Row detail(long id,Instant now){var rows=query(new GameQuery("",0,1,"name","ASC","ALL","ALL"),now,id);return rows.isEmpty()?null:rows.getFirst();}
    private Row row(ResultSet r,String status)throws SQLException {
        long id=r.getLong(1);String name=r.getString(2);Long current=r.getObject(8,Long.class),peak=r.getObject(10,Long.class);
        if(id<1||id>4294967295L||name==null||name.isBlank()||current!=null&&current<0||peak!=null&&peak<0)throw new org.springframework.dao.DataRetrievalFailureException("Invalid game source data");
        return new Row(id,name,r.getString(3),instant(r,4),r.getString(5),instant(r,6),r.getObject(7,Boolean.class),current,instant(r,9),peak,instant(r,11),r.getLong(12),instant(r,13),r.getObject(14,Long.class),instant(r,15),r.getObject(16,Long.class),instant(r,17),status);
    }
    private Instant instant(ResultSet r,int column)throws SQLException {Timestamp t=r.getTimestamp(column);return t==null?null:t.toInstant();}
}
