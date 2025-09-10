import { useEffect, useState, useRef } from 'react';
import { useDataStore } from '@/store/dataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart3, Layers, Eye, Settings2, Play, Pause, HelpCircle, Info } from 'lucide-react';
import Plot from 'react-plotly.js';

interface SliderControl {
  variable: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isPlaying: boolean;
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
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Calculate available dimensions
  const mappedVariables = Object.values(visualizationMapping).filter(Boolean);
  const unmappedVariables = headers.filter(h => !mappedVariables.includes(h));
  const dimensionCount = mappedVariables.length;

  // Initialize slider controls for 4+ dimensions (개선된 로직)
  useEffect(() => {
    // 4차원 이상에서 슬라이더 활성화 (기존 5차원에서 변경)
    if (dimensionCount >= 4) {
      // 매핑되지 않은 변수들 중에서 슬라이더로 제어할 변수 선택
      const maxSliderCount = Math.min(4, unmappedVariables.length); // 최대 4개 슬라이더
      const extraVariables = unmappedVariables.slice(0, maxSliderCount);
      
      const controls = extraVariables.map(variable => {
        const values = parsedData.map(d => d[variable]).filter(v => 
          v !== null && v !== undefined && !isNaN(v) && isFinite(v)
        );
        
        if (values.length === 0) {
          // 빈 데이터 처리
          return {
            variable,
            value: 0,
            min: 0,
            max: 1,
            step: 0.01,
            isPlaying: false
          };
        }
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // 동일한 값들만 있는 경우 처리
        if (min === max) {
          const padding = Math.abs(min) * 0.1 || 1;
          return {
            variable,
            value: min,
            min: min - padding,
            max: max + padding,
            step: padding / 50,
            isPlaying: false
          };
        }
        
        // 데이터 범위에 따른 적절한 스텝 크기 계산
        const range = max - min;
        const step = range / 100; // 100 스텝으로 조정 (너무 세밀하지 않게)
        
        return {
          variable,
          value: (min + max) / 2,
          min,
          max,
          step,
          isPlaying: false
        };
      });
      setSliderControls(controls);
    } else {
      // 4차원 미만일 때는 슬라이더 비활성화
      setSliderControls([]);
    }
  }, [dimensionCount, unmappedVariables, parsedData]);

