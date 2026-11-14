export const PUBLIC_ORIGIN = "https://atmemo.afabl.fyi";
export const OAUTH_CALLBACK_PATH = "/oauth/callback";
export const PASSPORT_CALLBACK_PATH = "/atpassport/callback";
export const CLIENT_METADATA_PATH = "/oauth-client-metadata.json";
export const OAUTH_SCOPE =
  "atproto space:fyi.afabl.atmemo?authority=self&skey=self&collection=fyi.afabl.atmemo.memo&action=read_self&action=create&action=update&action=delete";

export function getOAuthClientId(origin: string): string {
  const url = new URL(origin);
  if (
    url.protocol === "http:" &&
    ["127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    const clientId = new URL("http://localhost");
    clientId.searchParams.set(
      "redirect_uri",
      new URL(OAUTH_CALLBACK_PATH, url).href,
    );
    clientId.searchParams.set("scope", OAUTH_SCOPE);
    return clientId.href;
  }
  if (url.protocol !== "https:")
    throw new Error("HTTPS、または127.0.0.1で開いてください。");
  if (url.origin !== PUBLIC_ORIGIN)
    throw new Error(`${PUBLIC_ORIGIN}で開いてください。`);
  return new URL(CLIENT_METADATA_PATH, PUBLIC_ORIGIN).href;
}

export function createClientMetadata() {
  const url = new URL(PUBLIC_ORIGIN);
  return {
    client_id: new URL(CLIENT_METADATA_PATH, url).href,
    client_name: "atmemo",
    client_uri: url.origin,
    redirect_uris: [new URL(OAUTH_CALLBACK_PATH, url).href],
    scope: OAUTH_SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  };
}
