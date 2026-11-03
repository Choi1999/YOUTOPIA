package com.youtopia.games;

import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GameSteamTagsTest {
    @Test void idsAreCanonicalBoundedNumbersNeverNamesOrSql(){
        for(String value:new String[]{"0","-1","+1","01","1.0","4294967296","1 OR 1=1","스포츠","","701,599"})
            assertThatThrownBy(()->new GameQuery("",0,20,"name","ASC","ALL","ALL",7,"ALL",value)).isInstanceOf(IllegalArgumentException.class);
        assertThat(GameSteamTags.id("4294967295")).isEqualTo(4294967295L);
        assertThat(new GameQuery("",0,20,"name","ASC","ALL","ALL").tagId()).isEqualTo("ALL");
    }
    @Test void missingPermissionAndTimeoutAreNotSuccessfulEmptyTags(){
        var jdbc=mock(JdbcTemplate.class);var tags=new GameSteamTags(jdbc);
        for(String state:new String[]{"PENDING_CONTRACT","PERMISSION_UNCONFIRMED"}){
            when(jdbc.queryForObject(anyString(),eq(String.class))).thenReturn(state);
            assertThat(tags.catalog().state()).isEqualTo(state);
            assertThatThrownBy(()->tags.require("701")).isInstanceOf(com.youtopia.account.AccountProblem.class);
        }
        when(jdbc.queryForObject(anyString(),eq(String.class))).thenThrow(new QueryTimeoutException("Synthetic timeout"));
        assertThatThrownBy(tags::catalog).isInstanceOf(QueryTimeoutException.class);
        assertThatThrownBy(()->tags.require("701")).isInstanceOf(QueryTimeoutException.class);
    }
}
