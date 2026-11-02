package com.youtopia.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.springframework.stereotype.Component;

/** One non-streaming Responses request; no SDK retry, redirects, tools or conversation state. */
@Component
public class OpenAiChatProvider implements ChatProvider {
    private static final URI ENDPOINT=URI.create("https://api.openai.com/v1/responses");
    private final ChatSettings settings;private final ObjectMapper json;private final HttpClient client;private final URI endpoint;
    @org.springframework.beans.factory.annotation.Autowired
    public OpenAiChatProvider(ChatSettings settings,ObjectMapper json){this(settings,json,client(),ENDPOINT);}
    // Only in-process tests can replace the transport. No property or client field controls the destination.
    OpenAiChatProvider(ChatSettings settings,ObjectMapper json,HttpClient client,URI endpoint){this.settings=settings;this.json=json;this.client=client;this.endpoint=endpoint;}
    private static HttpClient client(){
        System.setProperty("jdk.httpclient.disableRetryConnect","true");
        System.setProperty("jdk.httpclient.enableAllMethodRetry","false");
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).version(HttpClient.Version.HTTP_1_1).build();
    }
    @Override public String answer(ChatQuestion question){
        try{
            String body=json.writeValueAsString(Map.of("model",settings.model,"instructions",ChatQuestion.INSTRUCTIONS,"input",question.text,
                "max_output_tokens",300,"reasoning",Map.of("effort","none"),"store",false,"stream",false));
            var request=HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(8)).header("Authorization","Bearer "+settings.key)
                .header("Content-Type","application/json").header("Accept","application/json").POST(HttpRequest.BodyPublishers.ofString(body,StandardCharsets.UTF_8)).build();
            // A bounded body subscriber retains the end-to-end request timeout while reading the body.
            var response=client.send(request,info->new LimitedBodySubscriber(65536));
            int status=response.statusCode();
            if(status==401||status==403)throw new ChatFailure("PROVIDER_AUTH");
            if(status==402)throw new ChatFailure("PROVIDER_QUOTA");
            if(status==429){
                String code="";try{code=json.readTree(response.body()).path("error").path("code").asText();}catch(Exception ignored){}
                throw new ChatFailure(java.util.Set.of("insufficient_quota","credit_balance_exhausted").contains(code)?"PROVIDER_QUOTA":"PROVIDER_RATE");
            }
            if(status<200||status>=300)throw new ChatFailure(status>=500?"PROVIDER_UNAVAILABLE":"PROVIDER_REJECTED");
            var tree=json.readTree(response.body());
            if(!tree.path("status").asText().equals("completed")||!tree.path("output").isArray())throw new ChatFailure("PROVIDER_RESPONSE");
            var text=new StringBuilder();
            for(var output:tree.path("output"))if(output.path("type").asText().equals("message")&&output.path("role").asText().equals("assistant")){
                for(var part:output.path("content"))if(part.path("type").asText().equals("output_text")&&part.path("text").isTextual())text.append(part.path("text").asText());
            }
            String value=text.toString().strip();if(value.isEmpty()||value.length()>8000)throw new ChatFailure("PROVIDER_EMPTY");
            // Never propagate a provider echo of credentials or raw provider error payloads.
            if(!settings.key.isBlank()&&value.contains(settings.key))throw new ChatFailure("PROVIDER_RESPONSE");
            return value;
        }catch(ChatFailure error){throw error;}
        catch(HttpTimeoutException error){throw new ChatFailure("PROVIDER_TIMEOUT");}
        catch(InterruptedException error){Thread.currentThread().interrupt();throw new ChatFailure("PROVIDER_INTERRUPTED");}
        catch(com.fasterxml.jackson.core.JsonProcessingException error){throw new ChatFailure("PROVIDER_RESPONSE");}
        catch(IOException error){throw new ChatFailure("PROVIDER_TRANSPORT");}
        catch(Exception error){throw new ChatFailure("PROVIDER_RESPONSE");}
    }
    private static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final java.util.concurrent.CompletableFuture<byte[]> result=new java.util.concurrent.CompletableFuture<>();
        private final ByteArrayOutputStream bytes=new ByteArrayOutputStream();private final int max;private java.util.concurrent.Flow.Subscription subscription;
        LimitedBodySubscriber(int max){this.max=max;}
        public java.util.concurrent.CompletionStage<byte[]> getBody(){return result;}
        public void onSubscribe(java.util.concurrent.Flow.Subscription value){subscription=value;value.request(1);}
        public void onNext(java.util.List<java.nio.ByteBuffer> buffers){
            for(var buffer:buffers){if(bytes.size()+buffer.remaining()>max){subscription.cancel();result.completeExceptionally(new IOException("Response exceeds bound"));return;}byte[] value=new byte[buffer.remaining()];buffer.get(value);bytes.writeBytes(value);}subscription.request(1);
        }
        public void onError(Throwable error){result.completeExceptionally(error);}
        public void onComplete(){result.complete(bytes.toByteArray());}
    }
}
