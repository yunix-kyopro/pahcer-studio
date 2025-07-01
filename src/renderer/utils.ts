// 安全（？）な簡易式評価用ユーティリティ
// 評価対象の文字列中に含まれる識別子を与えられた変数マップで置換し、
// 許可された文字のみで構成されているかを確認してから eval します。
// 評価に失敗、あるいは危険な文字が含まれる場合は defaultValue を返却します。
/* eslint-disable no-eval */

export type VariableMap = Record<string, number | string | boolean | undefined>;

/**
 * 与えられたテンプレート式を評価します。
 * @param template 例: "N > 10 && M < 5"
 * @param variables 置換に使用する変数マップ。キーが変数名、値が数値もしくは boolean。
 * @param defaultValue 式が無効または評価エラーとなった際に返却する既定値。
 */
export function evaluateExpression<T extends number | boolean>(
  template: string,
  variables: VariableMap,
  defaultValue: T,
): T {
  if (!template.trim()) return defaultValue;

  // 識別子（英字始まりの連続英数字）を変数値へ置換
  const replaced = template.replace(/([A-Za-z_][A-Za-z0-9_]*)/g, (match) => {
    const v = variables[match];
    if (v === undefined || v === null) return '0'; // 未定義は 0 扱い
    return String(v);
  });

  // 許可文字チェック（数字・演算子・空白・括弧・カンマなど）
  if (!/^[\d\s+\-*/<>=!&|().,]+$/.test(replaced)) {
    return defaultValue;
  }

  try {
    // eslint-disable-next-line no-eval
    return eval(replaced) as unknown as T;
  } catch {
    return defaultValue;
  }
}
