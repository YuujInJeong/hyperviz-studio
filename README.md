# DataViz Pro

다차원 데이터 시각화 및 회귀 분석을 위한 웹 애플리케이션입니다.

## 주요 기능

- **다차원 데이터 시각화**: 최대 4차원까지 직접 시각화, 5차원 이상은 슬라이더로 동적 제어
- **고급 회귀 분석**: 다중 선형회귀, R², 진단 그래프 등 전문적인 통계 분석
- **완전한 프라이버시**: 모든 처리가 브라우저에서 이루어져 데이터가 서버로 전송되지 않음
- **최대 100개 데이터 포인트** 지원

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS
- **데이터 처리**: ml-matrix, simple-statistics, papaparse
- **시각화**: Plotly.js, Recharts
- **상태 관리**: Zustand

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── ui/             # shadcn/ui 컴포넌트
│   ├── DataInput.tsx   # 데이터 입력 컴포넌트
│   ├── VisualizationPanel.tsx  # 시각화 패널
│   └── RegressionAnalysis.tsx  # 회귀 분석 컴포넌트
├── pages/              # 페이지 컴포넌트
├── store/              # Zustand 상태 관리
├── hooks/              # 커스텀 훅
└── lib/                # 유틸리티 함수
```

## 사용법

1. **데이터 입력**: CSV 파일을 업로드하거나 샘플 데이터를 생성
2. **시각화**: 다차원 데이터를 3D/2D로 시각화하고 슬라이더로 차원 제어
3. **회귀 분석**: 선형회귀 모델을 구축하고 통계적 진단 수행
4. **진단**: 모델의 적합성과 가정 검증 (개발 중)

## 라이선스

MIT License

## 기여하기

이슈나 풀 리퀘스트를 환영합니다. 프로젝트에 기여하고 싶으시다면 GitHub에서 이슈를 생성해주세요.