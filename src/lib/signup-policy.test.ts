import { describe, expect, it } from "vitest";
import { signupPolicy } from "./signup-policy";

describe("signupPolicy", () => {
  it("is open to anyone when nothing is configured", () => {
    const p = signupPolicy({}, 5);
    expect(p.open).toBe(true);
    expect(p.emailAllowed("anyone@example.com")).toBe(true);
  });

  it("only allows the listed emails, ignoring case and spaces", () => {
    const p = signupPolicy({ SIGNUP_EMAILS: " Owner@Example.com , second@example.com" }, 0);
    expect(p.emailAllowed("owner@example.com")).toBe(true);
    expect(p.emailAllowed("  OWNER@example.COM ")).toBe(true);
    expect(p.emailAllowed("second@example.com")).toBe(true);
    expect(p.emailAllowed("someone@example.com")).toBe(false);
  });

  it("closes once MAX_ACCOUNTS accounts exist", () => {
    expect(signupPolicy({ MAX_ACCOUNTS: "1" }, 0).open).toBe(true);
    expect(signupPolicy({ MAX_ACCOUNTS: "1" }, 1).open).toBe(false);
    expect(signupPolicy({ MAX_ACCOUNTS: "3" }, 2).open).toBe(true);
  });

  it("ignores an empty or invalid MAX_ACCOUNTS", () => {
    expect(signupPolicy({ MAX_ACCOUNTS: "" }, 10).open).toBe(true);
    expect(signupPolicy({ MAX_ACCOUNTS: "lots" }, 10).open).toBe(true);
  });
});
