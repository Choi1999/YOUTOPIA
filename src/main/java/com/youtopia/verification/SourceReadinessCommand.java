package com.youtopia.verification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.youtopia.security.OperatorCommandSupport;
import java.sql.DriverManager;
import java.util.*;

/** Separate explicit operator entry point; never invoked by Spring startup. */
public final class SourceReadinessCommand {
    public static void main(String[] args){OperatorCommandSupport.execute("SOURCE_READINESS",()->{
        var env=System.getenv();String user=required(env,"YOUTOPIA_DATA_DB_USER");
        if(!user.equals("ytp_app_data_ro"))throw new IllegalArgumentException("Production verification requires the dedicated application reader");
        var properties=new Properties();properties.setProperty("user",user);properties.setProperty("password",required(env,"YOUTOPIA_DATA_DB_PASSWORD"));
        properties.setProperty("connectTimeout","5");properties.setProperty("socketTimeout","10");properties.setProperty("options","-c default_transaction_read_only=on -c statement_timeout=8000");
        try(var connection=DriverManager.getConnection(OperatorCommandSupport.jdbcUrl(required(env,"YOUTOPIA_DATA_JDBC_URL")),properties)){
            connection.setReadOnly(true);connection.setAutoCommit(false);
            var result=new SourceReadinessVerifier().verify(connection,"youtopia",user);connection.rollback();
            System.out.println(new ObjectMapper().writeValueAsString(result));if(!result.ready())System.exit(2);
        }
    });}
    private static String required(Map<String,String> env,String name){String value=env.get(name);if(value==null||value.isBlank())throw new IllegalArgumentException("Missing configured binding");return value;}
}
