import { describe, expect, it } from "vitest";
import {
  completionSchema,
  goalActivateSchema,
  goalCreateSchema,
  goalProgressCreateSchema,
  goalUpdateSchema,
  readOptionalMetric,
  readRequiredMetric,
} from "../src/index.js";

const uuid = "11111111-1111-1111-1111-111111111111";

const validGoalInput = {
  sourceSessionId: uuid,
  title: "连续演奏 17-24 小节",
  category: "SPEED",
  metricType: "SPEED",
  targetValue: 90,
  unit: "BPM",
  dueDate: "2026-10-10T00:00:00.000Z",
  evidenceRequirement: "NONE",
};

describe("required metric values reject missing input instead of coercing to zero", () => {
  it("rejects empty, whitespace, null and missing target values", () => {
    for (const targetValue of ["", "   ", null, undefined]) {
      const result = goalCreateSchema.safeParse({ ...validGoalInput, targetValue });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join(".") === "targetValue")).toBe(true);
      }
    }
  });

  it("rejects empty, whitespace, null and missing progress values", () => {
    for (const actualValue of ["", "   ", null, undefined]) {
      const result = goalProgressCreateSchema.safeParse({ sessionId: uuid, actualValue });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join(".") === "actualValue")).toBe(true);
      }
    }
  });

  it("rejects non-numeric and non-finite values", () => {
    expect(goalCreateSchema.safeParse({ ...validGoalInput, targetValue: "abc" }).success).toBe(false);
    expect(goalCreateSchema.safeParse({ ...validGoalInput, targetValue: Number.NaN }).success).toBe(false);
    expect(goalCreateSchema.safeParse({ ...validGoalInput, targetValue: true }).success).toBe(false);
    expect(goalProgressCreateSchema.safeParse({ sessionId: uuid, actualValue: "NaN" }).success).toBe(false);
  });

  it("still accepts an explicit, legitimate zero", () => {
    const created = goalCreateSchema.safeParse({ ...validGoalInput, targetValue: 0 });
    expect(created.success).toBe(true);
    if (created.success) expect(created.data.targetValue).toBe(0);

    const progress = goalProgressCreateSchema.safeParse({ sessionId: uuid, actualValue: 0 });
    expect(progress.success).toBe(true);
    if (progress.success) expect(progress.data.actualValue).toBe(0);
  });

  it("parses finite numeric strings without accepting empty strings", () => {
    const created = goalCreateSchema.safeParse({ ...validGoalInput, targetValue: "88.5" });
    expect(created.success).toBe(true);
    if (created.success) expect(created.data.targetValue).toBe(88.5);

    const progress = goalProgressCreateSchema.safeParse({ sessionId: uuid, actualValue: "72" });
    expect(progress.success).toBe(true);
    if (progress.success) expect(progress.data.actualValue).toBe(72);
  });

  it("rejects target value on activate and update payloads", () => {
    expect(goalActivateSchema.safeParse({ targetValue: "" }).success).toBe(false);
    expect(goalActivateSchema.safeParse({ targetValue: null }).success).toBe(false);
    expect(goalActivateSchema.safeParse({}).success).toBe(true);
    expect(goalUpdateSchema.safeParse({ version: 0, targetValue: "  " }).success).toBe(false);
  });
});

describe("optional baseline value normalizes absence to null, never zero", () => {
  it("maps empty/whitespace/null to null and accepts omission", () => {
    for (const baselineValue of ["", "   ", null]) {
      const result = goalCreateSchema.safeParse({ ...validGoalInput, baselineValue });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.baselineValue).toBeNull();
    }
    const omitted = goalCreateSchema.safeParse(validGoalInput);
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.baselineValue).toBeUndefined();
  });

  it("preserves an explicit, legitimate zero baseline", () => {
    const result = goalCreateSchema.safeParse({ ...validGoalInput, baselineValue: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.baselineValue).toBe(0);
  });

  it("rejects malformed baseline input", () => {
    expect(goalCreateSchema.safeParse({ ...validGoalInput, baselineValue: "abc" }).success).toBe(false);
  });
});

describe("completion payload keeps nested error paths", () => {
  it("rejects empty goal target and progress values during review completion", () => {
    const result = completionSchema.safeParse({
      version: 0,
      review: { nextFocus: "慢速分段练习" },
      goalCreates: [{ ...validGoalInput, sourceSessionId: undefined, targetValue: "" }],
      goalProgressUpdates: [{ goalId: uuid, actualValue: " " }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("goalCreates.0.targetValue");
      expect(paths).toContain("goalProgressUpdates.0.actualValue");
    }
  });
});

describe("frontend metric input helpers", () => {
  it("readRequiredMetric throws on missing input and returns finite numbers otherwise", () => {
    expect(() => readRequiredMetric("目标值", "")).toThrow("目标值不能为空");
    expect(() => readRequiredMetric("目标值", "  ")).toThrow("目标值不能为空");
    expect(() => readRequiredMetric("目标值", null)).toThrow("目标值不能为空");
    expect(() => readRequiredMetric("目标值", undefined)).toThrow("目标值不能为空");
    expect(() => readRequiredMetric("目标值", "abc")).toThrow("有限数值");
    expect(readRequiredMetric("目标值", 0)).toBe(0);
    expect(readRequiredMetric("目标值", "60")).toBe(60);
  });

  it("readOptionalMetric returns null on absence while keeping explicit values", () => {
    expect(readOptionalMetric("基线值", "")).toBeNull();
    expect(readOptionalMetric("基线值", "  ")).toBeNull();
    expect(readOptionalMetric("基线值", null)).toBeNull();
    expect(readOptionalMetric("基线值", undefined)).toBeNull();
    expect(readOptionalMetric("基线值", 0)).toBe(0);
    expect(readOptionalMetric("基线值", "1.25")).toBe(1.25);
    expect(() => readOptionalMetric("基线值", "abc")).toThrow("有限数值");
  });
});
