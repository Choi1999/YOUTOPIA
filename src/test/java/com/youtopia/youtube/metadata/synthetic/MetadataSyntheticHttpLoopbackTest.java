package com.youtopia.youtube.metadata.synthetic;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

@org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
@SpringBootTest(classes = MetadataSyntheticLoopbackApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.profiles.active=metadata-offline-test",
            "youtopia.metadata.synthetic-http.enabled=true",
            "server.address=127.0.0.1",
            "spring.session.store-type=none"
        })
class MetadataSyntheticHttpLoopbackTest {
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;

    private static final String ROOT = "/api/v1/youtube/metadata/synthetic";
    private static final String V = "Ab0_-123xyz";
    private static final String C = "UC" + "A".repeat(22);

    @Test
    void actualLoopbackHttpMatchesReactFixtureContractForAllTargetTypes()
            throws Exception {
        for (var spec : new String[][] {
                {"/videos/" + V, "VIDEO", V, "VIDEO_PLACEHOLDER"},
                {"/channels/" + C, "CHANNEL", C, "CHANNEL_PLACEHOLDER"},
                {"/handles/@samplecreator", "CHANNEL_HANDLE", "@samplecreator",
                        "CHANNEL_PLACEHOLDER"}
        }) {
            var response = http.getForEntity(ROOT + spec[0], String.class);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertNotNull(response.getHeaders().getContentType());
            assertEquals("application/json",
                    response.getHeaders().getContentType().toString().split(";")[0]);
            assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
            assertEquals("test-only", response.getHeaders().getFirst("X-YOUTOPIA-Synthetic"));
            assertNull(response.getHeaders().getFirst("Set-Cookie"));
            assertNotNull(response.getBody());
            assertTrue(response.getBody().length() < 4096);
            var root = json.readTree(response.getBody());
            assertEquals(MetadataSyntheticHttpController.SCHEMA, root.path("schema").asText());
            assertEquals("SYNTHETIC_NOT_PROVIDER_DATA", root.path("status").asText());
            var record = root.path("record");
            assertEquals(spec[1], record.path("kind").asText());
            assertEquals(spec[2], record.path("requestedId").asText());
            assertEquals(spec[3], record.path("artwork").asText());
            assertEquals("LOCAL_SYNTHETIC_ONLY", record.path("source").asText());
            assertFalse(record.path("sourceAuthenticated").asBoolean(true));
            assertFalse(record.path("consumerPublicationAuthorized").asBoolean(true));
            assertEquals(0, record.path("providerRequestsMade").asInt(-1));
            assertTrue(record.path("title").asText().startsWith("합성 "));
            assertFalse(root.toString().contains("apiKey"));
            assertFalse(root.toString().contains("thumbnailUrl"));
            if (spec[1].equals("VIDEO")) {
                assertEquals("합성 채널 안내 · 실제 소속 미확인",
                        record.path("channelName").asText());
            } else {
                assertTrue(record.path("channelName").isNull());
            }
        }
    }

    @Test
    void invalidCanonicalIdsAreRejectedWithoutEchoingOrLeaking() throws Exception {
        var response = http.getForEntity(ROOT + "/videos/not-a-video", String.class);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
        assertNotNull(response.getBody());
        var root = json.readTree(response.getBody());
        assertEquals("SYNTHETIC_INVALID_TARGET", root.path("code").asText());
        assertFalse(response.getBody().contains("not-a-video"));
        assertFalse(response.getBody().contains("API_KEY"));
    }

    @Test
    void realProviderAndUnknownPathsAreDeniedInStandaloneTestServer()
            throws Exception {
        for (String uri : new String[] {
                "/api/v1/youtube/metadata/videos/" + V,
                "/api/v1/youtube/videos/" + V + "/observations",
                "/api/v1/admin/youtube-data/deletions/capabilities",
                "/actuator/env",
                "/api/v1/youtube/metadata/synthetic/unknown/" + V
        }) {
            var response = http.getForEntity(uri, String.class);
            assertFalse(response.getStatusCode().is2xxSuccessful());
        }
        var post = http.exchange(ROOT + "/videos/" + V,
                HttpMethod.POST, null, String.class);
        assertFalse(post.getStatusCode().is2xxSuccessful());
    }

    @Test
    void fixtureControllerIsExplicitlyTestProfileAndPropertyGated() {
        var klass = MetadataSyntheticHttpController.class;
        var profile = klass.getAnnotation(org.springframework.context.annotation.Profile.class);
        var property = klass.getAnnotation(
                org.springframework.boot.autoconfigure.condition.ConditionalOnProperty.class);
        assertNotNull(profile);
        assertArrayEquals(new String[]{"metadata-offline-test"}, profile.value());
        assertNotNull(property);
        assertArrayEquals(
                new String[]{"youtopia.metadata.synthetic-http.enabled"},property.name());
        assertFalse(property.matchIfMissing());
        assertEquals("true",property.havingValue());
    }
}
