import type React from 'react';
import { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Tabs,
  Tab,
  Typography,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import './styles/App.css';
import TestExecutionForm from './components/TestExecutionForm';
import TestExecutionList from './components/TestExecutionList';
import ScoreAnalysis from './components/ScoreAnalysis';

// タブパネルのインターフェース
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// タブパネルコンポーネント
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      style={{ height: 'calc(100vh - 100px)' }}
      {...other}
    >
      {value === index && <Box sx={{ p: 0, height: '100%' }}>{children}</Box>}
    </div>
  );
}

// テーマの作成
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 'bold',
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
          },
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          minHeight: '36px',
          minWidth: '120px',
          maxWidth: '120px',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          backgroundColor: '#ffffff',
        },
        flexContainer: {
          justifyContent: 'flex-start',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        regular: {
          minHeight: '48px',
          '@media (min-width: 600px)': {
            minHeight: '48px',
          },
        },
      },
    },
  },
});

function App() {
  console.log('App');
  // 現在選択されているタブのインデックス
  const [tabIndex, setTabIndex] = useState(0);

  // タブ変更ハンドラー
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                px: 2,
                py: 1,
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
              }}
            >
              pahcer-studio
            </Typography>
            <Tabs
              value={tabIndex}
              onChange={handleTabChange}
              aria-label="basic tabs example"
              textColor="inherit"
              variant="standard"
              sx={{
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                flexGrow: 1,
              }}
            >
              <Tab label="テスト実行" sx={{ borderTopLeftRadius: '4px' }} />
              <Tab label="テスト履歴" />
              <Tab label="スコア分析" />
            </Tabs>
          </Box>
        </AppBar>

        <Box sx={{ width: '100%', height: 'calc(100vh - 50px)', px: 1 }}>
          <TabPanel value={tabIndex} index={0}>
            <TestExecutionForm />
          </TabPanel>

          <TabPanel value={tabIndex} index={1}>
            <TestExecutionList />
          </TabPanel>

          <TabPanel value={tabIndex} index={2}>
            <ScoreAnalysis />
          </TabPanel>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
