import * as path from 'path';
import { IFileSystemService } from './filesystem';

// ファイル保存のステータス
export type FileHistoryStatus =
  | 'SUCCESS' // 正常に保存完了
  | 'PARTIAL_SUCCESS' // 一部のファイルが保存できなかった
  | 'FAILED_NO_PATHS' // save_path_listが空または存在しない
  | 'FAILED_SIZE_LIMIT' // ファイルサイズ制限超過
  | 'FAILED_COUNT_LIMIT' // ファイル数制限超過
  | 'FAILED_PERMISSION' // ファイルアクセス権限エラー
  | 'FAILED_NOT_FOUND' // 指定されたファイル/フォルダが存在しない
  | 'FAILED_INVALID_PATH' // 無効なパス（絶対パス、../等）
  | 'FAILED_DISK_SPACE' // ディスク容量不足
  | 'FAILED_UNKNOWN'; // その他のエラー

export interface FileHistoryResult {
  status: FileHistoryStatus;
  totalFiles: number;
  totalSize: number; // bytes
  processedFiles: number; // 実際に処理できたファイル数
  skippedFiles: string[]; // スキップされたファイルのパス
  warnings: string[];
  errors: string[];
  executionTimeMs: number; // 実行時間
}

interface FileHistoryLog {
  timestamp: string;
  executionId: string;
  savePathList: string[];
  result: FileHistoryResult;
}

/**
 * ファイル履歴保存を管理するサービス
 */
export class FileHistoryService {
  // 制限値
  private static readonly MAX_FILES = 100;
  private static readonly MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly WARN_FILE_SIZE = 1 * 1024 * 1024; // 1MB

  private readonly dataDir: string;
  private readonly projectRoot: string;

  constructor(
    private fileSystem: IFileSystemService,
    projectRoot: string = path.resolve(process.cwd(), '..'),
    dataDir: string = path.join(process.cwd(), 'data', 'file_history'),
  ) {
    this.projectRoot = projectRoot;
    this.dataDir = dataDir;
  }

