import type { IExecutionRepository } from '../repositories/IExecutionRepository';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { ProcessManager } from './ProcessManager';
import type { IFileSystemService } from '../services/filesystem/IFileSystemService';
import { FileSystemService, MockFileSystemService } from '../services/filesystem';
import { ConfigService } from '../services/ConfigService';
import { ScoreAnalysisService } from '../services/ScoreAnalysisService';
import { AnalysisService } from '../services/AnalysisService';
import { ExecutionService } from '../services/ExecutionService';

/**
 * 依存性注入コンテナ
 */
export class DIContainer {
  private static instance: DIContainer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dependencies: Map<string, any> = new Map();

  private constructor() {
    this.setupDependencies();
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  private setupDependencies(): void {
    // FileSystemServiceの設定
    const fileSystemService = new FileSystemService();
    this.dependencies.set('IFileSystemService', fileSystemService);

    // ConfigServiceの設定
    const configService = new ConfigService(fileSystemService);
    this.dependencies.set('ConfigService', configService);

    // ScoreAnalysisServiceの設定
    const scoreAnalysisService = new ScoreAnalysisService(configService, fileSystemService);
    this.dependencies.set('ScoreAnalysisService', scoreAnalysisService);

    // AnalysisServiceの設定
    const analysisService = new AnalysisService(configService);
    this.dependencies.set('AnalysisService', analysisService);

    // ProcessManagerの設定
    const processManager = new ProcessManager();
    this.dependencies.set('ProcessManager', processManager);

    // ExecutionRepositoryの設定
    const executionRepository = new ExecutionRepository(scoreAnalysisService, fileSystemService);
    this.dependencies.set('IExecutionRepository', executionRepository);

    // ExecutionServiceの設定
    const executionService = new ExecutionService(
      executionRepository,
      processManager,
      configService,
      scoreAnalysisService,
    );
    this.dependencies.set('ExecutionService', executionService);
  }

  public get<T>(key: string): T {
    const dependency = this.dependencies.get(key);
    if (!dependency) {
      throw new Error(`Dependency ${key} not found`);
    }
    return dependency;
  }

  public register<T>(key: string, instance: T): void {
    this.dependencies.set(key, instance);
  }

  // 便利メソッド
  public getFileSystemService(): IFileSystemService {
    return this.get<IFileSystemService>('IFileSystemService');
  }

  public getConfigService(): ConfigService {
    return this.get<ConfigService>('ConfigService');
  }

  public getScoreAnalysisService(): ScoreAnalysisService {
    return this.get<ScoreAnalysisService>('ScoreAnalysisService');
  }

  public getAnalysisService(): AnalysisService {
    return this.get<AnalysisService>('AnalysisService');
  }

  public getExecutionRepository(): IExecutionRepository {
    return this.get<IExecutionRepository>('IExecutionRepository');
  }

  public getProcessManager(): ProcessManager {
    return this.get<ProcessManager>('ProcessManager');
  }

  public getExecutionService(): ExecutionService {
    return this.get<ExecutionService>('ExecutionService');
  }

  // テスト用のモック注入
  public registerMock<T>(key: string, mockInstance: T): void {
    this.dependencies.set(key, mockInstance);
  }

  // コンテナのリセット（テスト用）
  public reset(): void {
    this.dependencies.clear();
    this.setupDependencies();
  }

  /**
   * テスト用のDIコンテナを作成
   * MockFileSystemServiceを使用したテスト環境を提供
   */
  public static createTestContainer(mockFileSystem?: MockFileSystemService): DIContainer {
    const container = new DIContainer();
    container.dependencies.clear();

    // MockFileSystemServiceを注入
    const fileSystem = mockFileSystem || new MockFileSystemService();
    container.dependencies.set('IFileSystemService', fileSystem);

    // ConfigServiceの設定
    const configService = new ConfigService(fileSystem);
    container.dependencies.set('ConfigService', configService);

    // ScoreAnalysisServiceの設定
    const scoreAnalysisService = new ScoreAnalysisService(configService, fileSystem);
    container.dependencies.set('ScoreAnalysisService', scoreAnalysisService);

    // AnalysisServiceの設定
    const analysisService = new AnalysisService(configService);
    container.dependencies.set('AnalysisService', analysisService);

    // ProcessManagerの設定
    const processManager = new ProcessManager();
    container.dependencies.set('ProcessManager', processManager);

    // ExecutionRepositoryの設定
    const executionRepository = new ExecutionRepository(scoreAnalysisService, fileSystem);
    container.dependencies.set('IExecutionRepository', executionRepository);

    // ExecutionServiceの設定
    const executionService = new ExecutionService(
      executionRepository,
      processManager,
      configService,
      scoreAnalysisService,
    );
    container.dependencies.set('ExecutionService', executionService);

    return container;
  }
}
