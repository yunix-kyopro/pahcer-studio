import type React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Paper,
  Typography,
  CircularProgress,
  Box,
  TextField,
  FormControl,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import type { TestExecution } from '../../../schemas/execution';

interface VisualizerProps {
  selectedExecution: TestExecution | null;
  onError: (message: string) => void;
}

// ビジュアライザー用 Window 型
interface VisualizerWindow extends Window {
  generate?: () => void;
}

// Helper: wait until "generate" becomes available on iframe window
const waitGenerate = (
  win: VisualizerWindow | null | undefined,
  timeout = 2000,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const id = setInterval(() => {
      if (win?.generate || Date.now() - start > timeout) {
        clearInterval(id);
        resolve(Boolean(win?.generate));
      }
    }, 50);
  });
};

const Visualizer: React.FC<VisualizerProps> = ({ selectedExecution, onError }) => {
  const visualizerIframeRef = useRef<HTMLIFrameElement>(null);
  const seedInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------
  // 内部ステート
  //   selectedSeed : 既にビジュアライザーへ反映済みのシード
  //   seedDraft    : テキストフィールドに入力中の値（確定前）
  //   loadingCaseOutput : テストケース出力取得中フラグ
  // --------------------------------------------------------------------
  const [selectedSeed, setSelectedSeed] = useState<number>(0);
  const [seedDraft, setSeedDraft] = useState<string>('0');
  const [loadingCaseOutput, setLoadingCaseOutput] = useState(false);
  // 表示倍率 (%). 25〜150
  const [scalePct, setScalePct] = useState<number>(100);

  // ビジュアライザアセットの存在確認
  const [visualizerReady, setVisualizerReady] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [filesDialogOpen, setFilesDialogOpen] = useState<boolean>(false);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);

  // キャッシュバスター
  const [cacheKey, setCacheKey] = useState<number>(() => Date.now());
  const [entryHtml, setEntryHtml] = useState<string | null>(null);

  // 入力制限: 0 以上であれば上限なし
  const minSeed = 0;

  // URL バリデーション: https://img.atcoder.jp から始まり .html で終わる
  const urlPattern = /^https:\/\/img\.atcoder\.jp\/.*\.html(?:\?.*)?$/;
  const urlValid = urlInput === '' ? true : urlPattern.test(urlInput);

  // 初回チェック
  useEffect(() => {
    const init = async () => {
      try {
        const res = await window.electronAPI.asset.getVisualizerEntry();
        setVisualizerReady(res.exists);
        setEntryHtml(res.entry);
      } catch (err) {
        console.error(err);
        setVisualizerReady(false);
      }
    };
    init();
  }, []);

  // visualizerReady が true になったタイミングでキャッシュキー更新
  useEffect(() => {
    if (visualizerReady) {
      setCacheKey(Date.now());
    }
  }, [visualizerReady]);

  // シード変更ハンドラー
  const handleSeedChange = useCallback(
    async (newSeed: number, maintainFocus: boolean = true) => {
      setSelectedSeed(newSeed);

      if (selectedExecution?.id) {
        setLoadingCaseOutput(true);

        // フォーカス維持のため、現在のフォーカス状態を記録
        const shouldRestoreFocus = maintainFocus && document.activeElement === seedInputRef.current;

        try {
          const output = await window.electronAPI.execution.getTestCaseResult(
            selectedExecution.id,
            newSeed,
          );

          // ビジュアライザーのiframeを更新
          if (visualizerIframeRef.current) {
            const iframe = visualizerIframeRef.current;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

            // ここで0.1秒待つ
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (iframeDoc) {
              const outputTextarea = iframeDoc.getElementById('output') as HTMLTextAreaElement;
              const seedInput = iframeDoc.getElementById('seed') as HTMLInputElement;

              if (outputTextarea && seedInput) {
                // ensure generate defined
                await waitGenerate(iframe.contentWindow as VisualizerWindow);

                seedInput.value = newSeed?.toString() ?? '';
                const event = new Event('change', { bubbles: true });
                seedInput.dispatchEvent(event);

                outputTextarea.value = output || '';
                const outputEvent = new Event('input', { bubbles: true });
                outputTextarea.dispatchEvent(outputEvent);
              }
            }
          }
        } catch (err) {
          console.error('Error updating visualizer:', err);
          onError('ビジュアライザーの更新に失敗しました');
        } finally {
          setLoadingCaseOutput(false);

          // フォーカスを復元
          if (shouldRestoreFocus && seedInputRef.current) {
            // 少し遅延させてフォーカスを復元（非同期処理完了後）
            setTimeout(() => {
              seedInputRef.current?.focus();
            }, 0);
          }
        }
      }
    },
    [selectedExecution, onError],
  );

  /**
   * onChange: 入力途中の値を draft として保持するだけ
   *            （即ビジュアライザー更新は行わない）
   */
  const handleSeedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeedDraft(e.target.value);
  };

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        // ±1 で即時反映
        e.preventDefault();
        const step = e.key === 'ArrowUp' ? 1 : -1;
        const next = Math.max(minSeed, selectedSeed + step);
        setSeedDraft(String(next));
        handleSeedChange(next, true);
        break;
      }
      case 'Enter': {
        // Enter で確定反映
        e.preventDefault();
        commitSeedDraft();
        break;
      }
      default:
        break;
    }
  };

  // フォーカスアウト時に確定
  const handleBlur = () => commitSeedDraft();

  /** draft を selectedSeed に確定し、ビジュアライザー更新 */
  const commitSeedDraft = () => {
    const num = Number(seedDraft);
    if (isNaN(num) || num < minSeed) return;
    if (num !== selectedSeed) {
      handleSeedChange(num, false);
    }
  };

  // 選択された実行が変わったら同じシードで再描画
  useEffect(() => {
    if (selectedExecution?.id && selectedExecution.status === 'COMPLETED') {
      handleSeedChange(selectedSeed, false);
    }
  }, [selectedExecution, handleSeedChange, selectedSeed]);

  // selectedSeed が変われば draft も同期
  useEffect(() => {
    setSeedDraft(String(selectedSeed));
  }, [selectedSeed]);

  // アセット削除
  const handleDeleteAssets = async () => {
    setConfirmOpen(false);
    try {
      await window.electronAPI.asset.deleteVisualizer();
      setVisualizerReady(false);
      setCacheKey(Date.now());
      setEntryHtml(null);
      onError('ビジュアライザのアセットを削除しました');
    } catch (err) {
      console.error(err);
      onError('アセット削除に失敗しました');
    }
  };

  // アセットダウンロード
  const handleDownloadVisualizer = async () => {
    if (!urlInput || !urlValid) return;
    setDownloading(true);
    try {
      const res = await window.electronAPI.asset.downloadVisualizer(urlInput);
      if (res?.success !== false) {
        await refreshEntry();
        setCacheKey(Date.now());

        if (Array.isArray(res.urls) && res.urls.length > 0) {
          setDownloadedFiles(res.urls);
          setFilesDialogOpen(true);
        }
      } else {
        onError('ダウンロードに失敗しました: ' + res.error);
      }
    } catch (err: unknown) {
      onError('ダウンロードに失敗しました');
    } finally {
      setDownloading(false);
    }
  };

  // helper to refresh entry html after download
  const refreshEntry = async () => {
    const res = await window.electronAPI.asset.getVisualizerEntry();
    setVisualizerReady(res.exists);
    setEntryHtml(res.entry);
  };

  /** スケール変更ハンドラ */
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 25 && val <= 150) {
      setScalePct(val);
    }
  };

  // iframe がロード完了したときに選択中シードを反映
  useEffect(() => {
    const iframe = visualizerIframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      // iframe のコンテンツがロードされた後、選択中の実行があれば反映
      if (selectedExecution?.id && selectedExecution.status === 'COMPLETED') {
        handleSeedChange(selectedSeed, false);
      }
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [selectedExecution, selectedSeed, handleSeedChange]);

  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid rgba(224, 224, 224, 1)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" sx={{ mr: 2, fontSize: '1.1rem' }}>
          ビジュアライザー
          {selectedExecution?.id && ` (ID: ${selectedExecution.id.substring(0, 4)})`}
        </Typography>
        {visualizerReady && selectedExecution?.status === 'COMPLETED' && (
          <FormControl sx={{ width: '150px' }}>
            <TextField
              inputRef={seedInputRef}
              label="Seed"
              type="number"
              size="small"
              value={seedDraft}
              onChange={handleSeedInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              InputProps={{
                inputProps: {
                  min: minSeed,
                  step: 1,
                },
              }}
              disabled={loadingCaseOutput}
              variant="outlined"
            />
          </FormControl>
        )}
        {visualizerReady && (
          <FormControl sx={{ width: '130px', ml: 2 }}>
            <TextField
              label="Scale %"
              type="number"
              size="small"
              value={scalePct}
              onChange={handleScaleChange}
              InputProps={{ inputProps: { min: 25, max: 150, step: 5 } }}
              variant="outlined"
            />
          </FormControl>
        )}
        {visualizerReady && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            sx={{ ml: 2 }}
            onClick={() => setConfirmOpen(true)}
          >
            アセット削除
          </Button>
        )}
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {visualizerReady ? (
          selectedExecution?.status === 'COMPLETED' ? (
            <Box
              sx={() => {
                const factor = scalePct / 100;
                const isZoomIn = factor > 1;
                return {
                  flexGrow: 1,
                  position: 'relative',
                  overflowX: isZoomIn ? 'auto' : 'hidden',
                  overflowY: isZoomIn ? 'auto' : 'hidden',
                };
              }}
            >
              {loadingCaseOutput && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    zIndex: 1,
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
              <Box
                sx={() => {
                  const factor = scalePct / 100;
                  return {
                    transform: `scale(${factor})`,
                    transformOrigin: 'top left',
                    width: `${100 / factor}%`,
                    height: `${100 / factor}%`,
                  };
                }}
              >
                <iframe
                  ref={visualizerIframeRef}
                  src={
                    entryHtml ? `../../public/visualizer/${entryHtml}?v=${cacheKey}` : 'about:blank'
                  }
                  title="Visualizer"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                />
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                p: 3,
              }}
            >
              <Typography variant="body1" color="text.secondary">
                {!selectedExecution
                  ? 'テスト実行を選択してください'
                  : 'ビジュアライザーは完了したテスト実行でのみ利用できます'}
              </Typography>
            </Box>
          )
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              gap: 2,
            }}
          >
            <Typography variant="body1" sx={{ mb: 2 }}>
              ビジュアライザーがまだダウンロードされていません。
            </Typography>
            <TextField
              label="Visualizer URL (例: https://img.atcoder.jp/ahc048/lI5DXOAV.html)"
              fullWidth
              multiline
              rows={2}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/visualizer.html"
              error={!urlValid}
              helperText={
                urlValid ? '' : 'https://img.atcoder.jp から始まり .html で終わるURLのみ許可'
              }
            />
            <Button
              variant="contained"
              disabled={downloading || !urlInput || !urlValid}
              onClick={handleDownloadVisualizer}
            >
              {downloading ? 'ダウンロード中...' : 'ビジュアライザ取得'}
            </Button>
          </Box>
        )}
      </Box>

      {/* 削除確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>アセット削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            public/visualizer フォルダ内のファイルをすべて削除します。よろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button color="error" onClick={handleDeleteAssets} autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* ダウンロード完了ファイル一覧ダイアログ */}
      <Dialog
        open={filesDialogOpen}
        onClose={() => setFilesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ダウンロード完了</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            ダウンロードしたファイル（URL）一覧
          </Typography>
          <Box
            component="ul"
            sx={{ pl: 2, maxHeight: 300, overflowY: 'auto', typography: 'body2' }}
          >
            {downloadedFiles.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilesDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default Visualizer;
