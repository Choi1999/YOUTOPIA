import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "./SessionProvider";
import { serviceApi } from "./api";
/** Auth idle activity follows trusted interaction; polling/telemetry never generates heartbeats. */
export function UserActivity() {
  const session = useSession();
  useEffect(() => {
    if (session.status !== "authenticated") return;
    let last = -Infinity;
    const activity = (event: Event) => {
      if (!event.isTrusted || performance.now() - last < 30000) return;
      last = performance.now();
      void serviceApi
        .request("/api/v1/auth/activity", {
          method: "POST",
          body: {},
          account: session.identity!.id,
        })
        .catch(() => {});
    };
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [session.generation, session.status]);
  return null;
}
type Interaction =
  | {
      type: "SORT_CHANGED";
      action: "games.sort.change";
      properties: { sortKey: string; direction: string };
    }
  | {
      type: "FILTER_CHANGED";
      action: "games.filter.change";
      properties: { filterKey: string; filterValue: string };
    }
  | {
      type: "PERIOD_CHANGED";
      action: "analysis.period.change";
      properties: { fromPeriod: string; toPeriod: string };
    }
  | {
      type: "ANALYSIS_VIEW";
      action: "analysis.view";
      properties: { appId: number; analysisType: "STEAM" | "YOUTUBE" };
    };

/** Explicit interactions only; no query text, timer, administrator or fallback collection. */
export function useInteractionEvents() {
  const session = useSession();
  return useCallback(
    (event: Interaction) => {
      if (
        (session.status !== "guest" && session.identity?.kind !== "USER") ||
        import.meta.env.VITE_PRODUCT_EVENTS_ENABLED !== "true"
      )
        return;
      void serviceApi
        .request("/api/v1/events", {
          method: "POST",
          account: session.identity?.id,
          body: {
            clientEventId: crypto.randomUUID(),
            eventType: event.type,
            actionKey: event.action,
            properties: event.properties,
          },
        })
        .catch(() => {});
    },
    [session.status, session.identity?.id, session.identity?.kind],
  );
}

export function usePageView(
  routeKey: string,
  ready: boolean,
  appId?: number,
  analysisType?: "STEAM" | "YOUTUBE",
) {
  const session = useSession();
  const interaction = useInteractionEvents();
  const location = useLocation();
  useEffect(() => {
    if (lastNavigation !== location.key) {
      lastNavigation = location.key;
      navigationVersion++;
    }
    if (
      !ready ||
      (session.status !== "guest" && session.identity?.kind !== "USER") ||
      import.meta.env.VITE_PRODUCT_EVENTS_ENABLED !== "true"
    )
      return;
    // Focus revalidation can remount a guarded page without a navigation.
    // That must not produce a new view or keep a visitor session active.
    const key = (session.identity?.id ?? "guest") + ":" + navigationVersion + ":" + routeKey;
    if (pageViews.has(key)) return;
    pageViews.add(key);
    if (pageViews.size > 256)
      pageViews.delete(pageViews.values().next().value!);
    if (appId && analysisType)
      interaction({
        type: "ANALYSIS_VIEW",
        action: "analysis.view",
        properties: { appId, analysisType },
      });
    void serviceApi
      .request("/api/v1/events", {
        method: "POST",
        account: session.identity?.id,
        body: {
          clientEventId: crypto.randomUUID(),
          eventType: "PAGE_VIEW",
          actionKey: "route.view",
          properties: { routeKey, ...(appId ? { appId } : {}) },
        },
      })
      .catch(() => {});
  }, [
    ready,
    routeKey,
    session.generation,
    appId,
    analysisType,
    interaction,
    location.key,
  ]);
}

let lastNavigation: string | undefined;
let navigationVersion = 0;
const pageViews = new Set<string>();
