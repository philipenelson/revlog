import { describe, it, expect } from "vitest";
import { resetPasswordRoute } from "./useForgotPasswordViewModel";

describe("forgot-password.logic", () => {
  it("routes to reset-password carrying the URL-encoded email", () => {
    expect(resetPasswordRoute("a+b@example.com")).toBe("/reset-password?email=a%2Bb%40example.com");
  });
});
