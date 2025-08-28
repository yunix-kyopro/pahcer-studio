import { FileDataService, ExecutionMetadata, VersionData } from '../FileDataService';
import { DIContainer } from '../../infrastructure/DIContainer';
import { MockFileSystemService } from '../filesystem';

describe('FileDataService', () => {
  let service: FileDataService;
  let mockFileSystem: MockFileSystemService;
  let container: DIContainer;

  beforeEach(() => {
    // テスト用DIContainerを作成
    container = DIContainer.createTestContainer();
    service = container.getFileDataService();
    mockFileSystem = container.getMockFileSystemService();

    // MockFileSystemServiceをクリア
    mockFileSystem.clear();
  });

  describe('getCurrentFileData', () => {
    it('should get current project file data using ConfigService', async () => {
      // Arrange - MockFileSystemにファイルを設定
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["src/main.cpp", "README.md"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // プロジェクトファイルを追加
      mockFileSystem.addFile('/mock/src/main.cpp', '// main.cpp content', { size: 100 });
      mockFileSystem.addFile('/mock/README.md', '# README content', { size: 50 });

      // Act
      const result = await service.getCurrentFileData();

      // Assert
      expect(result.execution.id).toBe('current');
      expect(result.execution.dataPath).toBe('/mock');
      expect(result.files.size).toBe(2);
      expect(result.files.get('src/main.cpp')).toEqual({
        path: 'src/main.cpp',
        content: '// main.cpp content',
        exists: true,
      });
      expect(result.files.get('README.md')).toEqual({
        path: 'README.md',
        content: '# README content',
        exists: true,
      });
    });

    it('should handle reading file errors gracefully', async () => {
      // Arrange - 設定には存在するが読み込めないファイル
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["readable.txt"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // ファイルは存在するが、readFileで異常を起こすファイルを作成
      mockFileSystem.addFile('/mock/readable.txt', 'content', { size: 100 });

      // readFileを明示的にエラーにする（実際のファイルアクセスエラーをシミュレート）
      const originalReadFile = mockFileSystem.readFile;
      mockFileSystem.readFile = jest.fn().mockImplementation(async (path: string) => {
        if (path === '/mock/readable.txt') {
          throw new Error('Permission denied');
        }
        return originalReadFile.call(mockFileSystem, path, 'utf-8');
      });

      // Act
      const result = await service.getCurrentFileData();

      // Assert - エラーが発生したファイルは exists: false として扱われる
      expect(result.files.get('readable.txt')).toEqual({
        path: 'readable.txt',
        content: '',
        exists: false,
      });
    });

    it('should exclude directories from processing', async () => {
      // Arrange - ディレクトリを含む設定
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["src"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // ディレクトリとファイルを追加
      mockFileSystem.addDirectory('/mock/src');
      mockFileSystem.addFile('/mock/src/main.cpp', '// content', { size: 100 });

      // Act
      const result = await service.getCurrentFileData();

      // Assert - ディレクトリは除外され、ファイルのみ処理される
      expect(result.files.size).toBe(1);
      expect(result.files.has('src/')).toBe(false);
      expect(result.files.has('src/main.cpp')).toBe(true);
    });
  });

  describe('getExecutionFileData', () => {
    it('should get execution file data from directory', async () => {
      // Arrange
      const executionId = 'exec123';
      const executionPath = '/mock/pahcer-studio/data/file_history/exec123';

      // 実行ディレクトリとファイルを追加
      mockFileSystem.addDirectory(executionPath);
      mockFileSystem.addFile(`${executionPath}/main.cpp`, '// saved content', { size: 100 });
      mockFileSystem.addFile(`${executionPath}/file_history_log.json`, '{}', { size: 10 }); // ログファイル

      // Act
      const result = await service.getExecutionFileData(executionId);

      // Assert
      expect(result.execution.id).toBe(executionId);
      expect(result.execution.dataPath).toBe(executionPath);
      expect(result.files.size).toBe(1); // log file excluded
      expect(result.files.has('main.cpp')).toBe(true);
      expect(result.files.has('file_history_log.json')).toBe(false); // excluded
      expect(result.files.get('main.cpp')).toEqual({
        path: 'main.cpp',
        content: '// saved content',
        exists: true,
      });
    });

    it('should throw error if execution directory not found', async () => {
      // Arrange
      const executionId = 'nonexistent';
      // ディレクトリを追加しない

      // Act & Assert
      await expect(service.getExecutionFileData(executionId)).rejects.toThrow(
        'Execution nonexistent not found',
      );
    });

    it('should throw error if execution path is not a directory', async () => {
      // Arrange
      const executionId = 'notdir';
      const executionPath = '/mock/pahcer-studio/data/file_history/notdir';

      // ファイルとして追加（ディレクトリではない）
      mockFileSystem.addFile(executionPath, 'content', { size: 10 });

      // Act & Assert
      await expect(service.getExecutionFileData(executionId)).rejects.toThrow(
        'Execution notdir is not a directory',
      );
    });

    it('should exclude log files from processing', async () => {
      // Arrange
      const executionId = 'exec123';
      const executionPath = '/mock/pahcer-studio/data/file_history/exec123';

      // 実行ディレクトリとファイルを追加（ログファイルも含む）
      mockFileSystem.addDirectory(executionPath);
      mockFileSystem.addFile(`${executionPath}/main.cpp`, 'content', { size: 100 });
      mockFileSystem.addFile(`${executionPath}/execution.log`, 'log', { size: 10 });
      mockFileSystem.addFile(`${executionPath}/file_history_log.json`, '{}', { size: 10 });
      mockFileSystem.addFile(`${executionPath}/execution_log.json`, '{}', { size: 10 });

      // Act
      const result = await service.getExecutionFileData(executionId);

      // Assert - ログファイルは除外される
      expect(result.files.size).toBe(1);
      expect(result.files.has('main.cpp')).toBe(true);
      expect(result.files.has('execution.log')).toBe(false);
      expect(result.files.has('file_history_log.json')).toBe(false);
      expect(result.files.has('execution_log.json')).toBe(false);
    });

    describe('timestamp retrieval from file_history_log.json', () => {
      it('should use timestamp from file_history_log.json when available', async () => {
        // Arrange
        const executionId = 'exec123';
        const executionPath = '/mock/pahcer-studio/data/file_history/exec123';
        const expectedTimestamp = '2025-08-18T14:09:10.229Z';

        const logContent = JSON.stringify({
          timestamp: expectedTimestamp,
          executionId: executionId,
          savePathList: ['main.cpp'],
          result: {
            status: 'SUCCESS',
            totalFiles: 1,
            totalSize: 1000,
            processedFiles: 1,
            skippedFiles: [],
            warnings: [],
            errors: [],
            executionTimeMs: 50,
          },
        });

        // 実行ディレクトリとファイルを追加
        mockFileSystem.addDirectory(executionPath);
        mockFileSystem.addFile(`${executionPath}/main.cpp`, '// main content', { size: 100 });
        mockFileSystem.addFile(`${executionPath}/file_history_log.json`, logContent, {
          size: logContent.length,
        });

        // Act
        const result = await service.getExecutionFileData(executionId);

        // Assert
        expect(result.execution.id).toBe(executionId);
        expect(result.execution.timestamp).toBe(expectedTimestamp);
        expect(result.execution.dataPath).toBe(executionPath);
        expect(result.files.size).toBe(1);
      });

      it('should fallback to current time when file_history_log.json is missing', async () => {
        // Arrange
        const executionId = 'exec123';
        const executionPath = '/mock/pahcer-studio/data/file_history/exec123';

        // 実行ディレクトリとファイルを追加（ログファイルは除外）
        mockFileSystem.addDirectory(executionPath);
        mockFileSystem.addFile(`${executionPath}/main.cpp`, '// main content', { size: 100 });
        // file_history_log.json は追加しない

        const beforeTime = new Date();

        // Act
        const result = await service.getExecutionFileData(executionId);

        const afterTime = new Date();
        const resultTime = new Date(result.execution.timestamp);

        // Assert - 現在時刻でフォールバック
        expect(result.execution.id).toBe(executionId);
        expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        expect(result.files.size).toBe(1);
      });

      it('should fallback to current time when file_history_log.json has invalid JSON', async () => {
        // Arrange
        const executionId = 'exec123';
        const executionPath = '/mock/pahcer-studio/data/file_history/exec123';
        const invalidJsonContent = '{ invalid json content';

        // 実行ディレクトリとファイルを追加
        mockFileSystem.addDirectory(executionPath);
        mockFileSystem.addFile(`${executionPath}/main.cpp`, '// main content', { size: 100 });
        mockFileSystem.addFile(`${executionPath}/file_history_log.json`, invalidJsonContent, {
          size: invalidJsonContent.length,
        });

        const beforeTime = new Date();

        // Act
        const result = await service.getExecutionFileData(executionId);

        const afterTime = new Date();
        const resultTime = new Date(result.execution.timestamp);

        // Assert - 現在時刻でフォールバック
        expect(result.execution.id).toBe(executionId);
        expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        expect(result.files.size).toBe(1);
      });

      it('should fallback to current time when file_history_log.json lacks timestamp field', async () => {
        // Arrange
        const executionId = 'exec123';
        const executionPath = '/mock/pahcer-studio/data/file_history/exec123';

        const logContentWithoutTimestamp = JSON.stringify({
          executionId: executionId,
          savePathList: ['main.cpp'],
          result: {
            status: 'SUCCESS',
          },
          // timestamp フィールドなし
        });

        // 実行ディレクトリとファイルを追加
        mockFileSystem.addDirectory(executionPath);
        mockFileSystem.addFile(`${executionPath}/main.cpp`, '// main content', { size: 100 });
        mockFileSystem.addFile(
          `${executionPath}/file_history_log.json`,
          logContentWithoutTimestamp,
          { size: logContentWithoutTimestamp.length },
        );

        const beforeTime = new Date();

        // Act
        const result = await service.getExecutionFileData(executionId);

        const afterTime = new Date();
        const resultTime = new Date(result.execution.timestamp);

        // Assert - 現在時刻でフォールバック
        expect(result.execution.id).toBe(executionId);
        expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        expect(result.files.size).toBe(1);
      });

      it('should fallback to current time when file_history_log.json cannot be read', async () => {
        // Arrange
        const executionId = 'exec123';
        const executionPath = '/mock/pahcer-studio/data/file_history/exec123';

        // 実行ディレクトリとファイルを追加
        mockFileSystem.addDirectory(executionPath);
        mockFileSystem.addFile(`${executionPath}/main.cpp`, '// main content', { size: 100 });
        mockFileSystem.addFile(`${executionPath}/file_history_log.json`, '{}', { size: 10 });

        // readFileを特定のファイルでエラーにする
        const originalReadFile = mockFileSystem.readFile;
        mockFileSystem.readFile = jest
          .fn()
          .mockImplementation(async (path: string, encoding?: string) => {
            if (path.endsWith('file_history_log.json')) {
              throw new Error('Permission denied');
            }
            return originalReadFile.call(mockFileSystem, path, encoding || 'utf-8');
          });

        const beforeTime = new Date();

        // Act
        const result = await service.getExecutionFileData(executionId);

        const afterTime = new Date();
        const resultTime = new Date(result.execution.timestamp);

        // Assert - 現在時刻でフォールバック
        expect(result.execution.id).toBe(executionId);
        expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        expect(result.files.size).toBe(1);
      });
    });
  });

  describe('determineOlderNewer', () => {
    it('should determine older and newer executions correctly', () => {
      // Arrange
      const older: ExecutionMetadata = {
        id: 'exec1',
        timestamp: '2024-01-01T10:00:00Z',
        dataPath: '/path1',
      };
      const newer: ExecutionMetadata = {
        id: 'exec2',
        timestamp: '2024-01-01T11:00:00Z',
        dataPath: '/path2',
      };

      // Act
      const result1 = service.determineOlderNewer(older, newer);
      const result2 = service.determineOlderNewer(newer, older);

      // Assert
      expect(result1.older).toEqual(older);
      expect(result1.newer).toEqual(newer);
      expect(result2.older).toEqual(older);
      expect(result2.newer).toEqual(newer);
    });

    it('should handle equal timestamps correctly', () => {
      // Arrange
      const exec1: ExecutionMetadata = {
        id: 'exec1',
        timestamp: '2024-01-01T10:00:00Z',
        dataPath: '/path1',
      };
      const exec2: ExecutionMetadata = {
        id: 'exec2',
        timestamp: '2024-01-01T10:00:00Z',
        dataPath: '/path2',
      };

      // Act
      const result = service.determineOlderNewer(exec1, exec2);

      // Assert
      expect(result.older).toEqual(exec1);
      expect(result.newer).toEqual(exec2);
    });
  });

  describe('getAllFilePaths', () => {
    it('should combine all file paths from two versions', () => {
      // Arrange
      const version1: VersionData = {
        execution: { id: 'v1', timestamp: '2024-01-01T10:00:00Z', dataPath: '/v1' },
        files: new Map([
          ['file1.txt', { path: 'file1.txt', content: 'content1', exists: true }],
          ['file2.txt', { path: 'file2.txt', content: 'content2', exists: true }],
        ]),
      };

      const version2: VersionData = {
        execution: { id: 'v2', timestamp: '2024-01-01T11:00:00Z', dataPath: '/v2' },
        files: new Map([
          ['file2.txt', { path: 'file2.txt', content: 'content2-new', exists: true }],
          ['file3.txt', { path: 'file3.txt', content: 'content3', exists: true }],
        ]),
      };

      // Act
      const result = service.getAllFilePaths(version1, version2);

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
    });

    it('should return empty array for empty versions', () => {
      // Arrange
      const version1: VersionData = {
        execution: { id: 'v1', timestamp: '2024-01-01T10:00:00Z', dataPath: '/v1' },
        files: new Map(),
      };

      const version2: VersionData = {
        execution: { id: 'v2', timestamp: '2024-01-01T11:00:00Z', dataPath: '/v2' },
        files: new Map(),
      };

      // Act
      const result = service.getAllFilePaths(version1, version2);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
