---
name: sangdong-dashboard
description: 상동고 투수 대시보드 (Dashboard_Pitching_Team) 작업용 skill. 15개 src/js 모듈 체제 (driveline + analytics×3 + render×5 + io×4 + data + reports_init), Driveline Pitching/HP framework, Theia c3d.txt 파싱, build_dashboard.js 워크플로우 표준 패턴. 새 대화에서 작업 이어가거나 카드 추가·수정·검증, 모듈 추가 분리할 때 사용.
---

# 상동고 대시보드 작업 skill (v5.27)

상동고 20명 투수 4회 측정 통합 대시보드 작업을 위한 표준 패턴.

## 0. 대화 시작 시 즉시 할 일

1. **HANDOFF 읽기** (현재 v5.27):
   ```
   Read Dashboard_Pitching_Team/docs/HANDOFF_v5.27.md
   ```
2. **메모리 자동 로드 확인**: 대화 시작 시 `~/memory/MEMORY.md`가 자동 로드됨. Driveline reference 인덱스에 있는지 확인.
3. **필요 시 reference 읽기**:
   - 메카닉 5축 작업: `Read ~/memory/reference_driveline_pitching_report.md`
   - 체력 6축 작업: `Read ~/memory/reference_driveline_hp_assessment.md`
   - **함수 위치 모를 때**: `Read skills/sangdong-dashboard/references/MODULE_MAP.md`
   - **큰 모듈 분리할 때**: `Read skills/sangdong-dashboard/references/SPLIT_WORKFLOW.md`

