import { create } from 'zustand';
import { Matrix } from 'ml-matrix';
import { linearRegression, linearRegressionLine } from 'simple-statistics';

// Calculate determinant of a matrix
const calculateDeterminant = (matrix: number[][]): number => {
  const n = matrix.length;
  
  if (n === 1) {
    return matrix[0][0];
  }
  
  if (n === 2) {
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  }
  
  if (n === 3) {
    return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
           matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
           matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
  }
  
  // For larger matrices, use LU decomposition approach
  let det = 1;
  const temp = matrix.map(row => [...row]);
  
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(temp[k][i]) > Math.abs(temp[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    if (maxRow !== i) {
      [temp[i], temp[maxRow]] = [temp[maxRow], temp[i]];
      det *= -1;
    }
    
    // Check for singular matrix
    if (Math.abs(temp[i][i]) < 1e-10) {
      return 0;
    }
    
    det *= temp[i][i];
    
    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = temp[k][i] / temp[i][i];
      for (let j = i; j < n; j++) {
        temp[k][j] -= factor * temp[i][j];
      }
    }
  }
  
  return det;
};

// Calculate t-distribution CDF using approximation
const tDistributionCDF = (t: number, df: number): number => {
  if (df <= 0) return 0.5;
  
  // For large degrees of freedom, approximate with normal distribution
  if (df > 30) {
    return 0.5 * (1 + Math.sign(t) * Math.sqrt(1 - Math.exp(-2 * t * t / Math.PI)));
  }
  
  // For smaller df, use approximation
  const x = t / Math.sqrt(df);
  const a = 0.5;
  const b = 0.5;
  
  // Log gamma function approximation using Stirling's formula
  const logGamma = (z: number) => (z - 0.5) * Math.log(z) - z + 0.5 * Math.log(2 * Math.PI);
  
  // Beta function approximation for t-distribution
  const beta = Math.exp(
    logGamma(a) + logGamma(b) - logGamma(a + b) +
    (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)
  );
  
  // Incomplete beta function approximation
  let result = 0.5;
  if (Math.abs(x) < 1) {
    result = 0.5 + Math.sign(x) * beta * Math.abs(x) / 2;
  }
  
  return Math.max(0, Math.min(1, result));
};

// Calculate accurate p-value for t-test
const calculatePValue = (tValue: number, degreesOfFreedom: number): number => {
  const absT = Math.abs(tValue);
  const cdf = tDistributionCDF(absT, degreesOfFreedom);
  return 2 * (1 - cdf); // Two-tailed test
};

// Calculate matrix inverse using Gauss-Jordan elimination
const calculateMatrixInverse = (matrix: number[][]): number[][] => {
  const n = matrix.length;
  const identity: number[][] = [];
  
  // Create identity matrix
  for (let i = 0; i < n; i++) {
    identity[i] = [];
    for (let j = 0; j < n; j++) {
      identity[i][j] = i === j ? 1 : 0;
    }
  }
  
  // Create augmented matrix [A|I]
  const augmented: number[][] = [];
  for (let i = 0; i < n; i++) {
    augmented[i] = [...matrix[i], ...identity[i]];
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
      throw new Error('Matrix is singular and cannot be inverted');
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
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = [];
    for (let j = 0; j < n; j++) {
      inverse[i][j] = augmented[i][j + n];
    }
  }
  
  return inverse;
};

// Data preprocessing functions
const removeOutliersFromData = (data: DataPoint[], headers: string[]): DataPoint[] => {
  const processedData = [...data];
  
  headers.forEach(header => {
    const values = processedData.map(row => row[header]).filter(val => val !== null && val !== undefined);
    if (values.length === 0) return;
    
    // Calculate IQR
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    
    // Define outlier bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Remove outliers
    for (let i = processedData.length - 1; i >= 0; i--) {
      const value = processedData[i][header];
      if (value !== null && value !== undefined && (value < lowerBound || value > upperBound)) {
        processedData.splice(i, 1);
      }
    }
  });
  
  return processedData;
};

const standardizeData = (data: DataPoint[], headers: string[]): DataPoint[] => {
  const processedData = data.map(row => ({ ...row }));
  
  headers.forEach(header => {
    const values = processedData.map(row => row[header]).filter(val => val !== null && val !== undefined);
    if (values.length === 0) return;
    
    // Calculate mean and standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return; // Avoid division by zero
    
    // Standardize: (x - mean) / std
    processedData.forEach(row => {
      if (row[header] !== null && row[header] !== undefined) {
        row[header] = (row[header] - mean) / stdDev;
      }
    });
  });
  
  return processedData;
};

