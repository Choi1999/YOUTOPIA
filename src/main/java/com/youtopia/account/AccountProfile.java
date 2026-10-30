package com.youtopia.account;

import java.time.Instant;
import java.util.UUID;

public record AccountProfile(UUID id,String email,String status,Instant createdAt) {}
