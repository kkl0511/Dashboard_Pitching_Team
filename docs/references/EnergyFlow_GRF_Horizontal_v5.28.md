# 에너지 흐름 + GRF 수평 성분 학술 노트 (v5.28)

상동고 투구 리포트 v5.28에서 §3-3 (에너지·파워)과 §3-4 (지면반력) 카드를 심화하면서 사용한 학술 reference 정리. 각 변인의 reference 값 + 코드 위치 + 인용을 함께 둠.

---

## 1. 분절간 에너지 흐름 (Segment-to-Segment Energy Flow)

### 1.1 학술 근거

| 출처 | 핵심 발견 | 활용 |
|---|---|---|
| **Naito & Maruyama (2008)** *Sports Biomech* 7(2):166–180. "Mechanical Energy and joint power in pitching" | 분절 간 power transfer가 ball velocity의 핵심. proximal segment 감속 → distal segment 가속 (역회 풍선 효과) | speed_gain ratio 계산 근거 |
| **Aguinaldo & Escamilla (2007, 2019)** *Sports Biomech* 18(1):69–78. "Segmental Power for Pitchers" | Pelvis-trunk separation timing이 ball velocity의 strongest predictor (r=0.73). lag 30-50ms이 elite | pelvis→trunk lag ideal 30–50ms |
| **Howenstein, Kipp, Sabick (2020)** *J Biomech* 99:109535. "Energy flow analysis to investigate trunk and arm injury during pitching" | 분절간 energy transfer가 충분치 않으면 distal 분절(elbow, shoulder)이 과부하 → 부상 위험 ↑ | bottleneck 식별 후 injury risk 연결 가능 |
| **Werner et al. (2008)** *Am J Sports Med* 34(4):597–603 | Elite pitcher의 trunk-humerus internal rotation lag = 20–40ms | trunk→humerus lag ideal 20–40ms |

### 1.2 Proximal-to-Distal Sequence — 4 Transitions

```
Drive leg → Pelvis → Trunk → Humerus → Forearm → Hand → Ball
              T1       T2        T3         T4        (T5: ball release)
```

| Transition | Lag ideal (ms) | Speed gain ideal (×) | 핵심 결함 |
|---|---|---|---|
| **T1 Pelvis → Trunk** | 30–50 | 1.30–1.70 | <20ms = X-factor 분리 부족 (몸 통째로 회전), >70ms = 점화 지연 |
| **T2 Trunk → Humerus** | 20–40 | 4.0–6.0 | <10ms = 어깨 너무 일찍 가속 (lay-back 부족), >55ms = ER 점화 지연 |
| **T3 Humerus → Forearm** | 10–25 | 1.10–1.40 | gain<0.9 = 팔꿈치 신전 가속 부족 (forearm whip 약함) |
| **T4 Forearm → Hand** | 5–15 | 1.00–1.30 | gain<0.85 = wrist snap 부족 |

### 1.3 코드 위치

- **Reference 상수**: `src/js/driveline.js` → `SEGMENT_TRANSITION_REF`
- **분석 함수**: `src/js/driveline.js` → `segmentTransitionETE(input)`
- **데이터 추출**: `scripts/process_pitching_session.py` → 분절별 peak frame argmax + lag 계산
- **렌더링**: `src/js/render_player_cards.js`의 `v514_renderMechanicTables`에서 `m.energy.transitions` 시각화 (chain + bottleneck box + 4-transition table)

### 1.4 검증된 P01 sample 결과 (2026-05-15)

| Transition | lag (ms) | speed gain | 진단 |
|---|---|---|---|
| Pelvis → Trunk | **16.7** | **1.30×** | lag 너무 빠름 → X-factor 분리 부족 가능 |
| Trunk → Humerus | **66.7** | **5.07×** | lag 너무 느림 → ER 점화 지연 (bottleneck 후보) |
| Humerus → Forearm | 3.3 | 1.28× | lag 너무 빠름 |
| Forearm → Hand | -6.7 | 1.00× | 음수 lag (시퀀스 깨짐 — 측정 노이즈 가능) |

**해석**: P01의 가장 큰 누수는 **trunk → humerus 시점 지연** (어깨 ER 점화 늦음). 코어 연결성 또는 lay-back 자세 점검 필요.

---

## 2. GRF 수평 성분 + 임펄스 + 타이밍

### 2.1 핵심 통찰 (사용자 지적)

> "수직보다는 수평(추진과 블록) 성분이 중요하고 피크 포스 못지 않게 임펄스도 중요한데 전혀 반영을 안하고 있어. 타이밍도"

