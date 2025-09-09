import { useDataStore } from '@/store/dataStore';
import { DataInput } from '@/components/DataInput';
import { VisualizationPanel } from '@/components/VisualizationPanel';
import { RegressionAnalysis } from '@/components/RegressionAnalysis';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, BarChart3, Calculator, Activity, Github, BookOpen } from 'lucide-react';

const Index = () => {
  const { activeTab, setActiveTab, reset } = useDataStore();

  const tabConfigs = [
    {
      value: 'input',
      label: '데이터 입력',
      icon: Database,
      description: '데이터 업로드 및 파싱'
    },
    {
      value: 'visualization',
      label: '시각화',
      icon: BarChart3,
      description: '다차원 데이터 시각화'
    },
    {
      value: 'regression',
      label: '회귀 분석',
      icon: Calculator,
      description: '선형회귀 모델링'
    },
    {
      value: 'diagnostics',
      label: '진단',
      icon: Activity,
      description: '모델 진단 및 검증'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">DataViz Pro</h1>
                <p className="text-sm text-muted-foreground">
                  다차원 데이터 시각화 및 회귀 분석 도구
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={reset}>
                초기화
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold mb-3">
            브라우저에서 하는 <span className="gradient-text">데이터 분석</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            다차원 시각화와 선형회귀 분석을 완전히 클라이언트 사이드에서 수행하세요.
          </p>
        </div>

        {/* Main Application */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-card/80 backdrop-blur-sm">
            {tabConfigs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="input" className="mt-0">
            <DataInput />
          </TabsContent>

          <TabsContent value="visualization" className="mt-0">
            <VisualizationPanel />
          </TabsContent>

          <TabsContent value="regression" className="mt-0">
            <RegressionAnalysis />
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-0">
            <DiagnosticsPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/80 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <h4 className="font-semibold text-sm mb-1">다차원 시각화</h4>
              <p className="text-xs text-muted-foreground">최대 4차원 직접 시각화, 5차원 이상 슬라이더 제어</p>
            </div>
            
            <div className="text-center">
              <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calculator className="h-4 w-4 text-white" />
              </div>
              <h4 className="font-semibold text-sm mb-1">고급 회귀 분석</h4>
              <p className="text-xs text-muted-foreground">다중 선형회귀, R², 진단 그래프</p>
            </div>
            
            <div className="text-center">
              <div className="h-8 w-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Database className="h-4 w-4 text-white" />
              </div>
              <h4 className="font-semibold text-sm mb-1">완전한 프라이버시</h4>
              <p className="text-xs text-muted-foreground">모든 처리가 브라우저에서 수행</p>
            </div>
          </div>
          
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>
              DataViz Pro - 오픈 소스 데이터 분석 도구 | 
              <a href="#" className="ml-2 hover:text-primary transition-colors">
                문서 보기
              </a> |
              <a href="#" className="ml-2 hover:text-primary transition-colors">
                GitHub
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;