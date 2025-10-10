/**
 * ファイルシステム操作の抽象化インターフェース
 *
 * このインターフェースにより、本番環境では実際のファイルシステムを使用し、
 * テスト環境ではモック実装を使用することができます。
 *
 * @remarks
 * - 本番環境: FileSystemServiceを使用
 * - テスト環境: MockFileSystemServiceを使用
 */
export interface IFileSystemService {
  /**
   * ファイルを読み込みます
   *
   * @param path - 読み込むファイルのパス
   * @param encoding - 文字エンコーディング（例: 'utf-8'）
   * @returns ファイルの内容
   * @throws ファイルが存在しない場合はENOENTエラー
   */
  readFile(path: string, encoding: BufferEncoding): Promise<string>;

  /**
   * ファイルに書き込みます
   *
   * @param path - 書き込むファイルのパス
   * @param data - 書き込むデータ
   * @param encoding - 文字エンコーディング（例: 'utf-8'）
   * @throws 親ディレクトリが存在しない場合はENOENTエラー
   */
  writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;

  /**
   * ファイルをコピーします
   *
   * @param src - コピー元のファイルパス
   * @param dest - コピー先のファイルパス
   * @throws コピー元ファイルが存在しない場合はENOENTエラー
   */
  copyFile(src: string, dest: string): Promise<void>;

  /**
   * ファイルまたはディレクトリが存在するかチェックします
   *
   * @param path - チェックするパス
   * @throws パスが存在しない場合はENOENTエラー
   */
  access(path: string): Promise<void>;

  /**
   * ディレクトリ内のファイル一覧を取得します
   *
   * @param path - ディレクトリのパス
   * @returns ファイル名の配列
   * @throws ディレクトリが存在しない場合はENOENTエラー
   */
  readdir(path: string): Promise<string[]>;

  /**
   * ディレクトリを作成します
   *
   * @param path - 作成するディレクトリのパス
   * @param options - オプション（recursive: 親ディレクトリも作成するか）
   */
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;

  /**
   * ファイルまたはディレクトリの情報を取得します
   *
   * @param path - パス
   * @returns ファイル情報オブジェクト
   * @throws パスが存在しない場合はENOENTエラー
   */
  stat(path: string): Promise<{
    isDirectory: () => boolean;
    mtime: Date;
  }>;

  /**
   * ファイルまたはディレクトリを削除します
   *
   * @param path - 削除するパス
   * @param options - オプション（recursive: 再帰的に削除、force: エラーを無視）
   */
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}
