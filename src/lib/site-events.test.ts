import { describe, expect, it } from "vitest";
import { adminChanges } from "./site-events";

const sso = (...ids: number[]) => ({ enabled: true, user_id: null, admins: ids.map((id) => ({ id, login: `u${id}`, name: `User ${id}` })) });

describe("adminChanges", () => {
  it("lists admins added and removed by id", () => {
    expect(adminChanges(sso(1, 2), sso(2, 3))).toEqual({
      added: [{ id: 3, login: "u3", name: "User 3" }],
      removed: [{ id: 1, login: "u1", name: "User 1" }],
    });
  });

  it("reports nothing without a previous admin list", () => {
    expect(adminChanges(null, sso(1))).toEqual({ added: [], removed: [] });
    expect(adminChanges(sso(1), null)).toEqual({ added: [], removed: [] });
  });
});
