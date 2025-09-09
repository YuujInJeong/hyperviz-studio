import { useEffect, useState } from 'react';
import { useDataStore } from '@/store/dataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { BarChart3, Layers, Eye, Settings2 } from 'lucide-react';
import Plot from 'react-plotly.js';

interface SliderControl {
  variable: string;
  value: number;
  min: number;
  max: number;
}

export function VisualizationPanel() {
  const { 
    parsedData, 
    headers, 
    visualizationMapping, 
    setVisualizationMapping,
    setActiveTab 
  } = useDataStore();

  const [sliderControls, setSliderControls] = useState<SliderControl[]>([]);
  const [plotData, setPlotData] = useState<any[]>([]);
  const [layout, setLayout] = useState<any>({});

  // Calculate available dimensions
  const mappedVariables = Object.values(visualizationMapping).filter(Boolean);
  const unmappedVariables = headers.filter(h => !mappedVariables.includes(h));
  const dimensionCount = mappedVariables.length;

  // Initialize slider controls for 5+ dimensions
  useEffect(() => {
    if (dimensionCount >= 5) {
      const extraVariables = unmappedVariables.slice(0, Math.min(3, unmappedVariables.length));
      const controls = extraVariables.map(variable => {
        const values = parsedData.map(d => d[variable]).filter(v => v !== null && v !== undefined);
        const min = Math.min(...values);
        const max = Math.max(...values);
        return {
          variable,
          value: (min + max) / 2,
          min,
          max
        };
      });
      setSliderControls(controls);
    }
  }, [dimensionCount, unmappedVariables, parsedData]);

  // Generate plot based on current configuration
  useEffect(() => {
    if (!parsedData.length) return;

    const { x, y, z, color, size } = visualizationMapping;
    
    // Filter data based on slider values
    let filteredData = parsedData;
    if (sliderControls.length > 0) {
      filteredData = parsedData.filter(row => {
        return sliderControls.every(control => {
          const value = row[control.variable];
          const tolerance = (control.max - control.min) * 0.1; // 10% tolerance
          return Math.abs(value - control.value) <= tolerance;
        });
      });
    }

    if (!x || !y) {
      setPlotData([]);
      return;
    }

    // Prepare data for plotting
    const xData = filteredData.map(d => d[x]);
    const yData = filteredData.map(d => d[y]);
    const zData = z ? filteredData.map(d => d[z]) : undefined;
    const colorData = color ? filteredData.map(d => d[color]) : undefined;
    const sizeData = size ? filteredData.map(d => d[size]) : undefined;

    // Create plot configuration
    if (dimensionCount === 2) {
      // 2D Scatter Plot
      const trace: any = {
        x: xData,
        y: yData,
        mode: 'markers',
        type: 'scatter',
        name: 'Data Points',
        marker: {
          size: sizeData ? sizeData.map(s => Math.max(5, s * 10)) : 8,
          color: colorData || '#3B82F6',
          colorscale: colorData ? 'Viridis' : undefined,
          showscale: !!colorData,
          colorbar: colorData ? { title: color } : undefined,
          line: { width: 1, color: 'white' }
        }
      };

      setPlotData([trace]);
      setLayout({
        title: `${y} vs ${x}`,
        xaxis: { title: x },
        yaxis: { title: y },
        hovermode: 'closest',
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif' }
      });
    } else if (dimensionCount >= 3 && z) {
      // 3D Scatter Plot
      const trace: any = {
        x: xData,
        y: yData,
        z: zData,
        mode: 'markers',
        type: 'scatter3d',
        name: 'Data Points',
        marker: {
          size: sizeData ? sizeData.map(s => Math.max(3, s * 8)) : 5,
          color: colorData || '#3B82F6',
          colorscale: colorData ? 'Viridis' : undefined,
          showscale: !!colorData,
          colorbar: colorData ? { title: color } : undefined,
          line: { width: 1, color: 'white' }
        }
      };

      setPlotData([trace]);
      setLayout({
        title: `3D Visualization: ${x}, ${y}, ${z}`,
        scene: {
          xaxis: { title: x },
          yaxis: { title: y },
          zaxis: { title: z }
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif' }
      });
    }
  }, [visualizationMapping, parsedData, sliderControls]);

  const handleSliderChange = (variable: string, value: number[]) => {
    setSliderControls(prev => 
      prev.map(control => 
        control.variable === variable 
          ? { ...control, value: value[0] }
          : control
      )
    );
  };

  const handleNext = () => {
    setActiveTab('regression');
  };

  const getDimensionBadgeColor = (count: number) => {
    if (count <= 2) return 'bg-green-100 text-green-800';
    if (count <= 4) return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };

  if (!parsedData.length) {
    return (
      <Card className="data-card">
        <CardContent className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">먼저 데이터를 입력해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Variable Mapping */}
      <Card className="data-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            변수 매핑
            <Badge className={getDimensionBadgeColor(dimensionCount)}>
              {dimensionCount}차원
            </Badge>
          </CardTitle>
          <CardDescription>
            시각화할 변수들을 선택하세요. 최대 4차원까지 직접 시각화 가능하며, 5차원 이상은 슬라이더로 제어됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* X Axis */}
            <div>
              <Label>X축</Label>
              <Select 
                value={visualizationMapping.x || ''} 
                onValueChange={(value) => setVisualizationMapping({ x: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="X축 변수 선택" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Y Axis */}
            <div>
              <Label>Y축</Label>
              <Select 
                value={visualizationMapping.y || ''} 
                onValueChange={(value) => setVisualizationMapping({ y: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Y축 변수 선택" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Z Axis */}
            <div>
              <Label>Z축 (선택)</Label>
              <Select 
                value={visualizationMapping.z || 'none'} 
                onValueChange={(value) => setVisualizationMapping({ z: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Z축 변수 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div>
              <Label>색상 (선택)</Label>
              <Select 
                value={visualizationMapping.color || 'none'} 
                onValueChange={(value) => setVisualizationMapping({ color: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="색상 변수 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Size */}
            <div>
              <Label>크기 (선택)</Label>
              <Select 
                value={visualizationMapping.size || 'none'} 
                onValueChange={(value) => setVisualizationMapping({ size: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="크기 변수 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slider Controls for 5+ Dimensions */}
      {sliderControls.length > 0 && (
        <Card className="data-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              추가 차원 제어
            </CardTitle>
            <CardDescription>
              슬라이더를 사용하여 추가 차원의 값을 조절하고 데이터를 필터링하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sliderControls.map(control => (
              <div key={control.variable} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>{control.variable}</Label>
                  <Badge variant="outline">{control.value.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[control.value]}
                  onValueChange={(value) => handleSliderChange(control.variable, value)}
                  min={control.min}
                  max={control.max}
                  step={(control.max - control.min) / 100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{control.min.toFixed(2)}</span>
                  <span>{control.max.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Visualization */}
      {plotData.length > 0 ? (
        <Card className="data-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              데이터 시각화
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px]">
              <Plot
                data={plotData}
                layout={{
                  ...layout,
                  width: undefined,
                  height: 600,
                  autosize: true,
                  margin: { l: 50, r: 50, t: 50, b: 50 }
                }}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  modeBarButtonsToRemove: ['pan2d', 'lasso2d']
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={handleNext}>
                회귀 분석으로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="data-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              데이터 시각화
            </CardTitle>
            <CardDescription>
              시각화할 변수들을 선택해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              X축과 Y축 변수를 선택하면 시각화가 표시됩니다.
            </p>
            <p className="text-sm text-muted-foreground">
              최소 2개 변수를 선택해야 그래프가 표시됩니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}