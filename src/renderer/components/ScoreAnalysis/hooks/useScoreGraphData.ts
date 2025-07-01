import { useMemo } from 'react';
import type { AnalysisResponse, InputFeature } from '../../../../schemas/analysis';
import type { TestExecution } from '../../../../schemas/execution';

/**
 * useScoreGraphData
 * -----------------
 * スコア分析ビューで使用するグラフ用データを生成する React Hook です。
 *   1. inputFeatures / scoreData を結合してチャート用の配列へ変換。
 *   2. x 軸が seed 以外の場合は 20 グループへ集約しスムージング。
 *   3. 関数内でメモ化し、依存配列に変化がない限り再計算を抑制。
 * 戻り値には
 *   - featureKeys    : フィルタ式で利用可能な変数一覧（UI 表示用）
 *   - processedData  : Recharts にそのまま渡せる配列
 *   - useAggregation : 集約モードかどうかのフラグ
 * を含みます。
 */

// グラフ 1 点分のデータ構造
// 任意プロパティを許容するため index signature を含む
//   - 実行ごとのスコア（key はコメント or ID）
//   - 特徴量値          （key は特徴量名）
// を動的に追加できるようにしている点に注意
export interface ScoreGraphPoint {
  x: number;
  seeds: number[]; // 集約時は含まれるシード一覧
  count: number; // 集約グループのケース数
  // 任意追加プロパティ (特徴量や各実行のスコアなど)
  [key: string]: number | number[] | string | null | undefined;
}

export function useChartDataset(
  analysisResult: AnalysisResponse | null,
  executions: TestExecution[],
  selectedExecutionIds: string[],
  filteredInputs: InputFeature[],
  xValues: number[],
  xAxis: string,
  useRelativeScore: boolean,
) {
  // ① 画面上部に表示する「利用可能な入力変数」文字列を生成
  const featureKeys = useMemo(() => {
    if (!analysisResult || !analysisResult.inputFeatures?.[0]?.features) return '';
    const keys = Object.keys(analysisResult.inputFeatures[0].features);
    return `利用可能な入力変数: {${keys.join(', ')}, seed}`;
  }, [analysisResult]);

  // ② チャート用データ生成（重い処理なので useMemo でキャッシュ）
  const { processedData, useAggregation } = useMemo(() => {
    if (!analysisResult) {
      return { processedData: [] as ScoreGraphPoint[], useAggregation: false };
    }
    // 2-1) まずはテストケース単位の行列データを作成
    const chartData: ScoreGraphPoint[] = filteredInputs.map((input, index) => {
      const dataPoint: ScoreGraphPoint = {
        x: xValues[index],
        seeds: [input.seed],
        count: 1,
        ...(input.features as Record<string, number>),
      };

      //  対象実行ごとにスコアを列として追加
      selectedExecutionIds.forEach((execId) => {
        const scoreData = analysisResult.scoreData.find((data) => {
          const shortId = data.id.substring(0, 8);
          return (
            data.id === execId ||
            execId.includes(shortId) ||
            (data.id.length >= 8 && execId.includes(shortId))
          );
        });

        if (scoreData) {
          const seedKey = String(input.seed);
          const score = useRelativeScore
            ? scoreData.relativeScores?.[seedKey]
            : scoreData.scores[seedKey];
          if (score !== undefined && score >= 0) {
            const execName =
              executions.find((e) => e.id === execId)?.comment || execId.substring(0, 8);
            dataPoint[execName] = score;
          }
        }
      });

      return dataPoint;
    });

    // 2-2) x 軸が seed 以外の場合だけ 20 分割で集約してノイズ低減
    const aggEnabled = xAxis.trim() !== '' && xAxis.trim().toLowerCase() !== 'seed';

    let processed: ScoreGraphPoint[] = chartData.map((d) => ({ ...d }) as ScoreGraphPoint);
    if (aggEnabled) {
      const numGroups = 20;
      const sorted = [...chartData].sort((a, b) => a.x - b.x);
      const base = Math.floor(sorted.length / numGroups);
      const rest = sorted.length % numGroups;
      let idx = 0;
      const agg: ScoreGraphPoint[] = [];

      for (let i = 0; i < numGroups; i++) {
        const size = base + (i < rest ? 1 : 0);
        if (size === 0) continue;
        const group = sorted.slice(idx, idx + size);
        idx += size;

        //  グループ代表点（平均値）を作成
        const entry: ScoreGraphPoint = {
          x: group.reduce((s: number, d: ScoreGraphPoint) => s + d.x, 0) / group.length,
          seeds: group.flatMap((d) => d.seeds),
          count: group.length,
        };

        //  グループ内平均スコアを計算
        selectedExecutionIds.forEach((execId) => {
          const execName =
            executions.find((e) => e.id === execId)?.comment || execId.substring(0, 8);
          let sum = 0;
          let cnt = 0;
          group.forEach((d: ScoreGraphPoint) => {
            const v = d[execName];
            if (typeof v === 'number') {
              sum += v;
              cnt += 1;
            }
          });
          entry[execName] = cnt > 0 ? sum / cnt : null;
        });

        agg.push(entry);
      }
      processed = agg;
    } else {
      processed = processed
        .map((d: ScoreGraphPoint) => ({
          ...d,
          count: d.count ?? 1,
        }))
        .sort((a: ScoreGraphPoint, b: ScoreGraphPoint) => a.x - b.x);
    }

    // ③ 生成結果を返却
    return { processedData: processed, useAggregation: aggEnabled };
  }, [
    analysisResult,
    executions,
    selectedExecutionIds,
    filteredInputs,
    xValues,
    xAxis,
    useRelativeScore,
  ]);

  return { featureKeys, processedData, useAggregation };
}
