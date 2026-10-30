package com.youtopia.telemetry;

import java.util.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository @ConditionalOnExpression("${youtopia.accounts.enabled:false} && ${youtopia.events.enabled:false}")
public class EventPersistence {
    private final JdbcTemplate jdbc;
    public EventPersistence(@Qualifier("eventJdbc") JdbcTemplate jdbc){this.jdbc=jdbc;}
    public byte[] existing(UUID id){var rows=jdbc.query("SELECT payload_fingerprint FROM telemetry.product_event WHERE client_event_id=?",(r,n)->r.getBytes(1),id);return rows.isEmpty()?null:rows.getFirst();}
    @org.springframework.transaction.annotation.Transactional(transactionManager="eventTx",timeout=8)
    public boolean insert(ProductEvent event,EventCatalog.Validated value,UUID session,UUID user,String environment,byte[] digest){
        var columns=new ArrayList<>(List.of("client_event_id","event_type","action_key","analytics_session_key","analytics_user_key","environment","payload_fingerprint"));
        var parameters=new ArrayList<Object>(Arrays.asList(event.clientEventId(),value.type(),value.action(),session,user,environment,digest));
        for(String key:value.values().keySet()){
            columns.add(value.columns().get(key));Object parameter=value.values().get(key);
            if(key.equals("filterKeys")){var codes=(List<?>)parameter;parameter=new org.springframework.jdbc.core.SqlTypeValue(){public void setTypeValue(java.sql.PreparedStatement statement,int index,int sqlType,String typeName)throws java.sql.SQLException{statement.setArray(index,statement.getConnection().createArrayOf("text",codes.toArray()));}};}
            parameters.add(parameter);
        }
        String sql="INSERT INTO telemetry.product_event("+String.join(",",columns)+") VALUES("+String.join(",",Collections.nCopies(columns.size(),"?"))+") ON CONFLICT DO NOTHING RETURNING event_id";
        return !jdbc.query(sql,(r,n)->r.getObject(1,UUID.class),parameters.toArray()).isEmpty();
    }
}
