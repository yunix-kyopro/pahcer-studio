import { FileDiffService } from '../FileDiffService';
import { DIContainer } from '../../infrastructure/DIContainer';
import { MockFileSystemService } from '../filesystem';

describe('FileDiffService', () => {
  let fileDiffService: FileDiffService;
  let mockFileSystem: MockFileSystemService;
  let container: DIContainer;

  beforeEach(() => {
    // テスト用DIContainerを作成
    container = DIContainer.createTestContainer();
    mockFileSystem = container.getMockFileSystemService();
    fileDiffService = container.getFileDiffService();

    // MockFileSystemServiceをクリア
    mockFileSystem.clear();
  });

  describe('getDiff', () => {
    it('should compare two executions and return diff result', async () => {
      // テストデータの準備
      const executionId1 = 'exec-2024-01-01-123456';
      const executionId2 = 'exec-2024-01-02-123456';

      // 実行1のデータ（古い方）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-2024-01-01-123456');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-2024-01-01-123456/main.cpp',
        '#include <iostream>\nint main() {\n  std::cout << "Hello" << std::endl;\n  return 0;\n}',
        { size: 100 },
      );

      // 実行2のデータ（新しい方）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-2024-01-02-123456');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-2024-01-02-123456/main.cpp',
        '#include <iostream>\nint main() {\n  std::cout << "Hello World" << std::endl;\n  return 0;\n}',
        { size: 120 },
      );

      // テスト実行
      const result = await fileDiffService.getDiff(executionId1, executionId2);

      // 期待する結果
      expect(result.olderExecution.id).toBe(executionId1);
      expect(result.newerExecution.id).toBe(executionId2);
      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0].path).toBe('main.cpp');
      expect(result.changedFiles[0].changeType).toBe('modified');
      expect(result.changedFiles[0].fileExtension).toBe('.cpp'); // Monaco対応チェック
      expect(result.changedFiles[0].language).toBe('cpp');
      expect(result.changedFiles[0].isBinary).toBe(false);
      expect(result.stats.modifiedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(1);
    });

    it('should handle executions with different timestamps correctly', async () => {
      const executionId1 = 'exec-newer';
      const executionId2 = 'exec-older';

      // 実行1のディレクトリ（ファイルが存在しない場合でも空のディレクトリ）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-newer');

      // 実行2のディレクトリ（同じく空）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-older');

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      // FileDataServiceは現在時刻をタイムスタンプとして使用するため
      // IDで判別することになる（両方とも似た時刻になる）
      expect(result.changedFiles).toHaveLength(0); // ファイルが存在しない
      expect(result.stats.totalFiles).toBe(0);
    });

    it('should throw error when execution does not exist', async () => {
      const executionId1 = 'non-existent-1';
      const executionId2 = 'non-existent-2';

      await expect(fileDiffService.getDiff(executionId1, executionId2)).rejects.toThrow();
    });

    it('should throw error when one version folder does not exist', async () => {
      const executionId1 = 'existing-exec';
      const executionId2 = 'missing-folder-exec';

      // 実行1は存在
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/existing-exec');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/existing-exec/file1.txt',
        'content1',
        {
          size: 8,
        },
      );

      // 実行2のフォルダは作成しない（存在しない状態）

      await expect(fileDiffService.getDiff(executionId1, executionId2)).rejects.toThrow();
    });

    it('should handle files that exist in only one execution (added files)', async () => {
      const executionId1 = 'exec-old';
      const executionId2 = 'exec-new';

      // 実行1: main.cppのみ
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-old');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-old/main.cpp',
        '#include <iostream>',
        {
          size: 50,
        },
      );

      // 実行2: main.cpp + new-file.h
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-new');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-new/main.cpp',
        '#include <iostream>',
        {
          size: 50,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-new/new-file.h',
        '#ifndef NEW_FILE_H\n#define NEW_FILE_H\n#endif',
        { size: 40 },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(2);

      const addedFile = result.changedFiles.find((f) => f.changeType === 'added');
      expect(addedFile).toBeDefined();
      expect(addedFile?.path).toBe('new-file.h');
      expect(addedFile?.newContent).toBe('#ifndef NEW_FILE_H\n#define NEW_FILE_H\n#endif');
      expect(addedFile?.oldContent).toBeUndefined();

      const unchangedFile = result.changedFiles.find((f) => f.changeType === 'unchanged');
      expect(unchangedFile).toBeDefined();
      expect(unchangedFile?.path).toBe('main.cpp');

      expect(result.stats.addedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should handle files that exist in only one execution (deleted files)', async () => {
      const executionId1 = 'exec-with-files';
      const executionId2 = 'exec-fewer-files';

      // 実行1: 複数ファイル
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-with-files');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-with-files/main.cpp',
        '#include <iostream>',
        { size: 50 },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-with-files/deprecated.h',
        '// This file is deprecated',
        { size: 30 },
      );

      // 実行2: main.cppのみ
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-fewer-files');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-fewer-files/main.cpp',
        '#include <iostream>',
        { size: 50 },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(2);

      const deletedFile = result.changedFiles.find((f) => f.changeType === 'deleted');
      expect(deletedFile).toBeDefined();
      expect(deletedFile?.path).toBe('deprecated.h');
      expect(deletedFile?.oldContent).toBe('// This file is deprecated');
      expect(deletedFile?.newContent).toBeUndefined();

      expect(result.stats.deletedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should handle empty executions correctly', async () => {
      const executionId1 = 'empty-exec-1';
      const executionId2 = 'empty-exec-2';

      // 両方とも空のディレクトリ
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/empty-exec-1');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/empty-exec-2');

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(0);
      expect(result.stats.totalFiles).toBe(0);
      expect(result.stats.addedFiles).toBe(0);
      expect(result.stats.deletedFiles).toBe(0);
      expect(result.stats.modifiedFiles).toBe(0);
      expect(result.stats.unchangedFiles).toBe(0);
    });

    it('should handle complex file changes scenario', async () => {
      const executionId1 = 'complex-old';
      const executionId2 = 'complex-new';

      // 実行1: 4つのファイル
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/complex-old');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-old/unchanged.cpp',
        'unchanged content',
        { size: 20 },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-old/modified.cpp',
        'old content',
        {
          size: 15,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-old/deleted.h',
        'to be deleted',
        {
          size: 18,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-old/renamed-old.txt',
        'renamed content',
        { size: 20 },
      );

      // 実行2: 4つのファイル（1つ削除、1つ変更、1つ追加、1つリネーム風）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/complex-new');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-new/unchanged.cpp',
        'unchanged content',
        { size: 20 },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-new/modified.cpp',
        'new content',
        {
          size: 15,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-new/added.py',
        'print("hello")',
        {
          size: 18,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/complex-new/renamed-new.txt',
        'renamed content',
        { size: 20 },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(6); // All 6 files: unchanged + modified + deleted + renamed-old + added + renamed-new
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.modifiedFiles).toBe(1);
      expect(result.stats.addedFiles).toBe(2); // added.py + renamed-new.txt
      expect(result.stats.deletedFiles).toBe(2); // deleted.h + renamed-old.txt
      expect(result.stats.totalFiles).toBe(6);

      // 各変更タイプをチェック
      const unchangedFile = result.changedFiles.find((f) => f.path === 'unchanged.cpp');
      expect(unchangedFile?.changeType).toBe('unchanged');

      const modifiedFile = result.changedFiles.find((f) => f.path === 'modified.cpp');
      expect(modifiedFile?.changeType).toBe('modified');

      const addedFile = result.changedFiles.find((f) => f.path === 'added.py');
      expect(addedFile?.changeType).toBe('added');
      expect(addedFile?.language).toBe('python');

      const deletedFile = result.changedFiles.find((f) => f.path === 'deleted.h');
      expect(deletedFile?.changeType).toBe('deleted');
    });
  });

  describe('getDiffWithLatest', () => {
    it('should compare execution with current project files', async () => {
      const executionId = 'exec-test';

      // ConfigService用の設定ファイル
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["main.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // 実行データ（保存された古いファイル）
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-test');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-test/main.cpp',
        '#include <iostream>\nint main() {\n  std::cout << "Old version" << std::endl;\n  return 0;\n}',
        { size: 100 },
      );

      // 現在のプロジェクトファイル（新しいファイル）
      mockFileSystem.addFile(
        '/mock/main.cpp',
        '#include <iostream>\nint main() {\n  std::cout << "Latest version" << std::endl;\n  return 0;\n}',
        { size: 120 },
      );

      const result = await fileDiffService.getDiffWithLatest(executionId);

      expect(result.olderExecution.id).toBe(executionId);
      expect(result.newerExecution.id).toBe('current');
      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0].path).toBe('main.cpp');
      expect(result.changedFiles[0].changeType).toBe('modified');
      expect(result.changedFiles[0].fileExtension).toBe('.cpp'); // Monaco対応チェック
      expect(result.changedFiles[0].language).toBe('cpp');
      expect(result.changedFiles[0].isBinary).toBe(false);
    });

    it('should handle when execution has files but current project has no config', async () => {
      const executionId = 'exec-with-files';

      // 実行データにはファイルが存在
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-with-files');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-with-files/saved-file.cpp',
        '#include <iostream>',
        { size: 50 },
      );

      // 現在のプロジェクトには設定ファイルなし（ConfigServiceは空のリストを返す）
      // pahcer_config.tomlが存在しない

      const result = await fileDiffService.getDiffWithLatest(executionId);

      expect(result.olderExecution.id).toBe(executionId);
      expect(result.newerExecution.id).toBe('current');
      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0].path).toBe('saved-file.cpp');
      expect(result.changedFiles[0].changeType).toBe('deleted'); // 現在は存在しないので削除扱い
    });

    it('should handle when current project has files but execution is empty', async () => {
      const executionId = 'empty-exec';

      // ConfigService用の設定ファイル
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["current-file.js"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // 実行データは空
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/empty-exec');

      // 現在のプロジェクトファイル
      mockFileSystem.addFile('/mock/current-file.js', 'console.log("current");', { size: 25 });

      const result = await fileDiffService.getDiffWithLatest(executionId);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0].path).toBe('current-file.js');
      expect(result.changedFiles[0].changeType).toBe('added'); // 実行時には存在せず、現在は存在するので追加扱い
      expect(result.changedFiles[0].language).toBe('javascript');
      expect(result.stats.addedFiles).toBe(1);
    });

    it('should handle when current project file does not exist on disk', async () => {
      const executionId = 'exec-test';

      // ConfigService用の設定（存在しないファイルを指定）
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["missing-file.cpp", "existing-file.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // 実行データ
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/exec-test');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-test/missing-file.cpp',
        'old content',
        {
          size: 15,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/exec-test/existing-file.cpp',
        'old existing content',
        { size: 25 },
      );

      // 現在のプロジェクトには1つのファイルのみ存在
      mockFileSystem.addFile('/mock/existing-file.cpp', 'new existing content', { size: 25 });
      // missing-file.cppは実際には存在しない

      const result = await fileDiffService.getDiffWithLatest(executionId);

      expect(result.changedFiles).toHaveLength(2);

      const deletedFile = result.changedFiles.find((f) => f.path === 'missing-file.cpp');
      expect(deletedFile?.changeType).toBe('deleted');
      expect(deletedFile?.oldContent).toBe('old content');

      const modifiedFile = result.changedFiles.find((f) => f.path === 'existing-file.cpp');
      expect(modifiedFile?.changeType).toBe('modified');
      expect(modifiedFile?.oldContent).toBe('old existing content');
      expect(modifiedFile?.newContent).toBe('new existing content');

      expect(result.stats.deletedFiles).toBe(1);
      expect(result.stats.modifiedFiles).toBe(1);
    });

    it('should handle binary files in latest comparison', async () => {
      const executionId = 'binary-test';

      // ConfigService用の設定
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["data.bin", "text.txt"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // 実行データ
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/binary-test');
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/binary-test/data.bin',
        'old\0binary',
        {
          size: 12,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/binary-test/text.txt',
        'old text',
        {
          size: 10,
        },
      );

      // 現在のファイル
      mockFileSystem.addFile('/mock/data.bin', 'new\0binary\0data', { size: 18 });
      mockFileSystem.addFile('/mock/text.txt', 'new text', { size: 10 });

      const result = await fileDiffService.getDiffWithLatest(executionId);

      expect(result.changedFiles).toHaveLength(2);

      const binaryFile = result.changedFiles.find((f) => f.path === 'data.bin');
      expect(binaryFile?.changeType).toBe('modified');
      expect(binaryFile?.isBinary).toBe(true);

      const textFile = result.changedFiles.find((f) => f.path === 'text.txt');
      expect(textFile?.changeType).toBe('modified');
      expect(textFile?.isBinary).toBe(false);
    });

    it('should throw error when execution does not exist in getDiffWithLatest', async () => {
      const executionId = 'non-existent-exec';

      // ConfigService設定は存在
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["main.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      await expect(fileDiffService.getDiffWithLatest(executionId)).rejects.toThrow();
    });
  });

  describe('エラーケースと境界値テスト', () => {
    it('should handle directory that exists but is not a directory', async () => {
      const executionId1 = 'file-instead-of-dir-1';
      const executionId2 = 'file-instead-of-dir-2';

      // ディレクトリではなくファイルとして作成
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/file-instead-of-dir-1',
        'not a directory',
        {
          size: 20,
        },
      );
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/file-instead-of-dir-2');

      await expect(fileDiffService.getDiff(executionId1, executionId2)).rejects.toThrow();
    });

    it('should handle very long file paths', async () => {
      const executionId1 = 'long-path-test-1';
      const executionId2 = 'long-path-test-2';

      const longPath = 'very/long/nested/directory/structure/with/many/levels/deep/file.txt';

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/long-path-test-1');
      // Create nested directories first
      const pathParts = longPath.split('/');
      let currentPath1 = '/mock/pahcer-studio/data/file_history/long-path-test-1';
      let currentPath2 = '/mock/pahcer-studio/data/file_history/long-path-test-2';

      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath1 += '/' + pathParts[i];
        currentPath2 += '/' + pathParts[i];
        mockFileSystem.addDirectory(currentPath1);
        mockFileSystem.addDirectory(currentPath2);
      }

      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/long-path-test-1/${longPath}`,
        'content1',
        {
          size: 10,
        },
      );

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/long-path-test-2');
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/long-path-test-2/${longPath}`,
        'content2',
        {
          size: 10,
        },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0].path).toBe(longPath);
      expect(result.changedFiles[0].changeType).toBe('modified');
    });

    it('should handle files with special characters in names', async () => {
      const executionId1 = 'special-chars-1';
      const executionId2 = 'special-chars-2';

      const specialFiles = [
        'file with spaces.txt',
        'файл-кириллица.txt',
        'ファイル名前.txt',
        'file@#$%^&()_+.txt',
        'file.with.many.dots.txt',
      ];

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/special-chars-1');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/special-chars-2');

      specialFiles.forEach((fileName, index) => {
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/special-chars-1/${fileName}`,
          `old content ${index}`,
          { size: 15 + index },
        );
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/special-chars-2/${fileName}`,
          `new content ${index}`,
          { size: 15 + index },
        );
      });

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(specialFiles.length);
      result.changedFiles.forEach((file) => {
        expect(specialFiles).toContain(file.path);
        expect(file.changeType).toBe('modified');
      });
    });

    it('should handle large number of files', async () => {
      const executionId1 = 'many-files-1';
      const executionId2 = 'many-files-2';

      const fileCount = 100;

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/many-files-1');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/many-files-2');

      // 大量のファイルを作成
      for (let i = 0; i < fileCount; i++) {
        const fileName = `file-${i.toString().padStart(3, '0')}.txt`;
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/many-files-1/${fileName}`,
          `content ${i} old`,
          { size: 15 },
        );

        if (i % 3 === 0) {
          // 3つに1つは変更
          mockFileSystem.addFile(
            `/mock/pahcer-studio/data/file_history/many-files-2/${fileName}`,
            `content ${i} new`,
            { size: 15 },
          );
        } else if (i % 3 === 1) {
          // 3つに1つは削除（新しい方に作成しない）
          // なにもしない
        } else {
          // 3つに1つは変更なし
          mockFileSystem.addFile(
            `/mock/pahcer-studio/data/file_history/many-files-2/${fileName}`,
            `content ${i} old`,
            { size: 15 },
          );
        }
      }

      // いくつか新しいファイルも追加
      for (let i = 0; i < 10; i++) {
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/many-files-2/new-file-${i}.txt`,
          `new content ${i}`,
          { size: 18 },
        );
      }

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles.length).toBeGreaterThan(90); // 大部分のファイル
      expect(result.stats.totalFiles).toBeGreaterThan(100);

      // 統計の整合性チェック
      const { addedFiles, deletedFiles, modifiedFiles, unchangedFiles } = result.stats;
      expect(addedFiles + deletedFiles + modifiedFiles + unchangedFiles).toBe(
        result.stats.totalFiles,
      );
    });

    it('should handle empty file contents', async () => {
      const executionId1 = 'empty-content-1';
      const executionId2 = 'empty-content-2';

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/empty-content-1');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/empty-content-2');

      // 空のファイル同士
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-1/empty1.txt',
        '',
        {
          size: 0,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-2/empty1.txt',
        '',
        {
          size: 0,
        },
      );

      // 空 -> 内容あり
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-1/empty2.txt',
        '',
        {
          size: 0,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-2/empty2.txt',
        'now has content',
        { size: 16 },
      );

      // 内容あり -> 空
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-1/empty3.txt',
        'had content',
        {
          size: 12,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/empty-content-2/empty3.txt',
        '',
        {
          size: 0,
        },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(3);

      const unchangedEmpty = result.changedFiles.find((f) => f.path === 'empty1.txt');
      expect(unchangedEmpty?.changeType).toBe('unchanged');

      const emptyToContent = result.changedFiles.find((f) => f.path === 'empty2.txt');
      expect(emptyToContent?.changeType).toBe('modified');
      expect(emptyToContent?.oldContent).toBe('');
      expect(emptyToContent?.newContent).toBe('now has content');

      const contentToEmpty = result.changedFiles.find((f) => f.path === 'empty3.txt');
      expect(contentToEmpty?.changeType).toBe('modified');
      expect(contentToEmpty?.oldContent).toBe('had content');
      expect(contentToEmpty?.newContent).toBe('');
    });

    it('should handle mixed binary and text files', async () => {
      const executionId1 = 'mixed-types-1';
      const executionId2 = 'mixed-types-2';

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/mixed-types-1');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/mixed-types-2');

      // テキストファイル
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-1/readme.md',
        '# Old README',
        {
          size: 12,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-2/readme.md',
        '# New README',
        {
          size: 12,
        },
      );

      // バイナリファイル
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-1/image.png',
        'PNG\0old\0binary',
        { size: 15 },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-2/image.png',
        'PNG\0new\0binary',
        { size: 15 },
      );

      // テキスト -> バイナリ
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-1/convert.dat',
        'plain text',
        {
          size: 10,
        },
      );
      mockFileSystem.addFile(
        '/mock/pahcer-studio/data/file_history/mixed-types-2/convert.dat',
        'binary\0data\0now',
        { size: 15 },
      );

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(3);

      const textFile = result.changedFiles.find((f) => f.path === 'readme.md');
      expect(textFile?.isBinary).toBe(false);
      expect(textFile?.language).toBe('markdown');

      const binaryFile = result.changedFiles.find((f) => f.path === 'image.png');
      expect(binaryFile?.isBinary).toBe(true);

      const convertedFile = result.changedFiles.find((f) => f.path === 'convert.dat');
      expect(convertedFile?.isBinary).toBe(true); // 新しいバージョンがバイナリなので
    });
  });

  describe('実用的なシナリオテスト', () => {
    it('should handle typical C++ project structure', async () => {
      const executionId1 = 'cpp-project-old';
      const executionId2 = 'cpp-project-new';

      // 典型的なC++プロジェクト構造
      const cppFiles = [
        {
          path: 'main.cpp',
          oldContent: '#include "header.h"\nint main() { return 0; }',
          newContent: '#include "header.h"\nint main() {\n  std::cout << "Hello";\n  return 0;\n}',
        },
        {
          path: 'src/utils.cpp',
          oldContent: '#include "utils.h"\nvoid func() {}',
          newContent: '#include "utils.h"\nvoid func() {\n  // Implementation\n}',
        },
        {
          path: 'include/header.h',
          oldContent: '#ifndef HEADER_H\n#define HEADER_H\n#endif',
          newContent: '#ifndef HEADER_H\n#define HEADER_H\nvoid newFunc();\n#endif',
        },
        {
          path: 'CMakeLists.txt',
          oldContent: 'cmake_minimum_required(VERSION 3.10)',
          newContent: 'cmake_minimum_required(VERSION 3.15)\nproject(MyApp)',
        },
        {
          path: 'README.md',
          oldContent: '# Project',
          newContent: '# My C++ Project\n\nDescription here.',
        },
      ];

      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-old');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-new');

      // Create nested directories for the project structure
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-old/src');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-old/include');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-new/src');
      mockFileSystem.addDirectory('/mock/pahcer-studio/data/file_history/cpp-project-new/include');

      cppFiles.forEach(({ path, oldContent, newContent }) => {
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/cpp-project-old/${path}`,
          oldContent,
          {
            size: oldContent.length,
          },
        );
        mockFileSystem.addFile(
          `/mock/pahcer-studio/data/file_history/cpp-project-new/${path}`,
          newContent,
          {
            size: newContent.length,
          },
        );
      });

      const result = await fileDiffService.getDiff(executionId1, executionId2);

      expect(result.changedFiles).toHaveLength(cppFiles.length);
      expect(result.stats.modifiedFiles).toBe(cppFiles.length);
      expect(result.stats.totalFiles).toBe(cppFiles.length);

      // 言語検出のチェック
      const cppFile = result.changedFiles.find((f) => f.path === 'main.cpp');
      expect(cppFile?.language).toBe('cpp');

      const headerFile = result.changedFiles.find((f) => f.path === 'include/header.h');
      expect(headerFile?.language).toBe('cpp');

      const cmakeFile = result.changedFiles.find((f) => f.path === 'CMakeLists.txt');
      expect(cmakeFile?.language).toBe('plaintext');

      const markdownFile = result.changedFiles.find((f) => f.path === 'README.md');
      expect(markdownFile?.language).toBe('markdown');
    });

    it('should handle git-like workflow simulation', async () => {
      const branchOld = 'feature-branch-old';
      const branchNew = 'feature-branch-new';

      // Gitブランチのような変更パターン
      mockFileSystem.addDirectory(`/mock/pahcer-studio/data/file_history/${branchOld}`);
      mockFileSystem.addDirectory(`/mock/pahcer-studio/data/file_history/${branchNew}`);

      // 既存ファイルの修正
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/${branchOld}/existing.js`,
        'function old() { return 42; }',
        { size: 30 },
      );
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/${branchNew}/existing.js`,
        'function improved() {\n  return 42 * 2;\n}',
        { size: 35 },
      );

      // 新機能の追加
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/${branchNew}/feature.js`,
        'export function newFeature() {\n  return "awesome";\n}',
        { size: 45 },
      );

      // 不要ファイルの削除
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/${branchOld}/deprecated.js`,
        'console.log("old code");',
        { size: 25 },
      );

      // テストファイルの追加
      mockFileSystem.addFile(
        `/mock/pahcer-studio/data/file_history/${branchNew}/test.spec.js`,
        'describe("tests", () => {\n  it("should work", () => {});\n});',
        { size: 55 },
      );

      const result = await fileDiffService.getDiff(branchOld, branchNew);

      expect(result.changedFiles).toHaveLength(4);
      expect(result.stats.modifiedFiles).toBe(1);
      expect(result.stats.addedFiles).toBe(2);
      expect(result.stats.deletedFiles).toBe(1);

      // 各変更タイプの確認
      const modifiedFile = result.changedFiles.find((f) => f.changeType === 'modified');
      expect(modifiedFile?.path).toBe('existing.js');
      expect(modifiedFile?.language).toBe('javascript');

      const addedFiles = result.changedFiles.filter((f) => f.changeType === 'added');
      expect(addedFiles).toHaveLength(2);
      expect(addedFiles.map((f) => f.path).sort()).toEqual(['feature.js', 'test.spec.js']);

      const deletedFile = result.changedFiles.find((f) => f.changeType === 'deleted');
      expect(deletedFile?.path).toBe('deprecated.js');
    });
  });
});
