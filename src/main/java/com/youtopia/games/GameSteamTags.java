package com.youtopia.games;

import com.youtopia.account.AccountProblem;
import java.time.Instant;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Existing active Steam tag metadata through a catalog-scoped, read-only projection. */
@Repository @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameSteamTags {
    public record Option(String tagId,String label,String sourceLanguage,long gameCount,Instant lastSeenAt,Instant tagLastSeenAt) {}
    public record Catalog(String state,List<Option> options,String meaning) {}
    static final String MEANING="활성으로 저장된 Steam 태그 연결입니다. 태그 전체가 공식 장르는 아니며, 활성 상태는 최근 수집 성공을 뜻하지 않습니다. 관측 기간과 별도로 적용합니다.";
    private final JdbcTemplate jdbc;
    public GameSteamTags(JdbcTemplate jdbc){this.jdbc=jdbc;}
    static long id(String value){
        if(value==null||!value.matches("[1-9][0-9]{0,9}"))throw new IllegalArgumentException("Invalid Steam tag identifier");
        long id=Long.parseLong(value);if(id>4294967295L)throw new IllegalArgumentException("Invalid Steam tag identifier");return id;
    }
    private String state(){
        return jdbc.queryForObject("""
            SELECT CASE WHEN to_regclass('service.v_game_steam_tag') IS NULL THEN 'PENDING_CONTRACT'
             WHEN (SELECT count(*)=6 AND bool_and(has_column_privilege(a.attrelid,a.attnum,'SELECT'))
              FROM pg_attribute a WHERE a.attrelid=to_regclass('service.v_game_steam_tag')
              AND a.attname IN('app_id','tag_id','display_name','source_language','link_last_seen_at','tag_last_seen_at') AND NOT a.attisdropped)
             THEN 'AVAILABLE' ELSE 'PERMISSION_UNCONFIRMED' END
            """,String.class);
    }
    public Catalog catalog(){
        String state=state();if(!state.equals("AVAILABLE"))return new Catalog(state,List.of(),MEANING);
        var options=jdbc.query("""
            SELECT t.tag_id,t.display_name,t.source_language,count(DISTINCT t.app_id) game_count,
             max(t.link_last_seen_at) link_last_seen_at,max(t.tag_last_seen_at) tag_last_seen_at
             FROM service.v_game_steam_tag t WHERE EXISTS(SELECT 1 FROM service.v_game_catalog g WHERE g.app_id=t.app_id)
             GROUP BY t.tag_id,t.display_name,t.source_language ORDER BY t.display_name COLLATE "C",t.tag_id LIMIT 2049
            """,(r,n)->{
                String tagId=r.getString("tag_id"),label=r.getString("display_name"),language=r.getString("source_language");id(tagId);
                if(label==null||label.isBlank()||label.codePointCount(0,label.length())>512||language==null||language.isBlank()||language.length()>32||r.getTimestamp("link_last_seen_at")==null||r.getTimestamp("tag_last_seen_at")==null)
                    throw new org.springframework.dao.DataRetrievalFailureException("Invalid Steam tag metadata");
                return new Option(tagId,label,language,r.getLong("game_count"),r.getTimestamp("link_last_seen_at").toInstant(),r.getTimestamp("tag_last_seen_at").toInstant());
            });
        if(options.size()>2048||options.stream().map(Option::tagId).distinct().count()!=options.size())throw new org.springframework.dao.DataRetrievalFailureException("Steam tag catalog exceeds contract");
        return new Catalog(options.isEmpty()?"EMPTY":"AVAILABLE",List.copyOf(options),MEANING);
    }
    public void require(String tagId){
        long id=id(tagId);
        if(!state().equals("AVAILABLE"))throw new AccountProblem(HttpStatus.SERVICE_UNAVAILABLE,"STEAM_TAG_UNAVAILABLE","Steam 태그 원천·권한을 확인할 수 없습니다.");
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM service.v_game_steam_tag t WHERE t.tag_id=? AND EXISTS(SELECT 1 FROM service.v_game_catalog g WHERE g.app_id=t.app_id))",Boolean.class,id)))
            throw new IllegalArgumentException("Unsupported Steam tag identifier");
    }
}
