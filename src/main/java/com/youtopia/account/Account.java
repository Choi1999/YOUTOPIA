package com.youtopia.account;

import java.util.UUID;

public record Account(UUID id,String login,String passwordHash,String status,long authVersion,long rowVersion) {
    @Override public String toString(){return "Account[id="+id+", credentials=redacted]";}
    public enum Kind { USER, ADMIN }
}
