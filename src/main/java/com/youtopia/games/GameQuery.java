package com.youtopia.games;

import com.youtopia.api.PageResult;
import java.util.Set;

public record GameQuery(String q, int page, int size, String sort, String direction, String platform, String connectionStatus, int days) {
    public GameQuery(String q,int page,int size,String sort,String direction,String platform,String connectionStatus){this(q,page,size,sort,direction,platform,connectionStatus,30);}
    public GameQuery {
        PageResult.validate(page,size);
        q=q==null?"":q.strip();
        if(q.codePointCount(0,q.length())>100||q.codePoints().anyMatch(Character::isISOControl))throw new IllegalArgumentException("Invalid search");
        if(!Set.of("dataAvailable","name","currentCcu","peak24h","lastObservedAt").contains(sort)||!Set.of("ASC","DESC").contains(direction)
            ||!Set.of("ALL","STEAM").contains(platform)||!Set.of("ALL","CONNECTED","UNAVAILABLE","UNKNOWN").contains(connectionStatus))throw new IllegalArgumentException("Unsupported game query");
        if(days!=7&&days!=30)throw new IllegalArgumentException("Unsupported observation period");
    }
    public static long appId(String gameId){
        if(gameId==null||!gameId.matches("steam:[1-9][0-9]{0,9}"))throw new IllegalArgumentException("Invalid game identifier");
        long id=Long.parseLong(gameId.substring(6));if(id>4294967295L)throw new IllegalArgumentException("Invalid Steam identifier");return id;
    }
}
