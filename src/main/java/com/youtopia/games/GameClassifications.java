package com.youtopia.games;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import com.youtopia.account.AccountProblem;

/** Completed ranking collection history, never official game genre metadata. */
@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameClassifications {
    public record Option(String id,String label) {}
    public record Catalog(String state,List<Option> options,String meaning) {}
    private final JdbcTemplate jdbc;
    public GameClassifications(JdbcTemplate jdbc){this.jdbc=jdbc;}
    static final String MEANING="완료된 랭킹 수집 이력의 분류입니다. 공식 게임 장르가 아니며, 소속은 누적 이력 기준입니다.";
    public Catalog catalog(Instant asOf){
        String state=jdbc.queryForObject("""
            SELECT CASE WHEN to_regclass('service.v_weekly_rank_observation') IS NULL THEN 'PENDING_CONTRACT'
             WHEN (SELECT count(*)=6 AND bool_and(has_column_privilege(a.attrelid,a.attnum,'SELECT'))
              FROM pg_attribute a WHERE a.attrelid=to_regclass('service.v_weekly_rank_observation')
              AND a.attname IN('app_id','ranking_source','category_key','period_start','period_end','received_at') AND NOT a.attisdropped)
             THEN 'AVAILABLE' ELSE 'PERMISSION_UNCONFIRMED' END
            """,String.class);
        if(!"AVAILABLE".equals(state))return new Catalog(state,List.of(),MEANING);
        var options=jdbc.query("""
            SELECT DISTINCT r.ranking_source,r.category_key FROM service.v_weekly_rank_observation r
             WHERE r.period_end>r.period_start AND r.period_end<=? AND r.received_at<=?
             AND EXISTS(SELECT 1 FROM service.v_game_catalog g WHERE g.app_id=r.app_id)
             ORDER BY r.ranking_source,r.category_key LIMIT 129
            """,(r,n)->{
                String source=r.getString(1),category=r.getString(2);
                if(!code(source)||category!=null&&!code(category))throw new org.springframework.dao.DataRetrievalFailureException("Invalid collection classification");
                String sourceLabel=switch(source){case "DAILY_MOST_PLAYED"->"일간 최다 플레이 수집";case "WEEKLY_TOP_SELLERS"->"주간 판매 순위 수집";default->source;};
                return new Option(source+"|"+(category==null?"":category),category==null?sourceLabel:category+" · "+sourceLabel);
            },Timestamp.from(asOf),Timestamp.from(asOf));
        if(options.size()>128)throw new org.springframework.dao.DataRetrievalFailureException("Classification catalog exceeds bound");
        return new Catalog(options.isEmpty()?"EMPTY":"AVAILABLE",List.copyOf(options),MEANING);
    }
    static boolean code(String value){return value!=null&&value.matches("[A-Za-z0-9_.:-]{1,80}");}
    static String[] parts(String id){
        if(id==null)throw new IllegalArgumentException("Invalid collection classification");
        var values=id.split("\\|",-1);
        if(values.length!=2||!code(values[0])||!values[1].isEmpty()&&!code(values[1]))throw new IllegalArgumentException("Invalid collection classification");
        if(values[1].isEmpty())values[1]=null;
        return values;
    }
    public void require(String id,Instant asOf){
        var catalog=catalog(asOf);
        if(!Set.of("AVAILABLE","EMPTY").contains(catalog.state()))throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"GAME_CLASSIFICATION_UNAVAILABLE","수집 분류 원천을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.");
        if(catalog.options().stream().noneMatch(option->option.id().equals(id)))throw new IllegalArgumentException("Unsupported collection classification");
    }
}
