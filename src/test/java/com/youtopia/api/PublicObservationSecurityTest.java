package com.youtopia.api;

import com.youtopia.charts.*;
import com.youtopia.games.*;
import com.youtopia.security.SecurityConfiguration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers={GameController.class,GameSearchController.class,RankingChartController.class,ObservationChartController.class},
    properties="youtopia.games.enabled=true")
@Import({SecurityConfiguration.class,TraceFilter.class})
class PublicObservationSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean GameService games;
    @MockitoBean RankingChartService rankings;
    @MockitoBean ObservationChartService observations;

    @ParameterizedTest @ValueSource(strings={
        "/api/v1/games/steam:570",
        "/api/v1/charts/steam/ranking-periods",
        "/api/v1/charts/steam/rankings?source=weekly_native&category=sales&from=2026-10-01T00:00:00Z&to=2026-10-08T00:00:00Z",
        "/api/v1/charts/steam/ccu?appIds=570",
        "/api/v1/charts/steam/app-types",
        "/api/v1/youtube/videos/abcdefghijk/observations"})
    void anonymousApprovedReadsReachTheirControllers(String path)throws Exception {
        mvc.perform(get(path)).andExpect(status().isOk());
        if(path.startsWith("/api/v1/games/"))verify(games).detail("steam:570");
        else if(path.contains("ranking-periods"))verify(rankings).periods();
        else if(path.contains("rankings?"))verify(rankings).get(eq("weekly_native"),eq("sales"),any(),any());
        else if(path.contains("/ccu?"))verify(observations).ccu(any(),eq(7));
        else if(path.contains("app-types"))verify(observations).types();
        else verify(observations).video("abcdefghijk",7);
    }
    private GameService.Listing emptyListing(){
        return new GameService.Listing(List.of(),PageResult.of(List.of(),0,20,0).page(),Instant.parse("2026-10-30T00:00:00Z"),"APPROVED_OBSERVATIONS","EMPTY","UNASSESSED");
    }
    @Test void publicListReturnsOnlyTheCatalogDtoForGuestAndAdmin()throws Exception {
        when(games.list(any())).thenReturn(emptyListing());
        mvc.perform(get("/api/v1/games")).andExpect(status().isOk()).andExpect(jsonPath("dataStatus").value("EMPTY")).andExpect(jsonPath("content").isEmpty());
        mvc.perform(get("/api/v1/games").with(user("operator").roles("ADMIN"))).andExpect(status().isOk());
        verify(games,times(2)).list(any());
    }
    @Test void publicSearchStillRequiresCsrfAndValidInput()throws Exception {
        String body="{\"q\":\"Synthetic\",\"clientEventId\":\"00000000-0000-0000-0000-000000000001\"}";
        mvc.perform(post("/api/v1/games/search").contentType("application/json").content(body)).andExpect(status().isForbidden()).andExpect(jsonPath("code").value("CSRF_INVALID"));
        verifyNoInteractions(games);
        when(games.list(any())).thenReturn(emptyListing());
        mvc.perform(post("/api/v1/games/search").with(csrf().asHeader()).contentType("application/json").content(body)).andExpect(status().isOk()).andExpect(jsonPath("searchTracking.availability").value("UNAVAILABLE"));
    }
    @ParameterizedTest @ValueSource(strings={"/api/v1/me/settings","/api/v1/me/account","/api/v1/admin/members","/api/v1/charts/youtube/query-associations?appIds=570"})
    void publicBrowsingDoesNotOpenPersonalAdminOrUnapprovedMapping(String path)throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        verifyNoInteractions(games,rankings,observations);
    }
    @Test void unknownWritesStayProtectedAndMembersCannotReadAdminApis()throws Exception {
        mvc.perform(post("/api/v1/games/steam:570").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/members").with(user("member").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/me/settings").with(user("operator").roles("ADMIN"))).andExpect(status().isForbidden());
    }
}
