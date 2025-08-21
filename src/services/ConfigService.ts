import * as path from 'path';
import { parse, stringify } from 'smol-toml';
import { IFileSystemService } from './filesystem';

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
  'pahcer-studio'?: Array<{
    save_path_list?: string[];
  }>;
}

/**
 * pahcer_config.tomlの操作を行うサービス
 * Python側のconfig_service.pyの機能をTypeScriptで実装
 */
export class ConfigService {
  private readonly configPath: string;
  private readonly backupPath: string;
  private readonly bestScoresPath: string;
  private readonly projectRoot: string;

  constructor(
    private fileSystem: IFileSystemService,
    projectRoot: string = path.resolve(process.cwd(), '..'),
  ) {
    this.projectRoot = projectRoot;
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
   * pahcer_config.tomlの設定を更新
   */
  async updateConfig(config: PahcerConfig): Promise<PahcerConfig> {
    try {
      // 現在の設定を読み込む
      const currentConfig = await this.getConfig();

      // 設定をマージ
      const updatedConfig = this.mergeConfig(currentConfig, config);

      // smol-tomlのstringifyを使用してTOML文字列を生成
      const tomlContent = stringify(updatedConfig);
      await this.fileSystem.writeFile(this.configPath, tomlContent, 'utf-8');

      return await this.getConfig();
    } catch (error) {
      console.error(`Error updating config: ${error}`);
      return config;
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

  /**
   * pahcer-studioセクションからsave_path_listを取得
   * @returns { paths: string[], isConfigured: boolean } パス一覧と設定されているかどうか
   */
  async getSavePathList(): Promise<{ paths: string[]; isConfigured: boolean }> {
    try {
      const config = await this.getConfig();
      const pahcerStudioConfig = config['pahcer-studio'];

      // pahcer-studioセクションが存在しない場合
      if (!pahcerStudioConfig || pahcerStudioConfig.length === 0) {
        return { paths: [], isConfigured: false };
      }

      const firstConfig = pahcerStudioConfig[0];

      // save_path_listプロパティが存在しない場合
      if (!('save_path_list' in firstConfig)) {
        return { paths: [], isConfigured: false };
      }

      // save_path_listが存在するが空の場合
      if (!firstConfig.save_path_list || firstConfig.save_path_list.length === 0) {
        return { paths: [], isConfigured: true };
      }

      // 正常にパスが設定されている場合
      return { paths: firstConfig.save_path_list, isConfigured: true };
    } catch (error) {
      console.error(`Error getting save path list: ${error}`);
      return { paths: [], isConfigured: false };
    }
  }

  /**
   * save_path_listから実際に存在するファイル一覧を取得
   * @returns { files: Array<{path: string, isDirectory: boolean, size?: number}>, isConfigured: boolean, totalCount: number }
   */
  async getActualFileList(): Promise<{
    files: Array<{ path: string; isDirectory: boolean; size?: number }>;
    isConfigured: boolean;
    totalCount: number;
  }> {
    try {
      const savePathResult = await this.getSavePathList();

      if (!savePathResult.isConfigured) {
        return { files: [], isConfigured: false, totalCount: 0 };
      }

      if (savePathResult.paths.length === 0) {
        return { files: [], isConfigured: true, totalCount: 0 };
      }

      const allFiles: Array<{ path: string; isDirectory: boolean; size?: number }> = [];

      for (const targetPath of savePathResult.paths) {
        try {
          // パスを正規化（trailing slashを除去）
          const normalizedPath = targetPath.replace(/\/+$/, '') || targetPath;

          // プロジェクトルートからの絶対パスに変換
          const fullPath = path.join(this.projectRoot, normalizedPath);

          // ファイル/ディレクトリの存在確認
          await this.fileSystem.access(fullPath);
          const stats = await this.fileSystem.stat(fullPath);

          if (stats.isDirectory()) {
            // ディレクトリの場合は再帰的にファイルを収集
            const dirFiles = await this.collectDirectoryFilesForDisplay(fullPath, normalizedPath);
            allFiles.push(...dirFiles);
          } else {
            // ファイルの場合はそのまま追加
            allFiles.push({
              path: normalizedPath,
              isDirectory: false,
              size: stats.size,
            });
          }
        } catch (error) {
          // ファイル/ディレクトリが存在しない場合はスキップ
          console.warn(`File or directory not found: ${targetPath}`);
        }
      }

      // パスでソート
      allFiles.sort((a, b) => a.path.localeCompare(b.path));

      return {
        files: allFiles,
        isConfigured: true,
        totalCount: allFiles.length,
      };
    } catch (error) {
      console.error(`Error getting actual file list: ${error}`);
      return { files: [], isConfigured: false, totalCount: 0 };
    }
  }

  /**
   * 表示用にディレクトリ内のファイルを再帰的に収集
   */
  private async collectDirectoryFilesForDisplay(
    fullDirPath: string,
    relativeDirPath: string,
  ): Promise<Array<{ path: string; isDirectory: boolean; size?: number }>> {
    const files: Array<{ path: string; isDirectory: boolean; size?: number }> = [];

    try {
      const entries = await this.fileSystem.readdir(fullDirPath);

      for (const entry of entries) {
        const fullPath = path.join(fullDirPath, entry.name);
        const relativePath = path.join(relativeDirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            // ディレクトリエントリを追加
            files.push({
              path: relativePath + '/',
              isDirectory: true,
            });
            // 再帰的にサブディレクトリを探索
            const subFiles = await this.collectDirectoryFilesForDisplay(fullPath, relativePath);
            files.push(...subFiles);
          } else {
            // ファイルエントリを追加
            const stats = await this.fileSystem.stat(fullPath);
            files.push({
              path: relativePath,
              isDirectory: false,
              size: stats.size,
            });
          }
        } catch (error) {
          // 個別のファイル/ディレクトリでエラーが発生してもスキップして続行
          console.warn(`Error processing ${relativePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${relativeDirPath}:`, error);
    }

    return files;
  }
}
