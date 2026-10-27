import { describe, expect, it } from "vitest";
import { createSsoToken, ssoLoginUrl } from "./sso";

// Same vector as wp-siteherd/tests/SignerTest.php; both sides must agree.
const VECTOR =
  "eyJzaXRlIjoiYjcyNTgzMDItMGM3NS00NWJkLWJkOTQtOTljMGJlZTdjYmM3IiwidXNlciI6MSwiaWF0IjoxNzYwMDAwMDAwLCJub25jZSI6IjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2Nzg5YWJjZGVmIn0.c2f8274b81641da44940c9585d98e3eddc73ec6f4894d4930ea68f6c5a2d1ff5";

describe("createSsoToken", () => {
  it("matches the plugin's shared vector", () => {
    expect(
      createSsoToken("a".repeat(64), "b7258302-0c75-45bd-bd94-99c0bee7cbc7", 1, 1760000000, "0123456789abcdef0123456789abcdef"),
    ).toBe(VECTOR);
  });

  it("uses a fresh nonce each time", () => {
    const a = createSsoToken("s", "site", 1);
    const b = createSsoToken("s", "site", 1);
    expect(a).not.toBe(b);
  });
});

describe("ssoLoginUrl", () => {
  it("points at wp-login.php with the action and token", () => {
    expect(ssoLoginUrl("https://example.com", "abc.def")).toBe(
      "https://example.com/wp-login.php?action=siteherd_sso&token=abc.def",
    );
    expect(ssoLoginUrl("https://example.com/blog", "t")).toBe("https://example.com/blog/wp-login.php?action=siteherd_sso&token=t");
  });
});
