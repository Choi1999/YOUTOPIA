package com.youtopia.telemetry;

import com.fasterxml.jackson.databind.*;
import com.youtopia.account.AccountProblem;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
public class EventCatalog {
    public record Validated(String type,String action,SortedMap<String,Object> values,SortedMap<String,String> columns) {}
    private final ObjectMapper mapper;
    private static final Map<String,String> ACTIONS=Map.of("PAGE_VIEW","route.view","GAME_VIEW","game.detail.view","SEARCH_EXECUTED","games.search.execute","SORT_CHANGED","games.sort.change","FILTER_CHANGED","games.filter.change","ANALYSIS_VIEW","analysis.view","PERIOD_CHANGED","analysis.period.change","KEYWORD_SELECTED","keyword.select","EVENT_VIEW","game_event.view");
    private static final Map<String,String> COLUMNS=Map.ofEntries(Map.entry("routeKey","route_key"),Map.entry("appId","app_id"),Map.entry("source","source_code"),Map.entry("searchContextId","search_context_id"),Map.entry("resultPosition","result_position"),Map.entry("totalResultCount","total_result_count"),Map.entry("sortKey","sort_key"),Map.entry("filterKeys","filter_keys"),Map.entry("direction","sort_direction"),Map.entry("filterKey","filter_key"),Map.entry("filterValue","filter_value_code"),Map.entry("analysisType","analysis_type"),Map.entry("fromPeriod","from_period"),Map.entry("toPeriod","to_period"),Map.entry("keywordId","keyword_id"),Map.entry("eventId","game_event_key"));
    public EventCatalog(ObjectMapper mapper){this.mapper=mapper;}
    public Validated validate(ProductEvent event){
        String action=ACTIONS.get(event.eventType());
        if(action==null||!action.equals(event.actionKey())||!event.properties().isObject()||event.properties().size()>16)throw invalid();
        Set<String> required=switch(event.eventType()) {
            case "PAGE_VIEW"->Set.of("routeKey");case "GAME_VIEW"->Set.of("appId","source");case "SEARCH_EXECUTED"->Set.of("totalResultCount");
            case "SORT_CHANGED"->Set.of("sortKey","direction");case "FILTER_CHANGED"->Set.of("filterKey","filterValue");case "ANALYSIS_VIEW"->Set.of("appId","analysisType");
            case "PERIOD_CHANGED"->Set.of("toPeriod");case "KEYWORD_SELECTED"->Set.of("keywordId");case "EVENT_VIEW"->Set.of("eventId");default->throw invalid();
        };
        Set<String> optional=switch(event.eventType()) {
            case "PAGE_VIEW"->Set.of("appId");case "GAME_VIEW"->Set.of("searchContextId","resultPosition");
            case "SEARCH_EXECUTED"->Set.of("searchContextId","filterKeys","sortKey");case "PERIOD_CHANGED"->Set.of("fromPeriod");
            case "KEYWORD_SELECTED","EVENT_VIEW"->Set.of("appId");default->Set.of();
        };
        var keys=new HashSet<String>();event.properties().fieldNames().forEachRemaining(keys::add);
        if(!keys.containsAll(required)||keys.stream().anyMatch(k->!required.contains(k)&&!optional.contains(k)))throw invalid();
        var values=new TreeMap<String,Object>();var columns=new TreeMap<String,String>();
        for(String key:keys){values.put(key,value(key,event.properties().get(key)));columns.put(key,COLUMNS.get(key));}
        if("GAME_VIEW".equals(event.eventType())&&"SEARCH_RESULT".equals(values.get("source"))&&(!keys.contains("searchContextId")||!keys.contains("resultPosition")))throw invalid();
        if("FILTER_CHANGED".equals(event.eventType())){
            var accepted="platform".equals(values.get("filterKey"))?Set.of("ALL","STEAM","YOUTUBE"):Set.of("ALL","CONNECTED","UNAVAILABLE");
            if(!accepted.contains(values.get("filterValue")))throw invalid();
        }
        if(!"SEARCH_EXECUTED".equals(event.eventType())&&event.searchReceipt()!=null)throw invalid();
        return new Validated(event.eventType(),action,values,columns);
    }
    private Object value(String key,JsonNode value){
        if(value==null||value.isNull())throw invalid();
        if(key.equals("appId")){if(!value.isIntegralNumber()||!value.canConvertToLong()||value.asLong()<=0)throw invalid();return value.asLong();}
        if(key.equals("totalResultCount")||key.equals("resultPosition")){if(!value.isIntegralNumber()||!value.canConvertToInt()||value.asInt()<(key.equals("resultPosition")?1:0))throw invalid();return value.asInt();}
        if(key.equals("searchContextId")){if(!value.isTextual())throw invalid();try{return UUID.fromString(value.textValue());}catch(IllegalArgumentException e){throw invalid();}}
        if(key.equals("filterKeys")){
            if(!value.isArray()||value.size()>16)throw invalid();var set=new TreeSet<String>();
            for(JsonNode v:value){if(!v.isTextual()||!Set.of("platform","connectionStatus").contains(v.textValue())||!set.add(v.textValue()))throw invalid();}return List.copyOf(set);
        }
        if(!value.isTextual())throw invalid();String text=value.textValue();
        Set<String> allowed=switch(key){
            case "routeKey"->Set.of("dashboard","game.list","game.detail","analysis.steam","analysis.youtube","analysis.reaction","analysis.keyword","analysis.event","settings");
            case "source"->Set.of("DIRECT","DASHBOARD","GAME_LIST","SEARCH_RESULT");
            case "sortKey"->Set.of("name","currentCcu","peak24h","lastObservedAt");
            case "direction"->Set.of("ASC","DESC");case "filterKey"->Set.of("platform","connectionStatus");
            case "filterValue"->Set.of("ALL","STEAM","YOUTUBE","CONNECTED","UNAVAILABLE");
            case "analysisType"->Set.of("STEAM","YOUTUBE","REACTION","KEYWORD","EVENT");
            case "fromPeriod","toPeriod"->Set.of("7d","30d");
            // Source identifiers cannot be accepted until the actual source catalog is approved/connected.
            case "keywordId","eventId"->Set.of();default->throw invalid();
        };
        if(!allowed.contains(text))throw invalid();return text;
    }
    public byte[] canonical(Validated value){try{return mapper.writeValueAsBytes(List.of(value.type(),value.action(),value.values()));}catch(Exception e){throw new IllegalStateException("Event encoding unavailable");}}
    private AccountProblem invalid(){return new AccountProblem(HttpStatus.BAD_REQUEST,"INVALID_PRODUCT_EVENT","Only supported event fields and codes are accepted.");}
}
