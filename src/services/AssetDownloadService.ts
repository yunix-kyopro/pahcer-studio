import * as fs from 'fs/promises';
import * as path from 'path';
import { load } from 'cheerio';

/**
 * 任意の HTML ページをダウンロードし、そのページで参照される
 * JS / CSS / 画像 / WASM などの静的アセットを再帰的に取得して
 * 指定のディレクトリに配置するヘルパークラス。
 *
 * Visualizer など単一 HTML + 添付ファイル群を想定しており、
 * 相対パスを出来る限り保持したまま保存します。
 */
export class AssetDownloadService {
  /** 出力先のルートディレクトリ (例: public/visualizer) */
  private outputRoot: string;
  private visitedJs: Set<string> = new Set();
  private urlSet: Set<string> = new Set();

  constructor(outputRoot: string = path.join(process.cwd(), 'public', 'visualizer')) {
    this.outputRoot = outputRoot;
  }

  /**
   * 指定 URL から HTML と関連アセットをダウンロードして配置します。
   * @param url 例: https://img.atcoder.jp/ahc048/lI5DXOAV.html
   */
  async download(url: string): Promise<string[]> {
    const htmlResp = await fetch(url);
    if (!htmlResp.ok) {
      throw new Error(`Failed to fetch HTML from ${url}: ${htmlResp.status}`);
    }
    const htmlText = await htmlResp.text();

    this.urlSet.add(url);

    // output ディレクトリを確保
    await fs.mkdir(this.outputRoot, { recursive: true });

    const urlObj = new URL(url);
    const baseDirUrl =
      urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);

    // HTML を保存
    const htmlFileName = path.basename(urlObj.pathname).split('?', 1)[0] || 'index.html';
    const htmlLocalPath = path.join(this.outputRoot, htmlFileName);
    await fs.writeFile(htmlLocalPath, htmlText, 'utf8');

    // -------- JS assets --------
    const $ = load(htmlText);
    const jsUrls = new Set<string>();

