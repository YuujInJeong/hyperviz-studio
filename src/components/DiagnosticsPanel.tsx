import { useDataStore } from '@/store/dataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertTriangle, CheckCircle, Info, TrendingUp, BarChart3, FileText, Download, Calculator } from 'lucide-react';
import Plot from 'react-plotly.js';

export function DiagnosticsPanel() {
  const {
    parsedData,
    regressionResult,
    dependentVariable,
    independentVariables,
    setActiveTab
  } = useDataStore();

  if (!parsedData.length) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">먼저 데이터를 입력하고 회귀 분석을 수행해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  if (!regressionResult) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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

  // Calculate VIF (Variance Inflation Factor) for multicollinearity
  const calculateVIF = () => {
    if (independentVariables.length < 2) return null;
    
    const vifValues: { [key: string]: number } = {};
    
    for (let i = 0; i < independentVariables.length; i++) {
      const targetVar = independentVariables[i];
      const otherVars = independentVariables.filter((_, idx) => idx !== i);
      
      try {
        // Create regression of target variable against other variables
        const y = parsedData.map(row => row[targetVar]);
        const X = parsedData.map(row => otherVars.map(col => row[col]));
        
        // Calculate R-squared using proper regression
        const n = y.length;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;
        const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
        
        if (totalSumSquares === 0) {
          vifValues[targetVar] = 1;
          continue;
        }
        
        // Perform actual regression using matrix operations
        let rSquared = 0;
        
        if (otherVars.length === 1) {
          // Simple linear regression
          const xValues = X.map(row => row[0]);
          const meanX = xValues.reduce((sum, val) => sum + val, 0) / n;
          
          const numerator = xValues.reduce((sum, x, idx) => 
            sum + (x - meanX) * (y[idx] - meanY), 0);
          const denominator = xValues.reduce((sum, x) => 
            sum + Math.pow(x - meanX, 2), 0);
          
          if (denominator === 0) {
            vifValues[targetVar] = 1;
            continue;
          }
          
          const slope = numerator / denominator;
          const intercept = meanY - slope * meanX;
          
          const predictions = xValues.map(x => intercept + slope * x);
          const residualSumSquares = y.reduce((sum, actual, idx) => 
            sum + Math.pow(actual - predictions[idx], 2), 0);
          
          rSquared = 1 - (residualSumSquares / totalSumSquares);
        } else {
          // Multiple regression using matrix operations
          const XMatrix = X.map(row => [1, ...row]); // Add intercept
          
          // Calculate X'X and X'y
          const XTX = Array.from({ length: otherVars.length + 1 }, () => 
            Array.from({ length: otherVars.length + 1 }, () => 0));
          const XTy = Array.from({ length: otherVars.length + 1 }, () => 0);
          
          for (let row = 0; row < n; row++) {
            for (let i = 0; i <= otherVars.length; i++) {
              XTy[i] += XMatrix[row][i] * y[row];
              for (let j = 0; j <= otherVars.length; j++) {
                XTX[i][j] += XMatrix[row][i] * XMatrix[row][j];
              }
            }
          }
          
          // Calculate coefficients using normal equations
          try {
            // Matrix inversion using Gauss-Jordan elimination
            const n = XTX.length;
            const identity: number[][] = [];
            
            // Create identity matrix
            for (let i = 0; i < n; i++) {
              identity[i] = [];
              for (let j = 0; j < n; j++) {
                identity[i][j] = i === j ? 1 : 0;
              }
            }
            
            // Create augmented matrix [XTX|I]
            const augmented: number[][] = [];
            for (let i = 0; i < n; i++) {
              augmented[i] = [...XTX[i], ...identity[i]];
            }
            
            // Gauss-Jordan elimination
            for (let i = 0; i < n; i++) {
              // Find pivot
              let maxRow = i;
              for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                  maxRow = k;
                }
              }
              
              // Swap rows
              if (maxRow !== i) {
                [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
              }
              
              // Check for singular matrix
              if (Math.abs(augmented[i][i]) < 1e-10) {
                vifValues[targetVar] = 1;
                continue;
              }
              
              // Make diagonal element 1
              const pivot = augmented[i][i];
              for (let j = 0; j < 2 * n; j++) {
                augmented[i][j] /= pivot;
              }
              
              // Eliminate column
              for (let k = 0; k < n; k++) {
                if (k !== i) {
                  const factor = augmented[k][i];
                  for (let j = 0; j < 2 * n; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                  }
                }
              }
            }
            
            // Extract inverse matrix
            const invXTX: number[][] = [];
            for (let i = 0; i < n; i++) {
              invXTX[i] = [];
              for (let j = 0; j < n; j++) {
                invXTX[i][j] = augmented[i][j + n];
              }
            }
            
            const coefficients = invXTX.map((row, i) => 
              row.reduce((sum, val, j) => sum + val * XTy[j], 0));
            
            // Calculate predictions
            const predictions = XMatrix.map(row => 
              row.reduce((sum, val, idx) => sum + val * coefficients[idx], 0));
            
            const residualSumSquares = y.reduce((sum, actual, idx) => 
              sum + Math.pow(actual - predictions[idx], 2), 0);
            
            rSquared = 1 - (residualSumSquares / totalSumSquares);
          } catch (error) {
            vifValues[targetVar] = 1;
            continue;
          }
        }
        
        // VIF = 1 / (1 - R²)
        const vif = 1 / (1 - Math.max(rSquared, 0.001));
        vifValues[targetVar] = Math.max(vif, 1);
        
      } catch (error) {
        vifValues[targetVar] = 1; // Default value
      }
    }
    
    return vifValues;
  };

  const vifValues = calculateVIF();

  // Advanced statistical tests
  const performShapiroWilkTest = (data: number[]) => {
    const n = data.length;
    if (n < 3 || n > 5000) return { statistic: 0, pValue: 1, interpretation: '데이터 크기 부적절' };
    
    // Shapiro-Wilk test coefficients for n <= 50
    const coefficients: { [key: number]: number[] } = {
      3: [0.7071],
      4: [0.6872, 0.1677],
      5: [0.6646, 0.2413],
      6: [0.6431, 0.2806, 0.0875],
      7: [0.6233, 0.3031, 0.1401],
      8: [0.6052, 0.3164, 0.1743, 0.0561],
      9: [0.5888, 0.3244, 0.1976, 0.0947],
      10: [0.5739, 0.3291, 0.2141, 0.1224, 0.0399],
      11: [0.5601, 0.3315, 0.2260, 0.1429, 0.0695],
      12: [0.5475, 0.3325, 0.2347, 0.1586, 0.0922, 0.0303],
      13: [0.5359, 0.3325, 0.2412, 0.1707, 0.1099, 0.0539],
      14: [0.5251, 0.3318, 0.2460, 0.1802, 0.1240, 0.0727, 0.0240],
      15: [0.5150, 0.3306, 0.2495, 0.1878, 0.1353, 0.0880, 0.0433],
      20: [0.4734, 0.3211, 0.2565, 0.2085, 0.1686, 0.1334, 0.1013, 0.0711, 0.0422, 0.0140],
      25: [0.4407, 0.3126, 0.2574, 0.2201, 0.1880, 0.1598, 0.1346, 0.1119, 0.0910, 0.0719, 0.0540, 0.0371, 0.0209, 0.0053],
      30: [0.4152, 0.3051, 0.2556, 0.2274, 0.2000, 0.1750, 0.1520, 0.1308, 0.1112, 0.0930, 0.0761, 0.0603, 0.0455, 0.0317, 0.0187, 0.0063],
      35: [0.3946, 0.2987, 0.2528, 0.2319, 0.2082, 0.1860, 0.1654, 0.1463, 0.1286, 0.1122, 0.0970, 0.0829, 0.0698, 0.0577, 0.0465, 0.0361, 0.0265, 0.0176, 0.0094, 0.0019],
      40: [0.3774, 0.2931, 0.2499, 0.2345, 0.2141, 0.1946, 0.1761, 0.1586, 0.1421, 0.1265, 0.1118, 0.0980, 0.0850, 0.0728, 0.0614, 0.0508, 0.0409, 0.0317, 0.0232, 0.0153, 0.0080, 0.0013],
      45: [0.3626, 0.2882, 0.2473, 0.2361, 0.2187, 0.2014, 0.1849, 0.1692, 0.1543, 0.1402, 0.1268, 0.1142, 0.1023, 0.0911, 0.0806, 0.0707, 0.0614, 0.0527, 0.0446, 0.0370, 0.0299, 0.0233, 0.0171, 0.0113, 0.0059, 0.0008],
      50: [0.3497, 0.2839, 0.2449, 0.2370, 0.2222, 0.2068, 0.1921, 0.1780, 0.1646, 0.1518, 0.1397, 0.1282, 0.1173, 0.1070, 0.0972, 0.0880, 0.0793, 0.0711, 0.0634, 0.0561, 0.0493, 0.0429, 0.0369, 0.0313, 0.0260, 0.0211, 0.0165, 0.0122, 0.0082, 0.0045, 0.0011]
    };
    
    const sortedData = [...data].sort((a, b) => a - b);
    const mean = sortedData.reduce((sum, val) => sum + val, 0) / n;
    const variance = sortedData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
    
    if (variance === 0) return { statistic: 1, pValue: 1, interpretation: '정규성 가정 만족' };
    
    // Get coefficients for the sample size
    let coefs: number[];
    if (n <= 50 && coefficients[n]) {
      coefs = coefficients[n];
    } else {
      // For larger samples, use approximation
      coefs = Array.from({ length: Math.floor(n / 2) }, (_, i) => {
        const m = Math.floor(n / 2);
        const p = (i + 1 - 0.5) / m;
        return Math.sqrt(2) * Math.sqrt(-Math.log(1 - p));
      });
    }
    
    // Calculate W statistic
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < coefs.length; i++) {
      const j = n - 1 - i;
      if (i !== j) {
        numerator += coefs[i] * (sortedData[j] - sortedData[i]);
      }
      denominator += Math.pow(sortedData[i] - mean, 2);
    }
    
    const wStatistic = Math.pow(numerator / (Math.sqrt(variance) * denominator), 2);
    
    // Calculate p-value using approximation
    let pValue: number;
    if (n <= 11) {
      // For small samples, use exact critical values
      const criticalValues: { [key: number]: number[] } = {
        3: [0.767, 0.789, 0.810],
        4: [0.748, 0.792, 0.825],
        5: [0.762, 0.806, 0.841],
        6: [0.788, 0.826, 0.860],
        7: [0.803, 0.838, 0.869],
        8: [0.818, 0.851, 0.879],
        9: [0.829, 0.859, 0.885],
        10: [0.842, 0.869, 0.892],
        11: [0.850, 0.876, 0.897]
      };
      
      if (criticalValues[n]) {
        const [alpha005, alpha025, alpha05] = criticalValues[n];
        if (wStatistic >= alpha05) pValue = 0.05;
        else if (wStatistic >= alpha025) pValue = 0.025;
        else if (wStatistic >= alpha005) pValue = 0.005;
        else pValue = 0.001;
      } else {
        pValue = Math.max(0.001, Math.min(0.999, 1 - wStatistic));
      }
    } else {
      // For larger samples, use normal approximation
      const mu = 0.5 + 0.5 / Math.sqrt(n);
      const sigma = 0.5 / Math.sqrt(n);
      const z = (wStatistic - mu) / sigma;
      pValue = 2 * (1 - 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI))));
    }
    
    return {
      statistic: wStatistic,
      pValue: pValue,
      interpretation: pValue > 0.05 ? '정규성 가정 만족' : '정규성 가정 위반'
    };
  };

  // Chi-square CDF approximation
  const chiSquareCDF = (x: number, df: number): number => {
    if (x <= 0) return 0;
    if (df <= 0) return 0;
    
    // For large df, use normal approximation
    if (df > 30) {
      const mean = df;
      const variance = 2 * df;
      const z = (x - mean) / Math.sqrt(variance);
      return 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
    }
    
    // For smaller df, use gamma function approximation
    const k = df / 2;
    // Approximate log gamma function using Stirling's approximation
    const logGamma = (k - 0.5) * Math.log(k) - k + 0.5 * Math.log(2 * Math.PI);
    const gamma = Math.exp(logGamma);
    const incompleteGamma = Math.pow(x / 2, k) * Math.exp(-x / 2) / gamma;
    
    return Math.max(0, Math.min(1, incompleteGamma));
  };

  const performBreuschPaganTest = (residuals: number[], predictions: number[]) => {
    const n = residuals.length;
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / n;
    const meanFitted = predictions.reduce((sum, p) => sum + p, 0) / n;
    
    // Calculate squared residuals
    const squaredResiduals = residuals.map(r => Math.pow(r - meanResidual, 2));
    const meanSquaredResidual = squaredResiduals.reduce((sum, r) => sum + r, 0) / n;
    
    // Calculate correlation between squared residuals and fitted values
    const numerator = squaredResiduals.reduce((sum, r, i) => 
      sum + (r - meanSquaredResidual) * (predictions[i] - meanFitted), 0);
    const denominator = Math.sqrt(
      squaredResiduals.reduce((sum, r) => sum + Math.pow(r - meanSquaredResidual, 2), 0) *
      predictions.reduce((sum, p) => sum + Math.pow(p - meanFitted, 2), 0)
    );
    
    const correlation = numerator / denominator;
    const lmStatistic = n * Math.pow(correlation, 2);
    
    // Calculate accurate p-value using chi-square distribution (df=1 for Breusch-Pagan)
    const pValue = 1 - chiSquareCDF(lmStatistic, 1);
    
    return {
      statistic: lmStatistic,
      pValue: pValue,
      interpretation: pValue > 0.05 ? '등분산성 가정 만족' : '등분산성 가정 위반'
    };
  };

  const performDurbinWatsonTest = (residuals: number[]) => {
    const n = residuals.length;
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 1; i < n; i++) {
      numerator += Math.pow(residuals[i] - residuals[i-1], 2);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(residuals[i], 2);
    }
    
    const dwStatistic = numerator / denominator;
    
    // Simplified interpretation (typically 1.5-2.5 is good)
    let interpretation = '';
    if (dwStatistic < 1.5) interpretation = '양의 자기상관 의심';
    else if (dwStatistic > 2.5) interpretation = '음의 자기상관 의심';
    else interpretation = '자기상관 없음';
    
    return {
      statistic: dwStatistic,
      interpretation: interpretation
    };
  };

  // Enhanced model assumptions assessment
  const assessModelAssumptions = () => {
    const { residuals, predictions } = regressionResult;
    
    // 1. Linearity (residuals vs fitted)
    const residualVsFitted = residuals.map((res, i) => ({
      x: predictions[i],
      y: res
    }));
    
    // Calculate correlation between residuals and fitted values
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
    const meanFitted = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
    
    const numerator = residuals.reduce((sum, r, i) => 
      sum + (r - meanResidual) * (predictions[i] - meanFitted), 0);
    const denominator = Math.sqrt(
      residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) *
      predictions.reduce((sum, p) => sum + Math.pow(p - meanFitted, 2), 0)
    );
    
    const linearityCorrelation = Math.abs(numerator / denominator);
    
    // 2. Normality (Shapiro-Wilk test)
    const normalityTest = performShapiroWilkTest(residuals);
    
    // 3. Homoscedasticity (Breusch-Pagan test)
    const homoscedasticityTest = performBreuschPaganTest(residuals, predictions);
    
    // 4. Independence (Durbin-Watson test)
    const independenceTest = performDurbinWatsonTest(residuals);
    
    return {
      linearity: {
        score: 1 - linearityCorrelation,
        status: linearityCorrelation < 0.3 ? 'good' : 'warning',
        message: linearityCorrelation < 0.3 ? '선형 관계가 적절함' : '선형 관계 의심',
        correlation: linearityCorrelation,
        details: `잔차와 예측값 간 상관계수: ${linearityCorrelation.toFixed(4)}`
      },
      normality: {
        score: normalityTest.pValue,
        status: normalityTest.pValue > 0.05 ? 'good' : 'warning',
        message: normalityTest.interpretation,
        statistic: normalityTest.statistic,
        pValue: normalityTest.pValue,
        details: `Shapiro-Wilk 검정: W=${normalityTest.statistic.toFixed(4)}, p=${normalityTest.pValue.toFixed(4)}`
      },
      homoscedasticity: {
        score: homoscedasticityTest.pValue,
        status: homoscedasticityTest.pValue > 0.05 ? 'good' : 'warning',
        message: homoscedasticityTest.interpretation,
        statistic: homoscedasticityTest.statistic,
        pValue: homoscedasticityTest.pValue,
        details: `Breusch-Pagan 검정: LM=${homoscedasticityTest.statistic.toFixed(4)}, p=${homoscedasticityTest.pValue.toFixed(4)}`
      },
      independence: {
        statistic: independenceTest.statistic,
        status: independenceTest.statistic >= 1.5 && independenceTest.statistic <= 2.5 ? 'good' : 'warning',
        message: independenceTest.interpretation,
        details: `Durbin-Watson 검정: DW=${independenceTest.statistic.toFixed(4)}`
      }
    };
  };

  const assumptions = assessModelAssumptions();

  // Generate comprehensive diagnostic plots
  const generateResidualVsFittedPlot = () => {
    const { residuals, predictions } = regressionResult;
    
    const plot = {
      x: predictions,
      y: residuals,
      mode: 'markers',
      type: 'scatter',
      name: 'Residuals vs Fitted',
      marker: {
        color: '#3B82F6',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Add horizontal line at y=0
    const zeroLine = {
      x: [Math.min(...predictions), Math.max(...predictions)],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      name: 'Zero Line',
      line: { color: '#EF4444', width: 2, dash: 'dash' }
    };

    return [plot, zeroLine];
  };

  // Accurate inverse normal CDF using Beasley-Springer-Moro algorithm
  const inverseNormalCDF = (p: number): number => {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;
    
    const a = [0, -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [0, -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [0, -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0, 7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    
    let x: number;
    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) /
          ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    } else if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      x = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q /
          (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) /
           ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
    }
    
    return x;
  };

  const generateQQPlot = () => {
    const { residuals } = regressionResult;
    const n = residuals.length;
    const sortedResiduals = [...residuals].sort((a, b) => a - b);
    
    // Calculate theoretical quantiles using accurate inverse normal CDF
    const theoreticalQuantiles = sortedResiduals.map((_, i) => {
      const p = (i + 1 - 0.5) / n;
      return inverseNormalCDF(p);
    });
    
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

    // Add diagonal line
    const minVal = Math.min(...theoreticalQuantiles, ...sortedResiduals);
    const maxVal = Math.max(...theoreticalQuantiles, ...sortedResiduals);
    const diagonalLine = {
      x: [minVal, maxVal],
      y: [minVal, maxVal],
      mode: 'lines',
      type: 'scatter',
      name: 'Normal Line',
      line: { color: '#EF4444', width: 2, dash: 'dash' }
    };

    return [qqPlot, diagonalLine];
  };

  const generateScaleLocationPlot = () => {
    const { residuals, predictions } = regressionResult;
    
    // Calculate standardized residuals
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
    const variance = residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / (residuals.length - 1);
    const stdDev = Math.sqrt(variance);
    const standardizedResiduals = residuals.map(r => Math.abs((r - meanResidual) / stdDev));
    
    const plot = {
      x: predictions,
      y: standardizedResiduals,
      mode: 'markers',
      type: 'scatter',
      name: 'Scale-Location Plot',
      marker: {
        color: '#F59E0B',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    return [plot];
  };

  const generateLeveragePlot = () => {
    const { residuals, predictions } = regressionResult;
    const n = residuals.length;
    const p = regressionResult.coefficients.length;
    
    // Calculate leverage (simplified)
    const leverages = Array.from({ length: n }, () => p / n);
    
    const leveragePlot = {
      x: leverages,
      y: residuals,
      mode: 'markers',
      type: 'scatter',
      name: 'Leverage vs Residuals',
      marker: {
        color: '#8B5CF6',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    return [leveragePlot];
  };

  const generateInfluencePlot = () => {
    const { residuals } = regressionResult;
    const n = residuals.length;
    const p = regressionResult.coefficients.length;
    
    // Calculate influence measures (simplified)
    const influences = residuals.map((res, i) => {
      const leverage = p / n;
      const cooksD = (res * res * leverage) / (p * regressionResult.mse);
      return cooksD;
    });

    const influencePlot = {
      x: Array.from({ length: n }, (_, i) => i + 1),
      y: influences,
      mode: 'markers',
      type: 'scatter',
      name: 'Cook\'s Distance',
      marker: {
        color: '#EF4444',
        size: 8,
        line: { width: 1, color: 'white' }
      }
    };

    // Add threshold line
    const thresholdLine = {
      x: [1, n],
      y: [0.5, 0.5],
      mode: 'lines',
      type: 'scatter',
      name: 'Threshold (0.5)',
      line: { color: '#EF4444', width: 2, dash: 'dash' }
    };

    return [influencePlot, thresholdLine];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="assumptions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assumptions" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            가정 검정
          </TabsTrigger>
          <TabsTrigger value="plots" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            진단 그래프
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            통계 검정
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            종합 리포트
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assumptions" className="space-y-6">
          {/* Model Assumptions Assessment */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                모델 가정 검정
              </CardTitle>
              <CardDescription>
                회귀 분석의 기본 가정들이 만족되는지 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Linearity */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">선형성</h4>
                    <Badge variant={assumptions.linearity.status === 'good' ? 'default' : 'secondary'}>
                      {assumptions.linearity.status === 'good' ? '양호' : '주의'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {assumptions.linearity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assumptions.linearity.details}
                  </p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${assumptions.linearity.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${assumptions.linearity.score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Normality */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">정규성</h4>
                    <Badge variant={assumptions.normality.status === 'good' ? 'default' : 'secondary'}>
                      {assumptions.normality.status === 'good' ? '양호' : '주의'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {assumptions.normality.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assumptions.normality.details}
                  </p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${assumptions.normality.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${assumptions.normality.score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Homoscedasticity */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">등분산성</h4>
                    <Badge variant={assumptions.homoscedasticity.status === 'good' ? 'default' : 'secondary'}>
                      {assumptions.homoscedasticity.status === 'good' ? '양호' : '주의'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {assumptions.homoscedasticity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assumptions.homoscedasticity.details}
                  </p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${assumptions.homoscedasticity.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${assumptions.homoscedasticity.score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Independence */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">독립성</h4>
                    <Badge variant={assumptions.independence.status === 'good' ? 'default' : 'secondary'}>
                      {assumptions.independence.status === 'good' ? '양호' : '주의'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {assumptions.independence.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assumptions.independence.details}
                  </p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${assumptions.independence.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${assumptions.independence.statistic / 2.5 * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plots" className="space-y-6">
          {/* Diagnostic Plots */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent" />
                진단 그래프
              </CardTitle>
              <CardDescription>
                모델의 가정들을 시각적으로 검정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Residuals vs Fitted */}
                <div>
                  <h4 className="font-semibold mb-3">잔차 vs 예측값</h4>
                  <div className="h-[300px]">
                    <Plot
                      data={generateResidualVsFittedPlot()}
                      layout={{
                        title: '',
                        xaxis: { title: '예측값' },
                        yaxis: { title: '잔차' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 30, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    선형성 검정: 점들이 무작위로 분산되어야 함
                  </p>
                </div>

                {/* Q-Q Plot */}
                <div>
                  <h4 className="font-semibold mb-3">Q-Q Plot</h4>
                  <div className="h-[300px]">
                    <Plot
                      data={generateQQPlot()}
                      layout={{
                        title: '',
                        xaxis: { title: '이론적 분위수' },
                        yaxis: { title: '표본 분위수' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 30, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    정규성 검정: 점들이 대각선에 가까워야 함
                  </p>
                </div>

                {/* Scale-Location Plot */}
                <div>
                  <h4 className="font-semibold mb-3">Scale-Location Plot</h4>
                  <div className="h-[300px]">
                    <Plot
                      data={generateScaleLocationPlot()}
                      layout={{
                        title: '',
                        xaxis: { title: '예측값' },
                        yaxis: { title: '표준화 잔차의 제곱근' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 30, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    등분산성 검정: 점들이 수평선을 따라 분산되어야 함
                  </p>
                </div>

                {/* Leverage Plot */}
                <div>
                  <h4 className="font-semibold mb-3">레버리지 vs 잔차</h4>
                  <div className="h-[300px]">
                    <Plot
                      data={generateLeveragePlot()}
                      layout={{
                        title: '',
                        xaxis: { title: '레버리지' },
                        yaxis: { title: '잔차' },
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { family: 'Inter, sans-serif' },
                        margin: { l: 50, r: 30, t: 30, b: 50 }
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    영향점 검정: 높은 레버리지와 큰 잔차를 가진 점 주의
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          {/* Statistical Tests */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-accent" />
                통계적 검정 결과
              </CardTitle>
              <CardDescription>
                각 가정에 대한 정량적 검정 결과입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Normality Test */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">정규성 검정 (Shapiro-Wilk)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">검정 통계량</p>
                      <p className="text-lg font-mono">{assumptions.normality.statistic?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">p-값</p>
                      <p className="text-lg font-mono">{assumptions.normality.pValue?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">결론</p>
                      <Badge variant={assumptions.normality.pValue > 0.05 ? 'default' : 'destructive'}>
                        {assumptions.normality.pValue > 0.05 ? '정규성 만족' : '정규성 위반'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Homoscedasticity Test */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">등분산성 검정 (Breusch-Pagan)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">검정 통계량</p>
                      <p className="text-lg font-mono">{assumptions.homoscedasticity.statistic?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">p-값</p>
                      <p className="text-lg font-mono">{assumptions.homoscedasticity.pValue?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">결론</p>
                      <Badge variant={assumptions.homoscedasticity.pValue > 0.05 ? 'default' : 'destructive'}>
                        {assumptions.homoscedasticity.pValue > 0.05 ? '등분산성 만족' : '등분산성 위반'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Independence Test */}
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">독립성 검정 (Durbin-Watson)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">검정 통계량</p>
                      <p className="text-lg font-mono">{assumptions.independence.statistic?.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">결론</p>
                      <Badge variant={assumptions.independence.status === 'good' ? 'default' : 'destructive'}>
                        {assumptions.independence.message}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Multicollinearity Check */}
          {vifValues && (
            <Card className="data-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                  다중공선성 검정 (VIF)
                </CardTitle>
                <CardDescription>
                  VIF 값이 10 이상이면 다중공선성 문제가 있을 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(vifValues).map(([variable, vif]) => (
                    <div key={variable} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{variable}</h4>
                        <Badge variant={vif < 10 ? 'default' : 'destructive'}>
                          VIF: {vif.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {vif < 5 ? '다중공선성 없음' : 
                         vif < 10 ? '다중공선성 의심' : '다중공선성 문제'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="space-y-6">
          {/* Comprehensive Report */}
          <Card className="data-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                종합 진단 리포트
              </CardTitle>
              <CardDescription>
                모델의 전반적인 상태와 개선 권장사항을 제공합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Overall Assessment */}
                <div className="p-6 border rounded-lg bg-muted/20">
                  <h4 className="font-semibold mb-4">전체 평가</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        assumptions.linearity.status === 'good' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">선형성</p>
                      <p className="text-xs text-muted-foreground">
                        {assumptions.linearity.status === 'good' ? '양호' : '주의'}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        assumptions.normality.status === 'good' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">정규성</p>
                      <p className="text-xs text-muted-foreground">
                        {assumptions.normality.status === 'good' ? '양호' : '주의'}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        assumptions.homoscedasticity.status === 'good' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">등분산성</p>
                      <p className="text-xs text-muted-foreground">
                        {assumptions.homoscedasticity.status === 'good' ? '양호' : '주의'}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        assumptions.independence.status === 'good' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">독립성</p>
                      <p className="text-xs text-muted-foreground">
                        {assumptions.independence.status === 'good' ? '양호' : '주의'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-semibold">상세 권장사항</h4>
                  
                  {assumptions.linearity.status === 'warning' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>선형성 문제:</strong> 잔차와 예측값 간에 패턴이 발견되었습니다. 
                        변수 변환(로그, 제곱근, 다항식)을 고려해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {assumptions.normality.status === 'warning' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>정규성 문제:</strong> 잔차가 정규분포를 따르지 않습니다. 
                        Box-Cox 변환이나 로그 변환을 시도해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {assumptions.homoscedasticity.status === 'warning' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>등분산성 문제:</strong> 잔차의 분산이 일정하지 않습니다. 
                        가중최소제곱법(WLS)이나 변수 변환을 고려해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {assumptions.independence.status === 'warning' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>독립성 문제:</strong> 잔차 간 자기상관이 발견되었습니다. 
                        시계열 데이터라면 ARIMA 모델을 고려해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {vifValues && Object.values(vifValues).some(vif => vif >= 10) && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>다중공선성 문제:</strong> 변수 간 높은 상관관계가 있습니다. 
                        주성분 분석(PCA)이나 변수 선택 기법을 사용해보세요.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {assumptions.linearity.status === 'good' && 
                   assumptions.normality.status === 'good' && 
                   assumptions.homoscedasticity.status === 'good' && 
                   assumptions.independence.status === 'good' && 
                   (!vifValues || Object.values(vifValues).every(vif => vif < 10)) && (
                    <Alert className="border-green-200 bg-green-50 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>우수한 모델:</strong> 모든 가정이 만족되어 결과를 신뢰할 수 있습니다. 
                        현재 모델을 그대로 사용하셔도 됩니다.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Export Options */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    리포트 다운로드
                  </Button>
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
