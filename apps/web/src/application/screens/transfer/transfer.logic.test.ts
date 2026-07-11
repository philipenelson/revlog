import { describe, it, expect } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import { classifyTransferLoadError, transferActionError } from "./transfer.logic";

describe("transfer.logic", () => {
  describe("classifyTransferLoadError", () => {
    it("is not-found for a 404", () => {
      expect(classifyTransferLoadError(new ApiError(404, {}))).toBe("not-found");
    });
    it("is error for anything else", () => {
      expect(classifyTransferLoadError(new ApiError(403, {}))).toBe("error");
      expect(classifyTransferLoadError(new ApiError(500, {}))).toBe("error");
      expect(classifyTransferLoadError(new Error("x"))).toBe("error");
    });
  });

  describe("transferActionError", () => {
    it("surfaces an ApiError's own message", () => {
      expect(transferActionError(new ApiError(409, {}), "fallback")).toBe("API request failed with status 409");
    });
    it("uses the generic prompt for a non-ApiError", () => {
      expect(transferActionError(new Error("boom"), "fallback")).toBe("Something went wrong. Try again.");
      expect(transferActionError("nope", "fallback")).toBe("Something went wrong. Try again.");
    });
  });
});
