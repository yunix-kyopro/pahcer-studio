import type React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TestExecution } from '../../../../schemas/execution';
import type { AnalysisResponse } from '../../../../schemas/analysis';
import { useChartDataset, type ScoreGraphPoint } from '../hooks/useScoreGraphData';
import { useInputFilter } from '../hooks/useGraphData';

interface ScoreGraphProps {
  analysisResult: AnalysisResponse | null;
  executions: TestExecution[];
  selectedExecutionIds: string[];
  inputFilter: string;
  useRelativeScore: boolean;
  useLogScale: boolean;
  xAxis: string;
}

const ScoreGraph: React.FC<ScoreGraphProps> = ({
  analysisResult,
  executions,
  selectedExecutionIds,
  inputFilter,
  useRelativeScore,
  useLogScale,
  xAxis,
}) => {
  // 入力フィルタ適用 & X 軸計算
  const { filteredInputs, xValues } = useInputFilter(
    analysisResult,
    selectedExecutionIds,
    xAxis,
    inputFilter,
  );

  // Graph データ生成 (常に Hook を呼び出す)
  const { featureKeys, processedData, useAggregation } = useChartDataset(
    analysisResult,
    executions,
    selectedExecutionIds,
    filteredInputs,
    xValues,
    xAxis,
    useRelativeScore,
  );

  // 事前チェック（Hook 呼び出し後に行う）
  if (!analysisResult || selectedExecutionIds.length === 0) {
    return (
      <Box
        sx={{
          height: 200,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="body1">実行を選択してください</Typography>
      </Box>
    );
  }

  if (!analysisResult.scoreData || analysisResult.scoreData.length === 0) {
    return (
      <Box
        sx={{
          height: 200,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="body1">スコアデータが見つかりません</Typography>
      </Box>
    );
  }

  if (!analysisResult.inputFeatures || analysisResult.inputFeatures.length === 0) {
    return (
      <Box
        sx={{
          height: 200,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="body1">入力特徴量データが見つかりません</Typography>
      </Box>
    );
  }

  const colors = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#00ff00',
    '#ff00ff',
    '#00ffff',
    '#ff0000',
    '#0000ff',
    '#ffff00',
  ];

  return (
    <>
      {/* 特徴量キーのヘルプ表示 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {featureKeys}
        </Typography>
        <Tooltip title="式の中では特徴量の値を変数として使用できます。例: N > 10 && M < 5">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* フィルタリング情報を表示 */}
      <Typography variant="body2" sx={{ mb: 1 }}>
        フィルタ適用後の入力数: {filteredInputs.length} / {analysisResult.inputFeatures.length}
      </Typography>

      {/* Rechartsグラフ */}
      <Box sx={{ height: 400, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={processedData} margin={{ left: 50, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              scale={'linear'}
              domain={useLogScale ? ['dataMin', 'dataMax'] : ['auto', 'auto']}
              name={xAxis || 'seed'}
            />
            <YAxis
              scale={useLogScale ? 'log' : 'linear'}
              domain={useLogScale ? ['dataMin', 'dataMax'] : ['auto', 'auto']}
              name={useRelativeScore ? 'Relative Score' : 'Score'}
              width={50}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;

                const d = payload[0].payload as ScoreGraphPoint;
                const grouped = useAggregation;

                return (
                  <div
                    style={{
                      background: '#ffffff',
                      padding: 8,
                      border: '1px solid #cccccc',
                      maxWidth: 340,
                    }}
                  >
                    {grouped ? (
                      <>
                        <p>{`${xAxis || 'seed'}: ${d.x}`}</p>
                        <p>{`ケース数: ${d.count}`}</p>
                        <p style={{ whiteSpace: 'normal' }}>{`Seeds: ${d.seeds.join(', ')}`}</p>
                      </>
                    ) : (
                      <>
                        <p>{`Seed: ${d.seeds?.[0]}`}</p>
                        {selectedExecutionIds.map((id) => {
                          const name =
                            executions.find((e) => e.id === id)?.comment || id.substring(0, 8);
                          const v = d[name];
                          if (v === undefined || v === null) return null;
                          return (
                            <p key={id}>{`${name}: ${typeof v === 'number' ? v.toFixed(2) : v}`}</p>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              }}
            />
            <Legend />
            {selectedExecutionIds.map((execId, index) => {
              const execName =
                executions.find((e) => e.id === execId)?.comment || execId.substring(0, 8);
              return (
                <Line
                  key={execId}
                  type="monotone"
                  dataKey={execName}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  name={execName}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </>
  );
};

export default ScoreGraph;
