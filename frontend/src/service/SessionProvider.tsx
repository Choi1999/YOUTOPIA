import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, serviceApi, type Identity } from "./api";
type State = {
  status: "checking" | "guest" | "authenticated" | "unavailable";
  identity: Identity | null;
  generation: number;
};
type Session = State & {
  refresh: () => Promise<void>;
  login: (login: string, password: string, admin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};
export const ServiceSessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const epoch = useRef(0),
    channel = useRef<BroadcastChannel | null>(null);
  const mutations = useRef(Promise.resolve());
  const pendingMutations = useRef(0);
  const [state, setState] = useState<State>({
    status: "checking",
    identity: null,
    generation: 0,
  });
  const clear = useCallback(() => {
    const generation = ++epoch.current;
    setState({ status: "checking", identity: null, generation });
    return generation;
  }, []);
  const refresh = useCallback(async () => {
    if (pendingMutations.current > 0) return;
    const generation = clear();
    try {
      const identity = await serviceApi.me();
      if (generation === epoch.current)
        setState({ status: "authenticated", identity, generation });
    } catch (e) {
      if (generation === epoch.current)
        setState({
          status:
            e instanceof ApiError && e.status === 401 ? "guest" : "unavailable",
          identity: null,
          generation,
        });
    }
  }, [clear]);
  useEffect(() => {
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener("youtopia-session-changed", changed);
    window.addEventListener("focus", changed);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("youtopia-session");
      channel.current.onmessage = changed;
    }
    return () => {
      ++epoch.current;
      window.removeEventListener("youtopia-session-changed", changed);
      window.removeEventListener("focus", changed);
      channel.current?.close();
    };
  }, [refresh]);
  // Serialize cookie-changing requests, and invalidate responses at intent time.
  // Focus/refresh must not cancel an in-flight login or observe an older cookie.
  function mutate(operation: () => Promise<Identity | null>) {
    const generation = clear();
    ++pendingMutations.current;
    const result = mutations.current.then(async () => {
      try {
        const identity = await operation();
        if (generation === epoch.current) {
          setState({ status: identity ? "authenticated" : "guest", identity, generation });
        }
        channel.current?.postMessage("changed");
      } catch (error) {
        if (generation === epoch.current) {
          setState({ status: "unavailable", identity: null, generation });
        }
        throw error;
      } finally {
        --pendingMutations.current;
      }
    });
    // A failed operation must not prevent a later logout/login from running.
    mutations.current = result.catch(() => {});
    return result;
  }
  function login(login: string, password: string, admin = false) {
    return mutate(() => serviceApi.login(login, password, admin));
  }
  function logout() {
    return mutate(async () => { await serviceApi.logout(); return null; });
  }
  return (
    <ServiceSessionContext.Provider
      value={{ ...state, refresh, login, logout }}
    >
      {children}
    </ServiceSessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(ServiceSessionContext);
  if (!value) throw new Error("Service session provider required");
  return value;
}
