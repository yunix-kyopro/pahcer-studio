import * as path from 'path';
import { parse, stringify } from 'smol-toml';
import type { IFileSystemService } from './filesystem/IFileSystemService';

export interface PahcerConfig {
  general?: {
    version?: string;
  };
  problem?: {
    problem_name?: string;
    objective?: 'Max' | 'Min';
    score_regex?: string;
  };
  test?: {
    start_seed?: number;
    end_seed?: number;
    threads?: number;
    out_dir?: string;
    compile_steps?: string[];
    test_steps?: string[];
  };
}

/**
 * pahcer_config.tomlの操作を行うサービス
 * Python側のconfig_service.pyの機能をTypeScriptで実装
 */
export class ConfigService {
  private readonly configPath: string;
  private readonly backupPath: string;
  private readonly bestScoresPath: string;

  constructor(private readonly fileSystem: IFileSystemService) {
    // pacher_electron/がプロジェクトルートの1階層下にある前提
    const projectRoot = path.resolve(process.cwd(), '..');
    this.configPath = path.join(projectRoot, 'pahcer_config.toml');
    this.backupPath = path.join(projectRoot, 'pahcer_config.toml.bak');
    this.bestScoresPath = path.join(projectRoot, 'pahcer', 'best_scores.json');
  }

  /**
   * pahcer_config.tomlの設定を取得
   */
  async getConfig(): Promise<PahcerConfig> {
    try {
      const content = await this.fileSystem.readFile(this.configPath, 'utf-8');
      return parse(content) as PahcerConfig;
    } catch (error) {
      console.error(`Error loading config: ${error}`);
      return {};
    }
  }

  /**
   * pahcer_config.tomlをバックアップ
   */
  async backupConfig(): Promise<boolean> {
    try {
      await this.fileSystem.copyFile(this.configPath, this.backupPath);
      return true;
    } catch (error) {
      console.error(`Error backing up config: ${error}`);
      return false;
    }
  }

  /**
   * バックアップからpahcer_config.tomlを復元
   */
  async restoreConfig(): Promise<boolean> {
    try {
      await this.fileSystem.access(this.backupPath);
      await this.fileSystem.copyFile(this.backupPath, this.configPath);
      return true;
    } catch (error) {
      console.error(`Error restoring config: ${error}`);
      return false;
    }
  }

  /**
   * テスト実行用にpahcer_config.tomlを更新
   * Python側のupdate_config_for_testと同じ機能
   */
  async updateConfigForTest(testCaseCount: number, startSeed: number): Promise<boolean> {
    try {
      // 設定をバックアップ
      await this.backupConfig();

      // 現在の設定を読み込む
      const currentConfig = await this.getConfig();

      // テスト設定を更新
      const updatedConfig = {
        ...currentConfig,
        test: {
          ...currentConfig.test,
          start_seed: startSeed,
          end_seed: startSeed + testCaseCount,
        },
      };

      // smol-tomlのstringifyを使用してTOML文字列を生成
      const tomlContent = stringify(updatedConfig);
      await this.fileSystem.writeFile(this.configPath, tomlContent, 'utf-8');

      return true;
    } catch (error) {
      console.error(`Error updating config for test: ${error}`);
      return false;
    }
  }

  /**
   * 設定をマージ
   */
  private mergeConfig(current: PahcerConfig, update: PahcerConfig): PahcerConfig {
    return {
      general: { ...current.general, ...update.general },
      problem: { ...current.problem, ...update.problem },
      test: { ...current.test, ...update.test },
    };
  }

  /**
   * 問題の目的関数（Max/Min）を取得
   */
  async getObjective(): Promise<'Max' | 'Min'> {
    try {
      const config = await this.getConfig();
      return config.problem?.objective || 'Max'; // デフォルトはMax
    } catch (error) {
      console.error(`Error getting objective: ${error}`);
      return 'Max';
    }
  }

  /**
   * best_scores.jsonからベストスコアを取得
   */
  async getBestScores(): Promise<Record<number, number>> {
    try {
      const content = await this.fileSystem.readFile(this.bestScoresPath, 'utf-8');
      const bestScores = JSON.parse(content);

      // JSONのキーは文字列なので、数値に変換
      const result: Record<number, number> = {};
      for (const [seedStr, score] of Object.entries(bestScores)) {
        const seed = parseInt(seedStr, 10);
        if (!isNaN(seed) && typeof score === 'number') {
          result[seed] = score;
        }
      }

      return result;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        return {};
      }
      console.error(`Error loading best scores: ${error}`);
      return {};
    }
  }

  /**
   * 相対スコアを計算
   * @param score 現在のスコア
   * @param bestScore ベストスコア
   * @param objective 目的関数（Max/Min）
   * @returns 相対スコア（0.0-1.0）
   */
  calculateRelativeScore(score: number, bestScore: number, objective: 'Max' | 'Min'): number {
    if (score <= 0 || bestScore <= 0) {
      return 0;
    }

    if (objective === 'Min') {
      // Minの場合: ベストスコア / 自分のスコア
      return bestScore / score;
    } else {
      // Maxの場合: 自分のスコア / ベストスコア
      return score / bestScore;
    }
  }
}
