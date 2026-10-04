/**
 * 解析来自 <input type="number"> / v-model 的数值输入。
 *
 * 与 Number() 的关键区别：空串、纯空白、null/undefined 一律视为“缺失”（返回 null），
 * 绝不当作 0；NaN、Infinity 同样返回 null。合法的 0 会原样返回。
 * 行为与 @practice/contracts 的 parseFiniteNumber 保持一致，前端先拦截，后端再兜底。
 */
export function parseFiniteNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** 必填数值：缺失或非法时抛出错误，避免空值被静默写成 0。合法 0 不会被拒绝。 */
export function requireFiniteNumber(input: unknown, label: string): number {
  const value = parseFiniteNumber(input);
  if (value === null) throw new Error(`请填写${label}`);
  return value;
}
