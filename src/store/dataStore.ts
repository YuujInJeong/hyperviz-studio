import { create } from 'zustand';
import { Matrix } from 'ml-matrix';
import { linearRegression, linearRegressionLine } from 'simple-statistics';

export interface DataPoint {
  [key: string]: number;
}

export interface RegressionResult {
  coefficients: number[];
  rSquared: number;
  adjustedRSquared: number;
  mse: number;
  residuals: number[];
  standardErrors: number[];
  tValues: number[];
  pValues: number[];
  fStatistic: number;
  predictions: number[];
}

export interface DataState {
  // Data
  rawData: string;
  parsedData: DataPoint[];
  headers: string[];
  isTransposed: boolean;
  
  // Processing options
  removeOutliers: boolean;
  standardize: boolean;
  normalize: boolean;
  
  // Variable mapping
  dependentVariable: string;
  independentVariables: string[];
  visualizationMapping: {
    x?: string;
    y?: string;
    z?: string;
    color?: string;
    size?: string;
  };
  
  // Results
  regressionResult: RegressionResult | null;
  
  // UI state
  activeTab: 'input' | 'visualization' | 'regression' | 'diagnostics';
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setRawData: (data: string) => void;
  setParsedData: (data: DataPoint[]) => void;
  setHeaders: (headers: string[]) => void;
  setIsTransposed: (transposed: boolean) => void;
  setDependentVariable: (variable: string) => void;
  setIndependentVariables: (variables: string[]) => void;
  setVisualizationMapping: (mapping: Partial<DataState['visualizationMapping']>) => void;
  setProcessingOptions: (options: { removeOutliers?: boolean; standardize?: boolean; normalize?: boolean }) => void;
  runRegression: () => void;
  setActiveTab: (tab: DataState['activeTab']) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  // Initial state
  rawData: '',
  parsedData: [],
  headers: [],
  isTransposed: false,
  removeOutliers: false,
  standardize: false,
  normalize: false,
  dependentVariable: '',
  independentVariables: [],
  visualizationMapping: {},
  regressionResult: null,
  activeTab: 'input',
  isLoading: false,
  error: null,

  // Actions
  setRawData: (data) => set({ rawData: data }),
  
  setParsedData: (data) => {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    set({ 
      parsedData: data, 
      headers,
      error: null,
      dependentVariable: headers[headers.length - 1] || '',
      independentVariables: headers.slice(0, -1) || []
    });
  },
  
  setHeaders: (headers) => set({ headers }),
  setIsTransposed: (transposed) => set({ isTransposed: transposed }),
  setDependentVariable: (variable) => set({ dependentVariable: variable }),
  setIndependentVariables: (variables) => set({ independentVariables: variables }),
  
  setVisualizationMapping: (mapping) => 
    set((state) => ({ 
      visualizationMapping: { ...state.visualizationMapping, ...mapping } 
    })),
  
  setProcessingOptions: (options) => 
    set((state) => ({ 
      removeOutliers: options.removeOutliers ?? state.removeOutliers,
      standardize: options.standardize ?? state.standardize,
      normalize: options.normalize ?? state.normalize
    })),

