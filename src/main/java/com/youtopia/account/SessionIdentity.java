package com.youtopia.account;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

public record SessionIdentity(Account.Kind kind,UUID id,long authVersion,Instant issuedAt,Instant activityAt,
                              long generation) implements Serializable {
    public static final String ATTRIBUTE="youtopia.identity";
    public boolean expired(Instant now) {
        long idle=kind==Account.Kind.ADMIN ? 900 : 3600;
        long absolute=kind==Account.Kind.ADMIN ? 28800 : 86400;
        return !now.isBefore(activityAt.plusSeconds(idle)) || !now.isBefore(issuedAt.plusSeconds(absolute));
    }
    public SessionIdentity activeAt(Instant now) { return new SessionIdentity(kind,id,authVersion,issuedAt,now,generation); }
}
