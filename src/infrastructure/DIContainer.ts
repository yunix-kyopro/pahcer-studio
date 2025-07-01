import type { IExecutionRepository } from '../repositories/IExecutionRepository';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { ProcessManager } from './ProcessManager';

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
    // ProcessManagerの設定
    const processManager = new ProcessManager();
    this.dependencies.set('ProcessManager', processManager);

    // ExecutionRepositoryの設定
    const executionRepository = new ExecutionRepository();
    this.dependencies.set('IExecutionRepository', executionRepository);
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
  public getExecutionRepository(): IExecutionRepository {
    return this.get<IExecutionRepository>('IExecutionRepository');
  }

  public getProcessManager(): ProcessManager {
    return this.get<ProcessManager>('ProcessManager');
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
}
