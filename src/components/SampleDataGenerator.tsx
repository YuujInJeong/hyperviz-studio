import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDataStore } from '@/store/dataStore';
import { Sparkles, Download } from 'lucide-react';

export function SampleDataGenerator() {
  const { setRawData, setParsedData } = useDataStore();

  const generateLinearData = () => {
    const data = [];
    const header = 'x,y,z,category';
    data.push(header);
    
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 10;
      const y = 2 * x + Math.random() * 2 + 1;
      const z = x * 0.5 + y * 0.3 + Math.random() * 1;
      const category = Math.floor(Math.random() * 3) + 1;
      data.push(`${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)},${category}`);
    }
    
    const csvData = data.join('\n');
    setRawData(csvData);
    
    // Auto-parse the data
    const rows = data.slice(1).map(row => {
      const [x, y, z, category] = row.split(',').map(Number);
      return { x, y, z, category };
    });
    setParsedData(rows);
  };

  const generateNonLinearData = () => {
    const data = [];
    const header = 'temperature,humidity,pressure,wind_speed,rainfall';
    data.push(header);
    
    for (let i = 0; i < 30; i++) {
      const temp = Math.random() * 40 + 5; // 5-45°C
      const humidity = 50 + Math.random() * 40 + temp * 0.5; // influenced by temperature
      const pressure = 1000 + Math.random() * 50 - temp * 0.3; // inversely related to temp
      const windSpeed = Math.random() * 20 + humidity * 0.1;
      const rainfall = Math.max(0, (humidity - 70) * 0.2 + Math.random() * 5);
      
      data.push(`${temp.toFixed(1)},${humidity.toFixed(1)},${pressure.toFixed(1)},${windSpeed.toFixed(1)},${rainfall.toFixed(1)}`);
    }
    
    const csvData = data.join('\n');
    setRawData(csvData);
    
    // Auto-parse the data
    const rows = data.slice(1).map(row => {
      const [temperature, humidity, pressure, wind_speed, rainfall] = row.split(',').map(Number);
      return { temperature, humidity, pressure, wind_speed, rainfall };
    });
    setParsedData(rows);
  };

  const generateHighDimensionalData = () => {
    const data = [];
    const header = 'var1,var2,var3,var4,var5,var6,var7,target';
    data.push(header);
    
    for (let i = 0; i < 50; i++) {
      const vars = Array.from({ length: 7 }, () => Math.random() * 10);
      const target = vars[0] * 0.5 + vars[1] * 0.3 + vars[2] * 0.1 - vars[3] * 0.2 + Math.random() * 2;
      
      const row = [...vars, target].map(v => v.toFixed(2)).join(',');
      data.push(row);
    }
    
    const csvData = data.join('\n');
    setRawData(csvData);
    
    // Auto-parse the data
    const rows = data.slice(1).map(row => {
      const values = row.split(',').map(Number);
      return {
        var1: values[0],
        var2: values[1],
        var3: values[2],
        var4: values[3],
        var5: values[4],
        var6: values[5],
        var7: values[6],
        target: values[7]
      };
    });
    setParsedData(rows);
  };

  const sampleDatasets = [
    {
      title: '선형 관계 데이터',
      description: '2-3차원 선형 관계를 보여주는 간단한 데이터셋',
      generator: generateLinearData,
      dimensions: '3차원',
      samples: 20
    },
    {
      title: '날씨 데이터 (복합)',
      description: '기온, 습도, 기압 등의 상호 연관된 5차원 날씨 데이터',
      generator: generateNonLinearData,
      dimensions: '5차원',
      samples: 30
    },
    {
      title: '고차원 데이터',
      description: '7개 독립변수와 1개 종속변수를 가진 고차원 데이터셋',
      generator: generateHighDimensionalData,
      dimensions: '8차원',
      samples: 50
    }
  ];

  return (
    <Card className="data-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          샘플 데이터 생성
        </CardTitle>
        <CardDescription>
          빠른 시작을 위한 샘플 데이터셋을 생성하여 기능을 체험해보세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sampleDatasets.map((dataset, index) => (
            <div key={index} className="p-4 border rounded-lg hover:bg-muted/20 transition-colors">
              <h4 className="font-semibold mb-2">{dataset.title}</h4>
              <p className="text-sm text-muted-foreground mb-3">{dataset.description}</p>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {dataset.dimensions}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dataset.samples}개 샘플
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={dataset.generator}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                생성하기
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}