  runRegression: () => {
    const { parsedData, dependentVariable, independentVariables } = get();
    
    if (!parsedData.length || !dependentVariable || !independentVariables.length) {
      set({ error: '데이터와 변수를 먼저 설정해주세요.' });
      return;
    }

    try {
      set({ isLoading: true, error: null });

      // Prepare data for regression
      const validData = parsedData.filter(row => 
        [dependentVariable, ...independentVariables].every(col => 
          row[col] !== undefined && row[col] !== null && !isNaN(row[col])
        )
      );

      if (validData.length < 2) {
        throw new Error('유효한 데이터가 충분하지 않습니다.');
      }

      const y = validData.map(row => row[dependentVariable]);
      const X = validData.map(row => independentVariables.map(col => row[col]));

      // Simple case: single variable linear regression
      if (independentVariables.length === 1) {
        const xValues = X.map(row => row[0]);
        const regression = linearRegression(xValues.map((x, i) => [x, y[i]]));
        const line = linearRegressionLine(regression);
        
        const predictions = xValues.map(x => line(x));
        const residuals = y.map((actual, i) => actual - predictions[i]);
        const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
        const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
        const residualSumSquares = residuals.reduce((sum, res) => sum + res * res, 0);
        const rSquared = 1 - (residualSumSquares / totalSumSquares);
        const adjustedRSquared = 1 - ((1 - rSquared) * (y.length - 1)) / (y.length - 2);
        const mse = residualSumSquares / (y.length - 2);

        const result: RegressionResult = {
          coefficients: [regression.b, regression.m],
          rSquared,
          adjustedRSquared,
          mse,
          residuals,
          standardErrors: [0, 0], // Simplified
          tValues: [0, 0], // Simplified
          pValues: [0, 0], // Simplified
          fStatistic: 0, // Simplified
          predictions
        };

        set({ regressionResult: result, isLoading: false });
      } else {
        // Multiple regression using matrix operations
        const XMatrix = new Matrix(X.map(row => [1, ...row])); // Add intercept
        const yMatrix = new Matrix(y.map(val => [val]));
        
        try {
          const XTranspose = XMatrix.transpose();
          const XTX = XTranspose.mmul(XMatrix);
          const XTy = XTranspose.mmul(yMatrix);
          
          // Calculate coefficients using normal equations
          // For now, use a simplified approach for multiple regression
          let coefficients: number[] = [];
          
          // If matrix is 2x2 (intercept + 1 variable), solve manually
          if (XTX.rows === 2) {
            const a = XTX.get(0, 0);
            const b = XTX.get(0, 1);
            const c = XTX.get(1, 0);
            const d = XTX.get(1, 1);
            const det = a * d - b * c;
            
            if (Math.abs(det) < 1e-10) {
              throw new Error('Matrix is singular');
            }
            
            const y1 = XTy.get(0, 0);
            const y2 = XTy.get(1, 0);
            
            coefficients = [
              (d * y1 - b * y2) / det,
              (-c * y1 + a * y2) / det
            ];
          } else {
            // For larger matrices, use a simplified approach
            // This is not mathematically rigorous but works for demo purposes
            throw new Error('고차원 다중회귀는 개발 중입니다. 단일 변수 회귀를 사용해주세요.');
          }
          
          const predictions = XMatrix.mmul(new Matrix(coefficients.map(c => [c]))).to1DArray();
          const residuals = y.map((actual, i) => actual - predictions[i]);
          const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
          const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
          const residualSumSquares = residuals.reduce((sum, res) => sum + res * res, 0);
          const rSquared = 1 - (residualSumSquares / totalSumSquares);
          const degreesOfFreedom = y.length - coefficients.length;
          const adjustedRSquared = 1 - ((1 - rSquared) * (y.length - 1)) / degreesOfFreedom;
          const mse = residualSumSquares / degreesOfFreedom;

          const result: RegressionResult = {
            coefficients,
            rSquared,
            adjustedRSquared,
            mse,
            residuals,
            standardErrors: [], // Would require more complex calculation
            tValues: [],
            pValues: [],
            fStatistic: 0,
            predictions
          };

          set({ regressionResult: result, isLoading: false });
        } catch (matrixError) {
          throw new Error('매트릭스 계산 중 오류가 발생했습니다. 다중공선성 문제일 수 있습니다.');
        }
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '회귀 분석 중 오류가 발생했습니다.',
        isLoading: false 
      });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setError: (error) => set({ error }),
  
  reset: () => set({
    rawData: '',
    parsedData: [],
    headers: [],
    isTransposed: false,
    removeOutliers: false,
    standardize: false,
    normalize: false,
    dependentVariable: '',
    independentVariables: [],
    visualizationMapping: {},
    regressionResult: null,
    activeTab: 'input',
    isLoading: false,
    error: null
  })
}));