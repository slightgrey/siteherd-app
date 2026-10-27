// The one string a user pastes into the WordPress plugin. It packs everything
// the plugin needs to talk to the dashboard:
//   "siteherd1_" + base64url(JSON {"url": dashboard URL, "id": Site ID, "secret": Secret})
// The wp-siteherd plugin decodes it the same way; keep the two in sync.

const PREFIX = "siteherd1_";

export type ConnectionKey = { url: string; id: string; secret: string };

export function encodeConnectionKey(key: ConnectionKey): string {
  const json = JSON.stringify({ url: key.url, id: key.id, secret: key.secret });
  return PREFIX + Buffer.from(json).toString("base64url");
}

export function decodeConnectionKey(value: string): ConnectionKey | null {
  if (!value.startsWith(PREFIX)) return null;
  try {
    const data = JSON.parse(Buffer.from(value.slice(PREFIX.length), "base64url").toString());
    if (typeof data?.url === "string" && typeof data?.id === "string" && typeof data?.secret === "string") {
      return { url: data.url, id: data.id, secret: data.secret };
    }
  } catch {}
  return null;
}
