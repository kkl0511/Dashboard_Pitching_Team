---
name: sangdong-dashboard
description: 상동고 투수 대시보드 (Dashboard_Pitching_Team) 작업용 skill. Driveline Pitching/HP framework 적용, Theia c3d.txt 파싱, src/ 모듈 + build_dashboard.js 워크플로우, 메모리 reference 활용 패턴. 새 대화에서 작업 이어가거나, 리포트 카드 추가/수정/검증할 때 사용.
---

# 상동고 대시보드 작업 skill

상동고 20명 투수 4회 측정 통합 대시보드 작업을 위한 표준 패턴.

## 0. 대화 시작 시 즉시 할 일

1. **HANDOFF 읽기**:
   ```
   Read Dashboard_Pitching_Team/docs/HANDOFF_v5.25.md
   ```
2. **메모리 자동 로드 확인**: 대화 시작 시 `~/memory/MEMORY.md`가 자동 로드됨. Driveline reference 파일들이 인덱스에 있는지 확인.
3. **필요 시 reference 읽기**:
   - 메카닉 5축 작업: `Read ~/memory/reference_driveline_pitching_report.md`
   - 체력 6축 작업: `Read ~/memory/reference_driveline_hp_assessment.md`

## 1. 빌드 워크플로우 (절대 잊지 말 것)

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"
node scripts/build_dashboard.js
```

**규칙**:
- ❌ `dashboard.html` 직접 편집 금지 — 반드시 `src/` 편집 후 빌드
- ✅ 모듈 추가는 `scripts/build_dashboard.js`의 `JS_MODULES` 배열에 등록
- ✅ 모든 분리 모듈은 글로벌 scope에 `function`/`const`로 선언 (한 `<script>`에 합쳐짐)
- ✅ 빌드 후 항상 파일 크기 확인 (450-500KB 정상)

## 2. Driveline framework 적용 패턴

### 메카닉 5축 (Pitching Assessment)
- `DRIVELINE_5_MODELS` 상수 (driveline.js)에 metric 정의: `{label, unit, median_elite, per_1mph, importance}`
- 각 모델: Arm Action / Posture / Rotation / Block / CoG
- 점수: 100 = median elite (90+ mph cohort), 150 = ceiling
- Mechanical Ceiling = 측정 구속 + Σ((150 - score) / 5) × weight (mph 환산)

### 체력 HP 6축 (HP Assessment)
- `DRIVELINE_HP_6_MODELS` 상수에 정의: `{label, label_kr, sub, weight, metric_key, unit, velo_group, hs_avg, higher_better}`
- 각 모델: Strength / Rel Strength / Power / Rel Power / Reactive / Upper Body Power
- 점수: 100 = HS group 평균 (Driveline 표준)
- Velo Group cohort: `<80` / `80-85` / `85-90` / `90+` mph (4 cohort 평균과 비교)

### 추가/수정 시 위치
- 변인 정의: `src/js/driveline.js`
- 라디아 렌더: `src/js/render.js`의 `v516_renderFitnessHexRadar` (HP 6축) 또는 `v514_renderMechanicTables`의 [3-1] 섹션 (메카닉 5축)
- HTML 카드: `src/index.html`

## 3. Theia c3d.txt parser 패턴

데이터 흐름: `c3d.txt` (Visual3D ASCII) → `parse_theia_trial()` (Python) 또는 `parseC3DTxtTrial()` (JavaScript) → trial dict.

**FC~BR 윈도우 적용 필수** (Theia jerk noise 회피):
- `col_by_name_window()` — FC~BR 구간만 사용 (jerk 노이즈 회피, v5.7+ 표준)
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

## 4. ForceDecks CSV (체력) 파싱 패턴

- **32 컬럼 표준** — CMJ + SJ + Pogo + IMTP + (Plyo Push Up 추가 시 +3 컬럼: pp_peak_takeoff_force, pp_peak_eccentric_force, pp_asymmetry)
- **28 컬럼 legacy** — Plyo Push Up 컬럼 없음 → graceful 처리
- 데이터 구조: `m.fitness.{cmj,sj,pogo,imtp,pp,eur}`

## 5. 새 카드 추가 표준 절차

1. **HTML 골격**: `src/index.html`에 `<div class="panel">` 추가 + DOM ID 부여 (e.g., `id="p-energy-segment-body"`)
2. **렌더 함수**: `src/js/render.js`의 적절한 함수에 추가 (DOM 채우기)
3. **데이터 매핑 확인**: `m.energy?.generation?.field_name` 같은 안전한 chaining
4. **빌드**: `node scripts/build_dashboard.js`
5. **검증**:
   ```bash
   grep -c 'id="p-NEW-ID"' dashboard.html  # → 1이면 OK
   ```

## 6. 사용자 선호 (코딩 초보, 교수)

- 한국어 라벨 + 영문 학술명 병기 ("⚖ 좌우 힘 균형 (Asymmetry)")
- 분석가용 디테일은 `<details>` 폴더로 숨김 (선수/코치는 핵심만)
- "리포트 핵심", "분석가용" 같은 메타 라벨은 `var(--muted)` 색으로
- 큰 결정 (라벨 변경, 라디아 축 교체)은 진행 전 한 번 확인
- 작은 추가 (카드 보강, 데이터 표시)는 default로 진행 후 결과 보여주기

## 7. 디버깅 체크리스트

새 기능이 안 보일 때:
1. `dashboard.html` 빌드 후 파일 크기 변화 확인
2. `grep` 으로 새 ID/함수가 빌드 결과에 들어갔는지 확인
3. JavaScript 에러는 사용자에게 브라우저 콘솔 확인 요청
4. 데이터 구조 의심 시 `io.js`의 sample data (`SAMPLE_MEAS`) 참고

## 8. 자주 사용하는 메모리 reference

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/user_role.md` — 사용자 (교수, 코딩 초보)
- `~/memory/project_sangdong_dashboard.md` — 프로젝트 개요
- `~/memory/feedback_dashboard_workflow.md` — src/ 모듈 + build script 패턴
- `~/memory/project_manual_v2_and_dashboard_v5.md` — v5.x 누적 변경
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축

## 9. v5.25 NEW 카드 (메카닉 §3-3, §3-4)

- §3-3 **에너지·파워**: `m.energy.generation.{mech_energy_pelvis_J/trunk_J/humerus_J, hip_R/L_W, knee_R/L_W, shoulder_W, elbow_W, total_W}` + `m.energy.transfer.{ete_pct, speed_gain_pt, speed_gain_ta, ratio_humerus_to_pelvis_pct}`
- §3-4 **지면반력**: `m.grf.{lhei, rear_force_pct, lead_force_pct, type}` — FP1=뒷발 (drive leg), FP2=앞발 (lead leg)
- 자동 유형 판정: Lead/Drive 비율 > 1.4 → "Lead 우세", < 0.7 → "Drive 우세", 그 외 "균형형"
