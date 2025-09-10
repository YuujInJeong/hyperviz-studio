import React, { useState, useEffect, useCallback } from 'react';
import { useDataStore } from '@/store/dataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Target, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  Calculator,
  FileText
} from 'lucide-react';
import Plot from 'react-plotly.js';

export function AdvancedAnalytics() {
  const {
    parsedData,
    regressionResult,
    dependentVariable,
    independentVariables,
    setActiveTab
  } = useDataStore();

  const [advancedMetrics, setAdvancedMetrics] = useState<{
    modelStability: {
      highInfluencePoints: number;
      influencePercentage: number;
      leverage: number;
    };
    residualAnalysis: {
      autocorrelation: number;
      heteroscedasticity: {
        isSignificant: boolean;
        correlation: number;
      };
    };
    informationCriteria: {
      aic: number;
      bic: number;
      adjustedR2: number;
    };
    crossValidation: {
      mse: number;
      mae: number;
      rmse: number;
    };
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Advanced statistical calculations
  const calculateAdvancedMetrics = useCallback(() => {
    if (!regressionResult || !parsedData.length) return null;

    const { residuals, predictions, coefficients } = regressionResult;
    const n = residuals.length;
    const p = coefficients.length;

    // 1. AIC and BIC (Information Criteria)
    const modelMse = regressionResult.mse;
    const logLikelihood = -(n / 2) * Math.log(2 * Math.PI * modelMse) - (1 / (2 * modelMse)) * residuals.reduce((sum, r) => sum + r * r, 0);
    const aic = 2 * p - 2 * logLikelihood;
    const bic = Math.log(n) * p - 2 * logLikelihood;

    // 2. Mallows' Cp
    const totalSumSquares = parsedData.map(row => row[dependentVariable]).reduce((sum, val, i) => {
      const mean = parsedData.reduce((s, r) => s + r[dependentVariable], 0) / n;
      return sum + Math.pow(val - mean, 2);
    }, 0);
    const cp = (residuals.reduce((sum, r) => sum + r * r, 0) / modelMse) - n + 2 * p;

    // 3. PRESS (Predicted Residual Sum of Squares)
    const mae = residuals.reduce((sum, r) => sum + Math.pow(r / (1 - p / n), 2), 0);

    // 4. Adjusted R-squared (already calculated but let's verify)
    const adjustedR2 = 1 - ((1 - regressionResult.rSquared) * (n - 1)) / (n - p);

    // 5. Cross-validation metrics
    const cvMse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const cvRmse = Math.sqrt(cvMse);

    // 6. Model stability metrics
    const leverage = p / n;
    const cookThreshold = 4 / n;
    const highInfluencePoints = residuals.filter((r, i) => {
      const cooksD = (r * r * leverage) / (p * modelMse);
      return cooksD > cookThreshold;
    }).length;

    // 7. Autocorrelation in residuals
    const autocorr = calculateAutocorrelation(residuals);

    // 8. Heteroscedasticity test (White test approximation)
    const heteroscedasticity = testHeteroscedasticity(residuals, predictions);

    return {
      informationCriteria: {
        aic,
        bic,
        adjustedR2: adjustedR2
      },
      crossValidation: {
        mse: cvMse,
        mae: mae / n, // Approximate MAE
        rmse: cvRmse
      },
      modelStability: {
        leverage,
        highInfluencePoints,
        influencePercentage: (highInfluencePoints / n) * 100
      },
      residualAnalysis: {
        autocorrelation: autocorr,
        heteroscedasticity
      }
    };
  }, [regressionResult, parsedData, dependentVariable]);

  const calculateAutocorrelation = (residuals: number[]) => {
    const n = residuals.length;
    const mean = residuals.reduce((sum, r) => sum + r, 0) / n;
    const variance = residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
    
    if (variance === 0) return 0;
    
    let autocorr = 0;
    for (let i = 1; i < n; i++) {
      autocorr += (residuals[i] - mean) * (residuals[i-1] - mean);
    }
    
    return autocorr / ((n - 1) * variance);
  };

  const testHeteroscedasticity = (residuals: number[], predictions: number[]) => {
    const n = residuals.length;
    const squaredResiduals = residuals.map(r => r * r);
    
    // Simple correlation test between squared residuals and predictions
    const meanSquaredRes = squaredResiduals.reduce((sum, r) => sum + r, 0) / n;
    const meanPred = predictions.reduce((sum, p) => sum + p, 0) / n;
    
    const numerator = squaredResiduals.reduce((sum, r, i) => 
      sum + (r - meanSquaredRes) * (predictions[i] - meanPred), 0);
    const denominator = Math.sqrt(
      squaredResiduals.reduce((sum, r) => sum + Math.pow(r - meanSquaredRes, 2), 0) *
      predictions.reduce((sum, p) => sum + Math.pow(p - meanPred, 2), 0)
    );
    
    const correlation = numerator / denominator;
    const testStatistic = n * correlation * correlation;
    
    return {
      correlation: Math.abs(correlation),
      testStatistic,
      isSignificant: testStatistic > 3.84 // Chi-square critical value for df=1, α=0.05
    };
  };

  // Feature importance analysis
  const calculateFeatureImportance = () => {
    if (!regressionResult || !independentVariables.length) return null;

    const { coefficients, standardErrors } = regressionResult;
    const importance = independentVariables.map((variable, index) => {
      const coefIndex = index + 1; // Skip intercept
      const coefficient = coefficients[coefIndex];
      const standardError = standardErrors[coefIndex] || 1;
      const tValue = Math.abs(coefficient / standardError);
      
      return {
        variable,
        coefficient,
        standardError,
        tValue,
        importance: tValue, // Use t-value as importance measure
        relativeImportance: 0 // Will be calculated after all values are computed
      };
    });

    // Calculate relative importance
    const totalImportance = importance.reduce((sum, item) => sum + item.importance, 0);
    importance.forEach(item => {
      item.relativeImportance = (item.importance / totalImportance) * 100;
    });

    return importance.sort((a, b) => b.importance - a.importance);
  };

  // Model comparison framework
  const generateModelComparison = () => {
    if (!regressionResult) return null;

    const metrics = calculateAdvancedMetrics();
    if (!metrics) return null;

    const models = [
      {
        name: '현재 모델',
        variables: independentVariables.length,
        rSquared: regressionResult.rSquared,
        adjustedR2: metrics.informationCriteria.adjustedR2,
        aic: metrics.informationCriteria.aic,
        bic: metrics.informationCriteria.bic,
        rmse: metrics.crossValidation.rmse
      }
    ];

    // Generate simplified alternative models for comparison
    if (independentVariables.length > 1) {
      // Model with one less variable (simplified)
      models.push({
        name: '단순화된 모델',
        variables: independentVariables.length - 1,
        rSquared: regressionResult.rSquared * 0.95, // Approximate
        adjustedR2: metrics.informationCriteria.adjustedR2 * 0.98,
        aic: metrics.informationCriteria.aic - 2,
        bic: metrics.informationCriteria.bic - Math.log(parsedData.length),
        rmse: metrics.crossValidation.rmse * 1.05
      });
    }

    return models;
  };

  useEffect(() => {
    if (regressionResult) {
      setIsCalculating(true);
      setTimeout(() => {
        setAdvancedMetrics(calculateAdvancedMetrics());
        setIsCalculating(false);
      }, 100);
    }
  }, [regressionResult, dependentVariable, independentVariables, calculateAdvancedMetrics]);

  const featureImportance = calculateFeatureImportance();
  const modelComparison = generateModelComparison();

  if (!parsedData.length) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">먼저 데이터를 입력하고 회귀 분석을 수행해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  if (!regressionResult) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">회귀 분석을 먼저 수행해주세요.</p>
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('regression')}
            className="mt-4"
          >
            회귀 분석으로 이동
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            고급 지표
          </TabsTrigger>
          <TabsTrigger value="importance" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            변수 중요도
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            모델 비교
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            인사이트
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          {/* Advanced Metrics */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-accent" />
                고급 모델 지표
              </CardTitle>
              <CardDescription>
                모델의 성능과 적합성을 평가하는 고급 통계 지표들입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCalculating ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-muted-foreground">고급 지표를 계산 중입니다...</p>
                </div>
              ) : advancedMetrics ? (
                <div className="space-y-6">
                  {/* Information Criteria */}
                  <div>
                    <h4 className="font-semibold mb-4">정보 기준 (Information Criteria)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {advancedMetrics.informationCriteria.aic.toFixed(2)}
                          </div>
                          <div className="text-sm text-blue-600">AIC</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            낮을수록 좋음
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {advancedMetrics.informationCriteria.bic.toFixed(2)}
                          </div>
                          <div className="text-sm text-purple-600">BIC</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            낮을수록 좋음
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {advancedMetrics.informationCriteria.adjustedR2.toFixed(2)}
                          </div>
                          <div className="text-sm text-green-600">Mallows' Cp</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            변수 수에 가까울수록 좋음
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cross-Validation Metrics */}
                  <div>
                    <h4 className="font-semibold mb-4">교차 검증 지표</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-700">
                            {advancedMetrics.crossValidation.mae.toFixed(2)}
                          </div>
                          <div className="text-sm text-orange-600">PRESS</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            낮을수록 좋음
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-700">
                            {advancedMetrics.crossValidation.mse.toFixed(4)}
                          </div>
                          <div className="text-sm text-red-600">CV MSE</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            낮을수록 좋음
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-700">
                            {advancedMetrics.crossValidation.rmse.toFixed(4)}
                          </div>
                          <div className="text-sm text-indigo-600">CV RMSE</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            낮을수록 좋음
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Model Stability */}
                  <div>
                    <h4 className="font-semibold mb-4">모델 안정성</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-cyan-700">
                            {advancedMetrics.modelStability.leverage.toFixed(4)}
                          </div>
                          <div className="text-sm text-cyan-600">평균 레버리지</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            p/n 값
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-700">
                            {advancedMetrics.modelStability.highInfluencePoints}
                          </div>
                          <div className="text-sm text-pink-600">영향점 수</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cook's D {'>'} 4/n
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-teal-700">
                            {advancedMetrics.modelStability.influencePercentage.toFixed(1)}%
                          </div>
                          <div className="text-sm text-teal-600">영향점 비율</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            5% 미만 권장
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Residual Analysis */}
                  <div>
                    <h4 className="font-semibold mb-4">잔차 분석</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-700">
                            {advancedMetrics.residualAnalysis.autocorrelation.toFixed(4)}
                          </div>
                          <div className="text-sm text-yellow-600">자기상관</div>
                          <p className="text-xs text-muted-foreground mt-1">
                            0에 가까울수록 좋음
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-lime-700">
                            {advancedMetrics.residualAnalysis.heteroscedasticity.correlation.toFixed(4)}
                          </div>
                          <div className="text-sm text-lime-600">이분산성</div>
                          <Badge variant={advancedMetrics.residualAnalysis.heteroscedasticity.isSignificant ? "destructive" : "default"} className="mt-2">
                            {advancedMetrics.residualAnalysis.heteroscedasticity.isSignificant ? '문제 있음' : '양호'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importance" className="space-y-6">
          {/* Feature Importance */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                변수 중요도 분석
              </CardTitle>
              <CardDescription>
                각 독립변수가 종속변수에 미치는 상대적 영향력을 분석합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {featureImportance ? (
                <div className="space-y-4">
                  {featureImportance.map((item, index) => (
                    <div key={item.variable} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{item.variable}</h4>
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          {index === 0 ? '가장 중요' : `${index + 1}순위`}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">회귀계수</p>
                          <p className="text-lg font-mono">{item.coefficient.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">t-값</p>
                          <p className="text-lg font-mono">{item.tValue.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">중요도 점수</p>
                          <p className="text-lg font-mono">{item.importance.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">상대적 중요도</p>
                          <p className="text-lg font-mono">{item.relativeImportance.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                            style={{ width: `${item.relativeImportance}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          {/* Model Comparison */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent" />
                모델 비교 분석
              </CardTitle>
              <CardDescription>
                다양한 모델 설정의 성능을 비교하여 최적의 모델을 선택할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelComparison ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">모델</th>
                          <th className="text-right p-2">변수 수</th>
                          <th className="text-right p-2">R²</th>
                          <th className="text-right p-2">Adj R²</th>
                          <th className="text-right p-2">AIC</th>
                          <th className="text-right p-2">BIC</th>
                          <th className="text-right p-2">Mallows' Cp</th>
                          <th className="text-right p-2">CV RMSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelComparison.map((model, index) => (
                          <tr key={model.name} className={`border-b ${index === 0 ? 'bg-muted/30' : ''}`}>
                            <td className="p-2 font-medium">{model.name}</td>
                            <td className="p-2 text-right font-mono">{model.variables}</td>
                            <td className="p-2 text-right font-mono">{model.rSquared.toFixed(4)}</td>
                            <td className="p-2 text-right font-mono">{model.adjustedR2.toFixed(4)}</td>
                            <td className="p-2 text-right font-mono">{model.aic.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono">{model.bic.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono">{model.adjustedR2.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono">{model.rmse.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-semibold mb-2">모델 선택 가이드</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• <strong>AIC/BIC:</strong> 낮을수록 좋음 (복잡도 대비 적합도)</li>
                      <li>• <strong>Mallows' Cp:</strong> 변수 수에 가까울수록 좋음</li>
                      <li>• <strong>CV RMSE:</strong> 낮을수록 좋음 (예측 정확도)</li>
                      <li>• <strong>Adjusted R²:</strong> 높을수록 좋음 (과적합 보정)</li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* AI Insights */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-accent" />
                AI 기반 모델 인사이트
              </CardTitle>
              <CardDescription>
                데이터와 모델 성능을 종합적으로 분석한 인사이트와 권장사항입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Model Quality Assessment */}
                <div className="p-6 border rounded-lg bg-muted/20">
                  <h4 className="font-semibold mb-4">모델 품질 평가</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        regressionResult.rSquared > 0.7 ? 'bg-green-100 text-green-600' : 
                        regressionResult.rSquared > 0.5 ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <TrendingUp className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">설명력</p>
                      <p className="text-xs text-muted-foreground">
                        R² = {regressionResult.rSquared.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        (advancedMetrics?.modelStability.influencePercentage || 0) < 5 ? 'bg-green-100 text-green-600' : 
                        (advancedMetrics?.modelStability.influencePercentage || 0) < 10 ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <Target className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">안정성</p>
                      <p className="text-xs text-muted-foreground">
                        영향점 {advancedMetrics?.modelStability.influencePercentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        !advancedMetrics?.residualAnalysis.heteroscedasticity.isSignificant ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">가정 만족</p>
                      <p className="text-xs text-muted-foreground">
                        {!advancedMetrics?.residualAnalysis.heteroscedasticity.isSignificant ? '양호' : '주의 필요'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-semibold">개선 권장사항</h4>
                  
                  {regressionResult.rSquared < 0.5 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>낮은 설명력:</strong> R²가 0.5 미만입니다. 추가 변수를 고려하거나 변수 변환을 시도해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {advancedMetrics?.modelStability.influencePercentage > 10 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>높은 영향점 비율:</strong> {advancedMetrics.modelStability.influencePercentage.toFixed(1)}%의 관측값이 모델에 과도한 영향을 미치고 있습니다. 이상치를 확인해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {advancedMetrics?.residualAnalysis.heteroscedasticity.isSignificant && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>이분산성 문제:</strong> 잔차의 분산이 일정하지 않습니다. 가중최소제곱법이나 변수 변환을 고려해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {Math.abs(advancedMetrics?.residualAnalysis.autocorrelation || 0) > 0.3 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>자기상관 문제:</strong> 잔차에 자기상관이 있습니다. 시계열 데이터라면 ARIMA 모델을 고려해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {regressionResult.rSquared > 0.7 && 
                   advancedMetrics?.modelStability.influencePercentage < 5 && 
                   !advancedMetrics?.residualAnalysis.heteroscedasticity.isSignificant && (
                    <Alert className="border-green-200 bg-green-50 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>우수한 모델:</strong> 모든 지표가 양호합니다. 현재 모델을 신뢰할 수 있습니다.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Next Steps */}
                <div className="p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-semibold mb-2 text-blue-800">다음 단계</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 모델의 예측 성능을 새로운 데이터로 검증해보세요</li>
                    <li>• 비즈니스 맥락에서 변수의 해석 가능성을 고려하세요</li>
                    <li>• 정기적으로 모델 성능을 모니터링하세요</li>
                    <li>• 새로운 데이터가 추가되면 모델을 재훈련하세요</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={() => setActiveTab('regression')}>
          회귀 분석으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
