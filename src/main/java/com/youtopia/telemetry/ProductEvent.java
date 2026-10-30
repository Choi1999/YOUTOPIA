package com.youtopia.telemetry;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record ProductEvent(@NotNull UUID clientEventId,@NotBlank String eventType,@NotBlank String actionKey,
                           @NotNull JsonNode properties,@Size(max=2048) String searchReceipt) {
    @Override public String toString(){return "ProductEvent[content omitted]";}
}
