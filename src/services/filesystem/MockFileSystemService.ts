import * as path from 'path';
import type { IFileSystemService } from './IFileSystemService';

/**
 * テスト用のインメモリファイルシステム実装
 *
 * ファイルシステムをメモリ上でエミュレートし、テストを高速化します。
 * 実際のファイルI/Oを行わないため、テストの独立性が保たれます。
 */
export class MockFileSystemService implements IFileSystemService {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // ルートディレクトリを作成
    this.directories.add('/');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readFile(filepath: string, _encoding: BufferEncoding): Promise<string> {
    const normalized = this.normalizePath(filepath);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw this.createError('ENOENT', `no such file or directory, open '${filepath}'`);
    }
    return content;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async writeFile(filepath: string, data: string, _encoding: BufferEncoding): Promise<void> {
    const normalized = this.normalizePath(filepath);
    const parentDir = path.dirname(normalized);

    // 親ディレクトリの存在確認
    if (!this.directories.has(parentDir)) {
      throw this.createError('ENOENT', `no such file or directory, open '${filepath}'`);
    }

    this.files.set(normalized, data);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const normalizedSrc = this.normalizePath(src);
    const normalizedDest = this.normalizePath(dest);

    const content = this.files.get(normalizedSrc);
    if (content === undefined) {
      throw this.createError('ENOENT', `no such file or directory, open '${src}'`);
    }

    const destParentDir = path.dirname(normalizedDest);
    if (!this.directories.has(destParentDir)) {
      throw this.createError('ENOENT', `no such file or directory, open '${dest}'`);
    }

    this.files.set(normalizedDest, content);
  }

  async access(filepath: string): Promise<void> {
    const normalized = this.normalizePath(filepath);
    if (!this.files.has(normalized) && !this.directories.has(normalized)) {
      throw this.createError('ENOENT', `no such file or directory, access '${filepath}'`);
    }
  }

  async readdir(dirpath: string): Promise<string[]> {
    const normalized = this.normalizePath(dirpath);

    if (!this.directories.has(normalized)) {
      throw this.createError('ENOENT', `no such file or directory, scandir '${dirpath}'`);
    }

    const entries: string[] = [];

    // ファイルを検索
    for (const filepath of this.files.keys()) {
      const fileDir = path.dirname(filepath);
      if (fileDir === normalized) {
        entries.push(path.basename(filepath));
      }
    }

    // ディレクトリを検索
    for (const directory of this.directories) {
      const parentDir = path.dirname(directory);
      if (parentDir === normalized && directory !== normalized) {
        entries.push(path.basename(directory));
      }
    }

    return entries.sort();
  }

  async mkdir(dirpath: string, options?: { recursive: boolean }): Promise<void> {
    const normalized = this.normalizePath(dirpath);

    if (this.directories.has(normalized)) {
      // 既に存在する場合は何もしない
      return;
    }

    if (options?.recursive) {
      // 親ディレクトリも再帰的に作成
      const parts = normalized.split('/').filter((p) => p !== '');
      let currentPath = '';
      for (const part of parts) {
        currentPath += '/' + part;
        this.directories.add(currentPath);
      }
    } else {
      // 親ディレクトリの存在確認
      const parentDir = path.dirname(normalized);
      if (!this.directories.has(parentDir)) {
        throw this.createError('ENOENT', `no such file or directory, mkdir '${dirpath}'`);
      }
      this.directories.add(normalized);
    }
  }

  async stat(filepath: string): Promise<{ isDirectory: () => boolean; mtime: Date }> {
    const normalized = this.normalizePath(filepath);

    const isFile = this.files.has(normalized);
    const isDir = this.directories.has(normalized);

    if (!isFile && !isDir) {
      throw this.createError('ENOENT', `no such file or directory, stat '${filepath}'`);
    }

    return {
      isDirectory: () => isDir && !isFile,
      mtime: new Date(),
    };
  }

  async rm(filepath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const normalized = this.normalizePath(filepath);

    const isFile = this.files.has(normalized);
    const isDir = this.directories.has(normalized);

    if (!isFile && !isDir) {
      if (!options?.force) {
        throw this.createError('ENOENT', `no such file or directory, rm '${filepath}'`);
      }
      return;
    }

    if (isFile) {
      this.files.delete(normalized);
    }

    if (isDir) {
      if (options?.recursive) {
        // 再帰的に削除
        const toDelete: string[] = [];
        for (const file of this.files.keys()) {
          if (file.startsWith(normalized + '/')) {
            toDelete.push(file);
          }
        }
        for (const file of toDelete) {
          this.files.delete(file);
        }

        const dirsToDelete: string[] = [];
        for (const dir of this.directories) {
          if (dir.startsWith(normalized + '/') || dir === normalized) {
            dirsToDelete.push(dir);
          }
        }
        for (const dir of dirsToDelete) {
          this.directories.delete(dir);
        }
      } else {
        this.directories.delete(normalized);
      }
    }
  }

  // ========================================
  // テスト用ヘルパーメソッド
  // ========================================

  /**
   * ファイルの内容を設定します（テスト用）
   */
  setFileContent(filepath: string, content: string): void {
    const normalized = this.normalizePath(filepath);
    this.files.set(normalized, content);

    // 親ディレクトリが存在しない場合は自動作成
    const parts = normalized.split('/').filter((p) => p !== '');
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i];
      this.directories.add(currentPath);
    }
  }

  /**
   * ファイルの内容を取得します（テスト用）
   */
  getFileContent(filepath: string): string | undefined {
    const normalized = this.normalizePath(filepath);
    return this.files.get(normalized);
  }

  /**
   * ディレクトリを設定します（テスト用）
   */
  setDirectory(dirpath: string): void {
    const normalized = this.normalizePath(dirpath);
    this.directories.add(normalized);

    // 親ディレクトリも自動作成
    const parts = normalized.split('/').filter((p) => p !== '');
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      this.directories.add(currentPath);
    }
  }

  /**
   * ファイルが存在するか確認します（テスト用）
   */
  fileExists(filepath: string): boolean {
    const normalized = this.normalizePath(filepath);
    return this.files.has(normalized);
  }

  /**
   * ディレクトリが存在するか確認します（テスト用）
   */
  directoryExists(dirpath: string): boolean {
    const normalized = this.normalizePath(dirpath);
    return this.directories.has(normalized);
  }

  /**
   * すべてのファイルとディレクトリをクリアします（テスト用）
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  // ========================================
  // プライベートメソッド
  // ========================================

  private normalizePath(filepath: string): string {
    // パスを正規化（Windows/Unix対応）
    let normalized = filepath.replace(/\\/g, '/');

    // 相対パスを絶対パスに変換
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    return normalized;
  }

  private createError(code: string, message: string): Error {
    const error = new Error(`${code}: ${message}`) as Error & { code: string };
    error.code = code;
    return error;
  }
}
