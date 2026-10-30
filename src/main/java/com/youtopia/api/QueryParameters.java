package com.youtopia.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;

public final class QueryParameters {
    private QueryParameters() {}
    public static void only(HttpServletRequest request,String... allowed) {
        var names=Set.of(allowed);
        request.getParameterMap().forEach((key,values)->{
            if(!names.contains(key)||values.length!=1)throw new IllegalArgumentException("Unknown or repeated query parameter");
        });
    }
}
