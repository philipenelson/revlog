import { describe, it, expect } from "vitest";
import { safeNextPath, resolvePostAuthRoute, verifyEmailRoute } from "./login.logic";

describe("login.logic", () => {
  describe("safeNextPath", () => {
    it("returns null for a null or empty param", () => {
      expect(safeNextPath(null)).toBeNull();
      expect(safeNextPath("")).toBeNull();
    });

    it("keeps a same-origin path with its search string", () => {
      expect(safeNextPath("/garage?tab=all")).toBe("/garage?tab=all");
      expect(safeNextPath("/vehicles/123")).toBe("/vehicles/123");
    });

    it("rejects an absolute off-origin URL (open-redirect guard)", () => {
      expect(safeNextPath("https://evil.example.com/phish")).toBeNull();
      expect(safeNextPath("//evil.example.com")).toBeNull();
    });

    it("strips the origin from an absolute same-origin URL, keeping path+search", () => {
      expect(safeNextPath("http://localhost/garage?x=1")).toBe("/garage?x=1");
    });
  });

  describe("resolvePostAuthRoute", () => {
    it("prefers an explicit safe next path over the status route", () => {
      expect(resolvePostAuthRoute("/vehicles/7", "ACTIVE")).toBe("/vehicles/7");
    });

    it("falls back to the account-status route when there is no next path", () => {
      expect(resolvePostAuthRoute(null, "ACTIVE")).toBe("/garage");
      expect(resolvePostAuthRoute(null, "ONBOARDING")).toBe("/onboarding");
    });
  });

  describe("verifyEmailRoute", () => {
    it("targets verify-email carrying the URL-encoded email", () => {
      expect(verifyEmailRoute("a+b@example.com")).toBe(
        "/verify-email?email=a%2Bb%40example.com",
      );
    });
  });
});
