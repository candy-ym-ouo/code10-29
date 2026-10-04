import { describe, expect, it } from "vitest";
import { parseFiniteNumber, requireFiniteNumber } from "../src/utils/numbers.js";

describe("parseFiniteNumber", () => {
  it("treats empty and nullish input as missing instead of zero", () => {
    expect(parseFiniteNumber("")).toBeNull();
    expect(parseFiniteNumber("   ")).toBeNull();
    expect(parseFiniteNumber(null)).toBeNull();
    expect(parseFiniteNumber(undefined)).toBeNull();
    expect(parseFiniteNumber("abc")).toBeNull();
    expect(parseFiniteNumber(Number.NaN)).toBeNull();
    expect(parseFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseFiniteNumber(true)).toBeNull();
  });

  it("keeps legitimate zero and other finite values", () => {
    expect(parseFiniteNumber(0)).toBe(0);
    expect(parseFiniteNumber("0")).toBe(0);
    expect(parseFiniteNumber(" 88 ")).toBe(88);
    expect(parseFiniteNumber(-1.25)).toBe(-1.25);
  });

  it("requireFiniteNumber throws only for missing or invalid input", () => {
    expect(requireFiniteNumber(0, "目标值")).toBe(0);
    expect(() => requireFiniteNumber("", "目标值")).toThrow("请填写目标值");
    expect(() => requireFiniteNumber(null, "实际值")).toThrow("请填写实际值");
  });
});
