import * as path from 'path';
import { IFileSystemService, FileStats, FileDirent } from './IFileSystemService';

interface MockFileEntry {
  content: string;
  stats: FileStats;
  isDirectory: boolean;
}

/**
 * テスト用のモックファイルシステム実装
 * メモリ上でファイルシステムをシミュレート
 */
export class MockFileSystemService implements IFileSystemService {
  private files: Map<string, MockFileEntry> = new Map();
  private copyFileErrors: Map<string, Error> = new Map();

  /**
   * テスト用ファイルを追加
   */
  addFile(filePath: string, content: string, stats: { size: number }): void {
    this.files.set(filePath, {
      content,
      stats: {
        isDirectory: () => false,
        size: stats.size,
      },
      isDirectory: false,
    });
  }

  /**
   * テスト用ディレクトリを追加
   */
  addDirectory(dirPath: string): void {
    this.files.set(dirPath, {
      content: '',
      stats: {
        isDirectory: () => true,
        size: 0,
      },
      isDirectory: true,
    });
  }

  /**
   * ファイル・ディレクトリの存在確認
   */
  hasFile(filePath: string): boolean {
    return this.files.has(filePath);
  }

  /**
   * ファイル内容取得
   */
  getFileContent(filePath: string): string | undefined {
    return this.files.get(filePath)?.content;
  }

  /**
   * コピーエラーを設定（テスト用）
   */
  setCopyFileError(src: string, dest: string, error: Error): void {
    const key = `${src}->${dest}`;
    this.copyFileErrors.set(key, error);
  }

  /**
   * モックをクリア
   */
  clear(): void {
    this.files.clear();
    this.copyFileErrors.clear();
  }

  // IFileSystemService implementation

  async access(filePath: string): Promise<void> {
    if (!this.files.has(filePath)) {
      const error = new Error(
        `ENOENT: no such file or directory, access '${filePath}'`,
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
  }

  async readFile(filePath: string, encoding: string): Promise<string> {
    await this.access(filePath); // 存在チェック
    // encodingは実際のNode.jsとの互換性のため受け取るが、MockFileSystemServiceでは使用しない
    void encoding;
    const entry = this.files.get(filePath);
    if (entry?.isDirectory) {
      const error = new Error(
        `EISDIR: illegal operation on a directory, read`,
      ) as NodeJS.ErrnoException;
      error.code = 'EISDIR';
      throw error;
    }
    return entry!.content;
  }

  async writeFile(filePath: string, data: string, encoding: string): Promise<void> {
    // 親ディレクトリの存在確認
    const dir = path.dirname(filePath);
    if (dir !== '.' && !this.files.has(dir)) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${filePath}'`,
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    this.files.set(filePath, {
      content: data,
      stats: {
        isDirectory: () => false,
        size: Buffer.byteLength(data, encoding as BufferEncoding),
      },
      isDirectory: false,
    });
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      // 再帰的にディレクトリを作成
      const parts = dirPath.split(path.sep).filter((part) => part !== '');
      let currentPath = dirPath.startsWith('/') ? '/' : '';

      for (const part of parts) {
        currentPath = currentPath === '/' ? `/${part}` : path.join(currentPath, part);
        if (!this.files.has(currentPath)) {
          this.addDirectory(currentPath);
        }
      }
    } else {
      // 単一ディレクトリ作成
      if (this.files.has(dirPath)) {
        const error = new Error(
          `EEXIST: file already exists, mkdir '${dirPath}'`,
        ) as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }
      this.addDirectory(dirPath);
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    // コピーエラーがシミュレートされている場合はエラーを投げる
    const key = `${src}->${dest}`;
    if (this.copyFileErrors.has(key)) {
      throw this.copyFileErrors.get(key)!;
    }

    await this.access(src); // ソース存在チェック
    const srcEntry = this.files.get(src);
    if (srcEntry?.isDirectory) {
      const error = new Error(
        `EISDIR: illegal operation on a directory, copyfile`,
      ) as NodeJS.ErrnoException;
      error.code = 'EISDIR';
      throw error;
    }

    // 宛先ディレクトリの存在確認
    const destDir = path.dirname(dest);
    if (destDir !== '.' && !this.files.has(destDir)) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${dest}'`,
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    this.files.set(dest, {
      content: srcEntry!.content,
      stats: srcEntry!.stats,
      isDirectory: false,
    });
  }

  async stat(filePath: string): Promise<FileStats> {
    await this.access(filePath); // 存在チェック
    const entry = this.files.get(filePath);
    return entry!.stats;
  }

  async readdir(dirPath: string): Promise<FileDirent[]> {
    await this.access(dirPath); // 存在チェック
    const entry = this.files.get(dirPath);
    if (!entry?.isDirectory) {
      const error = new Error(
        `ENOTDIR: not a directory, scandir '${dirPath}'`,
      ) as NodeJS.ErrnoException;
      error.code = 'ENOTDIR';
      throw error;
    }

    // ディレクトリ内のファイル・ディレクトリを検索
    const entries: FileDirent[] = [];
    const prefix = dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep;

    for (const [filePath, fileEntry] of this.files.entries()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.substring(prefix.length);
        // 直下のファイル・ディレクトリのみ（サブディレクトリの中身は除外）
        if (!relativePath.includes(path.sep)) {
          entries.push({
            name: relativePath,
            isDirectory: () => fileEntry.isDirectory,
          });
        }
      }
    }

    return entries;
  }
}
