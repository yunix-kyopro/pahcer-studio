import type { TestExecution, TestCase } from '../schemas/execution';
import { ConfigService } from './ConfigService';
import type { SummaryJson, SummaryCaseRaw } from '../types/summary';
import type { IExecutionRepository } from '../repositories/IExecutionRepository';

/**
 * スコア分析専用のサービス
 * 相対スコア計算やその他の分析ロジックを担当
 */
export class ScoreAnalysisService {
  private configService: ConfigService;

  /**
   * コンストラクタ
   * ConfigService はファイル I/O を伴うため、ここで単一インスタンスを生成して再利用します。
   */
  constructor() {
    this.configService = new ConfigService();
  }

  /**
   * BestScores と Objective を並列取得する内部ヘルパー
   * UI からは直接呼ばれません。
   */
  private async loadConfig(): Promise<{
    bestScores: Record<number, number>;
    objective: 'Max' | 'Min';
  }> {
    try {
      const [bestScores, objective] = await Promise.all([
        this.configService.getBestScores(),
        this.configService.getObjective(),
      ]);
      return { bestScores, objective };
    } catch (err) {
      console.error('Config の取得に失敗しました', err);
      throw new Error('ConfigLoadFailed');
    }
  }

  /**
   * summary.json を読み込むユーティリティ
   * 読み込み失敗時には null を返して上位にエラーを伝播させません。
   */
  private async readSummary(path: string): Promise<SummaryJson | null> {
    const fs = await import('fs/promises');
    try {
      const txt = await fs.readFile(path, 'utf8');
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  /**
   * TestExecution に averageRelativeScore を付与する
   *   1. summaryData.cases が無効な場合はそのまま返す
   *   2. pahcer_config.toml から BestScores / Objective を取得
   *   3. 各ケースの相対スコアを計算し平均をセット
   *
   * @param execution UI へ返す TestExecution オブジェクト
   * @param summaryData 事前に読み込んだ summary.json の中身
   * @returns relativeScore を含む新しい TestExecution
   */
  async enrichExecutionWithRelativeScore(
    execution: TestExecution,
    summaryData?: SummaryJson,
  ): Promise<TestExecution> {
    if (!summaryData?.cases || !Array.isArray(summaryData.cases)) {
      return execution;
    }

    let bestScores: Record<number, number>, objective: 'Max' | 'Min';
    try {
      ({ bestScores, objective } = await this.loadConfig());
    } catch {
      // Config が取れなければ相対スコア 0 で返却
      return { ...execution, averageRelativeScore: 0 };
    }

    let total = 0;
    let cnt = 0;
    for (const c of summaryData.cases) {
      if (c.score != null && bestScores[c.seed] !== undefined) {
        total += this.configService.calculateRelativeScore(c.score, bestScores[c.seed], objective);
        cnt++;
      }
    }

    const avg = cnt ? total / cnt : 0;
    return { ...execution, averageRelativeScore: isNaN(avg) ? 0 : avg };
  }

  /**
   * 個々の TestCase 配列に relativeScore を追加する
   * フロントエンドに返すデータ整形も兼ねています。
   */
  async enrichTestCasesWithRelativeScore(testCaseData: SummaryCaseRaw[]): Promise<TestCase[]> {
    if (!Array.isArray(testCaseData)) return [];

    let bestScores: Record<number, number>, objective: 'Max' | 'Min';
    try {
      ({ bestScores, objective } = await this.loadConfig());
    } catch {
      return []; // Config 取得失敗時は空配列
    }

    return testCaseData
      .map((c) => {
        const best = bestScores[c.seed];
        const rel =
          c.score != null && best !== undefined
            ? this.configService.calculateRelativeScore(c.score, best, objective)
            : null;
        return {
          seed: c.seed,
          score: c.score,
          relativeScore: rel,
          status: c.error_message ? 'failed' : 'completed',
          executionTime: c.execution_time,
        } as TestCase;
      })
      .filter(Boolean);
  }

  /**
   * summary.json から実行全体の統計を計算
   * @returns 平均スコア・相対スコアなどを持つオブジェクト
   */
  async calculateExecutionStats(summaryData: SummaryJson) {
    const caseCnt = Number(summaryData.case_count ?? 0);
    const avgScore = caseCnt > 0 ? Number(summaryData.total_score ?? 0) / caseCnt : 0;

    let avgRel = 0;
    if (caseCnt > 0 && Array.isArray(summaryData.cases)) {
      try {
        const { bestScores, objective } = await this.loadConfig();
        let total = 0,
          cnt = 0;
        for (const c of summaryData.cases) {
          if (c.score != null && bestScores[c.seed] !== undefined) {
            total += this.configService.calculateRelativeScore(
              c.score,
              bestScores[c.seed],
              objective,
            );
            cnt++;
          }
        }
        if (cnt) avgRel = total / cnt;
      } catch {
        avgRel = 0;
      }
    }

    return {
      totalCount: caseCnt,
      acceptedCount: caseCnt - (summaryData.wa_seeds?.length ?? 0),
      averageScore: isNaN(avgScore) ? 0 : avgScore,
      averageRelativeScore: isNaN(avgRel) ? 0 : avgRel,
      maxExecutionTime: Number(summaryData.max_execution_time ?? 0) * 1000,
    };
  }

  /**
   * 既存すべての TestExecution の relativeScore を再計算
   *   - config を事前取得してループ内ロードを避ける
   *   - 変化があるもののみ保存し、件数をログ出力
   */
  async recalculateAllRelativeScores(executionRepository: IExecutionRepository): Promise<void> {
    // 外側で一度だけ Config を取得
    let bestScores: Record<number, number>, objective: 'Max' | 'Min';
    try {
      ({ bestScores, objective } = await this.loadConfig());
    } catch {
      console.error('Config なしでは再計算できませんわ');
      return;
    }

    const allExecutions = await executionRepository.findAll();
    let updated = 0;

    for (const exe of allExecutions) {
      const summary = await this.readSummary(executionRepository.getSummaryPath(exe.id));
      if (!summary?.cases) continue;

      let total = 0,
        cnt = 0;
      for (const c of summary.cases) {
        if (c.score != null && bestScores[c.seed] !== undefined) {
          total += this.configService.calculateRelativeScore(
            c.score,
            bestScores[c.seed],
            objective,
          );
          cnt++;
        }
      }
      const newAvg = cnt ? total / cnt : 0;
      if (Math.abs(newAvg - (exe.averageRelativeScore || 0)) > 0.001) {
        exe.averageRelativeScore = isNaN(newAvg) ? 0 : newAvg;
        await executionRepository.save(exe);
        updated++;
      }
    }
    console.log(
      `Relative score recalculation completed. Updated ${updated} / ${allExecutions.length}.`,
    );
  }

  /** ConfigService ラッパー: BestScores を外部公開 */
  async getBestScores(): Promise<Record<number, number>> {
    return await this.configService.getBestScores();
  }

  /** ConfigService ラッパー: Objective を外部公開 */
  async getObjective(): Promise<'Max' | 'Min'> {
    return await this.configService.getObjective();
  }
}
