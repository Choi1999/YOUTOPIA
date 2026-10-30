package com.youtopia.charts;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class JdbcRankingRepository {
    public record Period(String source,String category,Instant start,Instant end) {}
    private final JdbcTemplate jdbc;
    public JdbcRankingRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<Period> periods(Instant asOf){
        var values=jdbc.query("SELECT DISTINCT ranking_source,category_key,period_start,period_end FROM service.v_weekly_rank_observation WHERE (country_code='KR' OR country_code IS NULL) AND period_end<=? AND received_at<=? ORDER BY period_start DESC,ranking_source,category_key,period_end LIMIT 1001",(r,n)->{
            String source=r.getString(1),category=r.getString(2);
            if(source==null||category==null||!source.matches("[A-Za-z0-9_.:-]{1,80}")||!category.matches("[A-Za-z0-9_.:-]{1,80}"))throw new DataRetrievalFailureException("Invalid source category contract");
            Instant start=timestamp(r.getTimestamp(3)),end=timestamp(r.getTimestamp(4));
            if(!end.isAfter(start))throw new DataRetrievalFailureException("Invalid source period");
            return new Period(source,category,start,end);
        },Timestamp.from(asOf),Timestamp.from(asOf));
        if(values.size()>1000)throw new DataRetrievalFailureException("Ranking period catalog exceeds bound");
        return List.copyOf(values);
    }
    public List<RankingAnalytics.Run> runs(String source,String category,Instant from,Instant to,Instant asOf){
        var runs=new LinkedHashMap<Long,RankingAnalytics.Run>();
        var rows=jdbc.queryForList("SELECT ranking_run_id,country_code,period_start,period_end,received_at,app_id,game_name,result_position FROM service.v_weekly_rank_observation WHERE (country_code='KR' OR country_code IS NULL) AND ranking_source=? AND category_key=? AND period_start BETWEEN ? AND ? AND period_end<=? AND received_at<=? ORDER BY ranking_run_id,result_position LIMIT 50001",source,category,Timestamp.from(from.minusSeconds(604800)),Timestamp.from(to),Timestamp.from(asOf),Timestamp.from(asOf));
        if(rows.size()>50000)throw new DataRetrievalFailureException("Ranking input exceeds bound");
        for(var r:rows){
            long id=positiveNumber(r.get("ranking_run_id"));
            String country=(String)r.get("country_code");
            Instant start=timestamp(r.get("period_start")),end=timestamp(r.get("period_end")),received=timestamp(r.get("received_at"));
            var run=runs.computeIfAbsent(id,key->new RankingAnalytics.Run(id,country,start,end,received,new ArrayList<>()));
            if(!Objects.equals(run.country(),country)||!run.start().equals(start)||!run.end().equals(end)||!run.receivedAt().equals(received))
                throw new DataRetrievalFailureException("Conflicting ranking run metadata");
            if(r.get("app_id")!=null){
                long appId=positiveNumber(r.get("app_id")),position=positiveNumber(r.get("result_position"));
                if(appId>4294967295L||position>Integer.MAX_VALUE)throw new DataRetrievalFailureException("Invalid ranking bounds");
                run.entries().add(new RankingAnalytics.Entry(appId,(String)r.get("game_name"),(int)position));
            }else if(r.get("result_position")!=null)throw new DataRetrievalFailureException("Rank position without app identity");
        }
        return runs.values().stream().map(r->new RankingAnalytics.Run(r.id(),r.country(),r.start(),r.end(),r.receivedAt(),List.copyOf(r.entries()))).toList();
    }
    private static long positiveNumber(Object value){
        if(!(value instanceof Number number)||number.longValue()<1)throw new DataRetrievalFailureException("Invalid ranking identity or position");
        return number.longValue();
    }
    private static Instant timestamp(Object value){
        if(!(value instanceof Timestamp timestamp))throw new DataRetrievalFailureException("Missing ranking timestamp");
        return timestamp.toInstant();
    }
}
