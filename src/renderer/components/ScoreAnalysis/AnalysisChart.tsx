import type React from 'react';
import { useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import GraphSettings from './graph/GraphSettings';
import ScoreGraph from './graph/ScoreGraph';
import type { TestExecution } from '../../../schemas/execution';
import type { AnalysisResponse } from '../../../schemas/analysis';

interface AnalysisChartProps {
  analysisResult: AnalysisResponse | null;
  executions: TestExecution[];
  selectedExecutionIds: string[];
}

const AnalysisChart: React.FC<AnalysisChartProps> = ({
  analysisResult,
  executions,
  selectedExecutionIds,
}) => {
  // チャート固有の状態
  const [xAxis, setXAxis] = useState('seed');
  const [inputFilter, setInputFilter] = useState('');
  const [useLogScale, setUseLogScale] = useState(false);
  const [useRelativeScore, setUseRelativeScore] = useState(false);

  // 現在の値と適用される値を分離
  const [currentInputFilter, setCurrentInputFilter] = useState('');
  const [currentXAxis, setCurrentXAxis] = useState('seed');
  const [applyingSettings, setApplyingSettings] = useState(false);

  const applyGraphSettings = () => {
    setApplyingSettings(true);
    setInputFilter(currentInputFilter);
    setXAxis(currentXAxis);
    setApplyingSettings(false);
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 3,
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '600px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">分析結果</Typography>
        <GraphSettings
          currentXAxis={currentXAxis}
          currentInputFilter={currentInputFilter}
          onXAxisChange={setCurrentXAxis}
          onInputFilterChange={setCurrentInputFilter}
          useLogScale={useLogScale}
          onToggleLogScale={setUseLogScale}
          useRelativeScore={useRelativeScore}
          onToggleRelativeScore={setUseRelativeScore}
          onApply={applyGraphSettings}
          applying={applyingSettings}
        />
      </Box>

      {/* グラフの描画 */}
      <Box
        sx={{
          width: '100%',
          overflow: 'visible',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ScoreGraph
          analysisResult={analysisResult}
          executions={executions}
          selectedExecutionIds={selectedExecutionIds}
          inputFilter={inputFilter}
          useRelativeScore={useRelativeScore}
          useLogScale={useLogScale}
          xAxis={xAxis}
        />
      </Box>
    </Paper>
  );
};

export default AnalysisChart;
