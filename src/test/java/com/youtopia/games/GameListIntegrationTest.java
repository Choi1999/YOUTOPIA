package com.youtopia.games;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.integration.IsolatedTestServices;
import java.lang.reflect.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.AbstractDataSource;
import static org.assertj.core.api.Assertions.*;

/** Real owned PostgreSQL; exercises membership, whole-result ordering and query plans. */
class GameListIntegrationTest {
    static final String URL=IsolatedTestServices.url("youtopia_test");
    final Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    final List<String> executed=new ArrayList<>();
    JdbcTemplate jdbc;JdbcGameRepository repository;GameClassifications classifications;
    @BeforeEach void fixtures()throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("TRUNCATE service.game_catalog_fixture,collector.ccu_fixture,service.ranking_chart_fixture");
            s.execute("INSERT INTO service.game_catalog_fixture(app_id,steam_name,developers,steam_tracked) VALUES(1,'Alpha','[]',true),(2,'Beta','[]',false),(3,'Alpha','[]',true),(4,'No data','[]',true),(5,'Historical','[]',true),(6,'Missing classification','[]',true)");
            try(var q=c.prepareStatement("INSERT INTO collector.ccu_fixture(observation_id,app_id,scheduled_at,observed_at,player_count) VALUES(?,?,?,?,?)")){
                long[][] values={{1,1,60,100},{2,2,60,0},{3,3,120,100},{4,5,60*86400,999},{5,1,3600,300}};
                for(var v:values){q.setLong(1,v[0]);q.setLong(2,v[1]);q.setTimestamp(3,Timestamp.from(now.minusSeconds(v[2]+5)));q.setTimestamp(4,Timestamp.from(now.minusSeconds(v[2])));q.setLong(5,v[3]);q.executeUpdate();}
            }
            try(var q=c.prepareStatement("INSERT INTO service.ranking_chart_fixture(ranking_run_id,ranking_source,category_key,period_start,period_end,received_at,app_id,result_position) VALUES(?,?,?, ?,?,?,?,1)")){
                String[][] memberships={{"1","DAILY_MOST_PLAYED",""},{"1","DAILY_MOST_PLAYED",""},{"2","DAILY_MOST_PLAYED",""},{"1","WEEKLY_TOP_SELLERS",""},{"3","WEEKLY_TOP_SELLERS",""},{"1","WEEKLY_TOP_SELLERS","action"}};
                int n=0;for(var m:memberships){q.setInt(1,++n);q.setString(2,m[1]);q.setString(3,m[2].isEmpty()?null:m[2]);q.setTimestamp(4,Timestamp.from(now.minusSeconds(8*86400)));q.setTimestamp(5,Timestamp.from(now.minusSeconds(86400)));q.setTimestamp(6,Timestamp.from(now.minusSeconds(86000)));q.setLong(7,Long.parseLong(m[0]));q.executeUpdate();}
            }
        }
        DataSource source=new AbstractDataSource(){
            public Connection getConnection()throws SQLException{return counting(DriverManager.getConnection(URL,"ytp_test_data_ro",""));}
            public Connection getConnection(String user,String password)throws SQLException{return getConnection();}
        };
        jdbc=new JdbcTemplate(source);jdbc.setQueryTimeout(5);
        repository=new JdbcGameRepository(jdbc,new GameVideoRepository(jdbc));classifications=new GameClassifications(jdbc);
    }
    Connection counting(Connection target){return (Connection)Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{Connection.class},(p,m,a)->{
        Object result=invoke(target,m,a);
        if(result instanceof Statement statement){String prepared=a!=null&&a.length>0&&a[0] instanceof String text?text:null;
            return Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{result instanceof PreparedStatement?PreparedStatement.class:Statement.class},(p2,m2,a2)->{
                if(Set.of("execute","executeQuery","executeUpdate").contains(m2.getName()))executed.add(prepared!=null?prepared:(String)a2[0]);
                return invoke(statement,m2,a2);
            });}
        return result;
    });}
    static Object invoke(Object target,Method method,Object[] args)throws Throwable {try{return method.invoke(target,args);}catch(InvocationTargetException error){throw error.getCause();}}
    GameQuery query(String sort,String direction,int page,int size,String classification){return new GameQuery("",page,size,sort,direction,"ALL","ALL",7,classification);}
    List<Long> ids(GameQuery query){return repository.find(query,now).stream().map(GameRepository.Row::appId).toList();}
    @Test void duplicateAndMultipleMembershipsNeverMultiplyRowsOrCounts(){
        var options=classifications.catalog(now);assertThat(options.state()).isEqualTo("AVAILABLE");assertThat(options.meaning()).contains("공식 게임 장르가 아니며");
        var first=query("name","ASC",0,1,"WEEKLY_TOP_SELLERS|");
        classifications.require(first.classification(),now);assertThat(repository.count(first,now)).isEqualTo(2);assertThat(ids(first)).containsExactly(1L);
        assertThat(ids(query("name","ASC",1,1,"WEEKLY_TOP_SELLERS|"))).containsExactly(3L);
        assertThat(ids(query("name","ASC",0,20,"DAILY_MOST_PLAYED|"))).containsExactly(1L,2L);
        assertThat(ids(query("name","ASC",0,20,"WEEKLY_TOP_SELLERS|action"))).containsExactly(1L);
        assertThat(repository.count(query("name","ASC",0,20,"ALL"),now)).isEqualTo(6);
        assertThat(ids(query("name","ASC",0,20,"ALL"))).contains(6L);
        var combined=new GameQuery("Alpha",0,20,"currentCcu","DESC","STEAM","CONNECTED",30,"WEEKLY_TOP_SELLERS|");
        assertThat(repository.count(combined,now)).isEqualTo(2);assertThat(ids(combined)).containsExactly(1L,3L);
        assertThatThrownBy(()->classifications.require("UNRECOGNIZED|",now)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void numericZeroMissingHistoricalAndEqualValuesHaveStableWholeListOrder(){
        assertThat(ids(query("currentCcu","DESC",0,20,"ALL"))).containsExactly(5L,1L,3L,2L,6L,4L);
        assertThat(ids(query("currentCcu","ASC",0,20,"ALL"))).containsExactly(2L,1L,3L,5L,6L,4L);
        assertThat(ids(query("lastObservedAt","DESC",0,20,"ALL"))).containsExactly(1L,2L,3L,5L,6L,4L);
        assertThat(ids(query("peak24h","DESC",0,20,"ALL"))).containsExactly(1L,3L,2L,5L,6L,4L);
        assertThat(ids(query("name","DESC",0,20,"ALL"))).containsExactly(4L,6L,5L,2L,1L,3L);
        assertThat(ids(query("currentCcu","DESC",1,2,"ALL"))).containsExactly(3L,2L);
        assertThat(ids(query("dataAvailable","ASC",0,20,"ALL"))).containsExactly(1L,2L,3L,5L,6L,4L);
        var zero=repository.find(query("currentCcu","ASC",0,1,"ALL"),now).getFirst();assertThat(zero.currentCcu()).isZero();assertThat(zero.currentAt()).isNotNull();
    }
    @Test void databaseQueryCountDoesNotGrowWithPageSizeAndNamePagingPrecedesObservations(){
        for(int size:new int[]{1,6,100})for(String classification:List.of("ALL","WEEKLY_TOP_SELLERS|")){
            executed.clear();var q=query("name","ASC",0,size,classification);if(!classification.equals("ALL"))classifications.require(classification,now);repository.count(q,now);repository.find(q,now);
            assertThat(executed).hasSize(classification.equals("ALL")?3:5); // optional allowlist2, count, video status, list
            assertThat(executed.getLast()).doesNotContain("array_agg");
        }
    }
    @Test void sourcePrivilegeFailureIsNotAnEmptyClassificationCatalog()throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("REVOKE SELECT ON service.v_weekly_rank_observation FROM ytp_test_data_ro");
            try{assertThat(classifications.catalog(now).state()).isEqualTo("PERMISSION_UNCONFIRMED");assertThatThrownBy(()->classifications.require("DAILY_MOST_PLAYED|",now)).isInstanceOf(com.youtopia.account.AccountProblem.class);assertThat(repository.count(query("name","ASC",0,20,"ALL"),now)).isEqualTo(6);}
            finally{s.execute("GRANT SELECT ON service.v_weekly_rank_observation TO ytp_test_data_ro");}
        }
    }
    @Test void representativeOwnedPostgresPlansAndTimingsAreSavedWithoutProductionLoad()throws Exception {
        try(var c=DriverManager.getConnection(URL,"postgres","");var s=c.createStatement()){
            s.execute("TRUNCATE service.game_catalog_fixture,collector.ccu_fixture,service.ranking_chart_fixture");
            s.execute("INSERT INTO service.game_catalog_fixture(app_id,steam_name,developers,steam_tracked) SELECT i,'Synthetic '||lpad(i::text,4,'0'),'[]',i%2=0 FROM generate_series(1,360) i");
            s.execute("INSERT INTO collector.ccu_fixture(observation_id,app_id,scheduled_at,observed_at,player_count) SELECT (i-1)*400+j,i,now()-j*interval '6 hours',now()-j*interval '6 hours'+interval '1 minute',(i*j)%10000 FROM generate_series(1,360) i CROSS JOIN generate_series(1,400) j");
            s.execute("INSERT INTO service.ranking_chart_fixture(ranking_run_id,ranking_source,category_key,period_start,period_end,received_at,app_id,result_position) SELECT i,'WEEKLY_TOP_SELLERS',null,now()-interval '8 days',now()-interval '1 day',now()-interval '23 hours',i,1 FROM generate_series(1,240) i");
            s.execute("CREATE INDEX IF NOT EXISTS test_ccu_app_time ON collector.ccu_fixture(app_id,observed_at DESC)");
            s.execute("ANALYZE service.game_catalog_fixture");s.execute("ANALYZE collector.ccu_fixture");s.execute("ANALYZE service.ranking_chart_fixture");
        }
        var cases=new ArrayList<Map<String,Object>>();var json=new ObjectMapper();
        for(String sort:List.of("dataAvailable","name","currentCcu","peak24h","lastObservedAt"))for(String classification:List.of("ALL","WEEKLY_TOP_SELLERS|")){
            var q=query(sort,sort.equals("name")||sort.equals("dataAvailable")?"ASC":"DESC",1,20,classification);
            executed.clear();long start=System.nanoTime();if(!classification.equals("ALL"))classifications.require(classification,now);long total=repository.count(q,now);var values=repository.find(q,now);double wallMs=(System.nanoTime()-start)/1_000_000.0;int queryCount=executed.size();
            var sql=repository.listingSql(q,now,null,"PENDING_CONTRACT");
            String plan=jdbc.queryForObject("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+sql.text(),String.class,sql.args().toArray());
            var tree=json.readTree(plan).get(0);assertThat(values).hasSize(20);assertThat(total).isEqualTo(classification.equals("ALL")?360:240);assertThat(queryCount).isEqualTo(classification.equals("ALL")?3:5);
            assertThat(tree.path("Execution Time").asDouble()).isLessThan(5000);
            var countSql=repository.countSql(q,now);var countPlan=json.readTree(jdbc.queryForObject("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+countSql.text(),String.class,countSql.args().toArray())).get(0);
            cases.add(Map.of("sort",sort,"classification",classification,"wall_ms",wallMs,"query_count",queryCount,"list_plan",tree,"count_plan",countPlan));
        }
        Path path=Path.of("build/reports/game-list/isolated-performance.json");Files.createDirectories(path.getParent());
        Files.writeString(path,json.writerWithDefaultPrettyPrinter().writeValueAsString(Map.of("scope","OWNED_SYNTHETIC_POSTGRESQL_ONLY_NOT_PRODUCTION","games",360,"observations",144000,"classification_rows",240,"cases",cases)));
        var examples=new ArrayList<Map<String,Object>>();
        for(String sort:List.of("dataAvailable","name","currentCcu","peak24h","lastObservedAt")){
            var q=query(sort,sort.equals("name")||sort.equals("dataAvailable")?"ASC":"DESC",0,20,"DAILY_MOST_PLAYED|");
            for(var item:Map.of("count",repository.countSql(q,now),"list",repository.listingSql(q,now,null,"PENDING_CONTRACT")).entrySet())
                examples.add(Map.of("sort",sort,"kind",item.getKey(),"sql",item.getValue().text(),"args",item.getValue().args()));
        }
        Files.writeString(path.resolveSibling("sql-examples.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(examples));
    }
}
