import { ConfigService } from '../ConfigService';
import { MockFileSystemService } from '../filesystem/MockFileSystemService';
import * as path from 'path';

describe('ConfigService', () => {
  let mockFS: MockFileSystemService;
  let configService: ConfigService;
  let configPath: string;
  let backupPath: string;
  let bestScoresPath: string;

  beforeEach(() => {
    mockFS = new MockFileSystemService();
    configService = new ConfigService(mockFS);

    // パスの設定（ConfigServiceの実装に合わせる）
    const projectRoot = path.resolve(process.cwd(), '..');
    configPath = path.join(projectRoot, 'pahcer_config.toml');
    backupPath = path.join(projectRoot, 'pahcer_config.toml.bak');
    bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
  });

  describe('getConfig', () => {
    it('正常系: 設定ファイルが正常に読み込める', async () => {
      const tomlContent = `
[general]
version = "1.0.0"

[problem]
problem_name = "AHC001"
objective = "Max"
score_regex = "Score = (\\\\d+)"

[test]
start_seed = 0
end_seed = 100
threads = 4
out_dir = "out"
compile_steps = ["cargo build --release"]
test_steps = ["./target/release/main"]
`;
      mockFS.setFileContent(configPath, tomlContent);

      const result = await configService.getConfig();

      expect(result.general?.version).toBe('1.0.0');
      expect(result.problem?.problem_name).toBe('AHC001');
      expect(result.problem?.objective).toBe('Max');
      expect(result.test?.start_seed).toBe(0);
      expect(result.test?.end_seed).toBe(100);
    });

    it('ファイルが存在しない場合: 空のオブジェクトを返す', async () => {
      const result = await configService.getConfig();

      expect(result).toEqual({});
    });

    it('不正なTOML: 空のオブジェクトを返す', async () => {
      mockFS.setFileContent(configPath, 'invalid toml [[[');

      const result = await configService.getConfig();

      expect(result).toEqual({});
    });
  });

  describe('getObjective', () => {
    it('Max目的関数の取得', async () => {
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Max"
`,
      );

      const result = await configService.getObjective();

      expect(result).toBe('Max');
    });

    it('Min目的関数の取得', async () => {
      mockFS.setFileContent(
        configPath,
        `
[problem]
objective = "Min"
`,
      );

      const result = await configService.getObjective();

      expect(result).toBe('Min');
    });

    it('未設定の場合のデフォルト値（Max）', async () => {
      mockFS.setFileContent(configPath, '[problem]\nproblem_name = "Test"');

      const result = await configService.getObjective();

      expect(result).toBe('Max');
    });

    it('設定ファイルが存在しない場合のデフォルト値（Max）', async () => {
      const result = await configService.getObjective();

      expect(result).toBe('Max');
    });
  });

  describe('getBestScores', () => {
    it('正常系: JSONファイルから読み込み', async () => {
      const bestScoresData = {
        '0': 1000,
        '1': 2000,
        '2': 3000,
      };
      mockFS.setFileContent(bestScoresPath, JSON.stringify(bestScoresData));

      const result = await configService.getBestScores();

      expect(result).toEqual({
        0: 1000,
        1: 2000,
        2: 3000,
      });
    });

    it('ファイルが存在しない場合: 空のオブジェクトを返す', async () => {
      const result = await configService.getBestScores();

      expect(result).toEqual({});
    });

    it('不正なJSON: 空のオブジェクトを返す', async () => {
      mockFS.setFileContent(bestScoresPath, 'invalid json {{{');

      const result = await configService.getBestScores();

      expect(result).toEqual({});
    });
  });

  describe('backupConfig', () => {
    it('正常系: バックアップが作成される', async () => {
      mockFS.setFileContent(configPath, '[problem]\nproblem_name = "Test"');

      const result = await configService.backupConfig();

      expect(result).toBe(true);
      expect(mockFS.fileExists(backupPath)).toBe(true);
      expect(mockFS.getFileContent(backupPath)).toContain('problem_name = "Test"');
    });

    it('設定ファイルが存在しない場合: falseを返す', async () => {
      const result = await configService.backupConfig();

      expect(result).toBe(false);
    });
  });

  describe('restoreConfig', () => {
    it('正常系: バックアップから復元', async () => {
      mockFS.setFileContent(backupPath, '[problem]\nproblem_name = "Backup"');
      mockFS.setFileContent(configPath, '[problem]\nproblem_name = "Current"');

      const result = await configService.restoreConfig();

      expect(result).toBe(true);
      expect(mockFS.getFileContent(configPath)).toContain('problem_name = "Backup"');
    });

    it('バックアップファイルが存在しない場合: falseを返す', async () => {
      const result = await configService.restoreConfig();

      expect(result).toBe(false);
    });
  });

  describe('calculateRelativeScore', () => {
    describe('Max目的関数', () => {
      it('正常なスコア計算: score < bestScore', () => {
        const result = configService.calculateRelativeScore(800, 1000, 'Max');
        expect(result).toBe(0.8);
      });

      it('正常なスコア計算: score > bestScore', () => {
        const result = configService.calculateRelativeScore(1200, 1000, 'Max');
        expect(result).toBe(1.2);
      });

      it('score = bestScoreの場合: 相対スコア = 1.0', () => {
        const result = configService.calculateRelativeScore(1000, 1000, 'Max');
        expect(result).toBe(1.0);
      });

      it('小数点のスコア計算', () => {
        const result = configService.calculateRelativeScore(750.5, 1000.0, 'Max');
        expect(result).toBeCloseTo(0.7505);
      });
    });

    describe('Min目的関数', () => {
      it('正常なスコア計算: score > bestScore', () => {
        const result = configService.calculateRelativeScore(1200, 1000, 'Min');
        expect(result).toBeCloseTo(0.8333, 4);
      });

      it('正常なスコア計算: score < bestScore', () => {
        const result = configService.calculateRelativeScore(800, 1000, 'Min');
        expect(result).toBe(1.25);
      });

      it('score = bestScoreの場合: 相対スコア = 1.0', () => {
        const result = configService.calculateRelativeScore(1000, 1000, 'Min');
        expect(result).toBe(1.0);
      });

      it('小数点のスコア計算', () => {
        const result = configService.calculateRelativeScore(1250.0, 1000.0, 'Min');
        expect(result).toBe(0.8);
      });
    });

    describe('境界値・エッジケース', () => {
      it('score = 0の場合: 0を返す', () => {
        const result = configService.calculateRelativeScore(0, 1000, 'Max');
        expect(result).toBe(0);
      });

      it('bestScore = 0の場合: 0を返す', () => {
        const result = configService.calculateRelativeScore(1000, 0, 'Max');
        expect(result).toBe(0);
      });

      it('両方とも0の場合: 0を返す', () => {
        const result = configService.calculateRelativeScore(0, 0, 'Max');
        expect(result).toBe(0);
      });

      it('負のscoreの場合: 0を返す', () => {
        const result = configService.calculateRelativeScore(-100, 1000, 'Max');
        expect(result).toBe(0);
      });

      it('負のbestScoreの場合: 0を返す', () => {
        const result = configService.calculateRelativeScore(1000, -100, 'Max');
        expect(result).toBe(0);
      });

      it('非常に小さい値での計算（Max）', () => {
        const result = configService.calculateRelativeScore(0.001, 0.002, 'Max');
        expect(result).toBe(0.5);
      });

      it('非常に大きい値での計算（Max）', () => {
        const result = configService.calculateRelativeScore(1000000, 2000000, 'Max');
        expect(result).toBe(0.5);
      });
    });
  });

  describe('updateConfigForTest', () => {
    it('正常系: テストケース数とシードの更新', async () => {
      const initialContent = `
[problem]
problem_name = "AHC001"

[test]
threads = 4
`;
      mockFS.setFileContent(configPath, initialContent);

      const result = await configService.updateConfigForTest(10, 5);

      expect(result).toBe(true);

      // 設定が更新されたことを確認
      const config = await configService.getConfig();
      expect(config.test?.start_seed).toBe(5);
      expect(config.test?.end_seed).toBe(15);
      expect(config.test?.threads).toBe(4); // 既存の設定が保持される
    });

    it('バックアップが作成されることの確認', async () => {
      mockFS.setFileContent(configPath, '[problem]\nproblem_name = "Test"');

      await configService.updateConfigForTest(10, 0);

      // バックアップファイルが作成されたことを確認
      expect(mockFS.fileExists(backupPath)).toBe(true);
      expect(mockFS.getFileContent(backupPath)).toContain('problem_name = "Test"');
    });

    it('既存の設定が保持されることの確認', async () => {
      const initialContent = `
[general]
version = "1.0.0"

[problem]
problem_name = "AHC001"
objective = "Max"

[test]
threads = 8
out_dir = "output"
`;
      mockFS.setFileContent(configPath, initialContent);

      await configService.updateConfigForTest(20, 10);

      const config = await configService.getConfig();
      expect(config.general?.version).toBe('1.0.0');
      expect(config.problem?.problem_name).toBe('AHC001');
      expect(config.problem?.objective).toBe('Max');
      expect(config.test?.threads).toBe(8);
      expect(config.test?.out_dir).toBe('output');
      expect(config.test?.start_seed).toBe(10);
      expect(config.test?.end_seed).toBe(30);
    });

    it('設定ファイルが存在しない場合は失敗する', async () => {
      const result = await configService.updateConfigForTest(5, 0);

      // 親ディレクトリが存在しないため、書き込みに失敗してfalseを返す
      expect(result).toBe(false);
    });

    it('testCaseCount = 0の場合', async () => {
      mockFS.setFileContent(configPath, '[test]\nthreads = 4');

      await configService.updateConfigForTest(0, 10);

      const config = await configService.getConfig();
      expect(config.test?.start_seed).toBe(10);
      expect(config.test?.end_seed).toBe(10);
    });

    it('startSeed = 0の場合', async () => {
      mockFS.setFileContent(configPath, '[test]\nthreads = 4');

      await configService.updateConfigForTest(100, 0);

      const config = await configService.getConfig();
      expect(config.test?.start_seed).toBe(0);
      expect(config.test?.end_seed).toBe(100);
    });
  });
});
