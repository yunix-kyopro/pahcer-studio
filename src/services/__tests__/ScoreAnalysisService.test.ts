import * as path from 'path';
import { ScoreAnalysisService } from '../ScoreAnalysisService';
import { ConfigService } from '../ConfigService';
import { MockFileSystemService } from '../filesystem/MockFileSystemService';
import type { TestExecution } from '../../schemas/execution';
import type { SummaryJson, SummaryCaseRaw } from '../../types/summary';

describe('ScoreAnalysisService', () => {
  let mockFS: MockFileSystemService;
  let configService: ConfigService;
  let scoreAnalysisService: ScoreAnalysisService;

  beforeEach(() => {
    mockFS = new MockFileSystemService();
    configService = new ConfigService(mockFS);
    scoreAnalysisService = new ScoreAnalysisService(configService, mockFS);
  });

  describe('enrichExecutionWithRelativeScore', () => {
    const baseExecution: TestExecution = {
      id: 'test-001',
      status: 'COMPLETED',
      startTime: '2024-01-01T00:00:00Z',
      comment: null,
    };

    const summaryData: SummaryJson = {
      case_count: 3,
      total_score: 2700,
      cases: [
        { seed: 0, score: 1000, execution_time: 0.1 },
        { seed: 1, score: 800, execution_time: 0.2 },
        { seed: 2, score: 900, execution_time: 0.15 },
      ],
    };

    beforeEach(() => {
      // best_scores.jsonをセットアップ
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(
        bestScoresPath,
        JSON.stringify({
          '0': 1000,
          '1': 1000,
          '2': 1000,
        }),
      );

      // pahcer_config.tomlをセットアップ
      const configPath = path.join(projectRoot, 'pahcer_config.toml');
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Max"
`,
      );
    });

    it('正常系: 相対スコアが正しく計算される', async () => {
      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        summaryData,
      );

      // (1000/1000 + 800/1000 + 900/1000) / 3 = 2.7 / 3 = 0.9
      expect(result.averageRelativeScore).toBeCloseTo(0.9);
      expect(result.id).toBe('test-001');
    });

    it('summaryDataがnullの場合: executionをそのまま返す', async () => {
      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        undefined,
      );

      expect(result).toEqual(baseExecution);
      expect(result.averageRelativeScore).toBeUndefined();
    });

    it('summaryData.casesが空配列の場合: averageRelativeScore = 0', async () => {
      const emptySummary: SummaryJson = {
        case_count: 0,
        total_score: 0,
        cases: [],
      };

      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        emptySummary,
      );

      expect(result.averageRelativeScore).toBe(0);
    });

    it('bestScoresが空の場合: averageRelativeScore = 0', async () => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(bestScoresPath, JSON.stringify({}));

      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        summaryData,
      );

      expect(result.averageRelativeScore).toBe(0);
    });

    it('Config取得失敗の場合: averageRelativeScore = 0', async () => {
      // ファイルを削除してConfig取得を失敗させる
      mockFS.clear();

      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        summaryData,
      );

      expect(result.averageRelativeScore).toBe(0);
    });

    it('一部のケースにbestScoreがない場合', async () => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(
        bestScoresPath,
        JSON.stringify({
          '0': 1000,
          '1': 1000,
          // seed=2のbestScoreがない
        }),
      );

      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        summaryData,
      );

      // (1000/1000 + 800/1000) / 2 = 1.8 / 2 = 0.9
      expect(result.averageRelativeScore).toBeCloseTo(0.9);
    });

    it('すべてのケースでscoreがnullの場合: averageRelativeScore = 0', async () => {
      const nullScoreSummary: SummaryJson = {
        case_count: 3,
        total_score: 0,
        cases: [
          { seed: 0, score: null, execution_time: 0.1 },
          { seed: 1, score: null, execution_time: 0.2 },
          { seed: 2, score: null, execution_time: 0.15 },
        ],
      };

      const result = await scoreAnalysisService.enrichExecutionWithRelativeScore(
        baseExecution,
        nullScoreSummary,
      );

      expect(result.averageRelativeScore).toBe(0);
    });
  });

  describe('enrichTestCasesWithRelativeScore', () => {
    const testCaseData: SummaryCaseRaw[] = [
      { seed: 0, score: 1000, execution_time: 0.1 },
      { seed: 1, score: 800, execution_time: 0.2 },
      { seed: 2, score: 900, execution_time: 0.15 },
    ];

    beforeEach(() => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(
        bestScoresPath,
        JSON.stringify({
          '0': 1000,
          '1': 1000,
          '2': 1000,
        }),
      );

      const configPath = path.join(projectRoot, 'pahcer_config.toml');
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Max"
`,
      );
    });

    it('正常系: TestCaseの配列が正しく生成される', async () => {
      const result = await scoreAnalysisService.enrichTestCasesWithRelativeScore(testCaseData);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        seed: 0,
        score: 1000,
        relativeScore: 1.0,
        status: 'completed',
        executionTime: 0.1,
      });
      expect(result[1].relativeScore).toBe(0.8);
      expect(result[2].relativeScore).toBe(0.9);
    });

    it('testCaseDataが空配列の場合', async () => {
      const result = await scoreAnalysisService.enrichTestCasesWithRelativeScore([]);

      expect(result).toEqual([]);
    });

    it('Config取得失敗の場合: relativeScore = nullで返す', async () => {
      mockFS.clear();

      const result = await scoreAnalysisService.enrichTestCasesWithRelativeScore(testCaseData);

      expect(result).toHaveLength(3);
      expect(result[0].relativeScore).toBeNull();
      expect(result[1].relativeScore).toBeNull();
      expect(result[2].relativeScore).toBeNull();
    });

    it('error_messageがある場合: status = failed', async () => {
      const dataWithError: SummaryCaseRaw[] = [
        { seed: 0, score: 1000, execution_time: 0.1 },
        { seed: 1, score: null, execution_time: 0.2, error_message: 'Runtime Error' },
      ];

      const result = await scoreAnalysisService.enrichTestCasesWithRelativeScore(dataWithError);

      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('failed');
    });

    it('scoreがnullの場合: relativeScore = null', async () => {
      const dataWithNull: SummaryCaseRaw[] = [{ seed: 0, score: null, execution_time: 0.1 }];

      const result = await scoreAnalysisService.enrichTestCasesWithRelativeScore(dataWithNull);

      expect(result[0].relativeScore).toBeNull();
    });
  });

  describe('calculateExecutionStats', () => {
    beforeEach(() => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(
        bestScoresPath,
        JSON.stringify({
          '0': 1000,
          '1': 1000,
          '2': 1000,
        }),
      );

      const configPath = path.join(projectRoot, 'pahcer_config.toml');
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Max"
`,
      );
    });

    it('正常系: 統計情報が正しく計算される', async () => {
      const summaryData: SummaryJson = {
        case_count: 3,
        total_score: 2700,
        cases: [
          { seed: 0, score: 1000, execution_time: 0.1 },
          { seed: 1, score: 800, execution_time: 0.2 },
          { seed: 2, score: 900, execution_time: 0.15 },
        ],
        max_execution_time: 0.2,
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.totalCount).toBe(3);
      expect(result.acceptedCount).toBe(3);
      expect(result.averageScore).toBe(900); // 2700 / 3
      expect(result.averageRelativeScore).toBeCloseTo(0.9); // (1.0 + 0.8 + 0.9) / 3
      expect(result.maxExecutionTime).toBe(200); // 0.2 * 1000
    });

    it('case_countが0の場合', async () => {
      const summaryData: SummaryJson = {
        case_count: 0,
        total_score: 0,
        cases: [],
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.totalCount).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.averageRelativeScore).toBe(0);
    });

    it('casesが空配列の場合', async () => {
      const summaryData: SummaryJson = {
        case_count: 3,
        total_score: 2700,
        cases: [],
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.totalCount).toBe(3);
      expect(result.averageScore).toBe(900);
      expect(result.averageRelativeScore).toBe(0);
    });

    it('Config取得失敗の場合: averageRelativeScore = 0', async () => {
      mockFS.clear();

      const summaryData: SummaryJson = {
        case_count: 3,
        total_score: 2700,
        cases: [
          { seed: 0, score: 1000, execution_time: 0.1 },
          { seed: 1, score: 800, execution_time: 0.2 },
          { seed: 2, score: 900, execution_time: 0.15 },
        ],
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.averageRelativeScore).toBe(0);
    });

    it('wa_seedsがある場合: acceptedCountが正しく計算される', async () => {
      const summaryData: SummaryJson = {
        case_count: 5,
        total_score: 4000,
        cases: [
          { seed: 0, score: 1000, execution_time: 0.1 },
          { seed: 1, score: 800, execution_time: 0.2 },
          { seed: 2, score: 900, execution_time: 0.15 },
          { seed: 3, score: 700, execution_time: 0.18 },
          { seed: 4, score: 600, execution_time: 0.22 },
        ],
        wa_seeds: [1, 4],
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.totalCount).toBe(5);
      expect(result.acceptedCount).toBe(3); // 5 - 2
    });

    it('NaN回避: total_scoreがundefinedの場合', async () => {
      const summaryData: SummaryJson = {
        case_count: 3,
        cases: [],
      };

      const result = await scoreAnalysisService.calculateExecutionStats(summaryData);

      expect(result.averageScore).toBe(0);
      expect(isNaN(result.averageScore)).toBe(false);
    });
  });

  describe('getBestScores', () => {
    it('ConfigServiceのメソッドを正しく呼び出す', async () => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
      mockFS.setFileContent(
        bestScoresPath,
        JSON.stringify({
          '0': 1000,
          '1': 2000,
        }),
      );

      const result = await scoreAnalysisService.getBestScores();

      expect(result).toEqual({
        0: 1000,
        1: 2000,
      });
    });
  });

  describe('getObjective', () => {
    it('ConfigServiceのメソッドを正しく呼び出す', async () => {
      const projectRoot = path.resolve(process.cwd(), '..');
      const configPath = path.join(projectRoot, 'pahcer_config.toml');
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Min"
`,
      );

      const result = await scoreAnalysisService.getObjective();

      expect(result).toBe('Min');
    });
  });
});
