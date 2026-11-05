package com.youtopia.youtube.metadata;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * UI-R04-Q — testable Spring-backend-compatible contract for the UI-R04-O/P
 * OFFLINE metadata plan. No Bean annotation, endpoint, network client,
 * credential access, persistence, or policy release is supplied.
 *
 * This class validates YouTube-shaped JSON for a future backend boundary.
 * It MUST NOT be wired to live provider reads or consumer publication on its
 * own. A response shape is not proof of Google provenance.
 */
public final class OfflineMetadataBridge {
    public static final String SCHEMA = "R04O_OFFLINE_METADATA_SHAPE_V01";
    public static final String PROVIDER_POLICY = "POLICY_HOLD";
    public static final int MAX_TARGETS = 3;
    public static final int MAX_BODY_BYTES = 256 * 1024;
    public static final long CACHE_TTL_CANDIDATE_MS = 15 * 60 * 1000L;
    public static final boolean NETWORK_ENABLED = false;
    public static final boolean CREDENTIALS_ACCEPTED = false;
    public static final boolean CONSUMER_PUBLICATION_AUTHORIZED = false;

    private static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern CHANNEL_ID = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");
    private static final Pattern HANDLE = Pattern.compile("^@[\\p{L}\\p{N}._-]{3,30}$");
    private static final Pattern CONTROL = Pattern.compile("[\\x00-\\x1F\\x7F]");
    private static final Set<String> VIDEO_HOSTS = Set.of("i.ytimg.com");
    private static final Set<String> CHANNEL_HOSTS =
            Set.of("yt3.ggpht.com", "yt3.googleusercontent.com");
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private OfflineMetadataBridge() {}

    private static IllegalArgumentException rejected(String code) {
        // Never put provider body, caller identity, URL, credentials or IDs in exceptions.
        return new IllegalArgumentException("UI_R04Q_OFFLINE_" + code);
    }

    public record Candidate(String method, String host, String path,
                            String requestMethod, Map<String, String> query,
                            List<String> requestedKeys, int expectedQuotaUnits,
                            boolean networkEnabled, boolean credentialsAttached,
                            int automaticRetries, boolean redirectsAllowed) {
        public Candidate {
            query = Map.copyOf(query);
            requestedKeys = List.copyOf(requestedKeys);
        }
    }

    /** Private construction means arbitrary caller "approved" flags cannot mint plans. */
    public static final class Plan {
        private final List<Candidate> candidates;
        private final int totalTargets;
        private Plan(List<Candidate> candidates, int totalTargets) {
            this.candidates = List.copyOf(candidates);
            this.totalTargets = totalTargets;
        }
        public String schema() { return "R04O_OFFLINE_METADATA_PLAN_V01"; }
        public String status() { return "NON_EXECUTABLE_CANDIDATE"; }
        public String providerPolicy() { return PROVIDER_POLICY; }
        public List<Candidate> candidates() { return candidates; }
        public int totalTargets() { return totalTargets; }
        public int plannedQuotaUnits() { return candidates.size(); }
        public boolean networkEnabled() { return false; }
        public boolean credentialsAccepted() { return false; }
        public boolean consumerPublicationAuthorized() { return false; }
        public int providerRequestsMade() { return 0; }
    }

    public record Item(String lookupKey, String kind, String canonicalId,
                       String handleResolutionCandidate, String title,
                       String thumbnailUrl, long observedAt,
                       boolean sourceAuthenticated, boolean consumerReady) {}

    public record Shape(String schema, String status, String providerPolicy,
                        int providerRequestsMade, boolean credentialsAccepted,
                        boolean sourceAuthenticated, boolean consumerPublicationAuthorized,
                        List<Item> records, List<String> unmatchedKeys) {
        public Shape {
            records = List.copyOf(records);
            unmatchedKeys = List.copyOf(unmatchedKeys);
        }
    }

