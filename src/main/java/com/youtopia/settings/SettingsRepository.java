package com.youtopia.settings;

import java.util.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnProperty(name="youtopia.accounts.enabled",havingValue="true")
public class SettingsRepository {
    private final JdbcTemplate jdbc;
    public record Stored(long version,String json) {}
    public SettingsRepository(@Qualifier("memberJdbc")JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Stored find(UUID user){var rows=jdbc.query("SELECT row_version,preferences::text FROM service.user_setting WHERE user_id=?",(r,n)->new Stored(r.getLong(1),r.getString(2)),user);return rows.isEmpty()?null:rows.getFirst();}
    public void ensureRow(UUID user){jdbc.update("INSERT INTO service.user_setting(user_id,preferences) VALUES(?,'{}'::jsonb) ON CONFLICT DO NOTHING",user);}
    public boolean patch(UUID user,long expected,String changes){return jdbc.update("UPDATE service.user_setting SET preferences=preferences||?::jsonb,row_version=row_version+1,updated_at=current_timestamp WHERE user_id=? AND row_version=?",changes,user,expected)==1;}
}
