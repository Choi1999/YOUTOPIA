package com.youtopia.account;

import java.io.Console;
import java.sql.*;
import java.util.*;
import com.youtopia.security.OperatorCommandSupport;
import org.springframework.boot.SpringApplication;

/** Explicit trusted-terminal maintenance. Never called by startup or a web controller. */
public final class AdminOperatorCommand {
    private AdminOperatorCommand() {}
    public static void main(String[] args) {
        OperatorCommandSupport.execute("ADMIN_OPERATOR",()->run(args));
    }
    private static String password(Console console,String prompt) {
        char[] value=console.readPassword("%s",prompt);
        if(value==null)throw new IllegalArgumentException("Console input required");
        try{return new String(value);}finally{Arrays.fill(value,'\0');}
    }
    private static void run(String[] args)throws Exception {
        if(args.length==0 || !Set.of("status","create","reset").contains(args[0]))throw new IllegalArgumentException();
        String mode=args[0];
        if(mode.equals("status")?args.length!=1:
            mode.equals("create")?args.length!=2||!args[1].equals("--reviewed"):
            args.length!=3||!args[2].equals("--reviewed"))throw new IllegalArgumentException();
        Console console=System.console();if(console==null)throw new IllegalStateException("Trusted interactive terminal required");
        String login=AuthenticationService.normalize(console.readLine("Administrator login (3-80 lowercase ASCII letters/digits/._-): "));
        if(login==null||!login.matches("[a-z0-9][a-z0-9._-]{2,79}"))throw new IllegalArgumentException();
        if(!mode.equals("reset")) {
            String url=OperatorCommandSupport.jdbcUrl(console.readLine("Existing JDBC URL (no credentials): "));
            if(!url.equals("jdbc:postgresql://127.0.0.1:5432/youtopia?sslmode=disable"))throw new IllegalArgumentException();
            String user=console.readLine("Existing approved database login: ");
            try(var connection=DriverManager.getConnection(url,user,password(console,"Database password (hidden): "))) {
                if(!"youtopia".equals(connection.getCatalog()))throw new IllegalStateException();
                if(mode.equals("status")) {
                    connection.setReadOnly(true);connection.setAutoCommit(false);
                    printStatus(connection,login);connection.rollback();return;
                }
                String next=password(console,"New administrator password (hidden): ");
                if(!next.equals(password(console,"Confirm password (hidden): ")))throw new IllegalArgumentException();
                boolean created=AdminBootstrapCommand.initialize(connection,login,next,
                    new PasswordPolicy("/etc/youtopia-app/password-blocklist.sha256"),AccountPasswordEncoders.create());
                System.out.println(created?"ADMIN_INITIALIZED":"ADMIN_ALREADY_INITIALIZED; no credential overwritten");
            }
            return;
        }
        UUID request=UUID.fromString(args[1]);
        Map<String,String> env=System.getenv();
        if(!"PRODUCTION".equals(env.get("YOUTOPIA_ENVIRONMENT"))||!"true".equals(env.get("YOUTOPIA_ACCOUNTS_ENABLED"))
            ||!"true".equals(env.get("YOUTOPIA_CONTROL_ENABLED")))throw new IllegalStateException();
        for(String name:List.of("YOUTOPIA_PRIVACY_ENABLED","YOUTOPIA_ACCOUNTS_DELETION_ENABLED",
            "YOUTOPIA_ACCOUNTS_RECONCILIATION_ENABLED","YOUTOPIA_QUERY_ASSOCIATIONS_ENABLED"))
            if(!"false".equals(env.get(name)))throw new IllegalStateException();
        String next=password(console,"Replacement administrator password (hidden): ");
        if(!next.equals(password(console,"Confirm password (hidden): ")))throw new IllegalArgumentException();
        // Use the real restricted stores, session repository, audit and control guard.
        // Only a transient random loopback port is opened; no operating unit is started.
        try(var context=SpringApplication.run(com.youtopia.YoutopiaApplication.class,
                "--server.address=127.0.0.1","--server.port=0","--spring.main.banner-mode=off")) {
            if(!context.getBean(com.youtopia.restore.DeletionJournal.class).servingAllowed())throw new IllegalStateException();
            var outcome=context.getBean(AccountLifecycleService.class).resetAdministratorFromOperator(login,next,request);
            System.out.println("ADMIN_PASSWORD_RESET "+outcome.operationId());
        }
    }
    static void printStatus(Connection connection,String login)throws SQLException {
        try(var query=connection.prepareStatement("SELECT admin_login_name,account_status,auth_version FROM auth.admin_account WHERE admin_login_name=?")) {
            query.setString(1,login);
            try(var rows=query.executeQuery()) {
                if(rows.next())System.out.println("ADMIN_FOUND status="+rows.getString(2)+" auth_version="+rows.getLong(3));
                else System.out.println("ADMIN_NOT_FOUND");
            }
        }
        try(var query=connection.createStatement();var rows=query.executeQuery("SELECT count(*) FROM auth.admin_account")) {
            rows.next();System.out.println("ADMIN_ACCOUNT_COUNT "+rows.getLong(1));
        }
    }
}