    private static List<String> ids(List<String> source, Pattern rule, boolean lowercase) {
        if (source == null) return List.of();
        if (source.size() > MAX_TARGETS) throw rejected("TARGET_LIMIT");
        var output = new ArrayList<String>();
        var seen = new HashSet<String>();
        for (String value : source) {
            if (value == null) throw rejected("INVALID_TARGET");
            String normalized = lowercase
                    ? value.toLowerCase(Locale.ROOT) : value;
            if (!rule.matcher(normalized).matches()) throw rejected("INVALID_TARGET");
            if (!seen.add(normalized)) throw rejected("DUPLICATE_TARGET");
            output.add(normalized);
        }
        return List.copyOf(output);
    }

    private static Candidate candidate(String method, String path,
                                       Map<String, String> query, List<String> keys) {
        return new Candidate(method, "www.googleapis.com", path, "GET",
                query, keys, 1, false, false, 0, false);
    }

    /** Pure non-executing adapter matching the R04-O Node candidate ordering. */
    public static Plan plan(List<String> videoIds, List<String> channelIds,
                            List<String> channelHandles) {
        var videos = ids(videoIds, VIDEO_ID, false);
        var channels = ids(channelIds, CHANNEL_ID, false);
        var handles = ids(channelHandles, HANDLE, true);
        int total = videos.size() + channels.size() + handles.size();
        if (total < 1 || total > MAX_TARGETS) throw rejected("TARGET_LIMIT");
        var output = new ArrayList<Candidate>();
        if (!videos.isEmpty()) {
            Map<String, String> query = Map.of(
                    "part", "snippet",
                    "fields", "items(kind,id,snippet(title,channelId,thumbnails)),pageInfo(totalResults,resultsPerPage)",
                    "id", String.join(",", videos));
            output.add(candidate("videos.list", "/youtube/v3/videos", query,
                    videos.stream().map(x -> "VIDEO:" + x).toList()));
        }
        if (!channels.isEmpty()) {
            Map<String, String> query = Map.of(
                    "part", "snippet",
                    "fields", "items(kind,id,snippet(title,thumbnails)),pageInfo(totalResults,resultsPerPage)",
                    "id", String.join(",", channels));
            output.add(candidate("channels.list", "/youtube/v3/channels", query,
                    channels.stream().map(x -> "CHANNEL:" + x).toList()));
        }
        for (String handle : handles) {
            output.add(candidate("channels.list", "/youtube/v3/channels",
                    Map.of("part", "snippet",
                           "fields", "items(kind,id,snippet(title,thumbnails)),pageInfo(totalResults,resultsPerPage)",
                           "forHandle", handle),
                    List.of("CHANNEL_HANDLE:" + handle)));
        }
        return new Plan(output, total);
    }

    private static String safeTitle(JsonNode value) {
        if (value == null || !value.isTextual()) throw rejected("INVALID_TITLE");
        String text = value.textValue();
        if (text.length() < 1 || text.length() > 160 ||
                text.isBlank() || CONTROL.matcher(text).find()) throw rejected("INVALID_TITLE");
        return text.trim();
    }

    private static String safeThumbnail(JsonNode thumbnails, boolean video) {
        if (thumbnails == null || !thumbnails.isObject()) return null;
        for (String size : List.of("high", "medium", "default")) {
            JsonNode candidate = thumbnails.path(size);
            if (!candidate.isObject() || !candidate.path("url").isTextual()) continue;
            String value = candidate.path("url").textValue();
            if (value == null || value.length() < 12 || value.length() > 2048 ||
                    CONTROL.matcher(value).find()) continue;
            try {
                URI url = URI.create(value);
                var allowed = video ? VIDEO_HOSTS : CHANNEL_HOSTS;
                if (!"https".equals(url.getScheme()) || url.getHost() == null ||
                        !allowed.contains(url.getHost().toLowerCase(Locale.ROOT)) ||
                        url.getUserInfo() != null || url.getPort() != -1 ||
                        url.getRawFragment() != null || url.getRawPath() == null ||
                        url.getRawPath().length() < 2) continue;
                return value;
            } catch (IllegalArgumentException ignored) {
                // Hostile or malformed image URLs are absent, never fetched.
            }
        }
        return null;
    }

