package com.youtopia.reporting;

import java.time.*;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.reporting.enabled:false}")
public class UsageService {
    private final UsageRepository repository;private final String environment;private final int activeWindow;
    public UsageService(UsageRepository repository,@Value("${youtopia.environment:LOCAL}")String environment,@Value("${youtopia.reporting.active-window-seconds:300}")int activeWindow){
        if(activeWindow<1||activeWindow>86400)throw new IllegalArgumentException("Invalid active session window");
        this.repository=repository;this.environment=environment;this.activeWindow=activeWindow;
    }
    public record Usage(LocalDate from,LocalDate to,String aggregationTimezone,String environment,String dataStatus,String signupHistoryCoverage,
        String activeSessionAvailability,Integer activeSessionWindowSeconds,Long activeSessions,Instant activeSessionAsOf,String activeSessionLabel,String newReturningDefinition,
        List<UsageRepository.Visitors> observedVisitors,
        UsageRepository.Windows activeUsers,List<Day> daily,List<UsageRepository.Signup> signups,UsageRepository.SignupWindows signupWindows,
        List<UsageRepository.Route> routes,List<UsageRepository.Game> games,List<UsageRepository.Action> actions,List<Conversion> searchConversion) {}
    public record Day(LocalDate dayKst,long eventCount,long pageViews,long loginUsers,long sessions,long searches,long zeroResultSearches,Double zeroResultRatio,Double eventsPerSession,Double pageViewsPerSession,Instant lastRecordedAt) {}
    public record Conversion(LocalDate dayKst,long searchedContexts,long selectedContexts,Double ratio) {}
    @Transactional(transactionManager="reportTx",readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,timeout=8)
    public Usage get(LocalDate from,LocalDate to){
        if(from.isAfter(to)||java.time.temporal.ChronoUnit.DAYS.between(from,to)>365)throw new IllegalArgumentException("Invalid reporting range");
        var raw=repository.daily(from,to,environment);
        var daily=raw.stream().map(d->new Day(d.dayKst(),d.events(),d.pageViews(),d.loginUsers(),d.sessions(),d.searches(),d.zeroResults(),ratio(d.zeroResults(),d.searches()),ratio(d.events(),d.sessions()),ratio(d.pageViews(),d.sessions()),d.lastRecordedAt())).toList();
        var conversion=repository.searches(from,to,environment).stream().map(d->new Conversion(d.dayKst(),d.contexts(),d.selected(),ratio(d.selected(),d.contexts()))).toList();
        Long active=repository.activeSessions(environment,activeWindow);
        var signups=repository.signups(from,to);
        String state=raw.isEmpty()?(signups.isEmpty()?"EMPTY":"PARTIAL"):"AVAILABLE";
        return new Usage(from,to,"Asia/Seoul",environment,state,"COUNTED_SINCE_INSTALLATION_WITH_RETAINED_ACCOUNT_BACKFILL",active==0?"EMPTY":"AVAILABLE",activeWindow,active,repository.serverTime(),activeWindow==300?"최근 5분 활동 세션":"최근 "+activeWindow+"초 활동 세션","FIRST_OBSERVED_IN_RETAINED_EVENTS",repository.visitors(from,to,environment),repository.windows(environment),daily,signups,repository.signupWindows(),repository.routes(from,to,environment),repository.games(from,to,environment),repository.actions(from,to,environment),conversion);
    }
    private Double ratio(long numerator,long denominator){return denominator==0?null:(double)numerator/denominator;}
}
