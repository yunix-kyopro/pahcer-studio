import * as fs from 'fs/promises';
import { IFileSystemService, FileStats, FileDirent } from './IFileSystemService';

/**
 * 本番環境で使用する実際のファイルシステム実装
 */
export class FileSystemService implements IFileSystemService {
  async access(path: string): Promise<void> {
    return fs.access(path);
  }

  async readFile(path: string, encoding: string): Promise<string> {
    return fs.readFile(path, encoding as BufferEncoding);
  }

  async writeFile(path: string, data: string, encoding: string): Promise<void> {
    return fs.writeFile(path, data, encoding as BufferEncoding);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    return fs.copyFile(src, dest);
  }

  async stat(path: string): Promise<FileStats> {
    const stats = await fs.stat(path);
    return {
      isDirectory: () => stats.isDirectory(),
      size: stats.size,
    };
  }

  async readdir(path: string): Promise<FileDirent[]> {
    const entries = await fs.readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: () => entry.isDirectory(),
    }));
  }
}