    private static JsonNode parseBody(byte[] body) {
        if (body == null || body.length < 2 || body.length > MAX_BODY_BYTES)
            throw rejected("BODY_LIMIT");
        try {
            var decoder = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            String json = decoder.decode(ByteBuffer.wrap(body)).toString();
            JsonNode root = MAPPER.readTree(json);
            if (root == null || !root.isObject()) throw rejected("BAD_RESPONSE");
            return root;
        } catch (CharacterCodingException exception) {
            throw rejected("INVALID_UTF8");
        } catch (IOException exception) {
            throw rejected("INVALID_JSON");
        }
    }

    /**
     * Decode only in-memory caller-supplied YouTube-shaped bytes.
     * Neither the body nor a matching plan proves provider authenticity.
     */
    public static Shape decode(Plan plan, int candidateIndex,
                               byte[] body, long observedAt) {
        if (plan == null || candidateIndex < 0 ||
                candidateIndex >= plan.candidates().size()) throw rejected("UNTRUSTED_PLAN");
        if (observedAt < 0) throw rejected("INVALID_TIME");
        Candidate c = plan.candidates().get(candidateIndex);
        JsonNode root = parseBody(body);
        boolean video = "videos.list".equals(c.method());
        String responseKind = video ? "youtube#videoListResponse" :
                "youtube#channelListResponse";
        if (root.has("kind") &&
                (!root.path("kind").isTextual() ||
                 !responseKind.equals(root.path("kind").textValue())))
            throw rejected("RESPONSE_KIND");
        JsonNode items = root.path("items"), info = root.path("pageInfo");
        if (!items.isArray() || !info.isObject() ||
                items.size() > c.requestedKeys().size()) throw rejected("INVALID_PAGE");
        JsonNode total = info.path("totalResults");
        JsonNode count = info.path("resultsPerPage");
        if (!total.canConvertToInt() || total.intValue() < items.size() ||
                !count.canConvertToInt() || count.intValue() != items.size())
            throw rejected("PAGE_COUNT");
        boolean handle = c.query().containsKey("forHandle");
        if (handle && items.size() > 1) throw rejected("AMBIGUOUS_HANDLE");
        var found = new HashSet<String>();
        var canonicalIds = new HashSet<String>();
        var result = new ArrayList<Item>();
        for (JsonNode item : items) {
            if (!item.isObject() || !item.path("id").isTextual() ||
                    !item.path("snippet").isObject() ||
                    !(video ? "youtube#video" : "youtube#channel")
                            .equals(item.path("kind").asText()))
                throw rejected("INVALID_ITEM");
            String id = item.path("id").asText();
            if (!(video ? VIDEO_ID : CHANNEL_ID).matcher(id).matches() ||
                    !canonicalIds.add(id)) throw rejected("INVALID_OR_DUPLICATE_ID");
            String key = handle ? c.requestedKeys().get(0) :
                    (video ? "VIDEO:" : "CHANNEL:") + id;
            if (!c.requestedKeys().contains(key)) throw rejected("WRONG_SCOPE");
            JsonNode snippet = item.path("snippet");
            if (video &&
                    !CHANNEL_ID.matcher(snippet.path("channelId").asText()).matches())
                throw rejected("INVALID_VIDEO_CHANNEL");
            String title = safeTitle(snippet.get("title"));
            String url = safeThumbnail(snippet.get("thumbnails"), video);
            result.add(new Item(key, video ? "VIDEO" : "CHANNEL", id,
                    handle ? id : null, title, url, observedAt, false, false));
            found.add(key);
        }
        var unmatched = c.requestedKeys().stream().filter(key -> !found.contains(key)).toList();
        return new Shape(SCHEMA,
                result.isEmpty() ? "EMPTY_UNAUTHENTICATED" : "SHAPE_VALIDATED_UNAUTHENTICATED",
                PROVIDER_POLICY, 0, false, false, false, result, unmatched);
    }
}
