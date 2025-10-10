import * as fs from 'fs/promises';
import type { IFileSystemService } from './IFileSystemService';

/**
 * 本番環境用のファイルシステム実装
 *
 * Node.jsの fs/promises をラップし、IFileSystemService インターフェースを実装します。
 */
export class FileSystemService implements IFileSystemService {
  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return await fs.readFile(path, encoding);
  }

  async writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void> {
    await fs.writeFile(path, data, encoding);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
  }

  async access(path: string): Promise<void> {
    await fs.access(path);
  }

  async readdir(path: string): Promise<string[]> {
    return await fs.readdir(path);
  }

  async mkdir(path: string, options?: { recursive: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async stat(path: string): Promise<{ isDirectory: () => boolean; mtime: Date }> {
    const stats = await fs.stat(path);
    return {
      isDirectory: () => stats.isDirectory(),
      mtime: stats.mtime,
    };
  }

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await fs.rm(path, options);
  }
}
