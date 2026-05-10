# HANDOFF — Dashboard v5.40 (2026-05-10)

새 대화창에서 작업 이어가기용 문맥 문서.

---

## 🎯 현재 상태 — 한 줄 요약

> **Dashboard v5.40 완성**: Driveline 5 모델 + 분절간 ETE + GRF framework 으로 옛 4-axis (출력/전달/누수/GRF) 전체 교체. Tab 1·2·4·5 + 인쇄 모드 + Electron 데스크탑 앱 + 다운로드 페이지 + 자동 빌드 모두 통일 완료. **다음 단계 = git push + git tag v5.40**.

---

## 📂 핵심 변경 파일 (v5.40)

### 분석 알고리즘 (server-side)
- `scripts/process_pitching_session.py`
  - **Scap Load 부호 flip** (line 640): Pitching_Shoulder_Angle_X × −1
  - **좌표계 변환**: Counter Rot/Torso Rotation at FP/BR — `90 − lab_z` (lab frame X+ 3루, Y+ 홈)
  - **CoG Decel AE 자동 산출**: `synthesize_player_summary` 끝 — 회귀식 `0.0073 × ball_speed_kmh + 0.269` (KR n=103)

### Driveline 모델
- `src/js/driveline.js`
  - 5 모델 한국어 라벨 (팔동작/자세/회전 속도/앞다리 제동/체중이동)
  - Stride Length 단위 in→cm (median_elite 58→147, per_1mph 5→12.7)
  - `cog_decel_ae` 라벨 — "CoG Decel AE (Above Expected)"

### 렌더링 (client-side)
- `src/js/render_player_cards.js`
  - 5 모델 라벨 한국어
  - **§3-3 동적 마네킹 SVG** (`renderMannequinSvg`) — 본인 데이터 4 transition 색깔 + 7 라벨 + 뒷발 에너지 path
  - 변인 표 음수 차이 → 빨간 변인명 + 행
  - **§3-5 ELI 6 zone 삭제** → 에너지 손실 Top 3 (5 모델 + ETE bottleneck 결합)
  - 처방 매핑 18 변인 + ETE 4 transition

- `src/js/render_m1.js` (Tab 1)
  - 히트맵 4 axis (구속·메카닉·ETE·GRF) — 옛 5 axis 교체
  - 4분면 차트 X=메카닉 / Y=ETE / 점=GRF/LHEI
  - 종합 테이블 컬럼: 5 모델 / ETE / GRF/LHEI / Stuff / 손실↑ — 옛 출력/전달/누수↑ 교체
  - drivelineFiveModelDiagnosis 인라인 산출

- `src/js/reports_init.js` (Tab 4 인쇄)
  - 코치 리포트 헤드라인: 메카닉/ETE/GRF
  - 약점 패턴: 9 카테고리 (5 모델 + 4 ETE transition) Top 3
  - 부록 표: 5 모델 / ETE / GRF/LHEI / 손실↑

- `src/js/electron_bridge.js` (신규)
  - Electron 환경 감지 + IPC (window.bblApp.*)
  - 자동 저장/로드 (AppData JSON)
  - 폴더 import + PDF 일괄 + 백업/복원

- `src/index.html`
  - KPI: Mechanical Ceiling → 메카닉 향상 기대 구속
  - §3-1 footnote: 좌표계 정의 표 (Counter Rot, Forward Tilt, Torso Rotation at FP/BR, Scap Load) + CoG Decel AE 정의
  - §3-5 panel: ELI 영역 → "메카닉 결함 — 에너지 손실 Top 3"
  - Tab 1 종합 테이블 헤더 + 4분면 차트 헤더 갱신
  - Tab 5 비교 지표 옵션: 메카닉/ETE/GRF/손실 추가

### 정적 리포트
- `scripts/build_static_report_html.js`
  - 67 KB · 단일 선수 standalone HTML
  - 동적 마네킹 SVG (renderMannequinSvg) 포함
  - 폴더형 footnote 해석 가이드 (`<details>` 6 섹션)
- `docs/TestPlayer_static_report.html` — 검증 결과

