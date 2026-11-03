package com.youtopia.games;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class GameQueryTest {
    @Test void namespacedNativeIdentifiersAreExactAndBounded(){
        assertThat(GameQuery.appId("steam:4294967295")).isEqualTo(4294967295L);
        for(String invalid:new String[]{"570","steam:0570","steam:0","steam:4294967296","youtube:570","steam:1;DROP"})assertThatThrownBy(()->GameQuery.appId(invalid)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void unsupportedSourcesAndQuerySyntaxCannotSelectSqlIdentifiers(){
        assertThatThrownBy(()->new GameQuery("test",0,20,"password_hash","ASC","ALL","ALL")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new GameQuery("test",0,20,"name","ASC","YOUTUBE","ALL")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new GameQuery("x\ny",0,20,"name","ASC","ALL","ALL")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void classificationAndPagingInputsAreBounded(){
        for(String value:new String[]{"bad","x|a|b","x|'; DROP TABLE t;--","x|a b","|genre","x|"+"a".repeat(81)})
            assertThatThrownBy(()->new GameQuery("",0,20,"name","ASC","ALL","ALL",7,value)).isInstanceOf(IllegalArgumentException.class);
        for(int[] page:new int[][]{{-1,20},{0,0},{0,101}})assertThatThrownBy(()->new GameQuery("",page[0],page[1],"name","ASC","ALL","ALL",7,"ALL")).isInstanceOf(IllegalArgumentException.class);
        assertThat(new GameQuery("",0,20,"name","DESC","ALL","ALL",7,"WEEKLY_TOP_SELLERS|").classification()).endsWith("|");
    }
}