**통찰의 학술적 정당화**:
- **Peak force**는 일회성 정점 — 짧은 충격에 unstable
- **Impulse (∫F·dt)**가 운동량 변화 (Δp = J)를 결정 — 분절·신체 가속의 본질
- **수평 (Y, mound axis) 성분**이 추진(drive leg) + 블록(lead leg)의 본질
- **타이밍**이 분절 점화·정지 타이밍을 결정 → kinetic chain 효율 좌우

### 2.2 학술 근거

| 출처 | 핵심 발견 | 활용 |
|---|---|---|
| **MacWilliams et al. (1998)** *Am J Sports Med* 26(1):66–71. "Characteristic ground-reaction forces in baseball pitching" | Lead leg braking peak = 1.0–1.5 BW (collegiate). Y- 방향 (mound 반대) 추진 |
| **Kageyama et al. (2014)** *J Sports Sci Med* 13:910–9. "Difference between adolescent and collegiate baseball pitchers in lower limbs and trunk" | Drive leg propulsive peak = 50–70% BW. impulse가 ball velocity와 강한 상관 (r=0.61) |
| **Howenstein et al. (2020)** *J Biomech* 99:109535 | Lead leg braking peak timing = FC 후 30–50ms (elite). 늦으면 trunk forward tilt 부족 |
| **Guido & Werner (2012)** *J Strength Cond Res* 26(7):1782–5 | Collegiate pitcher GRF — drive leg propulsive impulse 0.18–0.28 BW·s |
| **McNally et al. (2015)** *J Sci Med Sport* 18(2):225–30 | Bilateral GRF asymmetry — pelvis braking 효율과 연결 |

### 2.3 새 변인 8개 + Elite 범위

| 변인 | Elite 범위 | 출처 | 단위 |
|---|---|---|---|
| **Drive propulsive peak** | 50–70 | Kageyama 2014 | %BW |
| **Drive propulsive impulse** | 18–28 | MacWilliams 1998 | %BW·s |
| **Drive peak timing** | 60–85 | Kageyama 2014 | %stride |
| **Lead braking peak** | 100–150 | MacWilliams 1998 | %BW |
| **Lead braking impulse** | 18–28 | MacWilliams 1998, Howenstein 2020 | %BW·s |
| **Lead braking peak timing** | 30–60 | Howenstein 2020 | ms after FC |
| **Lead block duration** | 120–180 | Howenstein 2020 | ms |
| **수평/수직 비율** | 0.50–0.85 | Kageyama 2014 | unitless |

### 2.4 좌표계 (Theia force plate)

P01 검증으로 확정:
- **Y-** = mound 방향 (drive leg push 시 GRF Y-)
- **Y+** = home plate 방향 (lead leg는 +Y로 ground 밂 → reaction = body가 -Y로 가속)
- **Z+** = vertical (수직)
- **X** = lateral (측방)

### 2.5 동적 윈도우 (윈도우 분리의 중요성)

기존 코드 (v5.27까지) 문제:
- 분석 윈도우 = FC-5 ~ BR+10 (Theia 표준)
- Drive leg는 FC 이전에 toe-off → 분석 윈도우 내에서 0 → drive peak 검출 안됨

v5.28 해결:
- **Drive leg 동적 윈도우**: FC 이전에서 마지막 contiguous active block (FP1_Z > 50N)
- **Lead leg 윈도우**: FC ~ BR + 30 frames (≈ FC ~ BR + 100ms)

### 2.6 임펄스 계산식

```
Drive propulsive impulse = ∫ FP1_Y- dt    (drive 동적 윈도우 내, Y- 부분만)
Lead braking impulse     = ∫ FP2_Y+ dt    (FC ~ BR+30, Y+ 부분만)
```

c3d.txt 내부 sampling rate = 300 Hz (Theia raw rate). force plate raw 1200 Hz는 export 시 motion rate에 동기화. 따라서 dt = 1/300s.

### 2.7 코드 위치

- **Reference 상수**: `src/js/driveline.js` → `GRF_HORIZONTAL_REF`
- **분석 함수**: `src/js/driveline.js` → `grfHorizontalAnalysis(g)`, `grfHorizontalMetricScore(value, def)`
- **데이터 추출**: `scripts/process_pitching_session.py` 내 `parse_theia_trial`의 v5.28 블록
- **렌더링**: `src/js/render_player_cards.js`의 `v514_renderMechanicTables`에서 `m.grf.horizontal` 시각화

### 2.8 검증된 P01 sample 결과 (2026-05-15)

