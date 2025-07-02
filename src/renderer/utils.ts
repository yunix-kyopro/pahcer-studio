import { evaluate } from 'mathjs';

// 安全な数式評価用ユーティリティ
// 評価対象の文字列中に含まれる識別子を与えられた変数マップで置換し、
// mathjs を使用して安全に評価します。
// 評価に失敗した場合は defaultValue を返却します。

export type VariableMap = Record<string, number | string | boolean | undefined>;

/**
 * JavaScript形式の論理演算子をmathjs形式に変換する
 */
function convertJSOperatorsToMathJS(expression: string): string {
  return expression.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ').replace(/!/g, 'not ');
}

/**
 * 与えられたテンプレート式を評価します。
 * @param template 例: "N > 10 && M < 5" または "N * M"
 * @param variables 置換に使用する変数マップ。キーが変数名、値が数値もしくは boolean。
 * @param defaultValue 式が無効または評価エラーとなった際に返却する既定値。
 */
export function evaluateExpression<T extends number | boolean>(
  template: string,
  variables: VariableMap,
  defaultValue: T,
): T {
  if (!template.trim()) return defaultValue;

  try {
    // JavaScript形式の論理演算子をmathjs形式に変換
    const convertedTemplate = convertJSOperatorsToMathJS(template);

    // mathjs用の変数オブジェクトを作成
    const scope: Record<string, number | boolean> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined || value === null) {
        scope[key] = 0; // 未定義は 0 扱い
      } else if (typeof value === 'boolean') {
        scope[key] = value;
      } else if (typeof value === 'number') {
        scope[key] = value;
      } else {
        // 文字列の場合は数値に変換を試みる
        const numValue = Number(value);
        scope[key] = isNaN(numValue) ? 0 : numValue;
      }
    }

    // mathjs で安全に評価
    // mathjsは数学的演算子（+, -, *, /, %, ^, ==, !=, <, >, <=, >=, and, or, not）をサポート
    const result = evaluate(convertedTemplate, scope);

    // 結果が期待する型か確認
    if (typeof result === 'number' || typeof result === 'boolean') {
      return result as T;
    }

    return defaultValue;
  } catch (error) {
    // mathjs評価エラーの場合はデフォルト値を返す
    console.warn('Expression evaluation failed:', template, error);
    return defaultValue;
  }
}