### Electron 데스크탑 앱
- `electron/main.js` — 메인 프로세스 (메뉴 + IPC + 폴더 import + PDF 일괄)
- `electron/preload.js` — Renderer 안전 API 브리지
- `electron/package.json` — electron-builder 설정 (NSIS + portable)
- `electron/build-prep.js` — 빌드 직전 dashboard.html + scripts 자동 복사
- `electron/icon.svg / icon.png / icon-512.png / icon-1024.png` — BBL 로고 (batter + 모션캡쳐 노드)
- `electron/README.md` — 사용법

### 매뉴얼 docx
- `docs/V3D_Export_Manual_상동고_v1.0.docx` (10 페이지) — c3d.txt 후작업 0건 업로드 사양 + Rapsodo 매칭 프로토콜
- `docs/V3D_Manual_상동고_v1.0.docx` (8 페이지) — 측정 + 캘리브레이션 + 변인 산출

### 다운로드 + 배포
- `docs/downloads/index.html` — 다운로드 페이지
- `docs/downloads/INSTALL_GUIDE.md` — Electron 설치 가이드 (한글)
- `docs/downloads/c3d_samples/TestPlayer_10trial_c3d.zip` (6.9 MB)
- `docs/downloads/c3d_samples/TestPlayer_processed_record.json` (4 KB)
- `docs/downloads/c3d_samples/theia_batch_TEST_9trial.json` (4 KB)
- `docs/downloads/rapsodo_samples/rapsodo_TEST_10trial.csv` (1 KB)
- `docs/downloads/rapsodo_samples/rapsodo_1차_2026-05-15.csv` (16 KB)
- `docs/downloads/rapsodo_samples/LYH_P01_Rapsodo_1차.csv` (1 KB)
- `docs/downloads/electron_source/Dashboard_Electron_source_v5.40.zip` (2.5 MB)
- `docs/BBL_Dashboard_연구원전달용.zip` (9.2 MB) — USB/이메일 전달용 단일 패키지

### CI/CD
- `.github/workflows/electron-build.yml`
  - 트리거: tag push (v*) 또는 수동 실행
  - 빌드: Windows .exe (NSIS + portable) → GitHub Releases 자동 업로드

---

## 🚀 다음 단계 (사용자가 진행)

### 즉시 가능 — git push (가장 쉬움)

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

# .git/index.lock 잠겨 있으면 먼저 해제
sudo rm -f .git/index.lock

git add -A
git commit -m "v5.40: Driveline 5 모델 + ETE + GRF 통일 + Electron 데스크탑 앱 + 다운로드 패키지

- Dashboard 전체 framework v5.40 으로 통일 (Tab 1·2·4·5 + 인쇄)
  · 옛 4-axis (출력/전달/누수/GRF) → Driveline 5 모델 + ETE + GRF
  · §3-5 ELI 6 zone 삭제 → 에너지 손실 Top 3
  · §3-3 동적 마네킹 SVG (본인 데이터 4 transition 색깔)
  · 좌표계 정의 + CoG Decel AE 회귀 자동 산출

- Electron 데스크탑 앱 (windows .exe)
  · electron/ 폴더 (main.js + preload.js + icon)
  · GitHub Actions 자동 빌드 (.github/workflows/electron-build.yml)

- 매뉴얼 + 다운로드 페이지
  · V3D Export Manual (후작업 0건 + Rapsodo 매칭) 10 페이지
  · V3D 분석 매뉴얼 (측정·캘리브레이션) 8 페이지
  · docs/downloads/ — c3d/Rapsodo 샘플 + Electron 소스 + 설치 가이드"

git push origin main

# .exe 자동 빌드 트리거
git tag v5.40
git push origin v5.40
# → 약 10분 후 GitHub Releases 페이지에 Setup.exe 자동 등록
```

### URL 확인 (push 1~2분 후)

- 웹 대시보드: https://kkl0511.github.io/Dashboard_Pitching_Team/
- 다운로드 페이지: https://kkl0511.github.io/Dashboard_Pitching_Team/downloads/
- Releases (.exe): https://github.com/kkl0511/Dashboard_Pitching_Team/releases

### 연구원 전달

**옵션 A**: URL 1줄 → `https://kkl0511.github.io/Dashboard_Pitching_Team/downloads/`
**옵션 B**: `docs/BBL_Dashboard_연구원전달용.zip` (9.2 MB) USB/이메일 전달