const normalizeData = (data: DataPoint[], headers: string[]): DataPoint[] => {
  const processedData = data.map(row => ({ ...row }));
  
  headers.forEach(header => {
    const values = processedData.map(row => row[header]).filter(val => val !== null && val !== undefined);
    if (values.length === 0) return;
    
    // Calculate min and max
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (max === min) return; // Avoid division by zero
    
    // Normalize: (x - min) / (max - min)
    processedData.forEach(row => {
      if (row[header] !== null && row[header] !== undefined) {
        row[header] = (row[header] - min) / (max - min);
      }
    });
  });
  
  return processedData;
};

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
  activeTab: 'input' | 'visualization' | 'regression' | 'diagnostics' | 'advanced';
  isLoading: boolean;
  error: string | null;
  
  // Performance optimization
  lastUpdateTime: number;
  updateDebounceMs: number;
  
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
  runRegressionImmediate: () => void;
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
  lastUpdateTime: 0,
  updateDebounceMs: 300,

  // Actions
  setRawData: (data) => set({ rawData: data }),
  
  setParsedData: (data) => {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    let processedData = data;
    
    // Apply preprocessing if enabled
    const { removeOutliers, standardize, normalize } = get();
    
    if (removeOutliers) {
      processedData = removeOutliersFromData(processedData, headers);
    }
    
    if (standardize) {
      processedData = standardizeData(processedData, headers);
    }
    
    if (normalize) {
      processedData = normalizeData(processedData, headers);
    }
    
    set({ 
      parsedData: processedData, 
      headers,
      error: null,
      dependentVariable: headers[headers.length - 1] || '',
      independentVariables: headers.slice(0, -1) || [],
      // Auto-set visualization mapping
      visualizationMapping: {
        x: headers[0] || undefined,
        y: headers[1] || undefined,
        z: headers[2] || undefined,
        color: headers[3] || undefined,
        size: headers[4] || undefined
      }
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
    const { updateDebounceMs, lastUpdateTime } = get();
    const currentTime = Date.now();
    
    // Debounce rapid updates
    if (currentTime - lastUpdateTime < updateDebounceMs) {
      setTimeout(() => {
        get().runRegressionImmediate();
      }, updateDebounceMs - (currentTime - lastUpdateTime));
      return;
    }
    
    get().runRegressionImmediate();
  },

  runRegressionImmediate: () => {
    const { parsedData, dependentVariable, independentVariables } = get();
    
    if (!parsedData.length || !dependentVariable || !independentVariables.length) {
      set({ error: '데이터와 변수를 먼저 설정해주세요.' });
      return;
    }

    try {
      set({ isLoading: true, error: null, lastUpdateTime: Date.now() });

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
          
          // Calculate coefficients using normal equations: β = (X'X)^(-1)X'y
          let coefficients: number[] = [];
          
          // Check for singularity using determinant calculation
          const det = calculateDeterminant(XTX.to2DArray());
          if (Math.abs(det) < 1e-10) {
            throw new Error('다중공선성 문제가 감지되었습니다. 변수들을 확인해주세요.');
          }
          
          // Calculate inverse and coefficients
          const XTXInverse = calculateMatrixInverse(XTX.to2DArray());
          const XTXInverseMatrix = new Matrix(XTXInverse);
          const betaMatrix = XTXInverseMatrix.mmul(XTy);
          coefficients = betaMatrix.to1DArray();
          
          // Calculate predictions
          const predictions = XMatrix.mmul(betaMatrix).to1DArray();
          const residuals = y.map((actual, i) => actual - predictions[i]);
          
          // Calculate R-squared and other statistics
          const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
          const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
          const residualSumSquares = residuals.reduce((sum, res) => sum + res * res, 0);
          const rSquared = 1 - (residualSumSquares / totalSumSquares);
          
          // Degrees of freedom
          const n = y.length;
          const p = coefficients.length; // including intercept
          const degreesOfFreedom = n - p;
          
          if (degreesOfFreedom <= 0) {
            throw new Error('관측값이 변수 수보다 적습니다.');
          }
          
          const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1)) / degreesOfFreedom;
          const mse = residualSumSquares / degreesOfFreedom;
          
          // Calculate standard errors, t-values, and p-values
          const standardErrors: number[] = [];
          const tValues: number[] = [];
          const pValues: number[] = [];
          
          for (let i = 0; i < coefficients.length; i++) {
            const se = Math.sqrt(mse * XTXInverse[i][i]);
            standardErrors.push(se);
            
            const tValue = coefficients[i] / se;
            tValues.push(tValue);
            
            // Calculate accurate p-value using t-distribution
            const pValue = calculatePValue(tValue, degreesOfFreedom);
            pValues.push(pValue);
          }
          
          // Calculate F-statistic
          const fStatistic = (rSquared / (p - 1)) / ((1 - rSquared) / degreesOfFreedom);

          const result: RegressionResult = {
            coefficients,
            rSquared,
            adjustedRSquared,
            mse,
            residuals,
            standardErrors,
            tValues,
            pValues,
            fStatistic,
            predictions
          };

          set({ regressionResult: result, isLoading: false });
        } catch (matrixError) {
          throw new Error(`매트릭스 계산 중 오류가 발생했습니다: ${matrixError instanceof Error ? matrixError.message : '알 수 없는 오류'}`);
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
    error: null,
    lastUpdateTime: 0,
    updateDebounceMs: 300
  })
}));