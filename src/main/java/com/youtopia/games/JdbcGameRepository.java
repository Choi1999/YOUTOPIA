package com.youtopia.games;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class JdbcGameRepository implements GameRepository {
    private final JdbcTemplate jdbc;
    public JdbcGameRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private static final String METRICS="""
        LEFT JOIN LATERAL (SELECT player_count AS current_ccu,observed_at AS current_at
          FROM collector.v_steam_ccu_canonical c WHERE c.app_id=g.app_id AND c.scheduled_at<=? AND c.observed_at<=?
          ORDER BY observed_at DESC,observation_id DESC LIMIT 1) latest ON true
        LEFT JOIN LATERAL (SELECT player_count AS peak24h,observed_at AS peak_at
          FROM collector.v_steam_ccu_canonical c WHERE c.app_id=g.app_id AND c.scheduled_at<=? AND c.observed_at BETWEEN ? AND ?
          ORDER BY player_count DESC,observed_at DESC,observation_id DESC LIMIT 1) peak ON true
        """;
    private static final String COLUMNS="g.app_id,g.steam_name,g.developers::text,g.release_at,g.source_language,g.metadata_observed_at,g.steam_tracked,latest.current_ccu,latest.current_at,peak.peak24h,peak.peak_at";
    private String predicate(GameQuery q,List<Object> args){
        var s=new StringBuilder(" WHERE true");
        if(!q.q().isEmpty()){s.append(" AND g.steam_name ILIKE ? ESCAPE '\\'");args.add("%"+q.q().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");}
        if(!q.connectionStatus().equals("ALL")){s.append(" AND g.steam_tracked=?");args.add(q.connectionStatus().equals("CONNECTED"));}
        return s.toString();
    }
    private List<Object> times(Instant now){return new ArrayList<>(List.of(Timestamp.from(now),Timestamp.from(now),Timestamp.from(now),Timestamp.from(now.minusSeconds(86400)),Timestamp.from(now)));}
    public long count(GameQuery q){var args=new ArrayList<Object>();return jdbc.queryForObject("SELECT count(*) FROM service.v_game_catalog g"+predicate(q,args),Long.class,args.toArray());}
    public List<Row> find(GameQuery q,Instant now){
        var args=times(now);String where=predicate(q,args);
        String key=switch(q.sort()){case "name"->"g.steam_name COLLATE \"C\"";case "currentCcu"->"latest.current_ccu";case "peak24h"->"peak.peak24h";case "lastObservedAt"->"latest.current_at";default->throw new IllegalArgumentException();};
        args.add(q.size());args.add((long)q.page()*q.size());
        return jdbc.query("SELECT "+COLUMNS+" FROM service.v_game_catalog g "+METRICS+where+" ORDER BY "+key+" "+q.direction()+" NULLS LAST,g.app_id ASC LIMIT ? OFFSET ?",(r,n)->row(r),args.toArray());
    }
    public Row detail(long id,Instant now){var args=times(now);args.add(id);var rows=jdbc.query("SELECT "+COLUMNS+" FROM service.v_game_catalog g "+METRICS+" WHERE g.app_id=?",(r,n)->row(r),args.toArray());return rows.isEmpty()?null:rows.getFirst();}
    private Row row(ResultSet r)throws SQLException {
        long id=r.getLong(1);String name=r.getString(2);
        if(id<1||id>4294967295L||name==null||name.isBlank())throw new org.springframework.dao.DataRetrievalFailureException("Invalid game source identity");
        Long current=r.getObject(8,Long.class),peak=r.getObject(10,Long.class);
        if(current!=null&&current<0||peak!=null&&peak<0)throw new org.springframework.dao.DataRetrievalFailureException("Invalid observed metric");
        return new Row(id,name,r.getString(3),instant(r,4),r.getString(5),instant(r,6),r.getBoolean(7),current,instant(r,9),peak,instant(r,11));
    }
    private Instant instant(ResultSet r,int column)throws SQLException {Timestamp t=r.getTimestamp(column);return t==null?null:t.toInstant();}
}
