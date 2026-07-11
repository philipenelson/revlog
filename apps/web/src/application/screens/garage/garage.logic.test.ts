import { describe, it, expect } from "vitest";
import { deriveGarageFlags } from "./garage.logic";

describe("garage.logic — deriveGarageFlags", () => {
  it("is neither empty nor populated while loading", () => {
    expect(deriveGarageFlags("loading", 0)).toEqual({ isEmpty: false, isPopulated: false });
    expect(deriveGarageFlags("loading", 3)).toEqual({ isEmpty: false, isPopulated: false });
  });

  it("is neither empty nor populated on error", () => {
    expect(deriveGarageFlags("error", 0)).toEqual({ isEmpty: false, isPopulated: false });
  });

  it("is empty when loaded with no vehicles", () => {
    expect(deriveGarageFlags("loaded", 0)).toEqual({ isEmpty: true, isPopulated: false });
  });

  it("is populated when loaded with vehicles", () => {
    expect(deriveGarageFlags("loaded", 2)).toEqual({ isEmpty: false, isPopulated: true });
  });
});
