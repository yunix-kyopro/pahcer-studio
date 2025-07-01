import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import type { TestExecution } from '../../../schemas/execution';
import type {
  AnalysisRequest,
  AnalysisResponse,
  UpdateAnalysisRequest,
} from '../../../schemas/analysis';
import AnalysisSettings from './AnalysisSettings';
import ExecutionSelectionTable from './ExecutionSelectionTable';
import AnalysisChart from './AnalysisChart';

const ScoreAnalysis: React.FC = () => {
  // グローバル状態管理
  const [loading, setLoading] = useState(false);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [featureFormat, setFeatureFormat] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [selectedExecutionIds, setSelectedExecutionIds] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  /* =====================================================
   * 1. 初期ロード
   *    - ユーザー設定 (featureFormat) と実行一覧を並列取得
   *    - 取得完了後、useEffect で分析データをフェッチ
   * ===================================================== */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // --- (1) 設定を取得 -----------------------------
        const settings = await window.electronAPI.analysis.getSettings();

        if (settings.featureFormat) {
          setFeatureFormat(settings.featureFormat);
        }

        setSettingsLoaded(true);
      } catch (error) {
        setSettingsLoaded(true); // エラーでも読み込みは完了したとマーク
      }
    };

    // 実行リストを取得
    const loadExecutions = async () => {
      try {
        setExecutionsLoading(true);
        const executionsList = await window.electronAPI.execution.getAll();

        if (executionsList && Array.isArray(executionsList)) {
          const completedExecutions = executionsList.filter((e) => e.status === 'COMPLETED');
          setExecutions(completedExecutions);
        }
      } catch (error) {
        setError('実行リストの取得に失敗しました');
      } finally {
        setExecutionsLoading(false);
      }
    };

    // --- (3) 並行ロード --------------------------------
    loadSettings();
    loadExecutions();
  }, []);

  /* =====================================================
   * 2. 分析データの取得ロジック
   *    executions が揃ってから呼び出されることを想定
   *    window.electronAPI.analysis.analyze を介して
   *    バックエンドに分析を依頼する
   * ===================================================== */
  const fetchAnalysisData = useCallback(async () => {
    if (!featureFormat) {
      setError('入力特徴量フォーマットを指定してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // まず分析を実行
      if (executions.length > 0) {
        const request: AnalysisRequest = {
          executionIds: executions.map((e) => e.id!),
          featureFormat,
        };

        const response = await window.electronAPI.analysis.analyze(request);
        setAnalysisResult(response);
      }
    } catch (error) {
      setError('分析データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [featureFormat, executions]);

  // 設定/実行一覧が揃ったタイミングで分析をトリガー
  useEffect(() => {
    if (settingsLoaded && featureFormat && executions.length > 0) {
      fetchAnalysisData();
    }
  }, [settingsLoaded, featureFormat, executions, fetchAnalysisData]);

  /* =====================================================
   * 3. キャッシュ更新＆再フェッチ
   *    - バックエンドに feature 抽出とスコア計算を依頼
   *    - 成功時は saveSettings でフォーマットを永続化
   * ===================================================== */
  const updateAnalysisData = async () => {
    if (!featureFormat) {
      setError('入力特徴量フォーマットを指定してください');
      return;
    }

    try {
      setUpdating(true);

      const requestData: UpdateAnalysisRequest = {
        featureFormat,
      };

      const result = await window.electronAPI.analysis.updateCache(requestData);

      if (result.successful) {
        setError(null);

        // データを再取得
        await fetchAnalysisData();

        // ★ 永続化: 入力フォーマットを保存
        await window.electronAPI.analysis.saveSettings(featureFormat);

        // 成功時に選択をクリア
        setSelectedExecutionIds([]);

        // 成功メッセージを表示
        alert(
          `更新完了: ${result.totalTestCases}ケース, \n
          入力特徴量の抽出に${result.extractedFeatures ? '成功' : '失敗'}しました`,
        );
      } else {
        setError(`更新に失敗しました: ${result.message || '不明なエラー'}`);
      }
    } catch (error) {
      setError(
        `分析データの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  /* =====================================================
   * 4. テーブル行選択ハンドラ
   *    selectedExecutionIds 状態をトグルし、短縮 ID にも対応
   * ===================================================== */
  const toggleExecution = (id: string) => {
    // 選択状態を更新
    setSelectedExecutionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((executionId) => executionId !== id);
      } else {
        return [...prev, id];
      }
    });

    // 分析結果がない場合は早期リターン
    if (!analysisResult) {
      return;
    }

    // IDから行インデックスを探索
    const shortId = id.substring(0, 8);

    for (let i = 0; i < analysisResult.scoreData.length; i++) {
      const data = analysisResult.scoreData[i];
      if (
        data.id === id ||
        data.id.includes(shortId) ||
        (data.id.length >= 8 && id.includes(data.id.substring(0, 8)))
      ) {
        break;
      }
    }
  };

  // 5. すべての選択を解除
  const clearAllSelections = () => {
    setSelectedExecutionIds([]);
  };

  // 6. その他コールバック
  const handleFeatureFormatChange = (value: string) => {
    setFeatureFormat(value);
  };

  return (
    <Box sx={{ p: 3, overflowY: 'auto', height: '100%', maxWidth: '100%' }}>
      <Typography variant="h4" gutterBottom>
        スコア分析
      </Typography>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 分析データがないか不足している場合の通知 */}
      {analysisResult && (!analysisResult.scoreData || analysisResult.scoreData.length === 0) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          分析データが不足しています。「を更新」ボタンを押して、データを生成してください。
        </Alert>
      )}

      {/* 設定パネル */}
      <AnalysisSettings
        featureFormat={featureFormat}
        updating={updating}
        onFeatureFormatChange={handleFeatureFormatChange}
        onUpdateAnalysisData={updateAnalysisData}
      />

      {/* テスト実行選択セクション */}
      <ExecutionSelectionTable
        executions={executions}
        selectedExecutionIds={selectedExecutionIds}
        executionsLoading={executionsLoading}
        onToggleExecution={toggleExecution}
        onClearAllSelections={clearAllSelections}
      />

      {/* 分析データ読み込み中表示 */}
      {loading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 3,
          }}
        >
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            分析データを読み込み中...
          </Typography>
        </Box>
      )}

      {/* 分析結果とグラフセクション */}
      {analysisResult && (
        <AnalysisChart
          analysisResult={analysisResult}
          executions={executions}
          selectedExecutionIds={selectedExecutionIds}
        />
      )}
    </Box>
  );
};

export default ScoreAnalysis;
