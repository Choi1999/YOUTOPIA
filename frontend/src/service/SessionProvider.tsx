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
  async function login(login: string, password: string, admin = false) {
    clear();
    try {
      const identity = await serviceApi.login(login, password, admin);
      setState({
        status: "authenticated",
        identity,
        generation: ++epoch.current,
      });
      channel.current?.postMessage("changed");
    } catch (e) {
      await refresh();
      throw e;
    }
  }
  async function logout() {
    clear();
    try {
      await serviceApi.logout();
      setState({
        status: "guest",
        identity: null,
        generation: ++epoch.current,
      });
      channel.current?.postMessage("changed");
    } catch (e) {
      setState({
        status: "unavailable",
        identity: null,
        generation: epoch.current,
      });
      throw e;
    }
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
