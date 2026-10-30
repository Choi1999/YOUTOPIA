package com.youtopia.games;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.telemetry.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

/** Explicit search execution issues an optional analytics proof only after a real successful query. */
@RestController @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameSearchController {
    public record Search(@NotBlank String q,@NotNull UUID clientEventId,Integer page,Integer size,String sort,String direction,String platform,String connectionStatus) {}
    public record Tracking(String availability,UUID clientEventId,UUID searchContextId,Map<String,Object> properties,String receipt) {}
    public record Result(java.util.List<GameService.Game> content,com.youtopia.api.PageResult.Page page,java.time.Instant asOf,String catalogScope,String dataStatus,String freshness,Tracking searchTracking) {}
    private final GameService service;private final ObjectProvider<SearchReceipt> receipts;private final ObjectProvider<EventCatalog> catalogs;private final ObjectProvider<ProductEventService> events;private final ObjectMapper json;
    public GameSearchController(GameService service,ObjectProvider<SearchReceipt> receipts,ObjectProvider<EventCatalog> catalogs,ObjectProvider<ProductEventService> events,ObjectMapper json){this.service=service;this.receipts=receipts;this.catalogs=catalogs;this.events=events;this.json=json;}
    @PostMapping("/api/v1/games/search")
    Result search(@Valid @RequestBody Search body,HttpServletRequest request,HttpServletResponse response){
        com.youtopia.api.QueryParameters.only(request);response.setHeader("Cache-Control","no-store");
        var query=new GameQuery(body.q(),body.page()==null?0:body.page(),body.size()==null?20:body.size(),body.sort()==null?"name":body.sort(),body.direction()==null?"ASC":body.direction(),body.platform()==null?"ALL":body.platform(),body.connectionStatus()==null?"ALL":body.connectionStatus());
        var result=service.list(query);Tracking tracking=new Tracking("UNAVAILABLE",body.clientEventId(),null,null,null);
        if(receipts.getIfAvailable()!=null&&catalogs.getIfAvailable()!=null&&events.getIfAvailable()!=null&&result.page().totalElements()<=Integer.MAX_VALUE)try{
            var keys=new ArrayList<String>();if(!query.platform().equals("ALL"))keys.add("platform");if(!query.connectionStatus().equals("ALL"))keys.add("connectionStatus");
            UUID context=UUID.randomUUID();Map<String,Object> properties=Map.of("totalResultCount",(int)result.page().totalElements(),"searchContextId",context.toString(),"filterKeys",List.copyOf(keys),"sortKey",query.sort());
            var event=new ProductEvent(body.clientEventId(),"SEARCH_EXECUTED","games.search.execute",json.valueToTree(properties),null);
            String receipt=receipts.getObject().issue(events.getObject().analyticsSession(request),body.clientEventId(),catalogs.getObject().validate(event));
            tracking=new Tracking("AVAILABLE",body.clientEventId(),context,properties,receipt);
        }catch(RuntimeException ignored){ /* Optional telemetry never changes a completed core search into failure. */ }
        return new Result(result.content(),result.page(),result.asOf(),result.catalogScope(),result.dataStatus(),result.freshness(),tracking);
    }
}
