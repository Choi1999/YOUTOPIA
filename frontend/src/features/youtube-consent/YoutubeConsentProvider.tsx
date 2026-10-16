import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type YoutubeConsentStatus =
  | "not-connected"
  | "review"
  | "approved"
  | "denied"
  | "cancelled"
  | "expired";

type YoutubeConsentContextValue = {
  status: YoutubeConsentStatus;
  beginReview: () => void;
  approve: () => void;
  deny: () => void;
  cancel: () => void;
  expire: () => void;
  disconnect: () => void;
};

const YoutubeConsentContext = createContext<YoutubeConsentContextValue | null>(null);

export function YoutubeConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<YoutubeConsentStatus>("not-connected");

  const value = useMemo(
    () => ({
      status,
      beginReview: () => setStatus("review"),
      approve: () => setStatus("approved"),
      deny: () => setStatus("denied"),
      cancel: () => setStatus("cancelled"),
      expire: () => setStatus("expired"),
      disconnect: () => setStatus("not-connected"),
    }),
    [status],
  );

  return (
    <YoutubeConsentContext.Provider value={value}>
      {children}
    </YoutubeConsentContext.Provider>
  );
}

export function useYoutubeConsent() {
  const context = useContext(YoutubeConsentContext);
  if (!context) {
    throw new Error("useYoutubeConsent must be used within YoutubeConsentProvider");
  }
  return context;
}
