import { useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, FileText, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SampleDataGenerator } from './SampleDataGenerator';
import Papa from 'papaparse';

export function DataInput() {
  const { 
    rawData, 
    parsedData, 
    headers, 
    isTransposed, 
    removeOutliers,
    standardize,
    normalize,
    error,
    setRawData, 
    setParsedData, 
    setIsTransposed,
    setProcessingOptions,
    setError,
    setActiveTab 
  } = useDataStore();

  const [dragActive, setDragActive] = useState(false);

  const parseData = (data: string) => {
    if (!data.trim()) {
      setError('데이터를 입력해주세요.');
      return;
    }

    try {
      const result = Papa.parse(data.trim(), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim()
      });

      if (result.errors.length > 0) {
        setError(`파싱 오류: ${result.errors[0].message}`);
        return;
      }

      let processedData = result.data as any[];

      // Filter out rows with all null/undefined values
      processedData = processedData.filter(row => 
        Object.values(row).some(val => val !== null && val !== undefined && val !== '')
      );

      if (processedData.length === 0) {
        setError('유효한 데이터가 없습니다.');
        return;
      }

      // Convert string numbers to actual numbers
      processedData = processedData.map(row => {
        const newRow: any = {};
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
            newRow[key] = Number(value);
          } else if (typeof value === 'number') {
            newRow[key] = value;
          } else {
            newRow[key] = null;
          }
        });
        return newRow;
      });

      // Handle transpose
      if (isTransposed) {
        const transposedData: any[] = [];
        const keys = Object.keys(processedData[0]);
        
        keys.forEach(key => {
          const newRow: any = { variable: key };
          processedData.forEach((row, index) => {
            newRow[`value_${index + 1}`] = row[key];
          });
          transposedData.push(newRow);
        });
        
        processedData = transposedData;
      }

      if (processedData.length > 100) {
        setError('데이터는 최대 100개 행까지 지원됩니다.');
        return;
      }

      setParsedData(processedData);
      setError(null);
    } catch (err) {
      setError('데이터 파싱 중 오류가 발생했습니다.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRawData(content);
      parseData(content);
    };
    reader.readAsText(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setRawData(content);
        parseData(content);
      };
      reader.readAsText(file);
    }
  };

  const handleParse = () => {
    parseData(rawData);
  };

  const handleNext = () => {
    if (parsedData.length > 0) {
      setActiveTab('visualization');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sample Data Generator */}
      {parsedData.length === 0 && (
        <SampleDataGenerator />
      )}
      
      <Card className="data-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            데이터 입력
          </CardTitle>
          <CardDescription>
            CSV 형식의 데이터를 붙여넣거나 파일을 업로드하세요. 최대 100개 데이터 포인트까지 지원됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              CSV 파일을 드래그하거나 클릭하여 업로드
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                파일 선택
              </label>
            </Button>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="data-input">또는 데이터를 직접 붙여넣기</Label>
            <Textarea
              id="data-input"
              placeholder="예시:
x,y,z
1.2,2.3,3.4
2.1,3.2,4.3
3.0,4.1,5.2"
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="transpose"
                checked={isTransposed}
                onCheckedChange={setIsTransposed}
              />
              <Label htmlFor="transpose" className="text-sm">
                행과 열 바꾸기 (전치)
              </Label>
            </div>
            
            {/* Data Preprocessing Options */}
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2">데이터 전처리 옵션</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="removeOutliers"
                    checked={removeOutliers}
                    onCheckedChange={(checked) => setProcessingOptions({ removeOutliers: checked })}
                  />
                  <Label htmlFor="removeOutliers" className="text-sm">
                    이상치 제거 (IQR 방법)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="standardize"
                    checked={standardize}
                    onCheckedChange={(checked) => setProcessingOptions({ standardize: checked })}
                  />
                  <Label htmlFor="standardize" className="text-sm">
                    표준화 (평균 0, 표준편차 1)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="normalize"
                    checked={normalize}
                    onCheckedChange={(checked) => setProcessingOptions({ normalize: checked })}
                  />
                  <Label htmlFor="normalize" className="text-sm">
                    정규화 (0-1 범위)
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                전처리 옵션을 변경한 후 데이터를 다시 파싱해주세요.
              </p>
            </div>
          </div>

          {/* Parse Button */}
          <Button onClick={handleParse} className="w-full" disabled={!rawData.trim()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            데이터 파싱
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {parsedData.length > 0 && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <Check className="h-4 w-4" />
              <AlertDescription>
                성공적으로 {parsedData.length}개 행, {headers.length}개 열의 데이터를 파싱했습니다.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Data Preview */}
      {parsedData.length > 0 && (
        <Card className="data-card">
          <CardHeader>
            <CardTitle>데이터 미리보기</CardTitle>
            <CardDescription>
              처음 5개 행을 표시합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {headers.map((header, index) => (
                      <th key={index} className="text-left p-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {headers.map((header, colIndex) => (
                        <td key={colIndex} className="p-2">
                          {row[header]?.toString() || 'N/A'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={handleNext} 
                disabled={parsedData.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                시각화로 이동 →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}