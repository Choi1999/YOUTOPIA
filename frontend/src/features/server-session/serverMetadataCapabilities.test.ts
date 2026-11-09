import { describe, expect, it, vi } from "vitest";
import {
  METADATA_CAPABILITIES_PATH,
  MetadataCapabilityError,
  ServerMetadataCapabilitiesClient,
} from "./serverMetadataCapabilities";

const HOLD = Object.freeze({
  schema: "YOUTOPIA_METADATA_CAPABILITIES_V01",
  status: "UNAVAILABLE",
  policy: "POLICY_HOLD",
  memberAuthenticationRequired: true,
  metadataReadAuthorized: false,
  commentReadAuthorized: false,
  consumerPublicationAuthorized: false,
  providerCredentialsAvailable: false,
  providerRequestsMade: 0,
});

function reply(status: number, body: unknown = HOLD, config: {
  type?: string; cache?: string; redirected?: boolean; raw?: string;
} = {}): Response {
  return {
    status,
    redirected: config.redirected ?? false,
    headers: { get: (name: string) => {
      const key = name.toLowerCase();
      return key === "content-type" ? config.type ?? "application/json" :
        key === "cache-control" ? config.cache ?? "no-store" : null;
    } },
    text: async () => config.raw ?? JSON.stringify(body),
  } as unknown as Response;
}

function setup(result: Response) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(result);
  return { client: new ServerMetadataCapabilitiesClient(fetcher), fetcher };
}

describe("UI-R04-AP — actual Spring metadata capability read boundary", () => {
  it("does not call network until explicitly invoked and returns only unavailable", async () => {
    const { client, fetcher } = setup(reply(200));
    expect(fetcher).not.toHaveBeenCalled();
    expect(await client.check()).toEqual({
      status: "unavailable", policy: "POLICY_HOLD",
    });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(METADATA_CAPABILITIES_PATH, {
      method: "GET", mode: "same-origin", credentials: "same-origin",
      redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
  });

  it("distinguishes server authorization denial, never turns denial into availability", async () => {
    await expect(setup(reply(401)).client.check())
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(setup(reply(403)).client.check())
      .rejects.toMatchObject({ code: "ACCESS_DENIED" });
    for (const status of [200 + 4, 302, 404, 429, 500, 503]) {
      await expect(setup(reply(status)).client.check()).rejects.toBeInstanceOf(
        MetadataCapabilityError,
      );
    }
  });

  it("rejects forged READY and every caller-controlled approval flag", async () => {
    const forged = [
      {...HOLD, status:"READY"},
      {...HOLD, policy:"ALLOW"},
      {...HOLD, metadataReadAuthorized:true},
      {...HOLD, commentReadAuthorized:true},
      {...HOLD, providerCredentialsAvailable:true},
      {...HOLD, consumerPublicationAuthorized:true},
      {...HOLD, providerRequestsMade:1},
      {...HOLD, memberAuthenticationRequired:false},
      {...HOLD, schema:"YOUTOPIA_METADATA_CAPABILITIES_V02"},
      {...HOLD, record:{title:"Forged provider data"}},
      {...HOLD, thumbnailUrl:"https://example.invalid/video.jpg"},
      {...HOLD, metadataReadAuthorized:"false"},
      {...HOLD, providerRequestsMade:"0"},
      null, [], {},
    ];
    for (const payload of forged) {
      await expect(setup(reply(200, payload)).client.check())
        .rejects.toMatchObject({ code: "UNEXPECTED_SERVER_RESPONSE" });
    }
  });

  it("rejects redirects, HTML, cacheable replies, oversized or malformed JSON", async () => {
    for (const variant of [
      reply(200, HOLD, {redirected: true}),
      reply(200, HOLD, {type: "text/html"}),
      reply(200, HOLD, {cache: "public, max-age=3600"}),
      reply(200, HOLD, {raw: "not json"}),
      reply(200, HOLD, {raw: "x".repeat(2049)}),
    ]) {
      await expect(setup(variant).client.check()).rejects.toMatchObject({
        code: "UNEXPECTED_SERVER_RESPONSE",
      });
    }
  });

  it("fails closed on network errors and never persists credentials or capability state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
      new Error("synthetic sensitive backend fault"));
    const client = new ServerMetadataCapabilitiesClient(fetcher);
    localStorage.clear(); sessionStorage.clear();
    await expect(client.check()).rejects.toMatchObject({
      code: "NETWORK_UNAVAILABLE",
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
