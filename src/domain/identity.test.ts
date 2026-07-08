import { describe, expect, it } from "vitest";
import {
  isNameTaken,
  resolveDisplayName,
  suggestName,
  type PresentMember,
} from "./identity";

const present = (...members: [string, string][]): PresentMember[] =>
  members.map(([clientId, name]) => ({ clientId, name }));

describe("isNameTaken", () => {
  it("is false when nobody present holds the name", () => {
    expect(isNameTaken("Marc", present(["a", "Sanne"]), "me")).toBe(false);
  });

  it("is true when another present member holds the name", () => {
    expect(isNameTaken("Marc", present(["a", "Marc"]), "me")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isNameTaken("  marc ", present(["a", "Marc"]), "me")).toBe(true);
  });

  it("does not treat my own seat as a collision (reconnect)", () => {
    expect(isNameTaken("Marc", present(["me", "Marc"]), "me")).toBe(false);
  });
});

describe("suggestName", () => {
  it("returns the desired name when it is free", () => {
    expect(suggestName("Marc", present(["a", "Sanne"]), "me")).toBe("Marc");
  });

  it("appends (2) when the base name is taken", () => {
    expect(suggestName("Marc", present(["a", "Marc"]), "me")).toBe("Marc (2)");
  });

  it("skips to the next free suffix when variants are also taken", () => {
    expect(
      suggestName("Marc", present(["a", "Marc"], ["b", "Marc (2)"]), "me"),
    ).toBe("Marc (3)");
  });

  it("keeps my own name when only my seat holds it (reconnect)", () => {
    expect(suggestName("Marc", present(["me", "Marc"]), "me")).toBe("Marc");
  });

  it("trims the desired name before suggesting", () => {
    expect(suggestName("  Marc  ", present(["a", "Marc"]), "me")).toBe(
      "Marc (2)",
    );
  });
});

describe("resolveDisplayName", () => {
  it("rejects an empty name as invalid", () => {
    expect(resolveDisplayName("  ", present(["a", "Sanne"]), "me")).toEqual({
      status: "invalid",
      error: "Display name is required",
    });
  });

  it("flags a collision with the nearest free suggestion", () => {
    expect(resolveDisplayName("Marc", present(["a", "Marc"]), "me")).toEqual({
      status: "taken",
      suggestion: "Marc (2)",
    });
  });

  it("accepts and trims a free name", () => {
    expect(
      resolveDisplayName("  Marc ", present(["a", "Sanne"]), "me"),
    ).toEqual({ status: "ok", name: "Marc" });
  });

  it("accepts my own name on reconnect without a collision", () => {
    expect(resolveDisplayName("Marc", present(["me", "Marc"]), "me")).toEqual({
      status: "ok",
      name: "Marc",
    });
  });
});
