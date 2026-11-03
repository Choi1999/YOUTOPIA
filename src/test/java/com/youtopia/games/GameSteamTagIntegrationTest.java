package com.youtopia.games;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;

/** Owned PostgreSQL only. Never copies user-provided production rows into fixtures. */
class GameSteamTagIntegrationTest {
    final GameListIntegrationTest fixture=new GameListIntegrationTest();
    static final String URL=GameListIntegrationTest.URL;
    final Instant now=fixture.now;
    final List<String> executed=fixture.executed;
    org.springframework.jdbc.core.JdbcTemplate jdbc;
    JdbcGameRepository repository;GameClassifications classifications;GameSteamTags tags;
    List<Long> ids(GameQuery q){return fixture.ids(q);}
    GameQuery query(String sort,String direction,int page,int size,String classification){return fixture.query(sort,direction,page,size,classification);}
    @BeforeEach void tagFixtures()throws Exception {
        fixture.fixtures();jdbc=fixture.jdbc;repository=fixture.repository;classifications=fixture.classifications;tags=new GameSteamTags(jdbc);
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("TRUNCATE collector.steam_tag_fixture,collector.steam_app_tag_fixture");
            s.execute("INSERT INTO collector.steam_tag_fixture(tag_id,display_name,last_seen_at,is_active) VALUES(701,'스포츠',now()-interval '40 days',true),(599,'시뮬레이션',now()-interval '40 days',true),(122,'RPG',now()-interval '40 days',false),(999,'Outside catalog',now(),true)");
            s.execute("INSERT INTO collector.steam_app_tag_fixture(app_id,tag_id,last_seen_at,is_active) VALUES(1,701,now()-interval '40 days',true),(1,701,now()-interval '40 days',true),(2,701,now()-interval '40 days',true),(1,599,now()-interval '40 days',true),(3,701,now(),false),(3,122,now(),true),(99999,999,now(),true)");
        }
    }
    GameQuery tagged(String sort,String direction,int page,int size,String classification,String tagId){return new GameQuery("",page,size,sort,direction,"ALL","ALL",7,classification,tagId);}
    @Test void existingOldActiveTagsCombineWithClassificationWithoutDuplicates(){
        var catalog=tags.catalog();assertThat(catalog.state()).isEqualTo("AVAILABLE");assertThat(catalog.options()).extracting(GameSteamTags.Option::label).containsExactly("스포츠","시뮬레이션");
        var sports=catalog.options().getFirst();assertThat(sports.tagId()).isEqualTo("701");assertThat(sports.gameCount()).isEqualTo(2);assertThat(sports.lastSeenAt()).isBefore(now.minusSeconds(30*86400L));
        assertThat(catalog.meaning()).contains("활성 상태는 최근 수집 성공을 뜻하지 않습니다");
        tags.require("701");tags.require("599");
        assertThat(ids(tagged("currentCcu","ASC",0,20,"ALL","701"))).containsExactly(2L,1L);
        assertThat(repository.count(tagged("name","ASC",0,1,"ALL","701"),now)).isEqualTo(2);
        assertThat(ids(tagged("name","ASC",1,1,"ALL","701"))).containsExactly(2L);
        assertThat(ids(tagged("currentCcu","DESC",0,20,"WEEKLY_TOP_SELLERS|","701"))).containsExactly(1L);
        assertThat(ids(new GameQuery("Alpha",0,20,"name","ASC","STEAM","CONNECTED",30,"ALL","701"))).containsExactly(1L);
        assertThat(ids(tagged("name","ASC",0,20,"ALL","599"))).containsExactly(1L);
        assertThat(ids(tagged("name","ASC",0,20,"ALL","ALL"))).contains(3L,4L,6L);
        assertThatThrownBy(()->tags.require("122")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->tags.require("999")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void columnOnlyPrivilegeIsSufficientAndRawTablesRemainUnavailable()throws Exception {
        assertThat(jdbc.queryForObject("SELECT has_table_privilege(current_user,'service.v_game_steam_tag','SELECT')",Boolean.class)).isFalse();
        assertThat(tags.catalog().state()).isEqualTo("AVAILABLE");
        assertThatThrownBy(()->jdbc.queryForObject("SELECT count(*) FROM collector.steam_app_tag_fixture",Long.class)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("REVOKE SELECT(app_id,tag_id,display_name,source_language,link_last_seen_at,tag_last_seen_at) ON service.v_game_steam_tag FROM ytp_test_data_ro");
            try{assertThat(tags.catalog().state()).isEqualTo("PERMISSION_UNCONFIRMED");assertThatThrownBy(()->tags.require("701")).isInstanceOf(com.youtopia.account.AccountProblem.class);assertThat(repository.count(query("name","ASC",0,20,"ALL"),now)).isEqualTo(6);}
            finally{s.execute("GRANT SELECT(app_id,tag_id,display_name,source_language,link_last_seen_at,tag_last_seen_at) ON service.v_game_steam_tag TO ytp_test_data_ro");}
            s.execute("ALTER VIEW service.v_game_steam_tag RENAME TO unbound_test_tags");
            try{assertThat(tags.catalog().state()).isEqualTo("PENDING_CONTRACT");assertThatThrownBy(()->tags.require("701")).isInstanceOf(com.youtopia.account.AccountProblem.class);}
            finally{s.execute("ALTER VIEW service.unbound_test_tags RENAME TO v_game_steam_tag");}
        }
    }
    @Test void successfulEmptySourceIsDistinctAndQueryCountsStayBounded()throws Exception {
        for(int size:new int[]{1,6,100})for(String classification:List.of("ALL","WEEKLY_TOP_SELLERS|")){
            executed.clear();var q=tagged("name","ASC",0,size,classification,"701");if(!classification.equals("ALL"))classifications.require(classification,now);tags.require("701");repository.count(q,now);repository.find(q,now);
            assertThat(executed).hasSize(classification.equals("ALL")?5:7);assertThat(executed.getLast()).doesNotContain("array_agg");assertThat(repository.countSql(q,now).text()).doesNotContain("ccu","observations");
        }
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){s.execute("TRUNCATE collector.steam_app_tag_fixture");}
        assertThat(tags.catalog().state()).isEqualTo("EMPTY");
    }
    @Test void tagAndCollectionPlansAndTimingsUseOnlyOwnedSyntheticData()throws Exception {
        fixture.prepareRepresentativeFixtures();
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("TRUNCATE collector.steam_app_tag_fixture");
            s.execute("INSERT INTO collector.steam_app_tag_fixture SELECT i,701,now()-interval '40 days',true FROM generate_series(1,360) i WHERE i%2=0");
            s.execute("INSERT INTO collector.steam_tag_fixture(tag_id,display_name,last_seen_at) SELECT 10000+j,'Synthetic tag '||j,now()-interval '40 days' FROM generate_series(1,10) j");
            s.execute("INSERT INTO collector.steam_app_tag_fixture SELECT i,10000+j,now()-interval '40 days',true FROM generate_series(1,360) i CROSS JOIN generate_series(1,10) j");
            s.execute("ANALYZE collector.steam_app_tag_fixture");
            s.execute("ANALYZE collector.steam_tag_fixture");
        }
        var json=new ObjectMapper();var cases=new ArrayList<Map<String,Object>>();var examples=new ArrayList<Map<String,Object>>();
        for(String sort:List.of("dataAvailable","name","currentCcu","peak24h","lastObservedAt"))for(String classification:List.of("ALL","WEEKLY_TOP_SELLERS|"))for(String tagId:List.of("ALL","701")){
            var q=tagged(sort,sort.equals("name")||sort.equals("dataAvailable")?"ASC":"DESC",1,20,classification,tagId);
            executed.clear();long start=System.nanoTime();if(!classification.equals("ALL"))classifications.require(classification,now);if(!tagId.equals("ALL"))tags.require(tagId);long total=repository.count(q,now);var rows=repository.find(q,now);double wall=(System.nanoTime()-start)/1e6;int queries=executed.size();
            assertThat(queries).isEqualTo(3+(classification.equals("ALL")?0:2)+(tagId.equals("ALL")?0:2));assertThat(rows).hasSize(20);assertThat(total).isEqualTo((classification.equals("ALL")?360:240)/(tagId.equals("ALL")?1:2));
            var list=repository.listingSql(q,now,null,"PENDING_CONTRACT");var count=repository.countSql(q,now);
            var listPlan=json.readTree(jdbc.queryForObject("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+list.text(),String.class,list.args().toArray())).get(0);
            var countPlan=json.readTree(jdbc.queryForObject("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+count.text(),String.class,count.args().toArray())).get(0);
            assertThat(listPlan.path("Execution Time").asDouble()).isLessThan(5000);
            cases.add(Map.of("sort",sort,"classification",classification,"tagId",tagId,"wall_ms",wall,"query_count",queries,"list_plan",listPlan,"count_plan",countPlan));
            examples.add(Map.of("sort",sort,"classification",classification,"tagId",tagId,"list_sql",list.text(),"list_args",list.args(),"count_sql",count.text(),"count_args",count.args()));
        }
        Path folder=Path.of("build/reports/steam-tags");Files.createDirectories(folder);
        Files.writeString(folder.resolve("isolated-performance.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(Map.of("scope","OWNED_SYNTHETIC_POSTGRESQL_NOT_PRODUCTION","games",360,"observations",144000,"tag_links",3780,"selected_tag_links",180,"cases",cases)));
        Files.writeString(folder.resolve("sql-examples.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(examples));
    }
}
