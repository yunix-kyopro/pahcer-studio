// 基本スキーマ
export * from './base';

// 機能別スキーマ
export * from './filesystem';
export * from './execution';
// export * from "./network"; // 将来追加
// export * from "./system"; // 将来追加

// バリデーション関数
export * from './validators';

// IPCチャンネルの統合型定義
import type {
  LSDirectoryRequest,
  LSDirectoryResponse,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
} from './filesystem';
import type { TestExecutionRequest, TestExecution } from './execution';

export interface IPCChannels {
  // ファイルシステム関連
  'ls-directory': {
    request: LSDirectoryRequest;
    response: LSDirectoryResponse;
  };
  'read-file': {
    request: ReadFileRequest;
    response: ReadFileResponse;
  };
  'write-file': {
    request: WriteFileRequest;
    response: WriteFileResponse;
  };

  // テスト実行関連
  'execution:start': {
    request: TestExecutionRequest;
    response: { id: string };
  };
  'execution:stop': {
    request: { executionId: string };
    response: { success: boolean };
  };
  'execution:status': {
    request: { executionId: string };
    response: TestExecution | null;
  };
  'execution:list': {
    request: void;
    response: TestExecution[];
  };

  // 将来のチャンネル
  // "get-system-info": { ... };
  // "network-request": { ... };
}

// チャンネル名のユニオン型
export type IPCChannelName = keyof IPCChannels;

// 型安全なヘルパー型
export type IPCRequest<T extends IPCChannelName> = IPCChannels[T]['request'];
export type IPCResponse<T extends IPCChannelName> = IPCChannels[T]['response'];