  /**
   * ファイル履歴を保存する
   */
  async saveFileHistory(executionId: string, savePathList: string[]): Promise<FileHistoryResult> {
    const startTime = Date.now();
    const result: FileHistoryResult = {
      status: 'SUCCESS',
      totalFiles: 0,
      totalSize: 0,
      processedFiles: 0,
      skippedFiles: [],
      warnings: [],
      errors: [],
      executionTimeMs: 0,
    };

    try {
      // 事前検証
      const validationResult = await this.validateSavePathList(savePathList);
      if (validationResult.status !== 'SUCCESS') {
        result.status = validationResult.status;
        result.errors = validationResult.errors;
        result.skippedFiles = savePathList;
        result.executionTimeMs = Date.now() - startTime;
        await this.saveLog(executionId, savePathList, result);
        return result;
      }

      // validation段階のエラー（一部ファイルが存在しない等）を記録
      result.errors.push(...validationResult.errors);

      // スキップされたファイルを記録（存在しないファイル等）
      const skippedInValidation = savePathList.filter(
        (path) => !validationResult.validPaths.includes(path),
      );
      result.skippedFiles.push(...skippedInValidation);

      // 保存先ディレクトリを作成
      const saveDir = path.join(this.dataDir, executionId);
      await this.fileSystem.mkdir(saveDir, { recursive: true });

      // ファイル情報を収集
      const fileInfos = await this.collectFileInfos(validationResult.validPaths);
      result.totalFiles = fileInfos.length;
      result.totalSize = fileInfos.reduce((sum, info) => sum + info.size, 0);

      // 容量・ファイル数制限チェック
      const limitResult = this.checkLimits(fileInfos);
      if (limitResult.status !== 'SUCCESS') {
        result.status = limitResult.status;
        result.errors.push(...limitResult.errors);
        result.warnings.push(...limitResult.warnings);
        result.skippedFiles = savePathList; // 制限超過時は全ファイルがスキップ
        result.executionTimeMs = Date.now() - startTime;
        await this.saveLog(executionId, savePathList, result);
        return result;
      }

      result.warnings.push(...limitResult.warnings);

      // ファイルコピー実行
      const copyResult = await this.copyFiles(fileInfos, saveDir);
      result.processedFiles = copyResult.processedFiles;
      result.skippedFiles.push(...copyResult.skippedFiles);
      result.errors.push(...copyResult.errors);
      result.warnings.push(...copyResult.warnings);

      // 最終ステータス決定
      if (result.errors.length > 0) {
        result.status = result.processedFiles > 0 ? 'PARTIAL_SUCCESS' : 'FAILED_UNKNOWN';
      }

      result.executionTimeMs = Date.now() - startTime;

      // ログ保存
      await this.saveLog(executionId, savePathList, result);

      return result;
    } catch (error) {
      result.status = 'FAILED_UNKNOWN';
      result.errors.push(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.skippedFiles = savePathList;
      result.executionTimeMs = Date.now() - startTime;
      await this.saveLog(executionId, savePathList, result);
      return result;
    }
  }

  /**
   * save_path_listの事前検証
   */
  private async validateSavePathList(savePathList: string[]): Promise<{
    status: FileHistoryStatus;
    validPaths: string[];
    errors: string[];
  }> {
    const result = {
      status: 'SUCCESS' as FileHistoryStatus,
      validPaths: [] as string[],
      errors: [] as string[],
    };

    // 空チェック
    if (!savePathList || savePathList.length === 0) {
      result.status = 'FAILED_NO_PATHS';
      result.errors.push('save_path_list is empty or not configured');
      return result;
    }

    for (const filePath of savePathList) {
      // パス形式検証
      if (path.isAbsolute(filePath)) {
        result.errors.push(`Absolute path not allowed: ${filePath}`);
        continue;
      }

      if (filePath.includes('..')) {
        result.errors.push(`Parent directory reference not allowed: ${filePath}`);
        continue;
      }

      // ファイル/フォルダ存在チェック（プロジェクトルートからの相対パス）
      const fullPath = path.join(this.projectRoot, filePath);
      try {
        await this.fileSystem.access(fullPath);
        result.validPaths.push(filePath); // 相対パスのまま保持
      } catch {
        result.errors.push(`File or directory not found: ${filePath}`);
      }
    }

    if (result.validPaths.length === 0) {
      result.status = result.errors.some((e) => e.includes('not allowed'))
        ? 'FAILED_INVALID_PATH'
        : 'FAILED_NOT_FOUND';
    }

    return result;
  }

  /**
   * ファイル情報を収集
   */
  private async collectFileInfos(
    paths: string[],
  ): Promise<Array<{ path: string; size: number; isDirectory: boolean }>> {
    const fileInfos: Array<{ path: string; size: number; isDirectory: boolean }> = [];

    for (const targetPath of paths) {
      // プロジェクトルートからの絶対パスに変換
      const fullPath = path.join(this.projectRoot, targetPath);
      const stats = await this.fileSystem.stat(fullPath);

      if (stats.isDirectory()) {
        const dirFiles = await this.collectDirectoryFiles(fullPath, targetPath);
        fileInfos.push(...dirFiles);
      } else {
        fileInfos.push({
          path: targetPath, // 相対パスを保持
          size: stats.size,
          isDirectory: false,
        });
      }
    }

    return fileInfos;
  }

  /**
   * ディレクトリ内のファイルを再帰的に収集
   */
  private async collectDirectoryFiles(
    fullDirPath: string,
    relativeDirPath: string,
  ): Promise<Array<{ path: string; size: number; isDirectory: boolean }>> {
    const files: Array<{ path: string; size: number; isDirectory: boolean }> = [];

    const entries = await this.fileSystem.readdir(fullDirPath);

    for (const entry of entries) {
      const fullPath = path.join(fullDirPath, entry.name);
      const relativePath = path.join(relativeDirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.collectDirectoryFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        const stats = await this.fileSystem.stat(fullPath);
        files.push({
          path: relativePath, // 相対パスを保持
          size: stats.size,
          isDirectory: false,
        });
      }
    }

    return files;
  }

  /**
   * 容量・ファイル数制限チェック
   */
  private checkLimits(fileInfos: Array<{ path: string; size: number }>): {
    status: FileHistoryStatus;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      status: 'SUCCESS' as FileHistoryStatus,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // ファイル数制限チェック
    if (fileInfos.length > FileHistoryService.MAX_FILES) {
      result.status = 'FAILED_COUNT_LIMIT';
      result.errors.push(
        `Too many files: ${fileInfos.length} (max: ${FileHistoryService.MAX_FILES})`,
      );
      return result;
    }

    // 合計サイズ制限チェック
    const totalSize = fileInfos.reduce((sum, info) => sum + info.size, 0);
    if (totalSize > FileHistoryService.MAX_TOTAL_SIZE) {
      result.status = 'FAILED_SIZE_LIMIT';
      result.errors.push(
        `Total size too large: ${this.formatSize(totalSize)} (max: ${this.formatSize(FileHistoryService.MAX_TOTAL_SIZE)})`,
      );
      return result;
    }

    // 大きなファイルの警告
    for (const fileInfo of fileInfos) {
      if (fileInfo.size > FileHistoryService.WARN_FILE_SIZE) {
        result.warnings.push(
          `Large file detected: ${fileInfo.path} (${this.formatSize(fileInfo.size)})`,
        );
      }
    }

    return result;
  }

  /**
   * ファイルコピー実行
   */
  private async copyFiles(
    fileInfos: Array<{ path: string; size: number; isDirectory: boolean }>,
    saveDir: string,
  ): Promise<{
    processedFiles: number;
    skippedFiles: string[];
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      processedFiles: 0,
      skippedFiles: [] as string[],
      errors: [] as string[],
      warnings: [] as string[],
    };

    for (const fileInfo of fileInfos) {
      try {
        // ソースファイルはプロジェクトルートからの相対パス
        const srcPath = path.join(this.projectRoot, fileInfo.path);
        // 保存先はpahcer-studio/data/file_history/{executionId}/ 以下
        const destPath = path.join(saveDir, fileInfo.path);
        await this.fileSystem.mkdir(path.dirname(destPath), { recursive: true });
        await this.fileSystem.copyFile(srcPath, destPath);
        result.processedFiles++;
      } catch (error) {
        result.errors.push(
          `Failed to copy ${fileInfo.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
        result.skippedFiles.push(fileInfo.path);
      }
    }

    return result;
  }

  /**
   * ログファイル保存
   */
  private async saveLog(
    executionId: string,
    savePathList: string[],
    result: FileHistoryResult,
  ): Promise<void> {
    try {
      const saveDir = path.join(this.dataDir, executionId);
      await this.fileSystem.mkdir(saveDir, { recursive: true });

      const log: FileHistoryLog = {
        timestamp: new Date().toISOString(),
        executionId,
        savePathList,
        result,
      };

      const logPath = path.join(saveDir, 'file_history_log.json');
      await this.fileSystem.writeFile(logPath, JSON.stringify(log, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to save file history log: ${error}`);
    }
  }

  /**
   * ファイルサイズのフォーマット
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
