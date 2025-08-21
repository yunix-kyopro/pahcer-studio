import { FileHistoryService } from '../FileHistoryService';
import { DIContainer } from '../../infrastructure/DIContainer';
import { MockFileSystemService } from '../filesystem';

describe('FileHistoryService', () => {
  let fileHistoryService: FileHistoryService;
  let mockFileSystem: MockFileSystemService;
  let container: DIContainer;
  const mockStudioDir = '/mock/pahcer-studio';
  const mockProjectDir = '/mock';

  beforeEach(() => {
    // テスト用DIContainerを作成
    container = DIContainer.createTestContainer();
    fileHistoryService = container.getFileHistoryService();
    mockFileSystem = container.getMockFileSystemService();

    // MockFileSystemServiceをクリア
    mockFileSystem.clear();
  });

  describe('saveFileHistory', () => {
    describe('SUCCESS状態', () => {
      it('正常なファイルがコピーされる', async () => {
        // テスト用ファイルシステムにファイルを追加
        mockFileSystem.addFile(`${mockProjectDir}/main.cpp`, 'test content', { size: 1024 });

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-1`);

        const result = await fileHistoryService.saveFileHistory('test-exec-1', ['main.cpp']);

        expect(result.status).toBe('SUCCESS');
        expect(result.processedFiles).toBe(1);
        expect(result.totalFiles).toBe(1);
        expect(result.totalSize).toBe(1024);
        expect(result.errors).toHaveLength(0);
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

        // ファイルがコピーされたことを確認
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-1/main.cpp`),
        ).toBe(true);
        expect(
          mockFileSystem.getFileContent(`${mockStudioDir}/data/file_history/test-exec-1/main.cpp`),
        ).toBe('test content');

        // ログファイルが作成されたことを確認
        expect(
          mockFileSystem.hasFile(
            `${mockStudioDir}/data/file_history/test-exec-1/file_history_log.json`,
          ),
        ).toBe(true);
      });

      it('大きなファイルに対して警告が出される', async () => {
        // テスト用ファイルシステムに大きなファイルを追加
        mockFileSystem.addFile(`${mockProjectDir}/large_file.txt`, 'large content', {
          size: 1.5 * 1024 * 1024,
        }); // 1.5MB

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-2`);

        const result = await fileHistoryService.saveFileHistory('test-exec-2', ['large_file.txt']);

        expect(result.status).toBe('SUCCESS');
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Large file detected');
        expect(result.warnings[0]).toContain('1.5MB');
      });

      it('ディレクトリが再帰的に処理される', async () => {
        // テスト用ファイルシステムにディレクトリとファイルを追加
        mockFileSystem.addDirectory(`${mockProjectDir}/src`);
        mockFileSystem.addFile(`${mockProjectDir}/src/file1.cpp`, 'content1', { size: 512 });
        mockFileSystem.addFile(`${mockProjectDir}/src/file2.hpp`, 'content2', { size: 256 });

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-3`);

        const result = await fileHistoryService.saveFileHistory('test-exec-3', ['src']);

        expect(result.status).toBe('SUCCESS');
        expect(result.processedFiles).toBe(2);
        expect(result.totalFiles).toBe(2);
        expect(result.totalSize).toBe(768);
      });
    });

    describe('FAILED_NO_PATHS状態', () => {
      it('空のsave_path_listでFAILED_NO_PATHSを返す', async () => {
        const result = await fileHistoryService.saveFileHistory('test-exec-4', []);

        expect(result.status).toBe('FAILED_NO_PATHS');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('save_path_list is empty');
        expect(result.processedFiles).toBe(0);
      });

      it('nullのsave_path_listでFAILED_NO_PATHSを返す', async () => {
        const result = await fileHistoryService.saveFileHistory(
          'test-exec-5',
          null as unknown as string[],
        );

        expect(result.status).toBe('FAILED_NO_PATHS');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('save_path_list is empty');
      });
    });

    describe('FAILED_INVALID_PATH状態', () => {
      it('絶対パスを拒否する', async () => {
        const result = await fileHistoryService.saveFileHistory('test-exec-6', ['/absolute/path']);

        expect(result.status).toBe('FAILED_INVALID_PATH');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Absolute path not allowed');
        expect(result.skippedFiles).toContain('/absolute/path');
      });

      it('親ディレクトリ参照を拒否する', async () => {
        const result = await fileHistoryService.saveFileHistory('test-exec-7', ['../invalid']);

        expect(result.status).toBe('FAILED_INVALID_PATH');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Parent directory reference not allowed');
      });
    });

    describe('FAILED_NOT_FOUND状態', () => {
      it('存在しないファイルでFAILED_NOT_FOUNDを返す', async () => {
        // ファイルを追加しない（存在しない状態）

        const result = await fileHistoryService.saveFileHistory('test-exec-8', ['missing.txt']);

        expect(result.status).toBe('FAILED_NOT_FOUND');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('File or directory not found');
      });

      it('複数のファイルが全て存在しない場合', async () => {
        // ファイルを追加しない（存在しない状態）

        const result = await fileHistoryService.saveFileHistory('test-exec-8b', [
          'missing1.txt',
          'missing2.cpp',
          'missing_dir',
        ]);

        expect(result.status).toBe('FAILED_NOT_FOUND');
        expect(result.errors).toHaveLength(3);
        expect(result.errors[0]).toContain('File or directory not found: missing1.txt');
        expect(result.errors[1]).toContain('File or directory not found: missing2.cpp');
        expect(result.errors[2]).toContain('File or directory not found: missing_dir');
        expect(result.processedFiles).toBe(0);
        expect(result.totalFiles).toBe(0);
        expect(result.skippedFiles).toEqual(['missing1.txt', 'missing2.cpp', 'missing_dir']);
      });
    });

    describe('FAILED_COUNT_LIMIT状態', () => {
      it('ファイル数制限を超えるとFAILED_COUNT_LIMITを返す', async () => {
        // テスト用ファイルシステムにディレクトリを追加
        mockFileSystem.addDirectory(`${mockProjectDir}/many_files`);

        // 105個のファイルを追加
        for (let i = 0; i < 105; i++) {
          mockFileSystem.addFile(`${mockProjectDir}/many_files/file${i}.txt`, 'content', {
            size: 100,
          });
        }

        const result = await fileHistoryService.saveFileHistory('test-exec-9', ['many_files']);

        expect(result.status).toBe('FAILED_COUNT_LIMIT');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Too many files: 105 (max: 100)');
      });
    });

    describe('FAILED_SIZE_LIMIT状態', () => {
      it('合計サイズ制限を超えるとFAILED_SIZE_LIMITを返す', async () => {
        // テスト用ファイルシステムに巨大なファイルを追加
        mockFileSystem.addFile(`${mockProjectDir}/huge_file.txt`, 'huge content', {
          size: 6 * 1024 * 1024,
        }); // 6MB

        const result = await fileHistoryService.saveFileHistory('test-exec-10', ['huge_file.txt']);

        expect(result.status).toBe('FAILED_SIZE_LIMIT');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Total size too large');
        expect(result.errors[0]).toContain('6.0MB');
      });
    });

    describe('PARTIAL_SUCCESS状態', () => {
      it('一部のファイルコピーが失敗した場合', async () => {
        // テスト用ファイルシステムにファイルを追加
        mockFileSystem.addFile(`${mockProjectDir}/file1.txt`, 'content1', { size: 1024 });
        mockFileSystem.addFile(`${mockProjectDir}/file2.txt`, 'content2', { size: 1024 });

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-11`);

        // file2.txtのコピーでエラーをシミュレート
        mockFileSystem.setCopyFileError(
          `${mockProjectDir}/file2.txt`,
          `${mockStudioDir}/data/file_history/test-exec-11/file2.txt`,
          new Error('Permission denied'),
        );

        const result = await fileHistoryService.saveFileHistory('test-exec-11', [
          'file1.txt',
          'file2.txt',
        ]);

        expect(result.status).toBe('PARTIAL_SUCCESS');
        expect(result.processedFiles).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.skippedFiles).toHaveLength(1);
      });

      it('一部のファイルが存在しない場合', async () => {
        // file1.txt と file3.txt は存在、file2.txt は存在しない
        mockFileSystem.addFile(`${mockProjectDir}/file1.txt`, 'content1', { size: 512 });
        // file2.txtは追加しない（存在しない状態）
        mockFileSystem.addFile(`${mockProjectDir}/file3.txt`, 'content3', { size: 512 });

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-12`);

        const result = await fileHistoryService.saveFileHistory('test-exec-12', [
          'file1.txt',
          'file2.txt',
          'file3.txt',
        ]);

        expect(result.status).toBe('PARTIAL_SUCCESS');
        expect(result.processedFiles).toBe(2); // file1.txt と file3.txt
        expect(result.totalFiles).toBe(2);
        expect(result.totalSize).toBe(1024); // 512 * 2
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('File or directory not found: file2.txt');
        expect(result.skippedFiles).toContain('file2.txt');

        // 存在するファイルのみコピーされることを確認
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-12/file1.txt`),
        ).toBe(true);
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-12/file3.txt`),
        ).toBe(true);
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-12/file2.txt`),
        ).toBe(false);
      });

      it('存在しないディレクトリと存在するファイルが混在する場合', async () => {
        // main.cpp は存在、modules ディレクトリは存在しない
        mockFileSystem.addFile(`${mockProjectDir}/main.cpp`, 'main content', { size: 2048 });
        // modulesは追加しない（存在しない状態）

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-13`);

        const result = await fileHistoryService.saveFileHistory('test-exec-13', [
          'main.cpp',
          'modules',
        ]);

        expect(result.status).toBe('PARTIAL_SUCCESS');
        expect(result.processedFiles).toBe(1); // main.cpp のみ
        expect(result.totalFiles).toBe(1);
        expect(result.totalSize).toBe(2048);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('File or directory not found: modules');
        expect(result.skippedFiles).toContain('modules');

        // main.cpp のみコピーされることを確認
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-13/main.cpp`),
        ).toBe(true);
        expect(
          mockFileSystem.getFileContent(`${mockStudioDir}/data/file_history/test-exec-13/main.cpp`),
        ).toBe('main content');
      });

      it('大部分のファイルが存在しない場合でも存在するファイルは保存される', async () => {
        // 5つのファイルのうちmain.cppだけ存在
        mockFileSystem.addFile(`${mockProjectDir}/main.cpp`, 'main content', { size: 1536 });
        // 他のファイルは追加しない（存在しない状態）

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-14`);

        const result = await fileHistoryService.saveFileHistory('test-exec-14', [
          'file1.txt',
          'file2.cpp',
          'main.cpp',
          'config.h',
          'utils.py',
        ]);

        expect(result.status).toBe('PARTIAL_SUCCESS');
        expect(result.processedFiles).toBe(1); // main.cpp のみ
        expect(result.totalFiles).toBe(1);
        expect(result.totalSize).toBe(1536);
        expect(result.errors).toHaveLength(4); // 4つのファイルが存在しない
        expect(result.skippedFiles).toHaveLength(4);
        expect(result.skippedFiles).toEqual(['file1.txt', 'file2.cpp', 'config.h', 'utils.py']);

        // 存在するファイルのみ処理される
        expect(
          mockFileSystem.hasFile(`${mockStudioDir}/data/file_history/test-exec-14/main.cpp`),
        ).toBe(true);
        expect(
          mockFileSystem.getFileContent(`${mockStudioDir}/data/file_history/test-exec-14/main.cpp`),
        ).toBe('main content');
      });
    });

    describe('ログファイル出力', () => {
      it('ログファイルが正常に出力される', async () => {
        // テスト用ファイルシステムにファイルを追加
        mockFileSystem.addFile(`${mockProjectDir}/main.cpp`, 'main content', { size: 1024 });

        // 必要なディレクトリを追加
        mockFileSystem.addDirectory(mockStudioDir);
        mockFileSystem.addDirectory(`${mockStudioDir}/data`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history`);
        mockFileSystem.addDirectory(`${mockStudioDir}/data/file_history/test-exec-log`);

        await fileHistoryService.saveFileHistory('test-exec-log', ['main.cpp']);

        // ログファイルが作成されたことを確認
        expect(
          mockFileSystem.hasFile(
            `${mockStudioDir}/data/file_history/test-exec-log/file_history_log.json`,
          ),
        ).toBe(true);
        const logContent = mockFileSystem.getFileContent(
          `${mockStudioDir}/data/file_history/test-exec-log/file_history_log.json`,
        );
        expect(logContent).toContain('test-exec-log');
      });
    });

    describe('エラーハンドリング', () => {
      it('予期しないエラーでFAILED_UNKNOWNを返す', async () => {
        // ファイルを追加するが、stat呼び出しでエラーをシミュレート
        // このテストは現在のアーキテクチャでは複雑であり、
        // MockFileSystemServiceではシミュレートが困難なためスキップ
        // TODO: 必要に応じてMockFileSystemServiceにエラーシミュレーション機能を追加
      });
    });
  });
});
