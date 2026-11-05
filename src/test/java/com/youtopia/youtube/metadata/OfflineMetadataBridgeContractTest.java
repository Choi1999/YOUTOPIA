package com.youtopia.youtube.metadata;

import static org.junit.jupiter.api.Assertions.*;

import com.youtopia.youtube.metadata.OfflineMetadataBridge.Candidate;
import com.youtopia.youtube.metadata.OfflineMetadataBridge.Plan;
import java.lang.annotation.Annotation;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * UI-R04-Q — Java 21 non-networking mirror of the independently versioned
 * Node R04-O/P offline shape contract. This is NOT a provider/API integration.
 */
class OfflineMetadataBridgeContractTest {
    static final String V1 = "Ab0_-123xyz";
    static final String V2 = "Bb0_-123xyz";
    static final String C1 = "UC" + "A".repeat(22);
    static final String C2 = "UC" + "B".repeat(22);

    static byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    static String youtubePage(boolean video, String items) {
        int size = items.isBlank() ? 0 : items.contains("},{") ? 2 : 1;
        return "{\"kind\":\"youtube#" + (video ? "videoListResponse" : "channelListResponse") +
                "\",\"items\":[" + items + "],\"pageInfo\":{\"totalResults\":" +
                size + ",\"resultsPerPage\":" + size + "}}";
    }

    static String video(String id, String title, String thumb) {
        return "{\"kind\":\"youtube#video\",\"id\":\"" + id +
                "\",\"snippet\":{\"title\":\"" + title +
                "\",\"channelId\":\"" + C1 +
                "\",\"thumbnails\":{\"high\":{\"url\":\"" + thumb + "\"}}}}";
    }

    static String channel(String id, String title, String thumb) {
        return "{\"kind\":\"youtube#channel\",\"id\":\"" + id +
                "\",\"snippet\":{\"title\":\"" + title +
                "\",\"thumbnails\":{\"high\":{\"url\":\"" + thumb + "\"}}}}";
    }

    static IllegalArgumentException rejected(String suffix, Runnable block) {
        var error = assertThrows(IllegalArgumentException.class, block::run);
        assertEquals("UI_R04Q_OFFLINE_" + suffix, error.getMessage());
        return error;
    }

    @Test
    void planMatchesNodeR04OCanonicalRequestOrderAndBudget() {
        Plan plan = OfflineMetadataBridge.plan(
                List.of(V1), List.of(C1), List.of("@somecreator"));
        assertEquals("R04O_OFFLINE_METADATA_PLAN_V01", plan.schema());
        assertEquals("NON_EXECUTABLE_CANDIDATE", plan.status());
        assertEquals("POLICY_HOLD", plan.providerPolicy());
        assertEquals(3, plan.totalTargets());
        assertEquals(3, plan.plannedQuotaUnits());
        assertEquals(3, plan.candidates().size());
        assertFalse(plan.networkEnabled());
        assertFalse(plan.credentialsAccepted());
        assertFalse(plan.consumerPublicationAuthorized());
        assertEquals(0, plan.providerRequestsMade());

        Candidate video = plan.candidates().get(0);
        assertEquals("videos.list", video.method());
        assertEquals("www.googleapis.com", video.host());
        assertEquals("/youtube/v3/videos", video.path());
        assertEquals("GET", video.requestMethod());
        assertEquals("snippet", video.query().get("part"));
        assertEquals(V1, video.query().get("id"));
        assertEquals(List.of("VIDEO:" + V1), video.requestedKeys());
        assertEquals(1, video.expectedQuotaUnits());
        assertFalse(video.networkEnabled());
        assertFalse(video.credentialsAttached());
        assertEquals(0, video.automaticRetries());
        assertFalse(video.redirectsAllowed());

        assertEquals("channels.list", plan.candidates().get(1).method());
        assertEquals(C1, plan.candidates().get(1).query().get("id"));
        assertEquals("@somecreator", plan.candidates().get(2).query().get("forHandle"));
        assertNull(plan.candidates().get(2).query().get("id"));
    }

    @Test
    void batchedIdsReduceProposedUnitsButNeverAuthorizeExecution() {
        Plan plan = OfflineMetadataBridge.plan(List.of(V1, V2), List.of(C1), null);
        assertEquals(2, plan.candidates().size());
        assertEquals(2, plan.plannedQuotaUnits());
        assertEquals(V1 + "," + V2, plan.candidates().get(0).query().get("id"));
        assertEquals(0, plan.providerRequestsMade());
        assertFalse(plan.networkEnabled());
        assertEquals(OfflineMetadataBridge.MAX_TARGETS, 3);
        assertEquals(OfflineMetadataBridge.CACHE_TTL_CANDIDATE_MS, 900_000L);
    }