  // Auto-play animation for sliders
  useEffect(() => {
    if (isAutoPlaying && sliderControls.length > 0) {
      let lastTime = 0;
      const animate = (currentTime: number) => {
        // 60fps로 제한 (약 16ms 간격)
        if (currentTime - lastTime >= 16) {
          setSliderControls(prev => prev.map(control => {
            if (!control.isPlaying) return control;
            
            // 데이터 범위에 따른 애니메이션 속도 조절
            const range = control.max - control.min;
            const speedMultiplier = Math.max(0.5, Math.min(2, range / 10)); // 범위가 클수록 빠르게
            const adjustedStep = control.step * speedMultiplier;
            
            let newValue = control.value + adjustedStep;
            if (newValue > control.max) {
              newValue = control.min;
            }
            return { ...control, value: newValue };
          }));
          lastTime = currentTime;
        }
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAutoPlaying, sliderControls.length]);

  // Generate plot based on current configuration
  useEffect(() => {
    if (!parsedData.length) return;

    const { x, y, z, color, size } = visualizationMapping;
    
    // Filter data based on slider values (개선된 필터링 로직)
    let filteredData = parsedData;
    if (sliderControls.length > 0) {
      // 각 슬라이더별로 필터링 적용
      filteredData = parsedData.filter(row => {
        return sliderControls.every(control => {
          const value = row[control.variable];
          
          // 유효하지 않은 값 처리
          if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
            return false;
          }
          
          // 동적 허용 오차 계산 (데이터 범위와 분산 고려)
          const range = control.max - control.min;
          const dataVariance = parsedData.map(d => d[control.variable])
            .filter(v => !isNaN(v) && isFinite(v))
            .reduce((sum, v, i, arr) => {
              const mean = arr.reduce((s, val) => s + val, 0) / arr.length;
              return sum + Math.pow(v - mean, 2);
            }, 0) / parsedData.length;
          
          const stdDev = Math.sqrt(dataVariance);
          // 허용 오차를 데이터의 표준편차와 범위를 고려하여 계산
          const tolerance = Math.max(
            range * 0.1, // 범위의 10%
            stdDev * 0.5, // 표준편차의 50%
            Math.abs(control.step) * 3 // 스텝의 3배
          );
          
          return Math.abs(value - control.value) <= tolerance;
        });
      });
      
      // 필터링된 데이터가 너무 적으면 허용 오차를 늘려서 재시도
      if (filteredData.length < parsedData.length * 0.05) { // 5% 미만이면
        filteredData = parsedData.filter(row => {
          return sliderControls.every(control => {
            const value = row[control.variable];
            if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
              return false;
            }
            
            const range = control.max - control.min;
            const tolerance = range * 0.2; // 허용 오차를 20%로 늘림
            
            return Math.abs(value - control.value) <= tolerance;
          });
        });
      }
      
      // 그래도 데이터가 너무 적으면 원본 데이터 사용
      if (filteredData.length < parsedData.length * 0.02) { // 2% 미만이면
        filteredData = parsedData;
      }
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

  const toggleSliderPlay = (variable: string) => {
    setSliderControls(prev => 
      prev.map(control => 
        control.variable === variable 
          ? { ...control, isPlaying: !control.isPlaying }
          : control
      )
    );
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  const getDimensionDescription = (variable: string) => {
    const descriptions: { [key: string]: string } = {
      'X축': '가로축으로 표시되는 변수입니다. 데이터의 수평적 분포를 보여줍니다.',
      'Y축': '세로축으로 표시되는 변수입니다. 데이터의 수직적 분포를 보여줍니다.',
      'Z축': '3차원 공간에서 깊이를 나타내는 변수입니다. 입체적인 데이터 분포를 보여줍니다.',
      '색상': '데이터 포인트의 색상으로 표현되는 변수입니다. 값에 따라 색상이 변합니다.',
      '크기': '데이터 포인트의 크기로 표현되는 변수입니다. 값이 클수록 점이 커집니다.'
    };
    return descriptions[variable] || `${variable} 변수입니다.`;
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
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-auto">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>차원별 변수 설명</DialogTitle>
                  <DialogDescription>
                    각 차원이 시각화에서 어떤 역할을 하는지 알아보세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">X축</h4>
                    <p className="text-sm text-muted-foreground">
                      가로축으로 표시되는 변수입니다. 데이터의 수평적 분포를 보여줍니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Y축</h4>
                    <p className="text-sm text-muted-foreground">
                      세로축으로 표시되는 변수입니다. 데이터의 수직적 분포를 보여줍니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Z축</h4>
                    <p className="text-sm text-muted-foreground">
                      3차원 공간에서 깊이를 나타내는 변수입니다. 입체적인 데이터 분포를 보여줍니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">색상</h4>
                    <p className="text-sm text-muted-foreground">
                      데이터 포인트의 색상으로 표현되는 변수입니다. 값에 따라 색상이 변합니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">크기</h4>
                    <p className="text-sm text-muted-foreground">
                      데이터 포인트의 크기로 표현되는 변수입니다. 값이 클수록 점이 커집니다.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>
            시각화할 변수들을 선택하세요. 최대 3차원까지 직접 시각화 가능하며, 4차원 이상은 슬라이더로 제어됩니다.
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
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAutoPlay}
                className="ml-auto"
              >
                {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isAutoPlaying ? '일시정지' : '자동재생'}
              </Button>
            </CardTitle>
            <CardDescription>
              슬라이더를 사용하여 추가 차원의 값을 조절하고 데이터를 필터링하세요. 
              자동재생을 사용하면 차원을 자동으로 탐색할 수 있습니다. (4차원 이상에서 활성화)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sliderControls.map(control => (
              <div key={control.variable} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>{control.variable}</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{control.value.toFixed(2)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSliderPlay(control.variable)}
                      className="h-6 w-6 p-0"
                    >
                      {control.isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[control.value]}
                  onValueChange={(value) => handleSliderChange(control.variable, value)}
                  min={control.min}
                  max={control.max}
                  step={control.step}
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    <Info className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>시각화 창 사용법</DialogTitle>
                    <DialogDescription>
                      현재 표시되는 그래프의 의미와 사용법을 알아보세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">현재 시각화</h4>
                      <p className="text-sm text-muted-foreground">
                        {dimensionCount === 2 
                          ? `2차원 산점도: ${visualizationMapping.x} vs ${visualizationMapping.y}`
                          : dimensionCount >= 3 
                            ? `3차원 산점도: ${visualizationMapping.x}, ${visualizationMapping.y}, ${visualizationMapping.z}`
                            : '차원 정보를 불러오는 중...'
                        }
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">상호작용</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• 마우스로 그래프를 회전, 확대/축소할 수 있습니다</li>
                        <li>• 데이터 포인트에 마우스를 올리면 상세 정보를 볼 수 있습니다</li>
                        <li>• 우측 상단의 도구를 사용해 그래프를 조작할 수 있습니다</li>
                      </ul>
                    </div>
                    {sliderControls.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">추가 차원</h4>
                        <p className="text-sm text-muted-foreground">
                          {sliderControls.map(control => control.variable).join(', ')} 변수들은 
                          슬라이더로 제어되며, 자동재생을 통해 동적으로 탐색할 수 있습니다.
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
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