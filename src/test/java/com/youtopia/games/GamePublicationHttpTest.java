package com.youtopia.games;

import com.youtopia.api.TraceFilter;
import com.youtopia.security.SecurityConfiguration;
import com.youtopia.steam.service.CcuRequestBudget;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.PermissionDeniedDataAccessException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP binding/security/DTO serialization with synthetic repository results; no live database. */
@WebMvcTest(controllers=GamePublicationController.class,properties="youtopia.games.enabled=true")
@Import({SecurityConfiguration.class,TraceFilter.class})
class GamePublicationHttpTest {
    static final String PATH="/api/v1/games/steam:570/youtube-publications";
    static final Instant NOW=Instant.parse("2026-11-27T00:00:00Z");
    static final Instant BOUNDARY=Instant.parse("2026-11-20T15:00:00Z");
    @Autowired MockMvc mvc;
    @MockitoBean GameVideoRepository videos;
    @MockitoBean GameRepository games;
    @MockitoBean CcuRequestBudget budget;
    @MockitoBean Clock clock;

    @BeforeEach void source(){
        when(clock.instant()).thenReturn(NOW);
        when(games.exists(570)).thenReturn(true);
        when(videos.status()).thenReturn("AVAILABLE");
        when(videos.videos(570,NOW)).thenReturn(List.of());
    }
    void mixedSource(){
        when(videos.videos(570,NOW)).thenReturn(List.of(
            new GameVideoRepository.Video("bbbbbbbbbbb","Second tie",NOW,NOW.minusSeconds(6)),
            new GameVideoRepository.Video("ddddddddddd","Before period",BOUNDARY.minusNanos(1),NOW.minusSeconds(5)),
            new GameVideoRepository.Video("ccccccccccc","KST boundary",BOUNDARY,NOW.minusSeconds(4)),
            new GameVideoRepository.Video("eeeeeeeeeee",null,null,NOW),
            new GameVideoRepository.Video("aaaaaaaaaaa","First tie",NOW,NOW.minusSeconds(3)),
            new GameVideoRepository.Video("fffffffffff","Future publication",NOW.plusSeconds(1),NOW.minusSeconds(2))));
    }
    @Test void dateDefaultIsPreservedAndSummaryDoesNotDependOnTheSelectedPage()throws Exception {
        mixedSource();
        mvc.perform(get(PATH).param("days","7").param("size","1"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("asOf").value(NOW.toString()))
            .andExpect(jsonPath("videoScope").value("date"))
            .andExpect(jsonPath("selectedDate").value("2026-11-27"))
            .andExpect(jsonPath("videos.content[0].videoId").value("aaaaaaaaaaa"))
            .andExpect(jsonPath("videos.page.totalElements").value(2))
            .andExpect(jsonPath("summary.population").value("QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF"))
            .andExpect(jsonPath("summary.observedVideos").value(6))
            .andExpect(jsonPath("summary.publishedVideos").value(4))
            .andExpect(jsonPath("summary.periodVideos").value(3))
            .andExpect(jsonPath("summary.missingPublishedAt").value(1))
            .andExpect(jsonPath("summary.futurePublishedAt").value(1))
            .andExpect(jsonPath("summary.latestFirstObservedAt").value(NOW.toString()))
            .andExpect(jsonPath("missingPublishedAt").value(1));
        mvc.perform(get(PATH).param("days","7").param("size","1").param("page","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("videos.content[0].videoId").value("bbbbbbbbbbb"))
            .andExpect(jsonPath("summary.observedVideos").value(6)).andExpect(jsonPath("summary.periodVideos").value(3));
    }
    @Test void periodScopeUsesKstBoundariesAndStablePaginationWithoutMissingOrFuturePublications()throws Exception {
        mixedSource();
        mvc.perform(get(PATH).param("days","7").param("scope","period").param("size","2"))
            .andExpect(status().isOk()).andExpect(jsonPath("selectedDate").doesNotExist())
            .andExpect(jsonPath("videoScope").value("period"))
            .andExpect(jsonPath("videos.page.totalElements").value(3))
            .andExpect(jsonPath("videos.page.hasNext").value(true))
            .andExpect(jsonPath("videos.content[0].videoId").value("aaaaaaaaaaa"))
            .andExpect(jsonPath("videos.content[1].videoId").value("bbbbbbbbbbb"))
            .andExpect(jsonPath("points[0].observedVideos").value(1))
            .andExpect(jsonPath("points[6].observedVideos").value(2))
            .andExpect(jsonPath("points[6].inProgress").value(true))
            .andExpect(jsonPath("coverage").value("UNASSESSED"));
        mvc.perform(get(PATH).param("days","7").param("scope","period").param("size","2").param("page","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("videos.content[0].videoId").value("ccccccccccc"));
        mvc.perform(get(PATH).param("days","7").param("scope","period").param("page","10"))
            .andExpect(status().isOk()).andExpect(jsonPath("videos.content").isEmpty())
            .andExpect(jsonPath("summary.periodVideos").value(3));
        mvc.perform(get(PATH).param("days","30").param("scope","period"))
            .andExpect(status().isOk()).andExpect(jsonPath("summary.periodVideos").value(4));
        mvc.perform(get(PATH).param("days","7").param("date","2026-11-21"))
            .andExpect(status().isOk()).andExpect(jsonPath("videos.content[0].videoId").value("ccccccccccc"));
    }
    @Test void confirmedEmptyHasZeroDenominatorsButMissingSourceDoesNot()throws Exception {
        mvc.perform(get(PATH).param("scope","period"))
            .andExpect(status().isOk()).andExpect(jsonPath("dataStatus").value("EMPTY"))
            .andExpect(jsonPath("summary.observedVideos").value(0))
            .andExpect(jsonPath("summary.publishedVideos").value(0))
            .andExpect(jsonPath("summary.periodVideos").value(0))
            .andExpect(jsonPath("summary.latestFirstObservedAt").doesNotExist());
        clearInvocations(videos);
        for(String state:List.of("PENDING_CONTRACT","PERMISSION_UNCONFIRMED")){
            when(videos.status()).thenReturn(state);
            mvc.perform(get(PATH).param("scope","period"))
                .andExpect(status().isOk()).andExpect(jsonPath("dataStatus").value(state))
                .andExpect(jsonPath("summary").doesNotExist()).andExpect(jsonPath("videos").doesNotExist())
                .andExpect(jsonPath("missingPublishedAt").doesNotExist());
        }
        verify(videos,never()).videos(anyLong(),any());
    }
    @ParameterizedTest @ValueSource(ints={7,30})
    void bothSupportedPeriodsIncludeExactlyTheirKstStartDate(int days)throws Exception {
        Instant start=NOW.atZone(ZoneId.of("Asia/Seoul")).toLocalDate().minusDays(days-1)
            .atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        when(videos.videos(570,NOW)).thenReturn(List.of(
            new GameVideoRepository.Video("aaaaaaaaaaa","At boundary",start,NOW),
            new GameVideoRepository.Video("bbbbbbbbbbb","Before boundary",start.minusNanos(1),NOW)));
        mvc.perform(get(PATH).param("scope","period").param("days",Integer.toString(days)))
            .andExpect(status().isOk()).andExpect(jsonPath("summary.observedVideos").value(2))
            .andExpect(jsonPath("summary.publishedVideos").value(2)).andExpect(jsonPath("summary.periodVideos").value(1))
            .andExpect(jsonPath("videos.page.totalElements").value(1))
            .andExpect(jsonPath("videos.content[0].videoId").value("aaaaaaaaaaa"));
    }
    @Test void sourceFailureIs503AndNeverLooksLikeZero()throws Exception {
        when(videos.videos(570,NOW)).thenThrow(new PermissionDeniedDataAccessException("private SQL",null));
        mvc.perform(get(PATH)).andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("code").value("DATA_SOURCE_ERROR"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private SQL"))));
    }
    @Test void gameOutsideTheCatalogReturns404BeforeLookingUpVideos() throws Exception {
        mvc.perform(get("/api/v1/games/steam:999/youtube-publications"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("code").value("GAME_NOT_FOUND"));
        verifyNoInteractions(videos);
    }
    @ParameterizedTest @ValueSource(strings={"scope=invalid","scope=","scope=date&scope=period","scope=period&date=2026-11-27",
        "scope=period&date=","days=7&date=2026-11-20","date=2026-11-28","page=-1","size=101","days=14","unknown=yes"})
    void invalidInputFailsBeforeBudgetAndDatabase(String query)throws Exception {
        mvc.perform(get(PATH+"?"+query)).andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        verifyNoInteractions(videos,games,budget);
    }
}
