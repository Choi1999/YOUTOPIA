package com.youtopia.charts;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Native rank positions are compared within one source/category/period/country; ranks are never sales volumes. */
public final class RankingAnalytics {
    private RankingAnalytics() {}
    public record Entry(long appId,String name,int position) {}
    public record Run(long id,String country,Instant start,Instant end,Instant receivedAt,List<Entry> entries) {}
    public record Move(long appId,String name,int previous,int current,int positionChange) {}
    public record Excluded(long appId,String reason) {}
    public record Region(String country,String availability,int observedEntries,int comparable,int uncomparable,List<Excluded> excluded,int up,int down,int same,
        BigDecimal upRatio,BigDecimal downRatio,BigDecimal sameRatio,SortedMap<Integer,Long> deltaHistogram,List<Move> topRisers,List<Move> topFallers) {}
    public record Pair(long appId,String name,int krPosition,int unspecifiedPosition,long absoluteGap) {}
    public record Week(Instant periodStart,Region kr,Region unspecified,String pairAvailability,List<Pair> pairs,List<Pair> largestGaps) {}
    public record Point(Instant periodStart,int position) {}
    public record Trend(long appId,String name,String country,List<Point> points) {}
    public record Continuity(String country,int expectedWeeks,int observedWeeks,String availability,int enteredTop20,Long everyWeekTop20) {}
    public record Report(String periodBasis,String comparisonBasis,boolean rankOneAtTop,List<Week> weeks,List<Trend> lastThreeWeekTrends,List<Continuity> top20Continuity) {}
    private record Key(String country,Instant start,Instant end) {}
    public static Report calculate(List<Run> input,Instant from,Instant to,Instant asOf){
        long seconds=Duration.between(from,to).getSeconds();
        if(from.isAfter(to)||seconds>12*604800L||seconds%604800!=0||!from.plusSeconds(seconds).equals(to)||to.isAfter(asOf))throw new IllegalArgumentException("Explicit weekly source-period bounds required");
        Map<Key,Run> chosen=new HashMap<>();
        for(var run:input){
            if(run.id()<=0||run.start()==null||run.end()==null||run.receivedAt()==null||!run.end().isAfter(run.start()))throw new IllegalArgumentException("Invalid rank run contract");
            if(run.receivedAt().isAfter(asOf)||run.end().isAfter(asOf)||run.start().isBefore(from.minusSeconds(604800))||run.start().isAfter(to))continue;
            if(run.country()!=null&&!run.country().equals("KR"))continue;
            var ids=new HashSet<Long>();var positions=new HashSet<Integer>();
            for(var entry:run.entries())if(entry.appId()<=0||entry.position()<=0||!ids.add(entry.appId())||!positions.add(entry.position()))throw new IllegalArgumentException("Duplicate or invalid ranking entry");
            var key=new Key(run.country(),run.start(),run.end());
            chosen.merge(key,run,(a,b)->Comparator.comparing(Run::receivedAt).thenComparingLong(Run::id).compare(a,b)>=0?a:b);
        }
        // Same start and country with conflicting end dates cannot be silently paired as the same week.
        for(String country:Arrays.asList("KR",null)){
            var byStart=new HashSet<Instant>();for(var run:chosen.values())if(Objects.equals(country,run.country())&&!byStart.add(run.start()))throw new IllegalArgumentException("Conflicting source period ends");
        }
        var weeks=new ArrayList<Week>();var dates=new ArrayList<Instant>();
        for(Instant start=from;!start.isAfter(to);start=start.plusSeconds(604800)){
            dates.add(start);Run kr=at(chosen,"KR",start),unspecified=at(chosen,null,start);
            var pairs=new ArrayList<Pair>();
            if(kr!=null&&unspecified!=null&&kr.end().equals(unspecified.end())){
                var reference=byApp(unspecified);for(var entry:kr.entries()){var match=reference.get(entry.appId());if(match!=null)pairs.add(new Pair(entry.appId(),entry.name(),entry.position(),match.position(),Math.abs((long)entry.position()-match.position())));}
                pairs.sort(Comparator.comparingLong(Pair::appId));
            }
            var gaps=pairs.stream().sorted(Comparator.comparingLong(Pair::absoluteGap).reversed().thenComparingLong(Pair::appId)).limit(10).toList();
            weeks.add(new Week(start,region(kr,previous(chosen,kr)),region(unspecified,previous(chosen,unspecified)),kr==null||unspecified==null?"UNAVAILABLE":!kr.end().equals(unspecified.end())?"PERIOD_MISMATCH":pairs.isEmpty()?"EMPTY":"AVAILABLE",List.copyOf(pairs),gaps));
        }
        var trends=new ArrayList<Trend>();
        if(dates.size()>=3)for(String country:Arrays.asList("KR",null)){
            var last=dates.subList(dates.size()-3,dates.size());var runs=last.stream().map(d->at(chosen,country,d)).toList();
            if(runs.stream().noneMatch(Objects::isNull))for(var entry:runs.getLast().entries()){
                var points=new ArrayList<Point>();for(var run:runs){var point=byApp(run).get(entry.appId());if(point!=null)points.add(new Point(run.start(),point.position()));}
                if(points.size()==3)trends.add(new Trend(entry.appId(),entry.name(),country==null?"UNSPECIFIED":country,List.copyOf(points)));
            }
        }
        trends.sort(Comparator.comparing(Trend::country).thenComparingLong(Trend::appId));
        if(trends.size()>1000||weeks.stream().anyMatch(w->w.pairs().size()>1000))throw new IllegalArgumentException("Ranking output exceeds supported bound");
        var continuity=new ArrayList<Continuity>();
        for(String country:Arrays.asList("KR",null)){
            int observed=0;var occurrences=new HashMap<Long,Integer>();
            for(var date:dates){var run=at(chosen,country,date);if(run!=null){observed++;for(var entry:run.entries())if(entry.position()<=20)occurrences.merge(entry.appId(),1,Integer::sum);}}
            continuity.add(new Continuity(country==null?"UNSPECIFIED":country,dates.size(),observed,observed==0?"EMPTY":observed!=dates.size()?"PARTIAL":"AVAILABLE",occurrences.size(),observed==dates.size()?occurrences.values().stream().filter(n->n==dates.size()).count():null));
        }
        return new Report("SOURCE_PERIOD_START_AND_END_UTC","EXACT_PREVIOUS_SOURCE_PERIOD_MINUS_7_DAYS",true,List.copyOf(weeks),List.copyOf(trends),List.copyOf(continuity));
    }
    private static Region region(Run current,Run previous){
        if(current==null)return new Region("UNAVAILABLE","UNAVAILABLE",0,0,0,List.of(),0,0,0,null,null,null,Collections.unmodifiableSortedMap(new TreeMap<>()),List.of(),List.of());
        var prior=previous==null?Map.<Long,Entry>of():byApp(previous);var moves=new ArrayList<Move>();var excluded=new ArrayList<Excluded>();
        for(var entry:current.entries()){var p=prior.get(entry.appId());if(p!=null)moves.add(new Move(entry.appId(),entry.name(),p.position(),entry.position(),p.position()-entry.position()));else excluded.add(new Excluded(entry.appId(),previous==null?"PREVIOUS_PERIOD_MISSING":"APP_ABSENT_PREVIOUS_PERIOD"));}
        int up=(int)moves.stream().filter(m->m.positionChange()>0).count(),down=(int)moves.stream().filter(m->m.positionChange()<0).count(),same=moves.size()-up-down;
        var hist=new TreeMap<Integer,Long>();moves.forEach(m->hist.merge(m.positionChange(),1L,Long::sum));
        return new Region(current.country()==null?"UNSPECIFIED":current.country(),current.entries().isEmpty()?"EMPTY":previous==null||!excluded.isEmpty()?"PARTIAL":"AVAILABLE",current.entries().size(),moves.size(),current.entries().size()-moves.size(),List.copyOf(excluded),up,down,same,
            ObservationAnalytics.ratio(up,moves.size()),ObservationAnalytics.ratio(down,moves.size()),ObservationAnalytics.ratio(same,moves.size()),Collections.unmodifiableSortedMap(hist),
            moves.stream().filter(m->m.positionChange()>0).sorted(Comparator.comparingInt(Move::positionChange).reversed().thenComparingLong(Move::appId)).limit(10).toList(),
            moves.stream().filter(m->m.positionChange()<0).sorted(Comparator.comparingInt(Move::positionChange).thenComparingLong(Move::appId)).limit(10).toList());
    }
    private static Run previous(Map<Key,Run> runs,Run current){return current==null?null:runs.get(new Key(current.country(),current.start().minusSeconds(604800),current.end().minusSeconds(604800)));}
    private static Run at(Map<Key,Run> runs,String country,Instant start){return runs.values().stream().filter(r->Objects.equals(country,r.country())&&r.start().equals(start)).findFirst().orElse(null);}
    private static Map<Long,Entry> byApp(Run run){return run.entries().stream().collect(Collectors.toMap(Entry::appId,Function.identity()));}
}
