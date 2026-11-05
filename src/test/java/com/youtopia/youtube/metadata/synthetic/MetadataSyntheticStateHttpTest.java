package com.youtopia.youtube.metadata.synthetic;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;

@org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
@SpringBootTest(classes = MetadataSyntheticLoopbackApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.profiles.active=metadata-offline-test",
            "youtopia.metadata.synthetic-http.enabled=true",
            "server.address=127.0.0.1",
            "spring.session.store-type=none"
        })
class MetadataSyntheticStateHttpTest {
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper mapper;
    private static final String ROOT = "/api/v1/youtube/metadata/synthetic-state";
    private static final String VIDEO = "Ab0_-123xyz";
    private static final String CHANNEL = "UC" + "A".repeat(22);

    @Test
    void realHttpStateVariantsHaveExactShapeAndNeverMintProviderTrust() throws Exception {
        for (var row : new String[][] {
                {"READY", "200", "videos/" + VIDEO, "VIDEO"},
                {"NOT_FOUND", "404", "channels/" + CHANNEL, "CHANNEL"},
                {"FAILED", "503", "handles/@samplecreator", "CHANNEL_HANDLE"},
                {"STALE", "200", "videos/" + VIDEO, "VIDEO"}
        }) {
            var response = http.getForEntity(ROOT + "/" + row[2]
                    + "?scenario=" + row[0], String.class);
            assertEquals(Integer.parseInt(row[1]), response.getStatusCode().value());
            assertEquals("test-only", response.getHeaders().getFirst("X-YOUTOPIA-Synthetic"));
            assertNotNull(response.getHeaders().getCacheControl());
            assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
            assertEquals("application/json", response.getHeaders().getContentType().getType()
                    + "/" + response.getHeaders().getContentType().getSubtype());
            assertNotNull(response.getBody());
            assertTrue(response.getBody().length() < 4096);

            var root = mapper.readTree(response.getBody());
            assertEquals(MetadataSyntheticStateController.SCHEMA, root.path("schema").asText());
            assertEquals(row[0], root.path("status").asText());
            assertEquals("LOCAL_SYNTHETIC_ONLY", root.path("source").asText());
            assertEquals(row[3], root.path("kind").asText());
            assertEquals(0, root.path("providerRequestsMade").asInt(-1));
            assertFalse(root.path("sourceAuthenticated").asBoolean(true));
            assertFalse(root.path("associationVerified").asBoolean(true));
            assertTrue(root.path("channelId").isNull());
            assertFalse(root.path("consumerPublicationAuthorized").asBoolean(true));
            assertFalse(response.getBody().contains("apiKey"));
            assertFalse(response.getBody().contains("thumbnailUrl"));
            assertFalse(response.getBody().contains("clientSecret"));

            boolean record = row[0].equals("READY") || row[0].equals("STALE");
            if (record) {
                assertTrue(root.path("title").asText().startsWith("합성 "));
                assertTrue(root.path("observedAt").asLong() > 0);
                assertTrue(root.path("expiresAt").asLong() > 0);
                assertEquals(row[0].equals("READY"),
                        root.path("expiresAt").asLong() > root.path("observedAt").asLong());
                assertEquals(row[3].equals("VIDEO"),
                        root.path("channelName").isTextual());
                assertEquals(row[3].equals("VIDEO") ?
                        "VIDEO_PLACEHOLDER" : "CHANNEL_PLACEHOLDER",
                        root.path("artwork").asText());
            } else {
                assertTrue(root.path("title").isNull());
                assertTrue(root.path("artwork").isNull());
                assertEquals(0, root.path("observedAt").asLong());
                assertEquals(0, root.path("expiresAt").asLong());
            }
        }
    }

    @Test
    void missingOrInvalidInputsFailClosedAndDoNotEchoDetails() throws Exception {
        var bad = http.getForEntity(ROOT + "/videos/not-a-valid-video-id",String.class);
        assertEquals(HttpStatus.BAD_REQUEST,bad.getStatusCode());
        assertNotNull(bad.getBody());
        assertFalse(bad.getBody().contains("not-a-valid-video-id"));
        var unknownScenario = http.getForEntity(ROOT + "/videos/" + VIDEO +
                "?scenario=AUTHENTICATED",String.class);
        assertEquals(HttpStatus.BAD_REQUEST,unknownScenario.getStatusCode());
        assertFalse(unknownScenario.getBody().contains("AUTHENTICATED"));
        var other = http.getForEntity("/api/v1/youtube/metadata/videos/" + VIDEO,
                String.class);
        assertFalse(other.getStatusCode().is2xxSuccessful());
        var post = http.exchange(ROOT + "/videos/" + VIDEO, HttpMethod.POST, null,
                String.class);
        assertFalse(post.getStatusCode().is2xxSuccessful());
    }

    @Test
    void newStateControllerIsTestProfileAndPropertyGated() {
        var t = MetadataSyntheticStateController.class;
        assertArrayEquals(new String[]{"metadata-offline-test"},
                t.getAnnotation(org.springframework.context.annotation.Profile.class).value());
        var p = t.getAnnotation(org.springframework.boot.autoconfigure.condition.
                ConditionalOnProperty.class);
        assertNotNull(p);
        assertArrayEquals(new String[]{"youtopia.metadata.synthetic-http.enabled"},
                p.name());
        assertEquals("true",p.havingValue());
        assertFalse(p.matchIfMissing());
    }
}
