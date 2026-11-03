package com.youtopia.games;

import com.youtopia.api.QueryParameters;
import jakarta.servlet.http.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

@RestController @ConditionalOnProperty(name="youtopia.games.enabled",havingValue="true")
public class GameController {
    private final GameService service;
    public GameController(GameService service){this.service=service;}
    @GetMapping("/api/v1/games")
    GameService.Listing list(@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,
        @RequestParam(defaultValue="dataAvailable")String sort,@RequestParam(defaultValue="ASC")String direction,@RequestParam(defaultValue="ALL")String platform,
        @RequestParam(defaultValue="ALL")String connectionStatus,@RequestParam(defaultValue="30")int days,@RequestParam(defaultValue="ALL")String classification,@RequestParam(defaultValue="ALL")String tagId,HttpServletRequest request,HttpServletResponse response){
        QueryParameters.only(request,"q","page","size","sort","direction","platform","connectionStatus","days","classification","tagId");response.setHeader("Cache-Control","no-store");
        return service.list(new GameQuery(q,page,size,sort,direction,platform,connectionStatus,days,classification,tagId));
    }
    @GetMapping("/api/v1/games/classifications")
    GameClassifications.Catalog classifications(HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.classifications();}
    @GetMapping("/api/v1/games/steam-tags")
    GameSteamTags.Catalog steamTags(HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.steamTags();}
    @GetMapping("/api/v1/games/{gameId}")
    GameService.Detail detail(@PathVariable String gameId,HttpServletRequest request,HttpServletResponse response){QueryParameters.only(request);response.setHeader("Cache-Control","no-store");return service.detail(gameId);}
}