    @Test
    void invalidOrDuplicateCanonicalTargetsFailClosed() {
        rejected("TARGET_LIMIT", () -> OfflineMetadataBridge.plan(null,null,null));
        rejected("TARGET_LIMIT", () -> OfflineMetadataBridge.plan(
                List.of(V1,V2),List.of(C1),List.of("@foo")));
        rejected("DUPLICATE_TARGET", () -> OfflineMetadataBridge.plan(
                List.of(V1,V1),null,null));
        rejected("DUPLICATE_TARGET", () -> OfflineMetadataBridge.plan(
                null,null,List.of("@SomeCreator","@somecreator")));
        rejected("INVALID_TARGET", () -> OfflineMetadataBridge.plan(
                List.of("../path"),null,null));
        rejected("INVALID_TARGET", () -> OfflineMetadataBridge.plan(
                null,List.of("BAD_CHANNEL"),null));
        rejected("INVALID_TARGET", () -> OfflineMetadataBridge.plan(
                null,null,List.of("channel-without-at")));
    }

    @Test
    void shapeValidVideoIsNotGoogleAuthenticatedOrUserReady() {
        Plan plan = OfflineMetadataBridge.plan(List.of(V1),null,null);
        String json = youtubePage(true,video(V1,"영상 제목 후보",
                "https://i.ytimg.com/vi/" + V1 + "/hqdefault.jpg"));
        var result = OfflineMetadataBridge.decode(plan,0,bytes(json),1_000L);
        assertEquals("R04O_OFFLINE_METADATA_SHAPE_V01",result.schema());
        assertEquals("SHAPE_VALIDATED_UNAUTHENTICATED",result.status());
        assertEquals("POLICY_HOLD",result.providerPolicy());
        assertEquals(0,result.providerRequestsMade());
        assertFalse(result.credentialsAccepted());
        assertFalse(result.sourceAuthenticated());
        assertFalse(result.consumerPublicationAuthorized());
        assertTrue(result.unmatchedKeys().isEmpty());
        var record = result.records().getFirst();
        assertEquals("VIDEO:" + V1,record.lookupKey());
        assertEquals("VIDEO",record.kind());
        assertEquals("영상 제목 후보",record.title());
        assertEquals("https://i.ytimg.com/vi/" + V1 + "/hqdefault.jpg",record.thumbnailUrl());
        assertEquals(1_000L,record.observedAt());
        assertNull(record.handleResolutionCandidate());
        assertFalse(record.sourceAuthenticated());
        assertFalse(record.consumerReady());
        assertThrows(UnsupportedOperationException.class,() -> result.records().clear());
    }

    @Test
    void channelHandleMappingIsAnUnauthenticatedCandidate() {
        Plan plan = OfflineMetadataBridge.plan(null,null,List.of("@SomeCreator"));
        String body = youtubePage(false,channel(C2,"채널 이름 후보",
                "https://yt3.googleusercontent.com/photo"));
        var result=OfflineMetadataBridge.decode(plan,0,bytes(body),1_000L);
        var item=result.records().getFirst();
        assertEquals("CHANNEL_HANDLE:@somecreator",item.lookupKey());
        assertEquals(C2,item.canonicalId());
        assertEquals(C2,item.handleResolutionCandidate());
        assertEquals("채널 이름 후보",item.title());
        assertFalse(item.sourceAuthenticated());
        assertFalse(item.consumerReady());
    }

    @Test
    void exactChannelIdScopeAndImageHostsAreRestricted() {
        Plan plan=OfflineMetadataBridge.plan(null,List.of(C1),null);
        var good=OfflineMetadataBridge.decode(plan,0,bytes(youtubePage(false,
                channel(C1,"채널","https://yt3.ggpht.com/photo"))),1_000L);
        assertEquals("https://yt3.ggpht.com/photo",good.records().getFirst().thumbnailUrl());
        for(String bad:List.of(
                "http://yt3.ggpht.com/photo",
                "https://yt3.ggpht.com.evil.example/photo",
                "https://someone.example.com/photo",
                "javascript:alert(1)",
                "https://user:pass@yt3.googleusercontent.com/photo",
                "https://yt3.ggpht.com:8443/photo"
        )){
            var shaped=OfflineMetadataBridge.decode(plan,0,bytes(youtubePage(false,
                    channel(C1,"채널",bad))),1_000L);
            assertNull(shaped.records().getFirst().thumbnailUrl());
        }
    }

