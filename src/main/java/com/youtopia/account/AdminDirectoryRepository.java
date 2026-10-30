package com.youtopia.account;

import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.directory.enabled:false}")
public class AdminDirectoryRepository {
    public record Row(UUID id,String email,String status,Instant created,Instant deadline) {}
    private final JdbcTemplate jdbc;
    private static final String FILTER=" WHERE account_status=? AND (strpos(lower(masked_email),lower(?))>0 OR CAST(user_id AS text)=?)";
    public AdminDirectoryRepository(@Qualifier("directoryJdbc")JdbcTemplate jdbc){this.jdbc=jdbc;}
    public long count(String status,String query){return jdbc.queryForObject("SELECT count(*) FROM auth.v_admin_member_directory"+FILTER,Long.class,status,query,query);}
    public List<Row> list(int page,int size,String status,String query){return jdbc.query("SELECT user_id,masked_email,account_status,created_at,recover_until_at FROM auth.v_admin_member_directory"+FILTER+" ORDER BY created_at DESC,user_id ASC LIMIT ? OFFSET ?",this::row,status,query,query,size,(long)page*size);}
    public Optional<Row> detail(UUID id){return jdbc.query("SELECT user_id,masked_email,account_status,created_at,recover_until_at FROM auth.v_admin_member_directory WHERE user_id=? AND account_status IN ('ACTIVE','PENDING_DELETION')",this::row,id).stream().findFirst();}
    private Row row(java.sql.ResultSet r,int ignored)throws java.sql.SQLException{return new Row(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getTimestamp(4).toInstant(),r.getTimestamp(5)==null?null:r.getTimestamp(5).toInstant());}
}
