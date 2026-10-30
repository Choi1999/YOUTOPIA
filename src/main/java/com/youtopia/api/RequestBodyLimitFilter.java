package com.youtopia.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @Order(Ordered.HIGHEST_PRECEDENCE+1)
public class RequestBodyLimitFilter extends OncePerRequestFilter {
    public static final String TOO_LARGE=RequestBodyLimitFilter.class.getName()+".tooLarge";
    private final long limit;private final ObjectMapper mapper;
    public RequestBodyLimitFilter(@Value("${youtopia.api.max-request-bytes:32768}")long limit,ObjectMapper mapper){if(limit<1024||limit>1048576)throw new IllegalArgumentException("Invalid request body limit");this.limit=limit;this.mapper=mapper;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException {
        if(request.getContentLengthLong()>limit){response.setStatus(413);response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);mapper.writeValue(response.getOutputStream(),ApiProblems.create(HttpStatus.PAYLOAD_TOO_LARGE,"REQUEST_TOO_LARGE","The request body is too large.",request));return;}
        var wrapped=new HttpServletRequestWrapper(request){
            private ServletInputStream bounded;
            @Override public ServletInputStream getInputStream()throws IOException {
                if(bounded==null){var original=super.getInputStream();bounded=new ServletInputStream(){
                    long count;
                    void consume(int amount)throws IOException {if(amount>0&&(count+=amount)>limit){request.setAttribute(TOO_LARGE,true);throw new IOException("Request body limit exceeded");}}
                    public int read()throws IOException{int value=original.read();if(value>=0)consume(1);return value;}
                    public int read(byte[] bytes,int offset,int length)throws IOException{int n=original.read(bytes,offset,(int)Math.min(length,Math.max(1,limit-count+1)));consume(n);return n;}
                    public boolean isFinished(){return original.isFinished();}public boolean isReady(){return original.isReady();}
                    public void setReadListener(ReadListener listener){original.setReadListener(listener);}
                };}return bounded;
            }
            @Override public BufferedReader getReader()throws IOException{return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
        };
        chain.doFilter(wrapped,response);
    }
}
