import { describe, expect, it } from "vitest";
import { AGENCY_NAME_MAX, brandSubtitle, fleetTitle, normalizeAgencyName, pluginLabel } from "./white-label";

describe("normalizeAgencyName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeAgencyName("  My   Agency \n")).toBe("My Agency");
  });

  it("turns empty or non-string input into null", () => {
    expect(normalizeAgencyName("")).toBeNull();
    expect(normalizeAgencyName("   ")).toBeNull();
    expect(normalizeAgencyName(null)).toBeNull();
    expect(normalizeAgencyName(42)).toBeNull();
  });

  it("caps the length", () => {
    expect(normalizeAgencyName("a".repeat(100))).toHaveLength(AGENCY_NAME_MAX);
  });
});

describe("white label texts", () => {
  it("uses the agency name when set", () => {
    expect(brandSubtitle("My Agency")).toBe("My Agency");
    expect(fleetTitle("My Agency")).toBe("Howdy, My Agency!");
    expect(pluginLabel("My Agency")).toBe("My Agency WordPress Manager");
  });

  it("falls back to the defaults", () => {
    expect(brandSubtitle(null)).toBe("WordPress fleet");
    expect(fleetTitle(null)).toBe("Fleet overview");
    expect(pluginLabel(null)).toBe("WP Siteherd");
  });
});