## 1. 빌드 워크플로우 (절대 잊지 말 것)

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"
node scripts/build_dashboard.js
```

**규칙**:
- ❌ `dashboard.html` 직접 편집 금지 — 반드시 `src/` 편집 후 빌드
- ✅ 모듈 추가는 `scripts/build_dashboard.js`의 `JS_MODULES` 배열에 등록 (의존성 순)
- ✅ 모든 분리 모듈은 글로벌 scope에 `function`/`const`/`let`로 선언 (한 `<script>`에 합쳐짐 → scope 격리 없음)
- ✅ 빌드 후 항상 `bash skills/sangdong-dashboard/scripts/verify_build.sh` 로 무결성 검증

## 2. 현재 모듈 체제 (v5.27 — src/js/ 15개)

| 모듈 | 줄 수 | 역할 |
|---|---|---|
| `driveline.js` | 369 | Driveline 5+6축 framework (DRIVELINE_5_MODELS, DRIVELINE_HP_6_MODELS) |
| `analytics_velocity.js` | 890 | OBP/KR 속도 모델, 4·5·6축 진단, percentile/dualRef |
| `analytics_fitness.js` | 488 | VALD_NORMS, gradeBenchmarks, 통계 헬퍼 |
| `analytics_mechanic.js` | 855 | ELI/GRF/Stuff/Composite + ANALYTICS export |
| `data.js` | 403 | PLAYERS, SESSIONS, genMeasurements |
| `render_m1.js` | 289 | TAB 1 종합 (M1) |
| `render_player.js` | 579 | TAB 2 진입 + renderPlayerView |
| `render_player_cards.js` | 1,134 | v5.14 카드 렌더러 (메카닉/체력/ELI/Action) — 추가 분리 후보 |
| `render_long.js` | 263 | TAB 3 + TAB 4 |
| `render_common.js` | 193 | chartOpts, switchTab, 이벤트, genMeasurementsFor |
| `io_apply.js` | 279 | Theia JSON apply + analytics enrichment |
| `io_c3d.js` | 490 | c3d.txt 파서 + 합성 + JSON zone |
| `io_csv.js` | 390 | VALD/Rapsodo CSV 파서 |
| `io_storage.js` | 89 | localStorage save/load |
| `reports_init.js` | 452 | 리포트 초기화·와이어업 |

상세 함수→모듈 lookup: `references/MODULE_MAP.md`.

## 3. Driveline framework 적용 패턴

### 메카닉 5축 (Pitching Assessment)
- 변인 정의: `driveline.js`의 `DRIVELINE_5_MODELS` 상수
- 모델: Arm Action / Posture / Rotation / Block / CoG
- 점수: 100 = median elite (90+ mph cohort), 150 = ceiling
- Mechanical Ceiling 계산: `analytics_mechanic.js`의 `drivelineMechanicalCeiling`
- 라디아 렌더: `render_player_cards.js`의 `v514_renderMechanicTables` [3-1] 섹션

### 체력 HP 6축 (HP Assessment)
- 변인 정의: `driveline.js`의 `DRIVELINE_HP_6_MODELS` 상수
- 모델: Strength / Rel Strength / Power / Rel Power / Reactive / Upper Body Power
- 점수: 100 = HS group 평균 (Driveline 표준)
- Velo Group cohort: `<80` / `80-85` / `85-90` / `90+` mph 비교 (`drivelineHPVeloGroup`)
- 라디아 렌더: `render_player_cards.js`의 `v516_renderFitnessHexRadar`

### 추가/수정 시 위치 표

| 변경 종류 | 편집 파일 |
|---|---|
| 새 변인 추가 | `driveline.js` (5축 또는 6축 상수에) |
| 진단 점수 로직 | `analytics_mechanic.js` 또는 `analytics_velocity.js` |
| 라디아 시각화 | `render_player_cards.js` |
| HTML 카드 | `src/index.html` |

## 4. Theia c3d.txt parser 패턴

데이터 흐름: `c3d.txt` (Visual3D ASCII) → Python (`scripts/process_pitching_session.py` → `parse_theia_trial`) 또는 JS (`io_c3d.js` → `parseC3DTxtTrial`) → trial dict.

**FC~BR 윈도우 적용 필수** (Theia jerk noise 회피):
- `col_by_name_window()` — FC~BR 구간만 (jerk 노이즈 회피, v5.7+ 표준)
- `col_by_name()` — 전 trial (sparse 데이터, e.g. `stride_length`)

**arm_dps Theia bias**: `Pitching_Humerus_Ang_Vel_Z`에 +490 deg/s 바이어스 → `peak_arm_v = humZ - 490` 후 사용 (검증 완료 v5.8).

**좌표계 (Theia)**:
- X = lateral (측방)
- Y = anterior-posterior (mound 방향) ← `COM_displacement_Y` 사용
- Z = vertical (수직) ← `Pelvis_Ang_Vel_Z`, `FP1_Z` 등

**검증 1-trial**:
```bash
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from process_pitching_session import parse_theia_trial
t = parse_theia_trial('PATH/TO/file.c3d.txt')
print({k:v for k,v in t.items() if k.startswith('cog')})
# 기대: max_cog_velo_m_s ~2.5-3.0 (Driveline median 2.84 비슷)
"
```

## 5. ForceDecks CSV (체력) 파싱 패턴

- **32 컬럼 표준** — CMJ + SJ + Pogo + IMTP + (Plyo Push Up 추가 시 +3 컬럼)
- **28 컬럼 legacy** — Plyo Push Up 컬럼 없음 → graceful 처리
- 데이터 구조: `m.fitness.{cmj,sj,pogo,imtp,pp,eur}`
- 파서 위치: `io_csv.js`의 `importValdCSV`

## 6. 새 카드 추가 표준 절차

1. **HTML 골격**: `src/index.html`에 `<div class="panel">` + DOM ID (예: `id="p-energy-segment-body"`)
2. **렌더 함수**: `render_player_cards.js` 등 적절한 파일에 함수 추가 (DOM 채우기)
3. **데이터 매핑**: `m.energy?.generation?.field_name` 같은 안전한 chaining
4. **renderPlayerView 호출에 추가**: `render_player.js`에 진입점 추가
5. **빌드**: `node scripts/build_dashboard.js`
6. **검증**:
   ```bash
   bash skills/sangdong-dashboard/scripts/verify_build.sh
   grep -c 'id="p-NEW-ID"' dashboard.html  # → 1이면 OK
   ```

## 7. 모듈 분리 표준 절차 (반복 패턴)

큰 모듈 (>1000줄)을 분리할 때는 `references/SPLIT_WORKFLOW.md`의 6단계를 따른다:
1. 함수/배너 grep으로 경계 매핑
2. 사용자 승인 받기 (분리 범위)
3. sed로 분할 + wc -l 합계 일치 검증
4. 원본 `.bak_v5.XX`로 백업
5. JS_MODULES 등록 + 빌드
6. verify_build.sh로 무결성 검증

이번 대화에서 검증된 패턴:
- v5.26: render.js (2,458) → 5개 모듈
- v5.27: analytics.js (2,233) → 3개, io.js (1,248) → 4개

## 8. 사용자 선호 (코딩 초보, 교수)

- 한국어 라벨 + 영문 학술명 병기 ("⚖ 좌우 힘 균형 (Asymmetry)")
- 분석가용 디테일은 `<details>` 폴더로 숨김 (선수/코치는 핵심만)
- "리포트 핵심", "분석가용" 같은 메타 라벨은 `var(--muted)` 색
- 모듈 분리 시 risky한 작업이라 **반드시 사용자 확인 단계 거치기**
- HANDOFF + 메모리 + skill을 매번 갱신해 다음 대화에서 빠르게 복원

## 9. 검증 체크리스트 (모든 작업 종료 전)

- [ ] `node scripts/build_dashboard.js` 정상 실행 (에러 없음)
- [ ] `bash skills/sangdong-dashboard/scripts/verify_build.sh` PASS
- [ ] dashboard.html 크기 450-500KB 범위
- [ ] 새 카드 ID grep `=1` 확인
- [ ] HANDOFF + 메모리 인덱스 갱신 (버전 bump)
- [ ] 브라우저 콘솔 에러 없는지 사용자 확인 요청