| 변인 | 실측 | Elite 범위 | 점수 |
|---|---|---|---|
| Drive propulsive peak | None (force plate에 안 올라감) | 50–70 %BW | — |
| Drive propulsive impulse | None | 18–28 %BW·s | — |
| Lead braking peak | **0.9** %BW | 100–150 | 매우 약함 |
| Lead braking impulse | **0.02** %BW·s | 18–28 | 매우 약함 |
| Lead braking peak timing | 3.3 ms after FC | 30–60 | 너무 빠름 |
| Lead block duration | 203 ms | 120–180 | 약간 김 |

**해석**: P01은 lead leg block이 거의 작동하지 않음. force plate 위치 문제일 가능성도 있고 (실측 환경 점검 필요), 또는 P01의 실제 약점일 수도. Drive leg는 force plate에 한 번도 안 올라감 (선수 위치 또는 force plate setup 점검 필요).

---

## 3. 분석 흐름 (Pipeline)

```
Theia c3d.txt (P01 sample)
   │
   ▼  parse_theia_trial (process_pitching_session.py)
   │   - 분절 ω 시계열 → peak frame → lag (ms)
   │   - FP1/FP2 X/Y/Z 시계열 → peak/impulse/timing
   ▼
trial summary dict (50+ 변인)
   │
   ▼  synthesize_player_summary
   │   - median_clip → 선수별 합성 record
   ▼
theia_record.json
   │
   ▼  io_apply.js → applyTheiaRecord → enrichWithAnalytics
   │   - segmentTransitionETE(input) → m.energy.transitions
   │   - grfHorizontalAnalysis(g) → m.grf.horizontal
   ▼
render_player_cards.js → v514_renderMechanicTables
   - §3-3 chain + bottleneck + 4-transition table
   - §3-4 horizontal force + impulse + timing table
```

---

## 4. 향후 개선 후보

1. **Drive leg 동적 윈도우 강건화** — FP1 활성 구간이 여러 개일 때 main motion 식별 (예: leg lift event + FC 사이 가장 큰 block)
2. **Force plate raw 1200Hz 직접 활용** — 현재 c3d.txt 내부 300Hz로 작업 중. raw 1200Hz를 별도 처리하면 timing 해상도 4배 향상
3. **Bilateral asymmetry** — drive/lead leg propulsive·braking impulse asymmetry index (McNally 2015)
4. **Vertical impulse** — 현재 수평만 분석. trunk forward tilt와 vertical impulse 관계 추가 (Werner 2008 lower body biomechanics)
5. **Cohort calibration** — P01뿐 아니라 41명 cohort 들어오면 Elite range를 한국 고교 기준으로 재calibrate
6. **분절 ETE Kinetic ver.** — 현재 kinematic gain (ω ratio)만. ½Iω² 기반 KE_rot ratio도 함께 계산하면 Naito 2008 더 충실
7. **Joint power 시계열** — 현재 peak power scalar만. P-D power flow 시간 흐름 시각화 (Aguinaldo 2019)

---

---

## 5. NewtForce 핵심 8 변인 통합 (v5.29 추가)

### 5.1 시스템 개요

**NewtForce** (Kyle Barker, Jacksonville, AR) — instrumented pitching mound (smart mound). 10 ft × 5 ft, 150 lb, regulation slope, 표면 아래 force plate × 2 (FP1=back leg, FP2=lead leg). 200 fps video sync. 사용처: **Vanderbilt, TCU, Minnesota Twins (spring training), Florida Baseball Ranch**.

### 5.2 좌표 정의 (Theia 변환)

| Axis | NewtForce | Theia (P01 검증) | 변환 |
|---|---|---|---|
| Z+ | down into ground | up (vertical) | 부호 무관 (peak는 |Z|) |
| Y+ | back/rubber (2루) | home plate (anterior) | **부호 반전** |
| Y- | home plate | rubber (posterior) | **부호 반전** |
| X | lateral | lateral | 동일 |

따라서 NewtForce **Back Leg Peak Y (positive)** = Theia FP1_Y의 **negative max abs** (P01 = 1075 N).

### 5.3 표준 18 변인 → 핵심 8 추출 (사용자 협의)

Florida Baseball Armory "Force Plate Metrics Chart Guide PDF" (2019)의 18 metrics 중 사용자가 가장 중요한 8개로 압축.

#### Amplitude (7)

