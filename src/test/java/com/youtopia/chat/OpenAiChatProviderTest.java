package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OpenAiChatProviderTest {
    private final ObjectMapper json=new ObjectMapper();
    private final ChatSettings settings=new ChatSettings("true","synthetic-openai-key-NEVER-REAL","gpt-6-luna","11111111-1111-4111-8111-111111111111","/unused");
    @ParameterizedTest @org.junit.jupiter.params.provider.EnumSource(ChatQuestion.class)
    void sendsOneActualHttpRequestWithServerOwnedFieldsAndParsesAllTextMessages(ChatQuestion question)throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);var calls=new AtomicInteger();
        server.createContext("/v1/responses",exchange->{
            calls.incrementAndGet();assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            assertThat(exchange.getRequestHeaders().getFirst("Authorization")).isEqualTo("Bearer "+settings.key);
            var body=json.readTree(exchange.getRequestBody());assertThat(body.size()).isEqualTo(7);
            assertThat(body.path("model").asText()).isEqualTo("gpt-6-luna");assertThat(body.path("input").asText()).isEqualTo(question.text);
            assertThat(body.path("instructions").asText()).contains("실제 특정 게임","RAG");assertThat(body.path("max_output_tokens").asInt()).isEqualTo(300);
            assertThat(body.at("/reasoning/effort").asText()).isEqualTo("none");assertThat(body.path("store").asBoolean()).isFalse();assertThat(body.path("stream").asBoolean()).isFalse();
            assertThat(body.has("messages")||body.has("previous_response_id")||body.has("tools")).isFalse();
            byte[] response="{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\"},{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"일반 설명\"},{\"type\":\"output_text\",\"text\":\"입니다.\"}]}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try{
            var provider=new OpenAiChatProvider(settings,json,HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build(),URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/v1/responses"));
            assertThat(provider.answer(question)).isEqualTo("일반 설명입니다.");assertThat(calls.get()).isEqualTo(1);
        }finally{server.stop(0);}
    }
    @ParameterizedTest @ValueSource(ints={301,400,401,402,403,429,500,502,503})
    void upstreamErrorsAreSanitizedAndNeverRetried(int status)throws Exception {
        HttpClient client=mock(HttpClient.class);HttpResponse<byte[]> response=mock(HttpResponse.class);when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(("{\"error\":{\"code\":\"credit_balance_exhausted\",\"message\":\""+settings.key+"\"}}").getBytes(StandardCharsets.UTF_8));
        when(client.send(any(),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var provider=new OpenAiChatProvider(settings,json,client,URI.create("https://api.openai.com/v1/responses"));
        assertThatThrownBy(()->provider.answer(ChatQuestion.VIDEO_VOLUME)).isInstanceOf(ChatFailure.class).hasMessage(ChatFailure.MAINTENANCE).hasMessageNotContaining(settings.key);
        verify(client,times(1)).send(any(),any(HttpResponse.BodyHandler.class));
    }
    @ParameterizedTest @ValueSource(strings={"", "not-json", "{}", "{\"status\":\"incomplete\",\"output\":[]}","{\"status\":\"completed\",\"output\":[]}","{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"synthetic-openai-key-NEVER-REAL\"}]}]}"})
    void malformedEmptyIncompleteOrSecretEchoIsNotASuccess(String body)throws Exception {
        HttpClient client=mock(HttpClient.class);HttpResponse<byte[]> response=mock(HttpResponse.class);when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn(body.getBytes(StandardCharsets.UTF_8));when(client.send(any(),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var error=catchThrowableOfType(()->new OpenAiChatProvider(settings,json,client,URI.create("https://api.openai.com/v1/responses")).answer(ChatQuestion.JOINT_SIGNALS),ChatFailure.class);
        assertThat(error).hasMessageNotContaining(settings.key);assertThat(error.category).isIn("PROVIDER_RESPONSE","PROVIDER_EMPTY");
    }
    @Test void timeoutHasOneAttemptAndNoRawExceptionDisclosure()throws Exception {
        HttpClient client=mock(HttpClient.class);when(client.send(any(),any(HttpResponse.BodyHandler.class))).thenThrow(new HttpTimeoutException(settings.key));
        assertThatThrownBy(()->new OpenAiChatProvider(settings,json,client,URI.create("https://api.openai.com/v1/responses")).answer(ChatQuestion.CCU_BASICS)).isInstanceOf(ChatFailure.class).hasMessage(ChatFailure.MAINTENANCE);
        verify(client,times(1)).send(any(),any(HttpResponse.BodyHandler.class));
    }
}
