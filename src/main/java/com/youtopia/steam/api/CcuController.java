package com.youtopia.steam.api;

import com.youtopia.steam.service.CcuService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Positive;
import java.util.Collections;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CcuController {
    private final CcuService service;

    public CcuController(CcuService service) { this.service = service; }

    @GetMapping("/api/v1/steam/apps/{appId}/ccu")
    ResponseEntity<CcuResponse> get(@PathVariable @Positive long appId,
                                  @RequestParam(defaultValue = "7") int days,
                                  HttpServletRequest request) {
        if (Collections.list(request.getParameterNames()).stream().anyMatch(p -> !p.equals("days"))
                || (request.getParameterValues("days") != null && (request.getParameterValues("days").length != 1
                    || !request.getParameter("days").matches("7|30")))) {
            throw new IllegalArgumentException("Unknown or repeated query parameter");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(appId, days));
    }
}
