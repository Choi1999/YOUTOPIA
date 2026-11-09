/**
 * UI-R04-AP: opt-in, same-origin USER capability check against real Spring.
 *
 * A capability document is *not* source provenance, authorization to ingest,
 * or actual metadata. Only the exact unavailable/POLICY_HOLD contract is
 * recognized. Every other response fails closed. No provider URLs, credentials,
 * cookies, CSRF tokens or status payloads are persisted in browser storage.
 */
export const METADATA_CAPABILITIES_PATH =
  "/api/v1/youtube/metadata/capabilities" as const;

export type ServerMetadataAvailability =
  Readonly<{ status: "unavailable"; policy: "POLICY_HOLD" }>;

export type MetadataCapabilityFailure =
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "NETWORK_UNAVAILABLE"
  | "UNEXPECTED_SERVER_RESPONSE";

export class MetadataCapabilityError extends Error {
  constructor(public readonly code: MetadataCapabilityFailure) {
    super(code);
    this.name = "MetadataCapabilityError";
  }
}

const EXPECTED_FIELDS = [
  "schema", "status", "policy", "memberAuthenticationRequired",
  "metadataReadAuthorized", "commentReadAuthorized",
  "consumerPublicationAuthorized", "providerCredentialsAvailable",
  "providerRequestsMade",
].sort().join("|");

function validUnavailableDocument(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    return false;
  const obj = raw as Record<string, unknown>;
  return Object.keys(obj).sort().join("|") === EXPECTED_FIELDS &&
    obj.schema === "YOUTOPIA_METADATA_CAPABILITIES_V01" &&
    obj.status === "UNAVAILABLE" &&
    obj.policy === "POLICY_HOLD" &&
    obj.memberAuthenticationRequired === true &&
    obj.metadataReadAuthorized === false &&
    obj.commentReadAuthorized === false &&
    obj.consumerPublicationAuthorized === false &&
    obj.providerCredentialsAvailable === false &&
    obj.providerRequestsMade === 0;
}

function secureSameOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return protocol === "https:" ||
    (protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname));
}

/** No calls occur until the caller explicitly checks an authenticated session. */
export class ServerMetadataCapabilitiesClient {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  async check(): Promise<ServerMetadataAvailability> {
    if (!secureSameOrigin())
      throw new MetadataCapabilityError("NETWORK_UNAVAILABLE");
    let response: Response;
    try {
      response = await this.transport(METADATA_CAPABILITIES_PATH, {
        method: "GET",
        mode: "same-origin",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new MetadataCapabilityError("NETWORK_UNAVAILABLE");
    }

    if (response.status === 401) throw new MetadataCapabilityError("AUTH_REQUIRED");
    if (response.status === 403) throw new MetadataCapabilityError("ACCESS_DENIED");
    if (response.status !== 200 || response.redirected ||
        !/^application\/json(?:\s*;|$)/i.test(
          response.headers.get("content-type") ?? "") ||
        !/\bno-store\b/i.test(response.headers.get("cache-control") ?? "")) {
      throw new MetadataCapabilityError("UNEXPECTED_SERVER_RESPONSE");
    }

    let payload: unknown;
    try {
      const body = await response.text();
      if (body.length < 2 || body.length > 2048)
        throw new Error("Unexpected payload size");
      payload = JSON.parse(body) as unknown;
    } catch {
      throw new MetadataCapabilityError("UNEXPECTED_SERVER_RESPONSE");
    }
    if (!validUnavailableDocument(payload))
      throw new MetadataCapabilityError("UNEXPECTED_SERVER_RESPONSE");

    // Explicitly no READY variant: a 200 capability document cannot make
    // provider metadata available or switch on any workspace reader.
    return { status: "unavailable", policy: "POLICY_HOLD" };
  }
}

export const serverMetadataCapabilitiesClient =
  new ServerMetadataCapabilitiesClient();
