package com.youtopia.integration;

import com.youtopia.account.AccountPasswordEncoders;
import java.sql.*;
import java.time.Instant;

/** Explicit disposable browser fixtures; hardcoded loopback test DBs, never production bindings. */
public final class BrowserFixtureCommand {
    public static void main(String[] args)throws Exception {
        try(var connection=DriverManager.getConnection(IsolatedTestServices.url("youtopia_auth_test")+"?connectTimeout=5","postgres","");var query=connection.prepareStatement("INSERT INTO auth.admin_account(admin_login_name,password_hash) VALUES('browser_operator',?) ON CONFLICT(admin_login_name) DO UPDATE SET password_hash=excluded.password_hash")){
            query.setString(1,AccountPasswordEncoders.create().encode("synthetic browser operator password 1234"));query.executeUpdate();
        }
        Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS),first=now.minusSeconds(28*86400L);
        try(var connection=DriverManager.getConnection(IsolatedTestServices.url("youtopia_test")+"?connectTimeout=5","postgres","");var query=connection.createStatement()){
            connection.setAutoCommit(false);
            query.execute("TRUNCATE service.game_catalog_fixture,collector.ccu_fixture,collector.video_chart_fixture,service.app_type_fixture,service.ranking_chart_fixture,service.video_association_fixture");
            query.execute("INSERT INTO service.game_catalog_fixture(app_id,steam_name,developers,steam_tracked) VALUES(570,'Browser Arena','[\"Synthetic Studio\"]',true),(730,'Browser Counter','[]',true),(900,'Browser Indie',null,false)");
            query.execute("INSERT INTO service.app_type_fixture VALUES(570,'game'),(730,'game'),(900,null)");
            try(var insert=connection.prepareStatement("INSERT INTO collector.ccu_fixture(observation_id,app_id,scheduled_at,observed_at,player_count) VALUES(?,?,?,?,?)")){
                for(int i=0;i<4;i++){insert.setLong(1,i+1);insert.setLong(2,570);insert.setTimestamp(3,Timestamp.from(now.minusSeconds((3-i)*86400L+60)));insert.setTimestamp(4,Timestamp.from(now.minusSeconds((3-i)*86400L+50)));insert.setLong(5,i==3?0:100+i*10);insert.executeUpdate();}
            }
            try(var insert=connection.prepareStatement("INSERT INTO collector.video_chart_fixture VALUES(?,?,?,?,?)")){
                for(int i=0;i<3;i++){insert.setLong(1,i+1);insert.setString(2,"abcdefghijk");insert.setTimestamp(3,Timestamp.from(now.minusSeconds((3-i)*3600L)));insert.setTimestamp(4,Timestamp.from(now.minusSeconds((3-i)*3600L-5)));insert.setLong(5,1000+i*100);insert.executeUpdate();}
            }
            try(var insert=connection.prepareStatement("INSERT INTO service.ranking_chart_fixture VALUES(?,?,?,?,?,?,?,?,?,?)")){
                for(int week=0;week<3;week++)for(int country=0;country<2;country++)for(int game=0;game<3;game++){
                    insert.setLong(1,week*2+country+1);insert.setString(2,"weekly_browser");if(country==0)insert.setString(3,"KR");else insert.setNull(3,Types.VARCHAR);insert.setString(4,"sales");insert.setTimestamp(5,Timestamp.from(first.plusSeconds(week*604800L)));insert.setTimestamp(6,Timestamp.from(first.plusSeconds((week+1)*604800L)));insert.setTimestamp(7,Timestamp.from(first.plusSeconds((week+1)*604800L+60)));insert.setLong(8,new long[]{570,730,900}[game]);insert.setString(9,new String[]{"Browser Arena","Browser Counter","Browser Indie"}[game]);insert.setInt(10,game==0?10-week+country:game==1?20+week+country:30+week+country);insert.executeUpdate();
                }
            }
            query.execute("INSERT INTO service.ranking_chart_fixture SELECT ranking_run_id+100,'weekly_uncategorized',country_code,null,period_start,period_end,received_at,app_id,game_name,result_position FROM service.ranking_chart_fixture WHERE ranking_source='weekly_browser'");
            connection.commit();
        }
        System.out.println("Synthetic browser fixtures prepared in loopback test databases only.");
    }
}
