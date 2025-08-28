import * as path from 'path';
import { IFileSystemService } from './filesystem';
import { ConfigService } from './ConfigService';

export interface ExecutionMetadata {
  id: string;
  timestamp: string;
  dataPath: string;
}

export interface FileData {
  path: string;
  content: string;
  exists: boolean;
}

export interface VersionData {
  execution: ExecutionMetadata;
  files: Map<string, FileData>; // relativePath -> FileData
}

/**
 * ファイルデータ取得サービス
 * 2つのバージョンのデータを取得する責任を持つ
 */
export class FileDataService {
  constructor(
    private fileSystem: IFileSystemService,
    private configService: ConfigService,
    private projectRoot: string = path.resolve(process.cwd(), '..'),
    private studioDataDir: string = path.resolve(process.cwd(), 'data'),
  ) {}

  /**
   * 現在のプロジェクトファイルのデータを取得
   * ConfigService.getActualFileList()を使用
   */
  async getCurrentFileData(): Promise<VersionData> {
    const actualFiles = await this.configService.getActualFileList();
    const files = new Map<string, FileData>();

    // ディレクトリは除外してファイルのみ処理
    const fileList = actualFiles.files.filter((file) => !file.isDirectory);

    for (const fileInfo of fileList) {
      const fullPath = path.join(this.projectRoot, fileInfo.path);

      try {
        await this.fileSystem.access(fullPath);
        const content = await this.fileSystem.readFile(fullPath, 'utf-8');
        files.set(fileInfo.path, {
          path: fileInfo.path,
          content,
          exists: true,
        });
      } catch {
        files.set(fileInfo.path, {
          path: fileInfo.path,
          content: '',
          exists: false,
        });
      }
    }

    return {
      execution: {
        id: 'current',
        timestamp: new Date().toISOString(),
        dataPath: this.projectRoot,
      },
      files,
    };
  }

  /**
   * 過去の実行ファイルデータを取得
   * 保存ディレクトリ内のファイルを走査
   */
  async getExecutionFileData(executionId: string): Promise<VersionData> {
    const dataPath = path.join(this.studioDataDir, 'file_history', executionId);

    try {
      await this.fileSystem.access(dataPath);
    } catch (error) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const stats = await this.fileSystem.stat(dataPath);
    if (!stats.isDirectory()) {
      throw new Error(`Execution ${executionId} is not a directory`);
    }

    // file_history_log.jsonから実行時刻を取得
    const timestamp = await this.getExecutionTimestamp(dataPath);

    // ディレクトリ内のファイルを再帰的に収集（logファイルは除外）
    const fileList = await this.collectDirectoryFiles(dataPath, '');
    const files = new Map<string, FileData>();

    for (const fileInfo of fileList.filter((f) => !f.isDirectory && !this.isLogFile(f.path))) {
      const fullPath = path.join(dataPath, fileInfo.path);

      try {
        const content = await this.fileSystem.readFile(fullPath, 'utf-8');
        files.set(fileInfo.path, {
          path: fileInfo.path,
          content,
          exists: true,
        });
      } catch {
        files.set(fileInfo.path, {
          path: fileInfo.path,
          content: '',
          exists: false,
        });
      }
    }

    return {
      execution: {
        id: executionId,
        timestamp,
        dataPath,
      },
      files,
    };
  }

  /**
   * ディレクトリ内のファイルを再帰的に収集
   * FileHistoryServiceと同じパターン
   */
  private async collectDirectoryFiles(
    fullDirPath: string,
    relativeDirPath: string,
  ): Promise<Array<{ path: string; isDirectory: boolean }>> {
    const files: Array<{ path: string; isDirectory: boolean }> = [];

    try {
      const entries = await this.fileSystem.readdir(fullDirPath);

      for (const entry of entries) {
        const fullPath = path.join(fullDirPath, entry.name);
        const relativePath = relativeDirPath ? path.join(relativeDirPath, entry.name) : entry.name;

        try {
          if (entry.isDirectory()) {
            files.push({
              path: relativePath,
              isDirectory: true,
            });
            // 再帰的にサブディレクトリを探索
            const subFiles = await this.collectDirectoryFiles(fullPath, relativePath);
            files.push(...subFiles);
          } else {
            files.push({
              path: relativePath,
              isDirectory: false,
            });
          }
        } catch (error) {
          console.warn(`Error processing ${relativePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${relativeDirPath}:`, error);
    }

    return files;
  }

  /**
   * 2つの実行の古い/新しいを判別
   */
  determineOlderNewer(
    execution1: ExecutionMetadata,
    execution2: ExecutionMetadata,
  ): { older: ExecutionMetadata; newer: ExecutionMetadata } {
    const timestamp1 = new Date(execution1.timestamp);
    const timestamp2 = new Date(execution2.timestamp);

    if (timestamp1 <= timestamp2) {
      return { older: execution1, newer: execution2 };
    } else {
      return { older: execution2, newer: execution1 };
    }
  }

  /**
   * 全てのファイルパスを統合して取得
   */
  getAllFilePaths(versionData1: VersionData, versionData2: VersionData): string[] {
    const allPaths = new Set<string>();

    versionData1.files.forEach((_, path) => allPaths.add(path));
    versionData2.files.forEach((_, path) => allPaths.add(path));

    return Array.from(allPaths).sort();
  }

  /**
   * file_history_log.jsonから実行時刻を取得（フォールバック付き）
   */
  private async getExecutionTimestamp(dataPath: string): Promise<string> {
    const logFilePath = path.join(dataPath, 'file_history_log.json');

    try {
      await this.fileSystem.access(logFilePath);
      const logContent = await this.fileSystem.readFile(logFilePath, 'utf-8');
      const logData = JSON.parse(logContent);

      if (logData.timestamp) {
        return logData.timestamp;
      }
    } catch (error) {
      // ファイルが存在しない、読み取りエラー、JSON解析エラー、timestampフィールドなしの場合
      // 全て現在時刻でフォールバック
    }

    return new Date().toISOString();
  }

  /**
   * ログファイルかどうかを判定
   */
  private isLogFile(filePath: string): boolean {
    const logFilePatterns = [/\.log$/, /file_history_log\.json$/, /execution_log\.json$/];

    return logFilePatterns.some((pattern) => pattern.test(filePath));
  }
}
