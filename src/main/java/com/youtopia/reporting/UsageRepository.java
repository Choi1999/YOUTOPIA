package com.youtopia.reporting;

import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.reporting.enabled:false}")
public class UsageRepository {
    private final JdbcTemplate jdbc;
    public UsageRepository(@Qualifier("reportJdbc")JdbcTemplate jdbc){this.jdbc=jdbc;}
    public record Daily(LocalDate dayKst,long events,long pageViews,long loginUsers,long sessions,long searches,long zeroResults,Instant lastRecordedAt) {}
    public record Windows(Long dau,Long wau,Long mau,long observedEvents,Instant lastRecordedAt,LocalDate asOfDayKst) {}
    public record Route(LocalDate dayKst,String routeKey,long pageViews,long loginUsers,long sessions) {}
    public record Game(LocalDate dayKst,long appId,long views,long loginUsers,long sessions) {}
    public record Action(LocalDate dayKst,String eventType,String sortKey,String direction,String filterKey,String filterValue,String analysisType,String fromPeriod,String toPeriod,long count) {}
    public record Search(LocalDate dayKst,long contexts,long selected) {}
    public record Signup(LocalDate dayKst,long count) {}
    public record SignupWindows(long today,long last7KstDays,long last30KstDays,LocalDate asOfDayKst) {}
    public record Visitors(LocalDate dayKst,long newlyObserved,long returningObserved) {}
    public List<Visitors> visitors(LocalDate from,LocalDate to,String environment){return jdbc.query("SELECT day_kst,new_observed_users,returning_observed_users FROM telemetry.v_new_returning_daily WHERE environment=? AND day_kst BETWEEN ? AND ? ORDER BY day_kst",(r,n)->new Visitors(r.getObject(1,LocalDate.class),r.getLong(2),r.getLong(3)),environment,from,to);}
    public Instant serverTime(){return jdbc.queryForObject("SELECT current_timestamp",java.sql.Timestamp.class).toInstant();}
    public Long activeSessions(String environment,int seconds){return jdbc.queryForObject("SELECT coalesce(sum(session_count),0)::bigint FROM telemetry.v_session_activity_histogram WHERE environment=? AND last_activity_at>current_timestamp-?*interval '1 second' AND last_activity_at<=current_timestamp",Long.class,environment,seconds);}
    public List<Daily> daily(LocalDate from,LocalDate to,String environment){return jdbc.query("SELECT day_kst,event_count,page_views,login_users,sessions,searches,zero_result_searches,last_recorded_at FROM telemetry.v_usage_daily WHERE environment=? AND day_kst BETWEEN ? AND ? ORDER BY day_kst",(r,n)->new Daily(r.getObject(1,LocalDate.class),r.getLong(2),r.getLong(3),r.getLong(4),r.getLong(5),r.getLong(6),r.getLong(7),r.getTimestamp(8).toInstant()),environment,from,to);}
    public Windows windows(String environment){var rows=jdbc.query("SELECT dau,wau,mau,observed_event_rows,last_recorded_at,(current_timestamp AT TIME ZONE 'Asia/Seoul')::date FROM telemetry.v_usage_windows WHERE environment=?",(r,n)->new Windows(r.getObject(1,Long.class),r.getObject(2,Long.class),r.getObject(3,Long.class),r.getLong(4),r.getTimestamp(5)==null?null:r.getTimestamp(5).toInstant(),r.getObject(6,LocalDate.class)),environment);return rows.isEmpty()?new Windows(null,null,null,0,null,jdbc.queryForObject("SELECT (current_timestamp AT TIME ZONE 'Asia/Seoul')::date",LocalDate.class)):rows.getFirst();}
    public List<Route> routes(LocalDate from,LocalDate to,String environment){return jdbc.query("SELECT day_kst,route_key,page_views,login_users,sessions FROM telemetry.v_route_daily WHERE environment=? AND day_kst BETWEEN ? AND ? ORDER BY day_kst,route_key",(r,n)->new Route(r.getObject(1,LocalDate.class),r.getString(2),r.getLong(3),r.getLong(4),r.getLong(5)),environment,from,to);}
    public List<Game> games(LocalDate from,LocalDate to,String environment){return bounded(jdbc.query("SELECT day_kst,app_id,game_views,login_users,sessions FROM telemetry.v_game_daily WHERE environment=? AND day_kst BETWEEN ? AND ? ORDER BY day_kst,game_views DESC,app_id LIMIT 1001",(r,n)->new Game(r.getObject(1,LocalDate.class),r.getLong(2),r.getLong(3),r.getLong(4),r.getLong(5)),environment,from,to),1000);}
    public List<Action> actions(LocalDate from,LocalDate to,String environment){return bounded(jdbc.query("SELECT day_kst,event_type,sort_key,filter_key,filter_value_code,analysis_type,from_period,to_period,event_count,sort_direction FROM telemetry.v_action_daily WHERE environment=? AND day_kst BETWEEN ? AND ? ORDER BY day_kst,event_type,sort_key NULLS FIRST,sort_direction NULLS FIRST,filter_key NULLS FIRST,filter_value_code NULLS FIRST,analysis_type NULLS FIRST,from_period NULLS FIRST,to_period NULLS FIRST LIMIT 10001",(r,n)->new Action(r.getObject(1,LocalDate.class),r.getString(2),r.getString(3),r.getString(10),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getString(8),r.getLong(9)),environment,from,to),10000);}
    public List<Search> searches(LocalDate from,LocalDate to,String environment){return jdbc.query("SELECT day_kst,sum(searched_contexts)::bigint,coalesce(sum(selected_contexts) FILTER(WHERE selected_day_kst<=?),0)::bigint FROM telemetry.v_search_conversion_daily WHERE environment=? AND day_kst BETWEEN ? AND ? GROUP BY day_kst ORDER BY day_kst",(r,n)->new Search(r.getObject(1,LocalDate.class),r.getLong(2),r.getLong(3)),to,environment,from,to);}
    public List<Signup> signups(LocalDate from,LocalDate to){return jdbc.query("SELECT day_kst,signups FROM auth.v_signup_daily WHERE day_kst BETWEEN ? AND ? ORDER BY day_kst",(r,n)->new Signup(r.getObject(1,LocalDate.class),r.getLong(2)),from,to);}
    public SignupWindows signupWindows(){return jdbc.queryForObject("WITH bounds AS(SELECT (current_timestamp AT TIME ZONE 'Asia/Seoul')::date AS today) SELECT coalesce(sum(signups) FILTER(WHERE day_kst=b.today),0)::bigint,coalesce(sum(signups) FILTER(WHERE day_kst>=b.today-6 AND day_kst<=b.today),0)::bigint,coalesce(sum(signups) FILTER(WHERE day_kst>=b.today-29 AND day_kst<=b.today),0)::bigint,b.today FROM bounds b LEFT JOIN auth.v_signup_daily ON day_kst BETWEEN b.today-29 AND b.today GROUP BY b.today",(r,n)->new SignupWindows(r.getLong(1),r.getLong(2),r.getLong(3),r.getObject(4,LocalDate.class)));}
    private <T> List<T> bounded(List<T> rows,int maximum){if(rows.size()>maximum)throw new org.springframework.dao.DataRetrievalFailureException("Report exceeds supported result bound");return List.copyOf(rows);}

}
