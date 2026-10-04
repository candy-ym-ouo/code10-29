import { describe, expect, it } from "vitest";
import {
  calculateSessionDuration,
  canTransitionSession,
  completionSchema,
  describeMissingReview,
  goalActivateSchema,
  goalCreateSchema,
  goalProgressCreateSchema,
  goalUpdateSchema,
  isGoalProgressValid,
  parseFiniteNumber,
  sessionCreateSchema,
  sessionUpdateSchema,
  validateAnnotationRange,
} from "../src/index.js";

describe("session state machine", () => {
  it("allows the required completion transition", () => {
    expect(canTransitionSession("IN_REVIEW", "COMPLETED")).toBe(true);
    expect(canTransitionSession("DRAFT", "COMPLETED")).toBe(false);
  });
});

describe("annotation range", () => {
  it("rejects ranges under 100ms and outside media", () => {
    expect(validateAnnotationRange(100, 150, 1000)).toMatchObject({ ok: false });
    expect(validateAnnotationRange(900, 1100, 1000)).toMatchObject({ ok: false });
    expect(validateAnnotationRange(100, 250, 1000)).toEqual({ ok: true });
  });
});

describe("review completion", () => {
  it("returns every missing item instead of a generic failure", () => {
    expect(
      describeMissingReview({
        readyMediaCount: 0,
        annotationCount: 0,
        noIssues: false,
        nextFocus: "",
        openGoalCount: 0,
        newGoalCount: 0,
        progressUpdateCount: 0,
      }),
    ).toHaveLength(4);
  });
});

describe("goal values", () => {
  it("suggests achieved only when actual reaches target", () => {
    expect(isGoalProgressValid(90, 88)).toBe(true);
    expect(isGoalProgressValid(87, 88)).toBe(false);
  });

  it("sums only valid media durations", () => {
    expect(calculateSessionDuration([1000, null, 2500, -1])).toBe(3500);
  });
});

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
    expect(parseFiniteNumber(" -12.5 ")).toBe(-12.5);
    expect(parseFiniteNumber(88)).toBe(88);
  });
});

describe("strict numeric request bodies", () => {
  const validGoal = {
    sourceSessionId: "00000000-0000-4000-8000-000000000000",
    title: "目标",
    category: "SPEED",
    metricType: "SPEED",
    targetValue: 88,
    unit: "BPM",
    dueDate: new Date().toISOString(),
    evidenceRequirement: "NONE",
  } as const;

  it("rejects empty or nullish target value when creating goals", () => {
    for (const missing of ["", "  ", null, undefined]) {
      const result = goalCreateSchema.safeParse({ ...validGoal, targetValue: missing });
      expect(result.success, `targetValue=${JSON.stringify(missing)} should be rejected`).toBe(false);
    }
  });

  it("rejects empty or nullish actual value when recording progress", () => {
    const base = { sessionId: "00000000-0000-4000-8000-000000000000" };
    for (const missing of ["", "  ", null, undefined]) {
      const result = goalProgressCreateSchema.safeParse({ ...base, actualValue: missing });
      expect(result.success, `actualValue=${JSON.stringify(missing)} should be rejected`).toBe(false);
    }
  });

  it("never treats empty update fields as zero", () => {
    const result = goalUpdateSchema.safeParse({ version: 1, targetValue: "" });
    expect(result.success).toBe(false);
    const withNull = goalUpdateSchema.safeParse({ version: 1, targetValue: null });
    expect(withNull.success).toBe(false);
    const reactivate = goalActivateSchema.safeParse({ targetValue: "" });
    expect(reactivate.success).toBe(false);
  });

  it("rejects empty duration and annotation numbers while accepting legal zeros", () => {
    expect(sessionCreateSchema.safeParse({
      title: "练习", instrument: "钢琴", startedAt: new Date(), actualDurationMs: "",
    }).success).toBe(false);

    const patch = sessionUpdateSchema.safeParse({ version: "", actualDurationMs: null });
    expect(patch.success).toBe(false);
    expect(sessionUpdateSchema.safeParse({ version: 0 }).success).toBe(true);

    const completion = completionSchema.safeParse({
      version: 0,
      review: { nextFocus: "下次重点" },
      goalProgressUpdates: [{ goalId: "00000000-0000-4000-8000-000000000000", actualValue: "" }],
    });
    expect(completion.success).toBe(false);
  });

  it("accepts legitimate numeric zero for target and progress", () => {
    expect(goalCreateSchema.safeParse({ ...validGoal, targetValue: 0 }).success).toBe(true);
    expect(goalCreateSchema.safeParse({ ...validGoal, targetValue: "0" }).success).toBe(true);
    expect(goalCreateSchema.safeParse({ ...validGoal, baselineValue: 0 }).success).toBe(true);
    expect(
      goalProgressCreateSchema.safeParse({
        sessionId: "00000000-0000-4000-8000-000000000000",
        actualValue: 0,
      }).success,
    ).toBe(true);
    expect(goalUpdateSchema.safeParse({ version: 2, targetValue: 0 }).success).toBe(true);
    expect(goalActivateSchema.safeParse({ targetValue: 0 }).success).toBe(true);
  });

  it("still allows explicit null to clear optional baseline/duration", () => {
    expect(goalCreateSchema.safeParse({ ...validGoal, baselineValue: null }).success).toBe(true);
    expect(sessionCreateSchema.safeParse({
      title: "练习", instrument: "钢琴", startedAt: new Date(), actualDurationMs: null,
    }).success).toBe(true);
  });
});
