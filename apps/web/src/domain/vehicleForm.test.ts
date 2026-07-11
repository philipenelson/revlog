import { describe, it, expect } from "vitest";
import { ApiError } from "@maintenance-log/api-client";
import type { VehicleDraft } from "@/domain/types";
import {
  vehicleDisplayLabel,
  isVehicleDraftComplete,
  buildVehiclePayload,
  classifyVehicleLoadError,
} from "./vehicleForm";

const draft = (over: Partial<VehicleDraft> = {}): VehicleDraft => ({
  nickname: "",
  make: "Honda",
  model: "CB650R",
  year: "2019",
  mileage: "4200",
  ...over,
});

describe("vehicleForm", () => {
  describe("vehicleDisplayLabel", () => {
    it("prefers a non-blank nickname", () => {
      expect(vehicleDisplayLabel("  Blackbird ", "Honda", "CB650R")).toBe("Blackbird");
    });
    it("falls back to 'make model' when both present", () => {
      expect(vehicleDisplayLabel("", "Honda", "CB650R")).toBe("Honda CB650R");
      expect(vehicleDisplayLabel("   ", " Honda ", " CB650R ")).toBe("Honda CB650R");
    });
    it("returns null when make or model is missing and there is no nickname", () => {
      expect(vehicleDisplayLabel("", "Honda", "")).toBeNull();
      expect(vehicleDisplayLabel("", "", "")).toBeNull();
    });
  });

  describe("isVehicleDraftComplete", () => {
    it("is true only when make, model, year, and mileage are all filled", () => {
      expect(isVehicleDraftComplete(draft())).toBe(true);
      expect(isVehicleDraftComplete(draft({ nickname: "" }))).toBe(true); // nickname optional
      expect(isVehicleDraftComplete(draft({ year: "" }))).toBe(false);
      expect(isVehicleDraftComplete(draft({ mileage: "   " }))).toBe(false);
    });
  });

  describe("buildVehiclePayload", () => {
    it("trims text, numbers year/mileage, strips mileage commas, empty nickname → null", () => {
      expect(
        buildVehiclePayload(draft({ nickname: "  ", make: " Honda ", model: " CB650R ", year: " 2019 ", mileage: " 12,500 " })),
      ).toEqual({ nickname: null, make: "Honda", model: "CB650R", year: 2019, mileage: 12500 });
    });
    it("keeps a real nickname", () => {
      expect(buildVehiclePayload(draft({ nickname: " Blackbird " })).nickname).toBe("Blackbird");
    });
  });

  describe("classifyVehicleLoadError", () => {
    it("is not-found for 403/404", () => {
      expect(classifyVehicleLoadError(new ApiError(403, {}))).toBe("not-found");
      expect(classifyVehicleLoadError(new ApiError(404, {}))).toBe("not-found");
    });
    it("is error for anything else", () => {
      expect(classifyVehicleLoadError(new ApiError(500, {}))).toBe("error");
      expect(classifyVehicleLoadError(new Error("x"))).toBe("error");
    });
  });
});
