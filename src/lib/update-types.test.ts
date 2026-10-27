import { describe, expect, it } from "vitest";
import { itemJobLabel, itemJobStates } from "./update-types";

const plugin = (id: string) => ({ type: "plugin" as const, id });

describe("itemJobStates", () => {
  it("maps items in unfinished jobs and ignores finished ones", () => {
    const states = itemJobStates([
      { kind: "update", status: "running", items: [plugin("a/a.php")] },
      { kind: "rollback", status: "waiting", items: [plugin("b/b.php")] },
      { kind: "update", status: "completed", items: [plugin("c/c.php")] },
    ]);
    expect(states).toEqual({
      "plugin:a/a.php": { kind: "update", waiting: false },
      "plugin:b/b.php": { kind: "rollback", waiting: true },
    });
  });

  it("prefers the active job over a waiting one for the same item", () => {
    const states = itemJobStates([
      { kind: "rollback", status: "waiting", items: [plugin("a/a.php")] },
      { kind: "update", status: "queued", items: [plugin("a/a.php")] },
    ]);
    expect(states["plugin:a/a.php"]).toEqual({ kind: "update", waiting: false });
  });

  it("labels rows", () => {
    expect(itemJobLabel({ kind: "update", waiting: true })).toBe("Queued");
    expect(itemJobLabel({ kind: "rollback", waiting: false })).toBe("Rolling back…");
  });
});
