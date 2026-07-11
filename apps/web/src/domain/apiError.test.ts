import { describe, it, expect } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import {
  isUserFacingError,
  apiErrorSlug,
  mapOtpSubmitError,
  errorMessage,
  SERVICE_ERROR,
  OTP_INVALID_CODE,
  OTP_CODE_EXPIRED,
} from "./apiError";

describe("apiError", () => {
  describe("isUserFacingError", () => {
    it("is true only for a 4xx ApiError", () => {
      expect(isUserFacingError(new ApiError(400, {}))).toBe(true);
      expect(isUserFacingError(new ApiError(499, {}))).toBe(true);
      expect(isUserFacingError(new ApiError(500, {}))).toBe(false);
      expect(isUserFacingError(new Error("x"))).toBe(false);
      expect(isUserFacingError(null)).toBe(false);
    });
  });

  describe("apiErrorSlug", () => {
    it("returns the body's error slug when present", () => {
      expect(apiErrorSlug(new ApiError(400, { error: "invalid_code" }))).toBe("invalid_code");
    });

    it("returns null when there is no string slug", () => {
      expect(apiErrorSlug(new ApiError(400, {}))).toBeNull();
      expect(apiErrorSlug(new ApiError(400, { error: 42 }))).toBeNull();
      expect(apiErrorSlug(new ApiError(400, null))).toBeNull();
      expect(apiErrorSlug(new Error("x"))).toBeNull();
    });
  });

  describe("mapOtpSubmitError", () => {
    it("maps invalid_code to friendly copy, not logged", () => {
      expect(mapOtpSubmitError(new ApiError(400, { error: "invalid_code" }))).toEqual({
        message: OTP_INVALID_CODE,
        shouldLog: false,
      });
    });

    it("maps code_expired to friendly copy, not logged", () => {
      expect(mapOtpSubmitError(new ApiError(400, { error: "code_expired" }))).toEqual({
        message: OTP_CODE_EXPIRED,
        shouldLog: false,
      });
    });

    it("maps an unknown 4xx to the service error, not logged", () => {
      expect(mapOtpSubmitError(new ApiError(400, { error: "wat" }))).toEqual({
        message: SERVICE_ERROR,
        shouldLog: false,
      });
    });

    it("maps a 5xx / network failure to the service error and logs it", () => {
      expect(mapOtpSubmitError(new ApiError(500, {}))).toEqual({ message: SERVICE_ERROR, shouldLog: true });
      expect(mapOtpSubmitError(new Error("network"))).toEqual({ message: SERVICE_ERROR, shouldLog: true });
    });
  });

  describe("errorMessage", () => {
    it("returns an Error's own message", () => {
      expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
    });
    it("returns the fallback for a non-Error", () => {
      expect(errorMessage("nope", "fallback")).toBe("fallback");
      expect(errorMessage(undefined, "fallback")).toBe("fallback");
    });
  });
});
