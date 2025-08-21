export interface FileStats {
  isDirectory(): boolean;
  size: number;
}

export interface FileDirent {
  name: string;
  isDirectory(): boolean;
}

/**
 * ファイルシステム操作の抽象化インターフェース
 * 本番実装とテスト実装を統一するためのインターフェース
 */
export interface IFileSystemService {
  /**
   * ファイル・ディレクトリの存在確認
   * @param path ファイルパス
   * @throws 存在しない場合はENOENTエラー
   */
  access(path: string): Promise<void>;

  /**
   * ファイル読み取り
   * @param path ファイルパス
   * @param encoding エンコーディング
   * @returns ファイル内容
   */
  readFile(path: string, encoding: string): Promise<string>;

  /**
   * ファイル書き込み
   * @param path ファイルパス
   * @param data データ
   * @param encoding エンコーディング
   */
  writeFile(path: string, data: string, encoding: string): Promise<void>;

  /**
   * ディレクトリ作成
   * @param path ディレクトリパス
   * @param options 作成オプション
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * ファイルコピー
   * @param src コピー元
   * @param dest コピー先
   */
  copyFile(src: string, dest: string): Promise<void>;

  /**
   * ファイル・ディレクトリ情報取得
   * @param path パス
   * @returns ファイル情報
   */
  stat(path: string): Promise<FileStats>;

  /**
   * ディレクトリ内容読み取り
   * @param path ディレクトリパス
   * @returns ディレクトリエントリ配列
   */
  readdir(path: string): Promise<FileDirent[]>;
}
