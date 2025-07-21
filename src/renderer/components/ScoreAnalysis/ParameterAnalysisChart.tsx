import type React from 'react';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
} from '@mui/material';
import Plot from 'react-plotly.js';
import type { Data, Layout } from 'plotly.js';
import type { AnalysisResponse } from '../../../schemas/analysis';

interface ParameterAnalysisChartProps {
  analysisResult: AnalysisResponse;
}

type PlotDimension = 1 | 2 | 3;

const ParameterAnalysisChart: React.FC<ParameterAnalysisChartProps> = ({ analysisResult }) => {
  const [dimension, setDimension] = useState<PlotDimension>(2);
  const [selectedParams, setSelectedParams] = useState<{
    x?: string;
    y?: string;
    z?: string;
  }>({});

  // パラメータの選択肢を取得
  const parameterOptions = useMemo(() => {
    if (!analysisResult || !analysisResult.featureKeys) {
      return [];
    }
    return analysisResult.featureKeys;
  }, [analysisResult]);

  // 初期値設定
  useMemo(() => {
    if (parameterOptions.length > 0) {
      setSelectedParams({
        x: parameterOptions[0],
        y: parameterOptions.length > 1 ? parameterOptions[1] : parameterOptions[0],
        z: parameterOptions.length > 2 ? parameterOptions[2] : parameterOptions[0],
      });
    }
  }, [parameterOptions]);

  // プロット用データの準備
  const plotData: Data[] = useMemo(() => {
    if (!analysisResult || !analysisResult.inputFeatures || !selectedParams.x) {
      return [];
    }

    const xData = analysisResult.inputFeatures.map(
      (feature) => feature.features[selectedParams.x!] || 0,
    );

    if (dimension === 1) {
      // ヒストグラム
      return [
        {
          x: xData,
          type: 'histogram',
          name: selectedParams.x,
          marker: {
            color: 'rgba(55, 128, 191, 0.7)',
            line: {
              color: 'rgba(55, 128, 191, 1.0)',
              width: 1,
            },
          },
        },
      ];
    }

    const yData = analysisResult.inputFeatures.map(
      (feature) => feature.features[selectedParams.y!] || 0,
    );

    if (dimension === 2) {
      // 2次元散布図
      return [
        {
          x: xData,
          y: yData,
          mode: 'markers',
          type: 'scatter',
          name: 'Data Points',
          marker: {
            size: 8,
            color: 'rgba(55, 128, 191, 0.7)',
            line: {
              color: 'rgba(55, 128, 191, 1.0)',
              width: 1,
            },
          },
        },
      ];
    }

    // 3次元散布図
    const zData = analysisResult.inputFeatures.map(
      (feature) => feature.features[selectedParams.z!] || 0,
    );

    return [
      {
        x: xData,
        y: yData,
        z: zData,
        mode: 'markers',
        type: 'scatter3d',
        name: 'Data Points',
        marker: {
          size: 5,
          color: 'rgba(55, 128, 191, 0.7)',
          line: {
            color: 'rgba(55, 128, 191, 1.0)',
            width: 1,
          },
        },
      },
    ];
  }, [analysisResult, dimension, selectedParams]);

  // レイアウトの設定
  const plotLayout: Partial<Layout> = useMemo(() => {
    const baseLayout = {
      title: {
        text: `${dimension}次元パラメータ分析`,
      },
      autosize: true,
      margin: { l: 50, r: 50, t: 50, b: 50 },
    };

    if (dimension === 1) {
      return {
        ...baseLayout,
        xaxis: { title: { text: selectedParams.x } },
        yaxis: { title: { text: '頻度' } },
      };
    }

    if (dimension === 2) {
      return {
        ...baseLayout,
        xaxis: { title: { text: selectedParams.x } },
        yaxis: { title: { text: selectedParams.y } },
      };
    }

    // 3次元
    return {
      ...baseLayout,
      scene: {
        xaxis: { title: { text: selectedParams.x } },
        yaxis: { title: { text: selectedParams.y } },
        zaxis: { title: { text: selectedParams.z } },
        camera: {
          eye: { x: 1.2, y: 1.2, z: 1.2 },
        },
      },
    };
  }, [dimension, selectedParams]);

  const handleDimensionChange = (newDimension: PlotDimension) => {
    setDimension(newDimension);
  };

  const handleParameterChange = (axis: 'x' | 'y' | 'z', value: string) => {
    setSelectedParams((prev) => ({
      ...prev,
      [axis]: value,
    }));
  };

  if (!analysisResult || !parameterOptions.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">パラメータ分析チャート</Typography>
          <Typography color="textSecondary">
            分析データがありません。データを読み込んでください。
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          パラメータ分析チャート
        </Typography>

        {/* コントロール部分 */}
        <Box mb={3}>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            {/* 次元選択 */}
            <Box flex="1" minWidth="200px">
              <FormControl fullWidth size="small">
                <InputLabel>次元</InputLabel>
                <Select
                  value={dimension}
                  label="次元"
                  onChange={(e) => handleDimensionChange(e.target.value as PlotDimension)}
                >
                  <MenuItem value={1}>1次元 (ヒストグラム)</MenuItem>
                  <MenuItem value={2}>2次元 (散布図)</MenuItem>
                  <MenuItem value={3}>3次元 (散布図)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* X軸パラメータ */}
            <Box flex="1" minWidth="200px">
              <FormControl fullWidth size="small">
                <InputLabel>X軸</InputLabel>
                <Select
                  value={selectedParams.x || ''}
                  label="X軸"
                  onChange={(e) => handleParameterChange('x', e.target.value)}
                >
                  {parameterOptions.map((param) => (
                    <MenuItem key={param} value={param}>
                      {param}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Y軸パラメータ (2次元以上) */}
            {dimension >= 2 && (
              <Box flex="1" minWidth="200px">
                <FormControl fullWidth size="small">
                  <InputLabel>Y軸</InputLabel>
                  <Select
                    value={selectedParams.y || ''}
                    label="Y軸"
                    onChange={(e) => handleParameterChange('y', e.target.value)}
                  >
                    {parameterOptions.map((param) => (
                      <MenuItem key={param} value={param}>
                        {param}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Z軸パラメータ (3次元) */}
            {dimension === 3 && (
              <Box flex="1" minWidth="200px">
                <FormControl fullWidth size="small">
                  <InputLabel>Z軸</InputLabel>
                  <Select
                    value={selectedParams.z || ''}
                    label="Z軸"
                    onChange={(e) => handleParameterChange('z', e.target.value)}
                  >
                    {parameterOptions.map((param) => (
                      <MenuItem key={param} value={param}>
                        {param}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>
        </Box>

        {/* グラフ表示 */}
        <Box height={500}>
          {plotData.length > 0 && (
            // @ts-expect-error - Plotly.jsの型エラーを回避
            <Plot
              data={plotData}
              layout={plotLayout}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
              }}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ParameterAnalysisChart;
