package com.youtopia.integration;

/** Non-secret endpoints injected by Gradle after validating owned disposable containers. */
public final class IsolatedTestServices {
    private IsolatedTestServices() {}
    private static int port(String name) {
        if(System.getenv().keySet().stream().anyMatch(k->k.startsWith("DB_")||k.startsWith("PG")||k.startsWith("YOUTOPIA_")))
            throw new IllegalStateException("Runtime database bindings must be removed from the test process");
        int value=Integer.parseInt(System.getProperty("youtopia.test."+name,"0"));
        if(value<1024||value>65535)throw new IllegalStateException("Prepare owned synthetic test services first");
        return value;
    }
    public static int redisPort(){return port("redisPort");}
    public static String url(String database){
        if(!java.util.Set.of("youtopia_test","youtopia_auth_test","youtopia_control_test","youtopia_source_test").contains(database))
            throw new IllegalArgumentException("Synthetic test database required");
        return "jdbc:postgresql://127.0.0.1:"+port("postgresPort")+"/"+database;
    }
    public static String postgresContainer(){
        String value=System.getProperty("youtopia.test.postgresContainer","");
        if(!value.matches("youtopia-test-pg-[a-f0-9]{12}"))throw new IllegalStateException("Owned synthetic container required");
        return value;
    }
}
