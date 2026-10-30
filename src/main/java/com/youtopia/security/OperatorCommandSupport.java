package com.youtopia.security;

/** Operator CLIs emit outcome codes, never JDBC URLs, input secrets or library exception messages. */
public final class OperatorCommandSupport {
    private OperatorCommandSupport() {}
    @FunctionalInterface public interface Command {void run()throws Exception;}
    public static void execute(String name,Command command){
        if(org.slf4j.LoggerFactory.getILoggerFactory() instanceof ch.qos.logback.classic.LoggerContext context)
            context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).setLevel(ch.qos.logback.classic.Level.OFF);
        try{command.run();}catch(Exception exception){
            String state=exception instanceof java.sql.SQLException sql&&sql.getSQLState()!=null?sql.getSQLState():"STATE_UNCONFIRMED";
            System.err.println(name+"_FAILED "+state);System.exit(1);
        }
    }
    public static String jdbcUrl(String value){
        if(!value.startsWith("jdbc:postgresql:")||java.util.regex.Pattern.compile("(?i)(password|token|secret)=").matcher(value).find())throw new IllegalArgumentException("Credentials must be separate from JDBC URL");
        return value;
    }
}
