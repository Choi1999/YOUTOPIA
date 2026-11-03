package com.youtopia.games;

import java.time.Instant;
import java.util.List;

public interface GameRepository {
    record Row(long appId,String name,String developersJson,Instant releaseAt,String language,Instant metadataAt,Boolean steamTracked,Long currentCcu,Instant currentAt,Long peak24h,Instant peakAt,
        long steamPeriodCount,Instant steamPeriodLast,Long youtubePeriodCount,Instant youtubePeriodLast,Long youtubeHistoryCount,Instant youtubeHistoryLast,String youtubeStatus) {
        public Row(long id,String name,String developers,Instant release,String language,Instant metadata,Boolean tracked,Long current,Instant at,Long peak,Instant peakAt){
            this(id,name,developers,release,language,metadata,tracked,current,at,peak,peakAt,0,null,null,null,null,null,"PENDING_CONTRACT");
        }
    }
    long count(GameQuery query);
    default long count(GameQuery query,Instant asOf){return count(query);}
    List<Row> find(GameQuery query,Instant asOf);
    Row detail(long appId,Instant asOf);
}
