package com.youtopia.api;

import java.util.List;

public record PageResult<T>(List<T> content,Page page) {
    public record Page(int number,int size,long totalElements,long totalPages,boolean hasNext) {}
    public static void validate(int page,int size){if(page<0||size<1||size>100)throw new IllegalArgumentException("Invalid page or size");}
    public static <T> PageResult<T> of(List<T> items,int number,int size,long total) {
        validate(number,size);long pages=total/size+(total%size==0?0:1);
        return new PageResult<>(List.copyOf(items),new Page(number,size,total,pages,(long)number+1<pages));
    }
}