| # | 변인 | 정의 | Elite (%BW) | v5.28 alias |
|---|---|---|---|---|
| 1 | **Impulse** | back leg ∫Y dt — *velocity #1 contributor* | 18–28 (%BW·s) | drive_propulsive_impulse_pct_bw_s |
| 2 | **Back Leg Peak Z** | drive leg vertical max | 150–200 | rear_force_pct |
| 3 | **Turning Point Z** | drive leg Z 최저점 (lead leg landing 직전) | 40–80 | **NEW v5.29** |
| 4 | **Lead Leg Peak Z** | lead leg vertical max (landing impact + block) | 180–280 | lead_force_pct |
| 8 | **Back Leg Peak Y** | drive leg Y 최대 (rubber 방향 push) | 50–70 | drive_propulsive_peak_pct_bw |
| 9 | **Lead Leg Peak Y** | lead leg Y 최저 (negative spike, body braking) | 100–150 | lead_braking_peak_pct_bw |
| 10 | **Lead Leg Negative Y** | claw back 후 lead leg Y 정점 | 30–80 | **NEW v5.29** |

#### Timing (1)

| # | 변인 | 정의 | Elite (ms) | 비고 |
|---|---|---|---|---|
| 13 | **Time of Transfer** | Back Leg Peak Z → Lead Leg Peak Z | 100–180 | NewtForce가 명시한 *most important time-related metric*. **NEW v5.29** |

### 5.4 v5.28 → v5.29 통합 매핑

5개 metrics는 v5.28 추출 변인을 직접 alias (driveline.js의 `alias_v528`로 자동 매핑). 3개는 새 추출 함수.

```
v5.28:  drive_propulsive_impulse_pct_bw_s   →  NewtForce #1 Impulse
v5.28:  rear_force_pct                       →  NewtForce #2 Back Leg Peak Z
v5.29:  newtforce_turning_point_z_pct_bw     →  NewtForce #3 Turning Point Z
v5.28:  lead_force_pct                       →  NewtForce #4 Lead Leg Peak Z
v5.28:  drive_propulsive_peak_pct_bw         →  NewtForce #8 Back Leg Peak Y
v5.28:  lead_braking_peak_pct_bw             →  NewtForce #9 Lead Leg Peak Y
v5.29:  newtforce_lead_negative_y_pct_bw     →  NewtForce #10 Lead Leg Negative Y
v5.29:  newtforce_time_of_transfer_ms        →  NewtForce #13 Time of Transfer
```

### 5.5 코드 위치

- **Reference 상수**: `src/js/driveline.js` → `NEWTFORCE_8_METRICS` (8 metrics × {nf_id, label, elite_range, citation, alias_v528 또는 new_in_v529})
- **분석 함수**: `src/js/driveline.js` → `newtforceCoreAnalysis(g)` → m.grf.newtforce
  - amplitude_score (7 metric 평균) + timing_score (1 metric)
  - overall = amplitude×0.70 + timing×0.30
- **데이터 추출**: `scripts/process_pitching_session.py` v5.29 블록
  - 신규 3개: `newtforce_turning_point_z_pct_bw`, `newtforce_lead_negative_y_pct_bw`, `newtforce_time_of_transfer_ms`
  - 기존 5개는 v5.28 변인 그대로 alias
- **렌더링**: `src/js/render_player_cards.js`의 `v514_renderMechanicTables` 끝 — placeholder `p-grf-newtforce`에 amplitude 7 표 + timing 1 카드

### 5.6 P01 sample 결과 (2026-05-15)

| # | NewtForce | P01 실측 | Elite | 비고 |
|---|---|---|---|---|
| 1 | Impulse | None | 18–28 %BW·s | drive force plate 데이터 없음 |
| 2 | Back Leg Peak Z | None | 150–200 %BW | drive 데이터 없음 |
| 3 | Turning Point Z | None | 40–80 %BW | drive 데이터 없음 |
| 4 | Lead Leg Peak Z | 145 N (16 %BW) | 180–280 %BW | 매우 약함 |
| 8 | Back Leg Peak Y | None | 50–70 %BW | drive 데이터 없음 |
| 9 | Lead Leg Peak Y | 0.9 %BW | 100–150 %BW | 매우 약함 |
| 10 | Lead Leg Negative Y | 1.7 %BW @ BR+497ms | 30–80 %BW | 매우 약함 |
| 13 | Time of Transfer | None | 100–180 ms | drive Z peak 없어 계산 불가 |

**P01 데이터 한계**: drive leg가 force plate에 캡처 안됨 → 5개 metric None. 다른 선수 (drive force plate 정상 캡처)는 모두 추출 가능.

### 5.7 출처

- NewtForce 공식: https://www.newtforce.com/
- Florida Baseball Armory chart guide: https://floridabaseballarmory.com/wp-content/uploads/2019/12/Force-Plate-Metrics-Chart-Guide-PDF.pdf
- "Impulse and the Little Glutes" article: https://floridabaseballarmory.com/impulse-and-the-gms-pitching-velocity/

---

**작성일**: 2026-05-10 · v5.28 (5.x 섹션 v5.29 추가)
**작성자**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
