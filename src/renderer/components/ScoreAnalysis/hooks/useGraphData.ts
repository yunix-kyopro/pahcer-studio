import { useMemo } from 'react';
import type { AnalysisResponse } from '../../../../schemas/analysis';
import { evaluateExpression } from '../../../utils';
import type { VariableMap } from '../../../utils';

/**
 * useGraphData
 * ------------
 * スコア分析画面で「入力フィルター & X 軸計算」を担当する React Hook です。
 *
 * 1. `analysisResult` から選択された実行に含まれる seed を抽出。
 * 2. `inputFilter` (例: "N > 10 && M < 5") を evaluateExpression で判定し、
 *    条件を満たす `inputFeatures` のみを残します。
 * 3. `xAxis` が空 or 'seed' の場合は seed 値をそのまま、
 *    それ以外は式を評価して X 座標を算出します。
 * 4. 戻り値として 2 つの配列を返却します。
 *    - filteredInputs : フィルタ後の InputFeature[]
 *    - xValues        : 同順序の X 座標配列 (number[])
 *
 *   本 Hook は重い計算を `useMemo` でラップしているため、依存配列に
 *   変化がない限り再計算を行いません。
 */

export const useInputFilter = (
  analysisResult: AnalysisResponse | null,
  selectedExecutionIds: string[],
  xAxis: string,
  inputFilter: string,
): {
  filteredInputs: AnalysisResponse['inputFeatures'];
  xValues: number[];
} => {
  // 入力フィルタの適用
  const filteredInputs = useMemo(() => {
    if (
      !analysisResult ||
      !analysisResult.inputFeatures ||
      !analysisResult.scoreData ||
      selectedExecutionIds.length === 0
    )
      return [] as AnalysisResponse['inputFeatures'];

    // -----------------------------
    // 1) Seed の網羅的収集
    // -----------------------------
    //   複数実行 (selectedExecutionIds) が指定されている場合、
    //   それぞれが持つテストケース(seed) の和集合を取ります。
    //   こうすることで「どの実行にも共通して存在する seed のみに限定され
    //   グラフがスカスカになる」事態を防ぎ、選択された実行の情報を
    //   余すことなく可視化できます。
    //   ※ shortId 同士の比較で部分一致を許容しているのは、
    //     UI で 8 文字短縮 ID を扱うケースを想定しているためです。
    const selectedScoreData = analysisResult.scoreData.filter((scoreData) => {
      const shortId = scoreData.id.substring(0, 8);
      return selectedExecutionIds.some(
        (execId) =>
          execId === scoreData.id ||
          execId.includes(shortId) ||
          (scoreData.id.length >= 8 && execId.includes(shortId)),
      );
    });

    const selectedSeeds = new Set<string>();
    selectedScoreData.forEach((data) => {
      Object.keys(data.scores).forEach((seed) => selectedSeeds.add(seed));
    });

    // 2) 入力特徴量のフィルタリング
    // --------------------------------
    //   - selectedSeeds に含まれないものは即除外
    //   - inputFilter が空文字の場合はここで終了
    //   - それ以外は evaluateExpression で真偽判定
    //     例: "N > 10 && M < 5" のような式
    return analysisResult.inputFeatures.filter((input) => {
      if (!selectedSeeds.has(String(input.seed))) return false;
      if (!inputFilter.trim()) return true;
      const seedValue = parseInt(String(input.seed), 10);
      const variables: VariableMap = { seed: seedValue, ...input.features };
      return evaluateExpression<boolean>(inputFilter, variables, true);
    });
  }, [analysisResult, selectedExecutionIds, inputFilter]);

  // X軸計算
  const xValues = useMemo(() => {
    if (!filteredInputs.length) return [] as number[];

    // --------------------------------
    // 3) X 軸値の計算
    // --------------------------------
    //   ・seed / 空文字 の場合はシンプルに seed を返す
    //   ・それ以外は式を評価し数値を得る
    return filteredInputs.map((input) => {
      if (!xAxis.trim() || xAxis.trim().toLowerCase() === 'seed') {
        return parseInt(String(input.seed), 10);
      }
      const seedValue = parseInt(String(input.seed), 10);
      const variables: VariableMap = { seed: seedValue, ...input.features };
      return evaluateExpression<number>(xAxis, variables, 0);
    });
  }, [filteredInputs, xAxis]);

  return { filteredInputs, xValues };
};
