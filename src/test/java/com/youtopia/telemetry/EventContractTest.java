package com.youtopia.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.account.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class EventContractTest {
    private final ObjectMapper json=new ObjectMapper();private final EventCatalog catalog=new EventCatalog(json);
    private ProductEvent event(String type,String action,Map<String,Object> fields){return new ProductEvent(UUID.randomUUID(),type,action,json.valueToTree(fields),null);}
    @Test void validatesTypedPropertiesForSupportedEventsAndRejectsPiiAndArbitraryCodes(){
        for(var event:List.of(event("PAGE_VIEW","route.view",Map.of("routeKey","game.list")),event("GAME_VIEW","game.detail.view",Map.of("appId",570,"source","DIRECT")),event("SORT_CHANGED","games.sort.change",Map.of("sortKey","currentCcu","direction","DESC")),event("FILTER_CHANGED","games.filter.change",Map.of("filterKey","platform","filterValue","STEAM")),event("ANALYSIS_VIEW","analysis.view",Map.of("appId",570,"analysisType","STEAM")),event("PERIOD_CHANGED","analysis.period.change",Map.of("fromPeriod","7d","toPeriod","30d"))))
            assertThat(catalog.validate(event).values()).isNotEmpty();
        assertThatThrownBy(()->catalog.validate(event("PAGE_VIEW","route.view",Map.of("routeKey","game.list","userId",UUID.randomUUID())))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->catalog.validate(event("FILTER_CHANGED","games.filter.change",Map.of("filterKey","platform","filterValue","CONNECTED")))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->catalog.validate(event("PERIOD_CHANGED","analysis.period.change",Map.of("toPeriod","90d")))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->catalog.validate(event("GAME_VIEW","game.detail.view",Map.of("appId",570,"source","SEARCH_RESULT")))).isInstanceOf(AccountProblem.class);
    }
    @Test void successfulSearchReceiptBindsSessionEventAndResultAndExpires(){
        var source=event("SEARCH_EXECUTED","games.search.execute",Map.of("totalResultCount",2,"searchContextId",UUID.randomUUID().toString()));var value=catalog.validate(source);
        var key=new AccountSecrets(Base64.getEncoder().encodeToString(new byte[32]));Instant now=Instant.parse("2026-10-29T00:00:00Z");
        var receipts=new SearchReceipt(key,Clock.fixed(now,ZoneOffset.UTC),catalog);UUID session=UUID.randomUUID();String receipt=receipts.issue(session,source.clientEventId(),value);
        receipts.verify(session,source.clientEventId(),value,receipt);
        assertThatThrownBy(()->receipts.verify(UUID.randomUUID(),source.clientEventId(),value,receipt)).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->receipts.verify(session,UUID.randomUUID(),value,receipt)).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->receipts.verify(session,source.clientEventId(),value,"forged")).isInstanceOf(AccountProblem.class);
        var expired=new SearchReceipt(key,Clock.fixed(now.plusSeconds(300),ZoneOffset.UTC),catalog);
        assertThatThrownBy(()->expired.verify(session,source.clientEventId(),value,receipt)).isInstanceOf(AccountProblem.class);
    }
    @Test void unsupportedKeywordAndEventSourcesCannotAcceptInventedIdentifiers(){
        assertThatThrownBy(()->catalog.validate(event("KEYWORD_SELECTED","keyword.select",Map.of("keywordId","madeUp")))).isInstanceOf(AccountProblem.class);
        assertThatThrownBy(()->catalog.validate(event("EVENT_VIEW","game_event.view",Map.of("eventId","madeUp")))).isInstanceOf(AccountProblem.class);
    }
}
