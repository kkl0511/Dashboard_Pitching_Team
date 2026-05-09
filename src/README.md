# src/ — 대시보드 소스 모듈 (v2.0)

`scripts/build_dashboard.js` 가 이 폴더의 파일을 합성해 `dashboard.html` / `dashboard_mobile.html` 을 생성합니다.

## 파일 구조

```
src/
├── index.html        HTML 골격 (placeholder: <link href="style.css">, <!-- MAIN_SCRIPTS -->)
├── style.css         전체 CSS (377줄)
└── js/
    ├── data.js          데이터 스키마 + 헬퍼 (PLAYERS, SESSIONS, DATA, genMeasurements)
    ├── render.js        탭 1~4 렌더링 + 차트 + 비교 분석
    ├── io.js            Theia JSON · Vald/Rapsodo CSV 파서 + localStorage
    ├── reports_init.js  선수/코치 리포트 + 초기 와이어업 (init)
    ├── svg_chart_stub.js 모바일용 Chart.js 대체 SVG 렌더러
    └── _main.js.legacy  (참고용) 분할 전 단일 파일 백업
```

## 합성 순서 (의존성)

`build_dashboard.js` 의 `JS_MODULES` 배열 순서:

1. **data.js** — 전역 상수·DATA 객체 정의
2. **render.js** — `renderM1KPI`, `renderPlayerView` 등 (data.js 의존)
3. **io.js** — `setupJsonZone`, `importRapsodoCSV`, `loadFromStorage` 등 (render.js 의존)
4. **reports_init.js** — 리포트 함수 + 초기 호출 (모든 위 모듈 의존)

## 빌드

```bash
node scripts/build_dashboard.js
```

출력:
- `dashboard.html` — 데스크탑 (Chart.js CDN)
- `dashboard_mobile.html` — 모바일 (svg_chart_stub.js 인라인)

## 편집 워크플로우

1. `src/js/{module}.js` 또는 `src/style.css` 편집
2. `node scripts/build_dashboard.js` 재실행
3. 브라우저에서 `dashboard.html` 새로고침

## 마이그레이션 메모

- v2.0 이전: `dashboard.html` 직접 편집 (3604줄 단일 파일)
- v2.0~: 모듈 분할 → 빌드 (이 README 의 구조)
- 호환성: `js/data.js` 등 모듈이 없고 `js/main.js` 만 있으면 그것을 사용 (폴백)