---

## 📋 미완료 / 선택 작업

### Pending (선택 — 다음 라운드)

1. **코드사이닝 인증서** ($300/년) — SmartScreen 경고 제거
2. **electron-updater** — 자동 업데이트 알림 (next 버전부터)
3. **Mac/Linux 빌드** — 이미 package.json 에 설정 포함, 필요 시 `npm run dist:mac` 실행
4. **Python embedded 통합** — 사용자 PC 에 Python 미설치 시도 폴더 import 자동 처리 (현재는 Python 3.10+ 필요)
5. ~~**태그 6, 10 빈 GRF event 트라이얼** 디버깅 (#65)~~ — **v5.41 해결 (2026-05-11)**

### v5.41 (2026-05-11) — 빈 GRF event trial 처리 수정

**문제 진단** (P01_LYH trial 6, 10):
- Trial 6: Footstrike event 자체 누락, Release event=t=0.00333s (frame 1) 손상
  · 분절 데이터 [1, 1259) ↔ GRF lead block [3891, 4674) — **시간적으로 분리** (다른 motion)
- Trial 10: 동일 event 손상 + lead leg 측정 처음부터 14초간 plate 위 active
  · Block 0 [0, 4186) FP1_Z max=244N (체중 25%, lead foot 가장자리에 살짝 닿은 상태)
  · 진짜 lead strike: Block 1 [5684, 6395) max=1984N
  · 분절 motion (humerus peak frame 1475) ↔ 진짜 GRF 분리

**해결책** (`scripts/process_pitching_session.py`):
1) **Fallback hierarchy 강화** (line ~198-235):
   · 우선순위 1: Visual3D event 정상 → 사용
   · 우선순위 2: humerus peak 기준 (BR 근사 = humerus_peak, FC = peak - 200ms)
   · 우선순위 3: FP1_Z block (motion_peak + min_peak 검증)
2) **`_find_main_active_block` 개선** (line ~445-487):
   · `motion_peak_frame` 인자 — kinematic peak 포함 block 우선
   · `min_peak=440N` (~0.5 BW) — 진짜 strike vs 가장자리 접촉 구분
   · `max_frames=1500` (5s) — standing/setup 제외
3) **Lead block 호출부에 motion_peak 전달** (line ~485)

**검증 결과** (trial 1 vs 6 vs 10):
| 변인 | Trial 1 | Trial 6 | Trial 10 |
|---|---|---|---|
| peak_pelvis_v | 709 | 709 | 774 |
| peak_humerus_v | 4656 | 4704 | 6466 |
| lead_braking_peak_n | 1075 | 1115 | 1120 |
| drive_propulsive_peak_n | 737 | 793 | 704 |
| newtforce_lead_z_peak_n | 2010 | 2033 | 1984 |

**10 trial 통합 record** (`sample_data/theia_TEST_10trial_single.json`, 3893 bytes):
- 9 trial vs 10 trial median 비교: 모든 변인 ±2% 이내 변화
- 가장 큰 변화: time_of_transfer +60ms (5%) — trial 6, 10 추가로 자연 증가
- pelvis_dps 774→771, lead_braking 1154→1134 — Trial 6, 10이 outlier 아님 확인

**신규 파일**:
- `scripts/recompute_test_player_v541.py` — USE_TRIALS = 1~10 (이전 v540은 9 trial만)
- `sample_data/theia_TEST_10trial_single.json` — 10 trial 통합 record

