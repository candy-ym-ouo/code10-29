import { describe, expect, it } from "vitest";
import { completionSchema, goalCreateSchema, goalProgressCreateSchema } from "@practice/contracts";
import { parseOrThrow } from "../src/lib/validation.js";
import { AppError } from "../src/lib/errors.js";

const uuid = "11111111-1111-1111-1111-111111111111";

const validGoal = {
  sourceSessionId: uuid,
  title: "17-24 小节连续演奏",
  category: "SPEED",
  metricType: "SPEED",
  targetValue: 90,
  unit: "BPM",
  dueDate: "2026-10-10T00:00:00.000Z",
  evidenceRequirement: "NONE",
};

describe("server-side metric validation", () => {
  it("rejects missing target value with a 400 AppError instead of writing zero", () => {
    for (const targetValue of ["", "   ", null, undefined]) {
      expect(() => parseOrThrow(goalCreateSchema, { ...validGoal, targetValue })).toThrow(AppError);
    }
  });

  it("rejects missing progress actual value with a 400 AppError", () => {
    for (const actualValue of ["", "   ", null, undefined]) {
      expect(() => parseOrThrow(goalProgressCreateSchema, { sessionId: uuid, actualValue })).toThrow(AppError);
    }
  });

  it("rejects missing metric values inside the review completion transaction payload", () => {
    expect(() =>
      parseOrThrow(completionSchema, {
        version: 0,
        review: { nextFocus: "慢速分手练习" },
        goalCreates: [{ ...validGoal, targetValue: "" }],
        goalProgressUpdates: [{ goalId: uuid, actualValue: " " }],
      }),
    ).toThrow(/请求字段不合法/);
  });

  it("still accepts an explicit legitimate zero", () => {
    const goal = parseOrThrow(goalCreateSchema, { ...validGoal, targetValue: 0 });
    expect(goal.targetValue).toBe(0);
    const progress = parseOrThrow(goalProgressCreateSchema, { sessionId: uuid, actualValue: 0 });
    expect(progress.actualValue).toBe(0);
  });

  it("normalizes an empty baseline to null without changing an explicit zero", () => {
    expect(parseOrThrow(goalCreateSchema, { ...validGoal, baselineValue: "" }).baselineValue).toBeNull();
    expect(parseOrThrow(goalCreateSchema, { ...validGoal, baselineValue: 0 }).baselineValue).toBe(0);
  });
});
