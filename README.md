# Dashboard_Pitching_Team

상동고등학교 야구부 투수 ~20명 통합 대시보드.
바이오모션 베이스볼 랩 (BBL) — 1차/2차 (상반기) + 3차/4차 (하반기) 4회 측정 통합 분석.

## 📦 구성

| 파일 | 용도 | 권장 환경 |
|---|---|---|
| `index.html` | 진입 허브 (모바일/데스크탑 선택) | 모두 |
| `dashboard.html` | 풀 기능 대시보드 (Chart.js) | 데스크탑 |
| `dashboard_mobile.html` | 모바일 데모 (SVG 차트, 외부 의존성 없음) | 스마트폰 |
| `_js_test.html` | JS 동작 진단용 미니 페이지 | 모두 |
| `theia_grf_dashboard_export.js` | Theia+GRF repo에 붙여넣을 JSON 저장 스니펫 | 개발자 |

## 🌐 GitHub Pages

이 repo의 Settings → Pages → Deploy from branch (main / `/` root) 활성화 시,
다음 URL에서 바로 접근 가능:

- 모바일 대시보드: `https://<username>.github.io/Dashboard_Pitching_Team/dashboard_mobile.html`
- 데스크탑 대시보드: `https://<username>.github.io/Dashboard_Pitching_Team/dashboard.html`
- 진입 허브: `https://<username>.github.io/Dashboard_Pitching_Team/`

## 🧭 기능 (v1.12)

### 5개 탭
1. **1차 측정 결과** — KPI · 진행 그리드 · 종합 테이블 · 4분면 산점도 · 5축 히트맵
2. **선수별 1차 리포트** — 5축 라디아 + 키네틱 시퀀스 + 에너지 분석(생성·전달·누수) + 인과 분석 Top 3 + GRF + 체력 보조
3. **데이터 관리** — Theia+GRF JSON 인입 (드래그앤드롭) + 선수 명단 관리
4. **📋 리포트 출력** — 선수별 PDF 일괄 + 코치 종합 리포트
5. **장기 추적** — 상·하반기 비교 분석 + 회차별 추이

### ⚡ 에너지 프레임워크 (1차 측정 헤드라인)
- **출력 (Generation)**: Joint Power Scalar 8개 · Mechanical Energy 3 분절
- **전달 (Transfer)**: ETE % · Speed Gain (P→T, T→A) · Proper Sequence · Lag
- **누수 (ELI 6 zones)**: 시퀀스/X-팩터/앞발블로킹/FC몸통자세/어깨정렬/골반감속
- **결함 인과 분석**: 점수 낮은 zone 3개 → 추정 손실 km/h

### 측정 일정
- 상반기: **1차 Theia+GRF + ForceDecks + Rapsodo** → 2차 Uplift
- 하반기: 3차 Theia+GRF + ForceDecks → 4차 Uplift

## 🔧 데이터 인입

- 단일 선수 또는 배치 JSON 형식 모두 지원
- Theia+GRF 리포트(<https://github.com/kkl0511/Theia_GRF_Pitching_Report>)에서
  `theia_grf_dashboard_export.js` 스니펫으로 JSON 추출 → 대시보드 데이터 관리 탭 드롭
- localStorage 자동 저장 → 새로고침 후에도 유지

## 라이선스 / 출처

국민대학교 바이오메카닉스 연구실 (KMU Biomechanics Lab) 자료용.
작성: Claude Cowork + 이기광 교수 검토 · 2026-05-09

문의: kklee@kookmin.ac.kr
