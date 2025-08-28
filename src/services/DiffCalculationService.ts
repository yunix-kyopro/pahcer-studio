import { VersionData, FileData } from './FileDataService';

export type ChangeType = 'added' | 'deleted' | 'modified' | 'unchanged';

export interface ChangedFile {
  path: string;
  changeType: ChangeType;
  oldContent?: string;
  newContent?: string;
  // MonacoDiffEditor対応情報
  fileExtension: string;
  language: string;
  isBinary: boolean;
}

export interface DiffStats {
  totalFiles: number;
  addedFiles: number;
  deletedFiles: number;
  modifiedFiles: number;
  unchangedFiles: number;
}

export interface DiffResult {
  olderExecution: { id: string; timestamp: string };
  newerExecution: { id: string; timestamp: string };
  changedFiles: ChangedFile[];
  stats: DiffStats;
}

/**
 * 差分計算サービス
 * 2つのVersionDataを比較してDiffResultを生成する責任を持つ
 */
export class DiffCalculationService {
  /**
   * 2つのバージョンを比較してdiff結果を生成
   */
  calculateDiff(olderVersion: VersionData, newerVersion: VersionData): DiffResult {
    const allPaths = this.getAllFilePaths(olderVersion, newerVersion);
    const changedFiles: ChangedFile[] = [];

    let addedFiles = 0;
    let deletedFiles = 0;
    let modifiedFiles = 0;
    let unchangedFiles = 0;

    for (const filePath of allPaths) {
      const olderFile = olderVersion.files.get(filePath);
      const newerFile = newerVersion.files.get(filePath);

      const changeType = this.determineChangeType(olderFile, newerFile);

      // Monaco対応の情報を追加
      const fileExtension = this.getFileExtension(filePath);
      const language = this.getLanguageFromExtension(filePath);

      // バイナリ判定（どちらかのコンテンツでもあれば判定）
      const contentForBinaryCheck = newerFile?.content || olderFile?.content || '';
      const isBinary = this.isBinaryFile(contentForBinaryCheck);

      changedFiles.push({
        path: filePath,
        changeType,
        oldContent: olderFile?.content,
        newContent: newerFile?.content,
        fileExtension,
        language,
        isBinary,
      });

      // 統計情報を更新
      switch (changeType) {
        case 'added':
          addedFiles++;
          break;
        case 'deleted':
          deletedFiles++;
          break;
        case 'modified':
          modifiedFiles++;
          break;
        case 'unchanged':
          unchangedFiles++;
          break;
      }
    }

    return {
      olderExecution: {
        id: olderVersion.execution.id,
        timestamp: olderVersion.execution.timestamp,
      },
      newerExecution: {
        id: newerVersion.execution.id,
        timestamp: newerVersion.execution.timestamp,
      },
      changedFiles,
      stats: {
        totalFiles: allPaths.length,
        addedFiles,
        deletedFiles,
        modifiedFiles,
        unchangedFiles,
      },
    };
  }

  /**
   * 変更タイプを判定
   */
  private determineChangeType(
    olderFile: FileData | undefined,
    newerFile: FileData | undefined,
  ): ChangeType {
    // 新しいファイルのみ存在 → 追加
    if (!olderFile?.exists && newerFile?.exists) {
      return 'added';
    }

    // 古いファイルのみ存在 → 削除
    if (olderFile?.exists && !newerFile?.exists) {
      return 'deleted';
    }

    // 両方とも存在しない → 実際には発生しないはずだが、安全のため
    if (!olderFile?.exists && !newerFile?.exists) {
      return 'unchanged';
    }

    // 両方とも存在する場合、内容を比較
    if (olderFile?.exists && newerFile?.exists) {
      if (olderFile.content === newerFile.content) {
        return 'unchanged';
      } else {
        return 'modified';
      }
    }

    // デフォルト（ここに到達することはないはず）
    return 'unchanged';
  }

  /**
   * 全てのファイルパスを統合して取得
   */
  private getAllFilePaths(versionData1: VersionData, versionData2: VersionData): string[] {
    const allPaths = new Set<string>();

    versionData1.files.forEach((_, path) => allPaths.add(path));
    versionData2.files.forEach((_, path) => allPaths.add(path));

    return Array.from(allPaths).sort();
  }

  /**
   * ファイル拡張子から言語を推定
   */
  private getLanguageFromExtension(filePath: string): string {
    const extension = this.getFileExtension(filePath);
    const languageMap: Record<string, string> = {
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c++': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.md': 'markdown',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.bat': 'bat',
      '.ps1': 'powershell',
      '.sql': 'sql',
      '.r': 'r',
      '.R': 'r',
      '.m': 'objective-c',
      '.mm': 'objective-cpp',
    };

    return languageMap[extension] || 'plaintext';
  }

  /**
   * ファイル拡張子を取得
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex >= 0 ? filePath.substring(lastDotIndex) : '';
  }

  /**
   * バイナリファイルかどうかを判定
   */
  private isBinaryFile(content: string): boolean {
    // 基本的な判定: null文字が含まれているかチェック
    if (content.includes('\0')) {
      return true;
    }

    // 制御文字の割合をチェック（改行・タブ・復帰文字は除く）
    const controlCharCount = content.split('').filter((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13; // tab, LF, CR は除外
    }).length;

    const controlRatio = controlCharCount / content.length;
    return controlRatio > 0.1; // 10%以上制御文字があればバイナリと判定
  }
}
