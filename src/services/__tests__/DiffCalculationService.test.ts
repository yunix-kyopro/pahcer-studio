import { DiffCalculationService } from '../DiffCalculationService';
import { VersionData, FileData } from '../FileDataService';

describe('DiffCalculationService', () => {
  let service: DiffCalculationService;

  beforeEach(() => {
    service = new DiffCalculationService();
  });

  // ヘルパー関数：VersionDataを作成
  const createVersionData = (
    id: string,
    timestamp: string,
    files: Record<string, { content: string; exists: boolean }>,
  ): VersionData => {
    const fileMap = new Map<string, FileData>();

    Object.entries(files).forEach(([path, { content, exists }]) => {
      fileMap.set(path, { path, content, exists });
    });

    return {
      execution: { id, timestamp, dataPath: `/mock/${id}` },
      files: fileMap,
    };
  };

  describe('calculateDiff', () => {
    it('should detect added files', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'existing.txt': { content: 'old content', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'existing.txt': { content: 'old content', exists: true },
        'new-file.txt': { content: 'new content', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(2);
      expect(result.changedFiles.find((f) => f.path === 'new-file.txt')?.changeType).toBe('added');
      expect(result.stats.addedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should detect deleted files', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'existing.txt': { content: 'content', exists: true },
        'deleted-file.txt': { content: 'to be deleted', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'existing.txt': { content: 'content', exists: true },
        'deleted-file.txt': { content: '', exists: false },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(2);
      expect(result.changedFiles.find((f) => f.path === 'deleted-file.txt')?.changeType).toBe(
        'deleted',
      );
      expect(result.stats.deletedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should detect modified files', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'modified.txt': { content: 'old content', exists: true },
        'unchanged.txt': { content: 'same content', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'modified.txt': { content: 'new content', exists: true },
        'unchanged.txt': { content: 'same content', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(2);
      expect(result.changedFiles.find((f) => f.path === 'modified.txt')?.changeType).toBe(
        'modified',
      );
      expect(result.changedFiles.find((f) => f.path === 'unchanged.txt')?.changeType).toBe(
        'unchanged',
      );
      expect(result.stats.modifiedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should handle complex diff scenario', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'unchanged.txt': { content: 'same', exists: true },
        'modified.txt': { content: 'old', exists: true },
        'deleted.txt': { content: 'will be deleted', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'unchanged.txt': { content: 'same', exists: true },
        'modified.txt': { content: 'new', exists: true },
        'deleted.txt': { content: '', exists: false },
        'added.txt': { content: 'newly added', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(4);
      expect(result.stats.addedFiles).toBe(1);
      expect(result.stats.deletedFiles).toBe(1);
      expect(result.stats.modifiedFiles).toBe(1);
      expect(result.stats.unchangedFiles).toBe(1);
      expect(result.stats.totalFiles).toBe(4);
    });

    it('should preserve file contents in diff result', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'test.txt': { content: 'old content', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'test.txt': { content: 'new content', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      const changedFile = result.changedFiles[0];
      expect(changedFile.oldContent).toBe('old content');
      expect(changedFile.newContent).toBe('new content');
    });

    it('should handle empty versions', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {});
      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {});

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(0);
      expect(result.stats.totalFiles).toBe(0);
    });

    it('should maintain execution metadata in result', () => {
      // Arrange
      const olderVersion = createVersionData('exec-123', '2024-01-01T10:00:00Z', {});
      const newerVersion = createVersionData('exec-456', '2024-01-01T11:00:00Z', {});

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.olderExecution.id).toBe('exec-123');
      expect(result.olderExecution.timestamp).toBe('2024-01-01T10:00:00Z');
      expect(result.newerExecution.id).toBe('exec-456');
      expect(result.newerExecution.timestamp).toBe('2024-01-01T11:00:00Z');
    });

    it('should sort file paths consistently', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'z-file.txt': { content: 'content', exists: true },
        'a-file.txt': { content: 'content', exists: true },
        'm-file.txt': { content: 'content', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'z-file.txt': { content: 'content', exists: true },
        'a-file.txt': { content: 'content', exists: true },
        'm-file.txt': { content: 'content', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      const filePaths = result.changedFiles.map((f) => f.path);
      expect(filePaths).toEqual(['a-file.txt', 'm-file.txt', 'z-file.txt']);
    });
  });

  describe('Monaco対応機能', () => {
    it('should include Monaco-compatible metadata for files', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'main.cpp': { content: '#include <iostream>', exists: true },
        'script.js': { content: 'console.log("hello");', exists: true },
        'config.json': { content: '{"key": "value"}', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'main.cpp': { content: '#include <iostream>\n// modified', exists: true },
        'script.js': { content: 'console.log("hello world");', exists: true },
        'config.json': { content: '{"key": "value"}', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      expect(result.changedFiles).toHaveLength(3);

      const cppFile = result.changedFiles.find((f) => f.path === 'main.cpp');
      expect(cppFile).toBeDefined();
      expect(cppFile?.fileExtension).toBe('.cpp');
      expect(cppFile?.language).toBe('cpp');
      expect(cppFile?.isBinary).toBe(false);

      const jsFile = result.changedFiles.find((f) => f.path === 'script.js');
      expect(jsFile).toBeDefined();
      expect(jsFile?.fileExtension).toBe('.js');
      expect(jsFile?.language).toBe('javascript');
      expect(jsFile?.isBinary).toBe(false);

      const jsonFile = result.changedFiles.find((f) => f.path === 'config.json');
      expect(jsonFile).toBeDefined();
      expect(jsonFile?.fileExtension).toBe('.json');
      expect(jsonFile?.language).toBe('json');
      expect(jsonFile?.isBinary).toBe(false);
    });

    it('should handle files without extension', () => {
      // Arrange
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        Makefile: { content: 'CC=gcc', exists: true },
        README: { content: '# Project', exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        Makefile: { content: 'CC=g++', exists: true },
        README: { content: '# Updated Project', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      result.changedFiles.forEach((file) => {
        expect(file.fileExtension).toBe('');
        expect(file.language).toBe('plaintext');
        expect(file.isBinary).toBe(false);
      });
    });

    it('should detect binary files', () => {
      // Arrange - バイナリっぽいコンテンツ（null文字を含む）
      const binaryContent = 'Some text\0binary data\0more binary';
      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'image.png': { content: binaryContent, exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'image.png': { content: binaryContent + 'modified', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      const pngFile = result.changedFiles[0];
      expect(pngFile.fileExtension).toBe('.png');
      expect(pngFile.language).toBe('plaintext');
      expect(pngFile.isBinary).toBe(true);
    });

    it('should handle various programming language extensions', () => {
      // Arrange
      const languageTests = [
        { file: 'test.cpp', expectedLang: 'cpp' },
        { file: 'test.c', expectedLang: 'c' },
        { file: 'test.h', expectedLang: 'cpp' },
        { file: 'test.py', expectedLang: 'python' },
        { file: 'test.java', expectedLang: 'java' },
        { file: 'test.ts', expectedLang: 'typescript' },
        { file: 'test.rs', expectedLang: 'rust' },
        { file: 'test.go', expectedLang: 'go' },
        { file: 'test.md', expectedLang: 'markdown' },
        { file: 'config.toml', expectedLang: 'toml' },
        { file: 'script.sh', expectedLang: 'shell' },
      ];

      const olderFiles: Record<string, { content: string; exists: boolean }> = {};
      const newerFiles: Record<string, { content: string; exists: boolean }> = {};

      languageTests.forEach(({ file }) => {
        olderFiles[file] = { content: 'old content', exists: true };
        newerFiles[file] = { content: 'new content', exists: true };
      });

      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', olderFiles);
      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', newerFiles);

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      languageTests.forEach(({ file, expectedLang }) => {
        const changedFile = result.changedFiles.find((f) => f.path === file);
        expect(changedFile?.language).toBe(expectedLang);
      });
    });

    it('should handle control characters in binary detection', () => {
      // Arrange - 制御文字が多いコンテンツ
      const controlCharsContent = '\x01\x02\x03\x04\x05\x06\x07\x08text\x0e\x0f\x10\x11';
      const normalContent = 'This is normal text content';

      const olderVersion = createVersionData('older', '2024-01-01T10:00:00Z', {
        'binary.dat': { content: controlCharsContent, exists: true },
        'text.txt': { content: normalContent, exists: true },
      });

      const newerVersion = createVersionData('newer', '2024-01-01T11:00:00Z', {
        'binary.dat': { content: controlCharsContent + 'more', exists: true },
        'text.txt': { content: normalContent + ' modified', exists: true },
      });

      // Act
      const result = service.calculateDiff(olderVersion, newerVersion);

      // Assert
      const binaryFile = result.changedFiles.find((f) => f.path === 'binary.dat');
      const textFile = result.changedFiles.find((f) => f.path === 'text.txt');

      expect(binaryFile?.isBinary).toBe(true);
      expect(textFile?.isBinary).toBe(false);
    });
  });
});
