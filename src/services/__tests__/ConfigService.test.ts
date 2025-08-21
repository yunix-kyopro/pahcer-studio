import { ConfigService } from '../ConfigService';
import { DIContainer } from '../../infrastructure/DIContainer';
import { MockFileSystemService } from '../filesystem';

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockFileSystem: MockFileSystemService;
  let container: DIContainer;

  beforeEach(() => {
    // テスト用DIContainerを作成
    container = DIContainer.createTestContainer();
    configService = container.getConfigService();
    mockFileSystem = container.getMockFileSystemService();

    // MockFileSystemServiceをクリア
    mockFileSystem.clear();
  });

  describe('getSavePathList', () => {
    it('正常なpahcer_config.tomlからsave_path_listを取得する', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["main.cpp", "modules"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(true);
      expect(result.paths).toEqual(['main.cpp', 'modules']);
    });

    it('空のsave_path_listが設定されている場合', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = []
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(true);
      expect(result.paths).toEqual([]);
    });

    it('pahcer-studioセクションが存在しない場合', async () => {
      const mockTomlContent = `
[general]
version = "0.2.0"

[problem]
problem_name = "AHC050"
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(false);
      expect(result.paths).toEqual([]);
    });

    it('save_path_listプロパティが存在しない場合', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
other_property = "value"
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(false);
      expect(result.paths).toEqual([]);
    });

    it('pahcer_config.tomlが存在しない場合', async () => {
      // ファイルを追加しない（存在しない状態）

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(false);
      expect(result.paths).toEqual([]);
    });

    it('不正なTOMLファイルの場合', async () => {
      mockFileSystem.addFile('/mock/pahcer_config.toml', 'invalid toml content [[[', { size: 23 });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(false);
      expect(result.paths).toEqual([]);
    });

    it('複数のpahcer-studioセクションがある場合は最初のものを使用', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["first.cpp"]

[[pahcer-studio]]
save_path_list = ["second.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getSavePathList();

      expect(result.isConfigured).toBe(true);
      expect(result.paths).toEqual(['first.cpp']);
    });
  });

  describe('getConfig', () => {
    it('基本的な設定を読み取れる', async () => {
      const mockTomlContent = `
[general]
version = "0.2.0"

[problem]
problem_name = "AHC050"
objective = "Max"

[[pahcer-studio]]
save_path_list = ["main.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const config = await configService.getConfig();

      expect(config.general?.version).toBe('0.2.0');
      expect(config.problem?.problem_name).toBe('AHC050');
      expect(config.problem?.objective).toBe('Max');
      expect(config['pahcer-studio']?.[0]?.save_path_list).toEqual(['main.cpp']);
    });

    it('ファイルが存在しない場合は空オブジェクトを返す', async () => {
      // ファイルを追加しない（存在しない状態）

      const config = await configService.getConfig();

      expect(config).toEqual({});
    });
  });

  describe('getActualFileList', () => {
    it('単一のファイルを取得する', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["main.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      mockFileSystem.addFile('/mock/main.cpp', '#include <iostream>', { size: 100 });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.files[0].path).toBe('main.cpp');
      expect(result.files[0].size).toBe(100);
      expect(result.files[0].isDirectory).toBe(false);
    });

    it('save_path_listが空の場合', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = []
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.files).toEqual([]);
    });

    it('pahcer-studioセクションが存在しない場合', async () => {
      const mockTomlContent = `
[general]
version = "0.2.0"
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(false);
      expect(result.totalCount).toBe(0);
      expect(result.files).toEqual([]);
    });

    it('pahcer_config.tomlが存在しない場合', async () => {
      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(false);
      expect(result.totalCount).toBe(0);
      expect(result.files).toEqual([]);
    });

    it('存在しないファイルはスキップされる', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["existing.cpp", "missing.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      mockFileSystem.addFile('/mock/existing.cpp', 'content', { size: 50 });
      // missing.cppは追加しない

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.files[0].path).toBe('existing.cpp');
      expect(result.files[0].size).toBe(50);
      expect(result.files[0].isDirectory).toBe(false);
    });

    it('trailing slashがあるディレクトリパスが正規化される', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["modules/"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      // trailing slashなしでディレクトリを追加
      mockFileSystem.addDirectory('/mock/modules');
      mockFileSystem.addFile('/mock/modules/utils.cpp', 'utility code', { size: 30 });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(1); // ディレクトリ内のファイルのみカウント
      expect(result.files[0].path).toBe('modules/utils.cpp');
      expect(result.files[0].isDirectory).toBe(false);
    });

    it('ファイルがパス順（辞書順）でソートされる', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["z_last.cpp", "a_first.cpp", "middle.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      mockFileSystem.addFile('/mock/z_last.cpp', 'last', { size: 10 });
      mockFileSystem.addFile('/mock/a_first.cpp', 'first', { size: 20 });
      mockFileSystem.addFile('/mock/middle.cpp', 'middle', { size: 30 });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(3);
      expect(result.files[0].path).toBe('a_first.cpp');
      expect(result.files[1].path).toBe('middle.cpp');
      expect(result.files[2].path).toBe('z_last.cpp');
    });

    it('ディレクトリとファイルが混在している場合のソートが正しい', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["main.cpp", "utils/"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      mockFileSystem.addFile('/mock/main.cpp', 'main code', { size: 100 });
      mockFileSystem.addDirectory('/mock/utils');
      mockFileSystem.addFile('/mock/utils/helper.cpp', 'helper code', { size: 50 });

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(2); // main.cpp + utils/helper.cpp
      // パス順ソート: "main.cpp", "utils/helper.cpp"
      expect(result.files[0].path).toBe('main.cpp');
      expect(result.files[0].isDirectory).toBe(false);
      expect(result.files[1].path).toBe('utils/helper.cpp');
      expect(result.files[1].isDirectory).toBe(false);
    });

    it('空のディレクトリはカウントされない', async () => {
      const mockTomlContent = `
[[pahcer-studio]]
save_path_list = ["empty_dir/", "main.cpp"]
`;
      mockFileSystem.addFile('/mock/pahcer_config.toml', mockTomlContent, {
        size: mockTomlContent.length,
      });

      mockFileSystem.addFile('/mock/main.cpp', 'main code', { size: 100 });
      mockFileSystem.addDirectory('/mock/empty_dir');
      // empty_dirには何もファイルを追加しない

      const result = await configService.getActualFileList();

      expect(result.isConfigured).toBe(true);
      expect(result.totalCount).toBe(1); // main.cppのみ
      expect(result.files[0].path).toBe('main.cpp');
      expect(result.files[0].isDirectory).toBe(false);
    });
  });
});
