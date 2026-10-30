package com.youtopia.restore;

import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;

/** Operator-only target access; never exposed through a web controller. */
public class RestoreMarkerStore {
    private final JdbcTemplate target;
    public RestoreMarkerStore(JdbcTemplate target){this.target=target;}
    public void seal(UUID generation,long sequence){if(target.update("UPDATE service.restore_marker SET generation=?,journal_sequence=? WHERE singleton=true",generation,sequence)!=1)throw new IllegalStateException("Missing restored service marker");}
    public DeletionJournal.Marker marker(){return target.queryForObject("SELECT generation,journal_sequence FROM service.restore_marker WHERE singleton=true",(r,n)->new DeletionJournal.Marker(r.getObject(1,UUID.class),r.getLong(2)));}
}