**v5.41 follow-up (선택)** — Trial 3 별도 패턴
- 분절 정상 (pelvis_v=769, hum_v=4632) but GRF 약함 (lead_brk=166, drive_pp=199, time_of_transfer=14750ms)
- v5.40 에서도 동일한 상태였음 (regression 아님)
- 추정: trial 3 은 lead foot strike 위치가 force plate 가장자리/외부, 분절 motion ↔ 강한 GRF block 매칭 실패한 또 다른 패턴
- 다음 라운드에서 진단 가능 (#66)

---

## v5.42 디자인 토큰 (2026-05-11)

`src/style.css` :root 변수 Linear 풍 정비 완료:
- 회색 9단계 추가 (`--gray-50` ~ `--gray-900`, Tailwind neutral 풍)
- accent B 유지 (`#0969da`), `--accent2` → `var(--gray-700)` alias
- 상태 옵션 Y (채도 낮춘 traffic-light): `--good #166534`, `--bad #991b1b`
- score s1~s5 옵션 Y 적용
- shadow 제거 (`--shadow:none`) — panel 1px border 만으로 구분
- protocol-tag.empty hardcode #f6f8fa → var(--panel2)

빌드: `dashboard.html` 563KB ✓

**문서**:
- `docs/DESIGN_PLAYBOOK.md` — Apple/Linear 미니멀 디자인 단계별 가이드 (8 단계)
- `docs/design_samples/KBO_design_comparison.html` — KBO 프로팀용 5종 디자인 비교 인터랙티브

---

## v6.0 KBO Pro Edition (PENDING — 다른 컴퓨터에서 이어 작업)

**선택 결정**:
- **디자인**: E. Driveline+ / MLB Statcast 풍 (네이비 #14213d + 빨강 #e63946 accent + 도넛 + bar)
- **구조**: 같은 repo 안 다른 빌드 타겟 (코드 재사용 극대화)
- **범위**: 일반 프로팁 템플릿 (특정 구단 X, team color 변수만 분리)
- **v1 스코프**: Tab 2 (선수별 리포트) 만 먼저

**파일 구조 (계획)**:
```
src/
├── index.html            (기존 — 상동고)
├── style.css             (기존 — Linear v5.42)
├── index_pro.html        ★ 신규 — KBO Pro 헤더+레이아웃
├── style_pro.css         ★ 신규 — Driveline+ 풍
└── js/
    └── render_player_pro.js  ★ 신규 — Tab 2 전용

scripts/
├── build_dashboard.js        (기존)
└── build_dashboard_pro.js    ★ 신규 (build_dashboard.js 변형)

dashboard_pro.html             ★ 신규 빌드 산출
```

**재사용**: `driveline.js`, `analytics_*.js`, `data.js`, `io_*.js` 그대로 import.

**v1.0 단계별 작업 (총 ~100분)**:
| 단계 | 내용 | 시간 |
|---|---|---|
| 1 | `build_dashboard_pro.js` + `style_pro.css` 토큰 + `index_pro.html` skeleton | 15분 |
| 2 | 도넛 차트 (composite) — Conic-gradient SVG | 10분 |
| 3 | 5 모델 progress bar (gradient 빨강) | 10분 |
| 4 | 변인별 표 (백분위 + 등급 라벨 Elite/Above Avg/Avg/Below/Poor) | 15분 |
| 5 | ETE + GRF 미니 패널 (기존 데이터 결합) | 20분 |
| 6 | 약점 Top 3 + 처방 (`render_player_cards.js` 변환) | 20분 |
| 7 | TestPlayer 데이터 연결 + 빌드 검증 | 10분 |

**시작점 reference**: `docs/design_samples/KBO_design_comparison.html` 의 §E "Driveline+" 섹션 코드 그대로 베이스로 사용 가능.

**핵심 디자인 토큰 (style_pro.css 신규 :root)**:
```css
:root{
  /* Premium Baseball Brand (네이비 + 빨강 accent) */
  --bg:#ffffff;
  --panel:#ffffff;
  --panel2:#f8f9fa;
  --text:#14213d;          /* 진한 네이비 */
  --muted:#6c757d;
  --line:#e0e0e0;
  --accent:#e63946;        /* 강조 빨강 (team color 자리) */
  --accent-soft:#ff6b6b;
  --header-bg:#14213d;     /* 헤더는 다크 네이비 */
  --header-text:#fff;
  /* 등급 색깔 */
  --grade-elite:#00854a;
  --grade-above:#14213d;
  --grade-avg:#6c757d;
  --grade-below:#ca8a04;
  --grade-poor:#e63946;
}
```

**다른 컴퓨터에서 이어가기**:
1. `docs/CONTINUE_ON_OTHER_COMPUTER.md` 따라 setup
2. 새 Claude 대화 첫 메시지:
   ```
   v6.0 KBO Pro Edition 작업 이어서 진행합니다.
   docs/HANDOFF_v5.40.md 의 "v6.0 KBO Pro Edition" 섹션 + 
   docs/design_samples/KBO_design_comparison.html §E 참고해서
   단계 1 (build_dashboard_pro.js + style_pro.css + index_pro.html skeleton) 부터 시작.
   ```

### 알려진 제약

- VM 에서 .exe 빌드 불가 (Windows toolchain 필요) → GitHub Actions 자동 빌드로 해결
- `.git/index.lock` 0바이트 잠금 파일 권한 문제 잔존 — `sudo rm` 필요
- 기존 코드 주석에 "출력·전달·누수" 표현 잔존 (3건, 사용자 미노출)

---

## 🔑 v5.40 framework 요약

### Tab 1 종합 테이블 컬럼 (옛 → 새)

| 옛 (4-axis) | 새 (v5.40) |
|---|---|
| 출력 (Output) | **5 모델** (Driveline 평균) |
| 전달 (Transfer) | **ETE** (분절간 4 transition) |
| 누수↑ (역ELI) | (삭제) |
| LHEI | **GRF/LHEI** |
| Stuff | Stuff (그대로) |
| (없음) | **손실↑** (에너지 손실 Top 3 km/h) |

### 메카닉 4분면 (옛 → 새)

| 축 | 옛 | 새 |
|---|---|---|
| X | 출력 (Generation) | 메카닉 (5 모델 평균) |
| Y | 전달 (Transfer) | 분절간 ETE 종합 |
| 점 크기 | 누수 (역ELI) | GRF/LHEI 부족 |

### 9 약점 카테고리 (코치 리포트 + 마네킹)

5 모델 (mech) + 4 ETE transition:
- 🚀 팔동작 (Arm Action)
- 🛡 자세 (Posture)
- 🔄 회전 속도 (Rotation)
- 🦵 앞다리 제동 (Block)
- 🎯 체중이동 (CoG)
- ① 골반 → 몸통
- ② 몸통 → 위팔
- ③ 위팔 → 아래팔
- ④ 아래팔 → 손

### 산출 함수 (모든 Tab 공통)

| 점수 | 함수 |
|---|---|
| **메카닉 (5 모델)** | `drivelineFiveModelDiagnosis()` 평균 × 100/150 → 0-100 |
| **ETE 종합** | `segmentTransitionETE().overall_score` |
| **에너지 손실** | 5 모델 high-importance 변인의 음의 차이 Top 3 합 (km/h) |
| **CoG Decel AE** | `process_pitching_session.py` synthesize 자동: 실제 − 예측(회귀) |

---

## 📐 핵심 좌표계 정의 (v5.40, 우투수 기준)

| 변인 | 기준점 | 부호 (+/−) | Elite | 산출 |
|---|---|---|---|---|
| Peak Torso Counter Rot | 홈 = 0° | + 오른쪽(3루) / − 왼쪽(홈) | ≈ −38° | `90 − MAX(Trunk_Angle_Z) before FC` |
| Torso Forward Tilt at FP | 수직선 = 0° | + 앞 / − 뒤 | ≈ +4° | `Trunk_Angle_X at FC` (그대로) |
| Torso Rotation at FP/BR | 3루 = 0°, 홈 = 90° | + 열림 / − 닫힘 | FP +2° / BR +111° | `90 − Trunk_Angle_Z at FC/BR` |
| Scap Load at FP | 중립 = 0° | + scap retraction / − protraction | ≈ +51° | `−Pitching_Shoulder_Angle_X at FC` (부호 flip) |
| CoG Decel AE | — | + above expected | ≈ +0.02 | 실제 − `0.0073 × ball_speed_kmh + 0.269` |

---

## 🗂 측정 + Rapsodo 매칭 프로토콜 (v5.40)

매뉴얼 §10 참조 (`docs/V3D_Export_Manual_상동고_v1.0.docx`):

- **20초 간격** 매 throw — 갭 분석 자동 매칭 가능 (운영자 작업 0초)
- **FP1 = 뒷발 (drive)** / **FP2 = 앞발 (lead)** — AMTI 채널 매핑 강제
- **lab frame X+ = 3루 / Y+ = 홈 / Z+ = 위** (Driveline 정의 자동 정합)
- 갭 분류: <30s 정상 / 30~50s Rapsodo 누락 자동 / 50~90s 모호 / >90s 선수 경계
- `measurement_log.csv` 선수당 1줄 (first/last throw_no, 5초 작성)

---

## 🧪 검증 데이터

- TestPlayer (192cm/91kg/140 km/h) 9 trial 합성 (trial 6, 10 제외)
- `sample_data/theia_TEST_9trial_single.json` — 가공된 record JSON
- 마네킹 SVG 본인 결과:
  - ① 골반→몸통: 100점 ✓ (15 ms)
  - ② 몸통→위팔: 100점 ✓ (67 ms)
  - ③ 위팔→아래팔: **79점 △** (1.6 ms — 너무 짧음)
  - ④ 아래팔→손: **79점 △** (−5 ms — 시퀀스 역전)
- CoG Decel AE = +0.468 m/s (실제 1.77 − 예측 1.30)
- Mechanical Ceiling: 5 모델 점수 (94/99/107/103/117) → 156 km/h 잠재 (현재 141.1)

---

## 📦 Electron 빌드 명령 (윈도우 PC 또는 Mac)

```bash
cd "Dashboard_Pitching_Team/electron"
npm install                     # ~5분 (~150 MB)
npm start                       # 로컬 실행 (테스트)
npm run dist:win                # 윈도우 .exe 빌드 (~10분)
# → dist/상동고-투구-리포트-Setup-5.40.0.exe (~80 MB)
# → dist/상동고-투구-리포트-5.40.0.exe (portable)
```

또는 GitHub Actions 자동 빌드:
```bash
git tag v5.40 && git push origin v5.40
# → GitHub Actions 자동 빌드 → Releases 에 .exe 자동 등록
```

---

## 💡 새 대화창에서 시작할 때

새 대화에서 첫 메시지:

> "상동고 투구 리포트 프로젝트 이어서 작업해. `docs/HANDOFF_v5.40.md` 읽어서 현재 상태 파악."

또는 구체적 작업이 있다면:

> "v5.40 dashboard 이어서 — [작업 내용]"

핵심 위치:
- **프로젝트 루트**: `/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/`
- **이 HANDOFF**: `docs/HANDOFF_v5.40.md`
- **이전 HANDOFF**: `docs/HANDOFF_v5.34.md` (참조용)

---

## 🔗 메모리 항목 (Claude 자동 로드)

다음 메모리가 새 대화에서 자동 표시됨 (`MEMORY.md` 통해):

- `user_role.md` — 스포츠과학과 교수, 야구 바이오메카닉스, 코딩 초보
- `project_sangdong_dashboard.md` — 상동고 20명 투수 4회 측정 통합 대시보드
- `feedback_dashboard_workflow.md` — src/ 모듈 + build script · dashboard.html 직접 편집 금지
- `project_manual_v2_and_dashboard_v5.md` — 매뉴얼 v2 + 대시보드 v5.34 (이전)
- `reference_driveline_pitching_report.md` — Driveline 평가 reference
- `reference_sangdong_sampling_rates.md` — Theia 300Hz, AMTI 1200Hz

⚠ `project_manual_v2_and_dashboard_v5.md` 메모리는 v5.34 기준이라 **v5.40 으로 갱신 필요** (다음 대화에서 update).

---

**문의:** kklee@kookmin.ac.kr
**저장소:** https://github.com/kkl0511/Dashboard_Pitching_Team
**버전:** v5.40 · 2026-05-10
