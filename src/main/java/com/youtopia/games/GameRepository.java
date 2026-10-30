package com.youtopia.games;

import java.time.Instant;
import java.util.List;

public interface GameRepository {
    record Row(long appId,String name,String developersJson,Instant releaseAt,String language,Instant metadataAt,boolean steamTracked,Long currentCcu,Instant currentAt,Long peak24h,Instant peakAt) {}
    long count(GameQuery query);
    List<Row> find(GameQuery query,Instant asOf);
    Row detail(long appId,Instant asOf);
}