    @Test
    void missingItemsAreUnknownNotVerifiedProviderNotFound() {
        Plan plan=OfflineMetadataBridge.plan(List.of(V1,V2),null,null);
        var shaped=OfflineMetadataBridge.decode(plan,0,bytes(youtubePage(true,
                video(V2,"두 번째","https://i.ytimg.com/vi/" + V2 + "/hqdefault.jpg"))),1_000L);
        assertEquals(List.of("VIDEO:" + V1),shaped.unmatchedKeys());
        var empty=OfflineMetadataBridge.decode(plan,0,bytes(youtubePage(true,"")),1_000L);
        assertEquals("EMPTY_UNAUTHENTICATED",empty.status());
        assertEquals(List.of("VIDEO:" + V1,"VIDEO:" + V2),empty.unmatchedKeys());
        assertFalse(empty.consumerPublicationAuthorized());
    }

    @Test
    void duplicateWrongScopeOrMalformedPageCannotBePromoted() {
        Plan plan=OfflineMetadataBridge.plan(List.of(V1),null,null);
        rejected("WRONG_SCOPE",()->OfflineMetadataBridge.decode(plan,0,bytes(youtubePage(true,
                video(V2,"다른 영상","https://i.ytimg.com/vi/" + V2 + "/hqdefault.jpg"))),1_000L));
        rejected("INVALID_PAGE",()->OfflineMetadataBridge.decode(plan,0,
                bytes("{\"items\":{},\"pageInfo\":{}}"),1_000L));
        rejected("INVALID_OR_DUPLICATE_ID",()-> {
            Plan two=OfflineMetadataBridge.plan(List.of(V1,V2),null,null);
            String rows=video(V1,"첫 번째","https://i.ytimg.com/vi/" + V1 + "/hqdefault.jpg") +
                    ","+video(V1,"중복","https://i.ytimg.com/vi/" + V1 + "/hqdefault.jpg");
            OfflineMetadataBridge.decode(two,0,bytes(youtubePage(true,rows)),1_000L);
        });
        rejected("INVALID_TITLE",()->OfflineMetadataBridge.decode(plan,0,
                bytes(youtubePage(true,video(V1,"","https://i.ytimg.com/vi/" + V1 + "/hqdefault.jpg"))),1_000L));
        rejected("RESPONSE_KIND",()->OfflineMetadataBridge.decode(plan,0,
                bytes(youtubePage(false,channel(C1,"채널","https://yt3.ggpht.com/a"))),1_000L));
    }

    @Test
    void strictUtf8SizeAndDuplicateJsonFieldsAreRejectedWithoutExposure() {
        Plan plan=OfflineMetadataBridge.plan(List.of(V1),null,null);
        rejected("BODY_LIMIT",()->OfflineMetadataBridge.decode(plan,0,new byte[0],1_000L));
        rejected("BODY_LIMIT",()->OfflineMetadataBridge.decode(plan,0,
                new byte[OfflineMetadataBridge.MAX_BODY_BYTES + 1],1_000L));
        rejected("INVALID_UTF8",()->OfflineMetadataBridge.decode(plan,0,
                new byte[] {(byte)0xFF,(byte)0xFE},1_000L));
        rejected("INVALID_JSON",()->OfflineMetadataBridge.decode(plan,0,bytes("{ "),1_000L));
        rejected("INVALID_JSON",()->OfflineMetadataBridge.decode(plan,0,
                bytes("{\"items\":[],\"items\":[],\"pageInfo\":{}}"),1_000L));
        rejected("UNTRUSTED_PLAN",()->OfflineMetadataBridge.decode(plan,99,bytes("{}"),1_000L));
        rejected("INVALID_TIME",()->OfflineMetadataBridge.decode(plan,0,bytes("{}"),-1L));
    }

    @Test
    void noSpringBeanRouteOrTransportCanBeInferredFromContractClass() {
        assertEquals(0,OfflineMetadataBridge.class.getAnnotations().length);
        assertTrue(Modifier.isFinal(OfflineMetadataBridge.class.getModifiers()));
        assertEquals(false,OfflineMetadataBridge.NETWORK_ENABLED);
        assertEquals(false,OfflineMetadataBridge.CREDENTIALS_ACCEPTED);
        assertEquals(false,OfflineMetadataBridge.CONSUMER_PUBLICATION_AUTHORIZED);
        assertEquals("POLICY_HOLD",OfflineMetadataBridge.PROVIDER_POLICY);
        assertTrue(OfflineMetadataBridge.class.getDeclaredMethods().length > 0);
        assertTrue(java.util.Arrays.stream(OfflineMetadataBridge.class.getDeclaredMethods())
                .noneMatch(method -> method.getName().matches("(?i)execute|fetch|send|authorize|publish")));
    }
}
