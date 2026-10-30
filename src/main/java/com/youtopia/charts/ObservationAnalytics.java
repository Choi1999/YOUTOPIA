package com.youtopia.charts;

import com.youtopia.steam.domain.CcuObservation;
import java.math.*;
import java.time.*;
import java.util.*;

/** Calculations use observed points only; no interpolation, estimated freshness or inferred video relevance. */
public final class ObservationAnalytics {
    private ObservationAnalytics() {}
    public record Change(long appId,String availability,String reason,Instant previousSlot,Instant currentSlot,Long previous,Long current,Long difference,BigDecimal percent,Long elapsedSeconds) {}
    public record DirectionCounts(int requested,int comparable,int up,int down,int same,int excluded,List<Change> comparisons) {}
    public record VideoPoint(long id,Instant slot,Instant receivedAt,long views) {}
    public record VideoComparison(String videoId,String availability,String reason,VideoPoint first,VideoPoint last,Long elapsedSeconds,Long cumulativeDifference) {}
    public record AppType(long appId,String appType) {}
    public record Composition(long total,long games,long nonGames,long unknown,BigDecimal gameRatio,BigDecimal nonGameRatio,BigDecimal unknownRatio) {}
    public static Change recent(long appId,List<CcuObservation> values,Instant asOf){
        var points=canonical(values,asOf);if(points.size()<2)return missing(appId,"INSUFFICIENT_OBSERVATIONS");
        return change(appId,points.get(points.size()-2),points.getLast());
    }
    public static DirectionCounts exact24Hours(SortedSet<Long> appIds,Map<Long,List<CcuObservation>> data,Instant asOf){
        var comparisons=new ArrayList<Change>();int up=0,down=0,same=0,excluded=0;
        for(long id:appIds){var points=canonical(data.getOrDefault(id,List.of()),asOf);Change comparison;
            if(points.isEmpty())comparison=missing(id,"NO_OBSERVATION");else{
                var last=points.getLast();var previous=points.stream().filter(p->p.scheduledAt().equals(last.scheduledAt().minusSeconds(86400))).findFirst();
                comparison=previous.isEmpty()?missing(id,"EXACT_24H_SLOT_MISSING"):change(id,previous.get(),last);
            }
            comparisons.add(comparison);
            // Direction is valid with a zero baseline; only the percentage is unavailable then.
            if(comparison.difference()==null)excluded++;else if(comparison.difference()>0)up++;else if(comparison.difference()<0)down++;else same++;
        }
        return new DirectionCounts(appIds.size(),appIds.size()-excluded,up,down,same,excluded,List.copyOf(comparisons));
    }
    public static VideoComparison video(String id,List<VideoPoint> values,Instant from,Instant to){
        var slots=new TreeMap<Instant,VideoPoint>();
        for(var p:values){if(p.id()<=0||p.slot()==null||p.receivedAt()==null||p.views()<0)throw new IllegalArgumentException("Invalid canonical video observation");
            if(p.slot().isBefore(from)||p.slot().isAfter(to)||p.receivedAt().isAfter(to))continue;
            slots.merge(p.slot(),p,(a,b)->Comparator.comparing(VideoPoint::receivedAt).thenComparingLong(VideoPoint::id).compare(a,b)>=0?a:b);
        }
        if(slots.size()<2)return new VideoComparison(id,"UNAVAILABLE","INSUFFICIENT_OBSERVATIONS",slots.isEmpty()?null:slots.firstEntry().getValue(),null,null,null);
        var first=slots.firstEntry().getValue();var last=slots.lastEntry().getValue();
        return new VideoComparison(id,"AVAILABLE",null,first,last,Duration.between(first.slot(),last.slot()).getSeconds(),last.views()-first.views());
    }
    public static Composition composition(List<AppType> values){
        Map<Long,String> types=new HashMap<>();
        for(var p:values){if(p.appId()<=0)throw new IllegalArgumentException("Invalid app type identity");String type=p.appType()==null?"":p.appType().strip().toLowerCase(Locale.ROOT);
            if(types.containsKey(p.appId())&&!types.get(p.appId()).equals(type))throw new IllegalArgumentException("Conflicting app types");types.put(p.appId(),type);}
        long games=types.values().stream().filter("game"::equals).count(),unknown=types.values().stream().filter(String::isBlank).count(),nonGames=types.size()-games-unknown;
        return new Composition(types.size(),games,nonGames,unknown,ratio(games,types.size()),ratio(nonGames,types.size()),ratio(unknown,types.size()));
    }
    public static BigDecimal ratio(long a,long b){return b==0?null:BigDecimal.valueOf(a).divide(BigDecimal.valueOf(b),8,RoundingMode.HALF_UP);}
    private static Change change(long id,CcuObservation previous,CcuObservation current){long diff=current.playerCount()-previous.playerCount();
        return new Change(id,previous.playerCount()==0?"UNAVAILABLE":"AVAILABLE",previous.playerCount()==0?"ZERO_BASELINE":null,previous.scheduledAt(),current.scheduledAt(),previous.playerCount(),current.playerCount(),diff,previous.playerCount()==0?null:BigDecimal.valueOf(diff).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(previous.playerCount()),8,RoundingMode.HALF_UP),Duration.between(previous.scheduledAt(),current.scheduledAt()).getSeconds());}
    private static Change missing(long id,String reason){return new Change(id,"UNAVAILABLE",reason,null,null,null,null,null,null,null);}
    private static List<CcuObservation> canonical(List<CcuObservation> values,Instant now){
        var slots=new TreeMap<Instant,CcuObservation>();
        for(var p:values){if(p.observationId()<=0||p.scheduledAt()==null||p.observedAt()==null||p.playerCount()<0)throw new IllegalArgumentException("Invalid canonical CCU observation");
            if(p.scheduledAt().isAfter(now)||p.observedAt().isAfter(now))continue;
            slots.merge(p.scheduledAt(),p,(a,b)->Comparator.comparing(CcuObservation::observedAt).thenComparingLong(CcuObservation::observationId).compare(a,b)>=0?a:b);}
        return List.copyOf(slots.values());
    }
}
