package com.youtopia.games;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GameClassificationsTest {
    @Test void contractAbsenceDoesNotMeanNoGenreAndTimeoutIsNeverAnEmptyCatalog(){
        var jdbc=mock(JdbcTemplate.class);var catalog=new GameClassifications(jdbc);
        when(jdbc.queryForObject(anyString(),eq(String.class))).thenReturn("PENDING_CONTRACT");
        assertThat(catalog.catalog(Instant.now()).state()).isEqualTo("PENDING_CONTRACT");
        assertThatThrownBy(()->catalog.require("DAILY_MOST_PLAYED|",Instant.now())).isInstanceOf(com.youtopia.account.AccountProblem.class);
        when(jdbc.queryForObject(anyString(),eq(String.class))).thenThrow(new QueryTimeoutException("Synthetic timeout"));
        assertThatThrownBy(()->catalog.catalog(Instant.now())).isInstanceOf(QueryTimeoutException.class);
    }
}