    // <script src="..">
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) jsUrls.add(src);
    });

    // after collecting script src loop, add inline import extraction
    $('script').each((_, el) => {
      const srcAttr = $(el).attr('src');
      if (srcAttr) return; // handled already
      const code = $(el).html() ?? '';
      const importRegex = /import\s+(?:[^'"`]+from\s+)?["'`](.+?\.js)["'`]/g;
      let m: RegExpExecArray | null;
      while ((m = importRegex.exec(code)) !== null) {
        jsUrls.add(m[1]);
      }
    });

    for (const jsUrlRaw of jsUrls) {
      await this.downloadJsAsset(jsUrlRaw, baseDirUrl, 0);
    }

    // -------- WASM referenced directly in HTML / inline scripts --------
    const wasmUrls = new Set<string>();

    // 1) src / href 属性に含まれる .wasm
    $('[src],[href]').each((_, el) => {
      const attr = $(el).attr('src') || $(el).attr('href');
      if (attr && /\.wasm(?:[?#]|$)/i.test(attr)) {
        wasmUrls.add(attr);
      }
    });

    // 2) HTML 全体から "xxx.wasm" という文字列リテラルを抽出
    const wasmLiteralRegex = /['"`]([^'"`]+?\.wasm)['"`]/g;
    let mWas: RegExpExecArray | null;
    while ((mWas = wasmLiteralRegex.exec(htmlText)) !== null) {
      wasmUrls.add(mWas[1]);
    }

    for (const wasmRel of wasmUrls) {
      await this.downloadWasmAsset(wasmRel, baseDirUrl);
    }

    // -------- WASM from main JS --------
    const mainJsName = htmlFileName.replace(/\.html?$/i, '.js');
    const mainJsPath = path.join(this.outputRoot, mainJsName);
    try {
      const jsContent = await fs.readFile(mainJsPath, 'utf8');
      const wasmRegex = /new\s+URL\(['"`](.+?\.wasm)['"`],\s*import\.meta\.url\)/g;
      let m: RegExpExecArray | null;
      while ((m = wasmRegex.exec(jsContent)) !== null) {
        const wasmRel = m[1];
        await this.downloadWasmAsset(wasmRel, baseDirUrl);
      }
    } catch {
      // ignore
    }

    // --- rewrite protocol-relative paths in saved HTML ---
    try {
      let htmlMod = await fs.readFile(htmlLocalPath, 'utf8');
      htmlMod = htmlMod.replace(/([src|href]=["'])\/\/img\.atcoder\.jp\//g, '$1./img.atcoder.jp/');
      await fs.writeFile(htmlLocalPath, htmlMod, 'utf8');
    } catch {
      // ignore
    }

    return Array.from(this.urlSet).sort();
  }

  private async downloadJsAsset(
    jsUrlRaw: string,
    baseDirUrl: string,
    depth: number,
  ): Promise<void> {
    if (depth > 2) return;

    let absUrl: string;
    let fileNameOnly: string;
    let relPath: string;
    if (jsUrlRaw.startsWith('//')) {
      // protocol-relative: only img.atcoder.jp allowed
      absUrl = `https:${jsUrlRaw}`;
      const host = new URL(absUrl).hostname;
      if (host !== 'img.atcoder.jp') {
        throw new Error(`Unexpected JS asset domain: ${host}`);
      }
      relPath = jsUrlRaw.replace(/^\/\//, ''); // keep host/… structure
    } else {
      fileNameOnly = path.basename(jsUrlRaw);
      absUrl = new URL(fileNameOnly, baseDirUrl).toString();
      const host = new URL(absUrl).hostname;
      if (host !== 'img.atcoder.jp') {
        throw new Error(`Unexpected JS asset domain: ${host}`);
      }
      relPath = jsUrlRaw.replace(/^\.?\//, '');
    }

    // 保存先は HTML が期待するパス（元の相対パス）を維持
    const localFull = path.join(this.outputRoot, relPath);

    if (this.visitedJs.has(localFull)) return;
    this.visitedJs.add(localFull);

    // skip if exists
    try {
      await fs.access(localFull);
      return;
    } catch {
      // ignore
    }

    await fs.mkdir(path.dirname(localFull), { recursive: true });

    const resp = await fetch(absUrl);
    if (!resp.ok) return;
    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.writeFile(localFull, buf);

    // record absolute url
    this.urlSet.add(absUrl);

    // ----- parse JS for wasm and further imports -----
    try {
      const jsText = buf.toString('utf8');
      // wasm
      const wasmRegex = /["'`](.+?\.wasm)["'`]/g;
      let m: RegExpExecArray | null;
      while ((m = wasmRegex.exec(jsText)) !== null) {
        await this.downloadWasmAsset(m[1], baseDirUrl);
      }

      // imports (relative)
      const importRegex = /import[^\n"'`]*["'`](\.\/?[^"'`]+?\.js)["'`]/g;
      while ((m = importRegex.exec(jsText)) !== null) {
        await this.downloadJsAsset(m[1], path.dirname(absUrl) + '/', depth + 1);
      }
    } catch {
      // ignore
    }
  }

  private async downloadWasmAsset(wasmRel: string, baseDirUrl: string): Promise<void> {
    let absUrl: string;
    let relPath: string;

    if (wasmRel.startsWith('//')) {
      // protocol-relative
      absUrl = `https:${wasmRel}`;
      const host = new URL(absUrl).hostname;
      if (host !== 'img.atcoder.jp') {
        throw new Error(`Unexpected WASM asset domain: ${host}`);
      }
      relPath = wasmRel.replace(/^\/\//, '');
    } else {
      absUrl = new URL(wasmRel, baseDirUrl).toString();
      const host = new URL(absUrl).hostname;
      if (host !== 'img.atcoder.jp') {
        throw new Error(`Unexpected WASM asset domain: ${host}`);
      }
      relPath = wasmRel.replace(/^\.?\//, '');
    }

    const localFull = path.join(this.outputRoot, relPath);

    try {
      await fs.access(localFull);
      return;
    } catch {
      // ignore
    }

    await fs.mkdir(path.dirname(localFull), { recursive: true });
    const resp = await fetch(absUrl);
    if (!resp.ok) return;
    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.writeFile(localFull, buf);

    // record absolute url
    this.urlSet.add(absUrl);

    // ----- parse JS for wasm and further imports -----
    try {
      const jsText = buf.toString('utf8');
      // wasm
      const wasmRegex = /["'`](.+?\.wasm)["'`]/g;
      let m: RegExpExecArray | null;
      while ((m = wasmRegex.exec(jsText)) !== null) {
        await this.downloadWasmAsset(m[1], baseDirUrl);
      }

      // imports (relative)
      const importRegex = /import[^\n"'`]*["'`](\.\/?[^"'`]+?\.js)["'`]/g;
      while ((m = importRegex.exec(jsText)) !== null) {
        await this.downloadJsAsset(m[1], path.dirname(absUrl) + '/', 0);
      }
    } catch {
      // ignore
    }
  }
}
