import { describe, expect, it } from "vitest";
import { decodeConnectionKey, encodeConnectionKey } from "./connection-key";

const key = {
  url: "https://siteherd.example.com",
  id: "b7258302-0c75-45bd-bd94-99c0bee7cbc7",
  secret: "f".repeat(64),
};

describe("connection key", () => {
  it("round-trips", () => {
    const encoded = encodeConnectionKey(key);
    expect(encoded).toMatch(/^siteherd1_[A-Za-z0-9_-]+$/);
    expect(decodeConnectionKey(encoded)).toEqual(key);
  });

  it("decodes with plain PHP-style base64url (no padding)", () => {
    const payload = Buffer.from(JSON.stringify(key)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeConnectionKey("siteherd1_" + payload)).toEqual(key);
  });

  it("rejects garbage", () => {
    expect(decodeConnectionKey("nope")).toBeNull();
    expect(decodeConnectionKey("siteherd1_!!!")).toBeNull();
    expect(decodeConnectionKey("siteherd1_" + Buffer.from('{"url":1}').toString("base64url"))).toBeNull();
  });
});
