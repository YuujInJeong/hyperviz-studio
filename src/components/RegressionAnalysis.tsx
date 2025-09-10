import { useEffect } from 'react';
import { useDataStore } from '@/store/dataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calculator, TrendingUp, AlertTriangle, BarChart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Plot from 'react-plotly.js';

export function RegressionAnalysis() {
  const {
    parsedData,
    headers,
    dependentVariable,
    independentVariables,
    regressionResult,
    isLoading,
    error,
    setDependentVariable,
    setIndependentVariables,
    runRegression,
    setActiveTab
  } = useDataStore();

  // Auto-run regression when variables change
  useEffect(() => {
    if (dependentVariable && independentVariables.length > 0) {
      runRegression();
    }
  }, [dependentVariable, independentVariables, runRegression]);

  const handleIndependentVariableToggle = (variable: string) => {
    if (independentVariables.includes(variable)) {
      setIndependentVariables(independentVariables.filter(v => v !== variable));
    } else {
      setIndependentVariables([...independentVariables, variable]);
    }
  };

  const formatCoefficient = (coef: number, index: number) => {
    if (index === 0) return `β₀ = ${coef.toFixed(4)} (절편)`;
    return `β${index} = ${coef.toFixed(4)}`;
  };

  const getModelEquation = () => {
    if (!regressionResult || !independentVariables.length) return '';
    
    const { coefficients } = regressionResult;
    let equation = `${dependentVariable} = ${coefficients[0].toFixed(3)}`;
    
    independentVariables.forEach((variable, index) => {
      const coef = coefficients[index + 1];
      const sign = coef >= 0 ? ' + ' : ' - ';
      equation += `${sign}${Math.abs(coef).toFixed(3)} × ${variable}`;
    });
    
    return equation;
  };

  const generateRegressionPlot = () => {
    if (!regressionResult || !parsedData.length) return null;

    const { predictions, residuals } = regressionResult;
    const actualValues = parsedData.map(row => row[dependentVariable]);

    // Actual vs Predicted scatter plot
    const actualVsPredicted = {
      x: predictions,
      y: actualValues,
      mode: 'markers',
      type: 'scatter',
      name: 'Actual vs Predicted',
      marker: {
        color: '#3B82F6',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Perfect prediction line
    const minVal = Math.min(...predictions, ...actualValues);
    const maxVal = Math.max(...predictions, ...actualValues);
    const perfectLine = {
      x: [minVal, maxVal],
      y: [minVal, maxVal],
      mode: 'lines',
      type: 'scatter',
      name: 'Perfect Prediction',
      line: { color: '#EF4444', dash: 'dash' }
    };

    return [actualVsPredicted, perfectLine];
  };

  const generateResidualPlot = () => {
    if (!regressionResult || !parsedData.length) return null;

    const { predictions, residuals } = regressionResult;

    // Residuals vs Fitted values
    const residualPlot = {
      x: predictions,
      y: residuals,
      mode: 'markers',
      type: 'scatter',
      name: 'Residuals',
      marker: {
        color: '#8B5CF6',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Zero line
    const minPred = Math.min(...predictions);
    const maxPred = Math.max(...predictions);
    const zeroLine = {
      x: [minPred, maxPred],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      name: 'Zero Line',
      line: { color: '#6B7280', dash: 'dash' }
    };

    return [residualPlot, zeroLine];
  };

  const generateQQPlot = () => {
    if (!regressionResult || !parsedData.length) return null;

    const { residuals } = regressionResult;
    const sortedResiduals = [...residuals].sort((a, b) => a - b);
    const n = sortedResiduals.length;
    
    // Calculate theoretical quantiles (normal distribution)
    const theoreticalQuantiles = [];
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) / n;
      // Approximate inverse normal CDF
      const z = Math.sqrt(2) * Math.sqrt(-Math.log(1 - p));
      theoreticalQuantiles.push(z);
    }

    // Q-Q Plot
    const qqPlot = {
      x: theoreticalQuantiles,
      y: sortedResiduals,
      mode: 'markers',
      type: 'scatter',
      name: 'Q-Q Plot',
      marker: {
        color: '#10B981',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Perfect normal line
    const minQ = Math.min(...theoreticalQuantiles);
    const maxQ = Math.max(...theoreticalQuantiles);
    const perfectLine = {
      x: [minQ, maxQ],
      y: [minQ, maxQ],
      mode: 'lines',
      type: 'scatter',
      name: 'Perfect Normal',
      line: { color: '#EF4444', dash: 'dash' }
    };

    return [qqPlot, perfectLine];
  };

  const generateCooksDistance = () => {
    if (!regressionResult || !parsedData.length) return null;

    const { residuals, predictions } = regressionResult;
    const n = residuals.length;
    const p = regressionResult.coefficients.length; // including intercept
    
    // Calculate Cook's Distance for each observation
    const cooksDistances = [];
    const mse = regressionResult.mse;
    
    for (let i = 0; i < n; i++) {
      // Simplified Cook's Distance calculation
      const residual = residuals[i];
      const leverage = 1 / n; // Simplified leverage
      const cooksD = (residual * residual * leverage) / (p * mse);
      cooksDistances.push(cooksD);
    }

    // Cook's Distance plot
    const cooksPlot = {
      x: Array.from({ length: n }, (_, i) => i + 1),
      y: cooksDistances,
      mode: 'markers',
      type: 'scatter',
      name: 'Cook\'s Distance',
      marker: {
        color: '#F59E0B',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Threshold line (4/n)
    const threshold = 4 / n;
    const thresholdLine = {
      x: [1, n],
      y: [threshold, threshold],
      mode: 'lines',
      type: 'scatter',
      name: 'Threshold (4/n)',
      line: { color: '#EF4444', dash: 'dash' }
    };

    return [cooksPlot, thresholdLine];
  };

  if (!parsedData.length) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">먼저 데이터를 입력해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Variable Selection */}
      <Card className="data-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            회귀 분석 설정
          </CardTitle>
          <CardDescription>
            종속변수와 독립변수를 선택하여 다중 선형회귀 분석을 수행하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dependent Variable */}
          <div>
            <Label>종속변수 (Y)</Label>
            <Select value={dependentVariable} onValueChange={setDependentVariable}>
              <SelectTrigger>
                <SelectValue placeholder="종속변수 선택" />
              </SelectTrigger>
              <SelectContent>
                {headers.map(header => (
                  <SelectItem key={header} value={header}>{header}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Independent Variables */}
          <div>
            <Label>독립변수들 (X)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
              {headers.filter(h => h !== dependentVariable).map(header => (
                <div key={header} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`var-${header}`}
                    checked={independentVariables.includes(header)}
                    onChange={() => handleIndependentVariableToggle(header)}
                    className="rounded border-border"
                  />
                  <label htmlFor={`var-${header}`} className="text-sm">
                    {header}
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Badge variant="outline">
                선택된 변수: {independentVariables.length}개
              </Badge>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Regression Results */}
      {regressionResult && (
        <>
          {/* Model Summary */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                회귀 분석 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Equation */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-2">회귀 방정식</h4>
                <code className="text-sm bg-background p-2 rounded block">
                  {getModelEquation()}
                </code>
              </div>

              {/* Model Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {regressionResult.rSquared.toFixed(4)}
                  </div>
                  <div className="text-sm text-blue-600">R²</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">
                    {regressionResult.adjustedRSquared.toFixed(4)}
                  </div>
                  <div className="text-sm text-purple-600">Adjusted R²</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {regressionResult.mse.toFixed(4)}
                  </div>
                  <div className="text-sm text-green-600">MSE</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">
                    {parsedData.length}
                  </div>
                  <div className="text-sm text-orange-600">관측값</div>
                </div>
              </div>

              {/* Coefficients Table */}
              <div>
                <h4 className="font-semibold mb-3">회귀 계수 및 통계적 유의성</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">변수</th>
                        <th className="text-right p-2">계수</th>
                        <th className="text-right p-2">표준오차</th>
                        <th className="text-right p-2">t값</th>
                        <th className="text-right p-2">p값</th>
                        <th className="text-right p-2">유의성</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 font-medium">절편</td>
                        <td className="p-2 text-right font-mono">
                          {regressionResult.coefficients[0].toFixed(4)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {regressionResult.standardErrors[0]?.toFixed(4) || 'N/A'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {regressionResult.tValues[0]?.toFixed(3) || 'N/A'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {regressionResult.pValues[0]?.toFixed(4) || 'N/A'}
                        </td>
                        <td className="p-2 text-right">
                          <Badge variant={regressionResult.pValues[0] < 0.05 ? "default" : "secondary"}>
                            {regressionResult.pValues[0] < 0.05 ? '유의함' : '비유의함'}
                          </Badge>
                        </td>
                      </tr>
                      {independentVariables.map((variable, index) => {
                        const coefIndex = index + 1;
                        const pValue = regressionResult.pValues[coefIndex];
                        const isSignificant = pValue < 0.05;
                        return (
                          <tr key={variable} className="border-b">
                            <td className="p-2 font-medium">{variable}</td>
                            <td className="p-2 text-right font-mono">
                              {regressionResult.coefficients[coefIndex].toFixed(4)}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {regressionResult.standardErrors[coefIndex]?.toFixed(4) || 'N/A'}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {regressionResult.tValues[coefIndex]?.toFixed(3) || 'N/A'}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {pValue?.toFixed(4) || 'N/A'}
                            </td>
                            <td className="p-2 text-right">
                              <Badge variant={isSignificant ? "default" : "secondary"}>
                                {isSignificant ? '유의함' : '비유의함'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>• p값 {'<'} 0.05인 경우 통계적으로 유의함 (α = 0.05)</p>
                  <p>• F통계량: {regressionResult.fStatistic.toFixed(4)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diagnostic Plots */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5 text-accent" />
                진단 그래프
              </CardTitle>
              <CardDescription>
                모델의 적합성을 평가하기 위한 진단 그래프입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actual vs Predicted */}
                <div>
                  <h4 className="font-semibold mb-3">실제값 vs 예측값</h4>
                  <div className="h-[400px]">
                    <Plot
                      data={generateRegressionPlot() || []}
                      layout={{
                        title: '',
                        xaxis: { title: '예측값' },
                        yaxis: { title: '실제값' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 50, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>

                {/* Residuals vs Fitted */}
                <div>
                  <h4 className="font-semibold mb-3">잔차 vs 적합값</h4>
                  <div className="h-[400px]">
                    <Plot
                      data={generateResidualPlot() || []}
                      layout={{
                        title: '',
                        xaxis: { title: '적합값' },
                        yaxis: { title: '잔차' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 50, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>

                {/* Q-Q Plot */}
                <div>
                  <h4 className="font-semibold mb-3">Q-Q Plot (정규성 검정)</h4>
                  <div className="h-[400px]">
                    <Plot
                      data={generateQQPlot() || []}
                      layout={{
                        title: '',
                        xaxis: { title: '이론적 분위수' },
                        yaxis: { title: '표본 분위수' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 50, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    점들이 대각선에 가까울수록 잔차가 정규분포를 따름
                  </p>
                </div>

                {/* Cook's Distance */}
                <div>
                  <h4 className="font-semibold mb-3">Cook's Distance (영향점 탐지)</h4>
                  <div className="h-[400px]">
                    <Plot
                      data={generateCooksDistance() || []}
                      layout={{
                        title: '',
                        xaxis: { title: '관측값 번호' },
                        yaxis: { title: 'Cook\'s Distance' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 50, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    빨간선(4/n) 위의 점들은 영향점으로 의심됨
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setActiveTab('diagnostics')}>
                  자세한 진단 보기
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}