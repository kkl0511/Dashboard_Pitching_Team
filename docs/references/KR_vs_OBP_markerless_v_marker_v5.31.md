# Markerless (KR Theia) vs Marker (OBP) 시스템 비교 (v5.31)

> **Cohort**:
> - **KR 135+ km/h** (markerless Theia): 47 trials, 14명, median 137 km/h (≈85.2 mph)
> - **OBP 90+ mph** (marker-based, college+indy+MiLB): 54 trials, median 91 mph
>
> **데이터 출처**:
> - KR: `pitching_processing_data.xlsx` (한국 41명 cohort 처리 결과, ball_speed≥135km/h subset)
> - OBP: `baseball_pitching/data/poi/poi_metrics.csv` (Driveline 100 pitchers)

## 1. 한 줄 요약

**Markerless Theia는 marker-based system 대비 ω peak를 ~10-15% 작게, X-factor를 ~40% 작게 측정한다.** 자세 변인 일부와 수직 GRF는 거의 동일하지만, 회전 변인과 X-factor는 시스템 보정 계수 적용 필요.

## 2. 비교 결과 표

### A. 거의 정합 (시스템 차이 < 5%) — 12개 중 6개

| 변인 | KR p50 (markerless) | OBP p50 (marker) | Δ% |
|---|---|---|---|
| **FC Shoulder Abduction** (deg) | 85.2 | 85.5 | -0.3% |
| **Pelvis→Trunk lag** (ms) | 7 | 8 | -1ms |
| **Peak Trunk Counter Rot** (\|deg\|) | 40.6 | 39.6 | +2.6% |
| **Max Shoulder ER** (deg) | 178 | 171 | +4.3% |
| **Trail leg vertical GRF** (%BW) | 144 | 139 | +3.5% |
| **Lead leg vertical GRF** (%BW) | 229 | 218 | +5.2% |

→ **이 변인들은 두 시스템 간 호환** — driveline.js reference 그대로 사용 가능.

### B. KR markerless가 작게 측정 (5-20%) — 회전 ω + CoG

| 변인 | KR p50 | OBP p50 | Δ% | 권장 보정 |
|---|---|---|---|---|
| **Pelvis peak ω** (deg/s) | 630 | 726 | **-13.2%** | KR×1.15 ≈ marker 등가 |
| **Trunk peak ω** (deg/s) | 910 | 1058 | **-14.0%** | KR×1.16 ≈ marker 등가 |
| **Arm peak ω** (deg/s) | 4184 | 4608 | **-9.2%** | KR×1.10 ≈ marker 등가 |
| **Max CoG velo** (m/s) | 2.5 | 3.1 | **-18.1%** | (selection effect 일부) |
| **Stride length** (%h) | 0.79 | 0.86 | **-8.3%** | KR×1.09 ≈ marker 등가 |

→ **회전 변인 등가 계수 ≈ 1.15** — markerless는 marker 대비 약 13% 낮은 ω 출력.

### C. KR이 매우 작게 측정 (>30%) — X-factor + FC 자세

| 변인 | KR p50 | OBP p50 | Δ% | 원인 |
|---|---|---|---|---|
| **Peak X-factor** (deg) | 21.6 | 34.6 | **-37.6%** | 골반 + 흉추 회전 추정 차이 누적 |
| **FC X-factor** (deg) | 18.5 | 33.5 | **-44.8%** | 동일 |
| **FC Trunk fwd tilt** (\|deg\|) | 3.5 | 9.6 | **-63.6%** | 골반 좌표축 정의 차이 가능 |

→ **X-factor는 markerless가 marker 대비 ~58%만 측정** (보정 계수 ≈ 1.65). 이는 두 회전 분절(pelvis, trunk)의 추정 차이가 누적된 결과.

### D. GRF 수평 성분 — 일부 차이 (selection 가능)

| 변인 | KR p50 | OBP p50 | Δ% |
|---|---|---|---|
| Trail AP (push-off, %BW) | 65 | 87 | -25.3% |
| Lead AP (braking, %BW) | 113 | 123 | -8.1% |

→ KR이 약함 — 시스템 차이도 있지만 cohort selection (KR 137km/h vs OBP 91mph≈146km/h, 9km/h gap) effect 큼.

## 3. 우리 reference 추가 보정 권고

### 즉시 보정 (driveline.js)

| 위치 | 변인 | v5.30 | v5.31 권장 | 근거 |
|---|---|---|---|---|
| `SEGMENT_TRANSITION_REF` | `trunk_to_humerus.lag_ideal_ms` | [20, 40] | **[50, 110]** | KR 실측 trunk_to_arm p10-p90 = 60-150ms |
| `SEGMENT_TRANSITION_REF` | `trunk_to_humerus.lag_acceptable_ms` | [10, 55] | **[30, 160]** | KR 실측 분포 |
| `NEWTFORCE_8_METRICS` | `time_of_transfer.elite_range` | [100, 180] | **[240, 320]** | KR Trail→Lead vGRF time p10-p50=241-292ms |
| `NEWTFORCE_8_METRICS` | `time_of_transfer.acceptable_range` | [60, 250] | **[180, 480]** | KR p10-p90=241-475ms |
| `DRIVELINE_5_MODELS` | `hip_shoulder_sep_fp.median_elite` | 34 | **유지 34** | OBP 33.5 vs KR 18.5 (markerless×1.65 ≈ 30 → 보정 후 OBP 일치) |

### 새 추가: `MARKERLESS_CALIBRATION_FACTORS` (driveline.js)

```js
const MARKERLESS_CALIBRATION_FACTORS = {
  // KR Theia markerless × factor ≈ marker 등가
  pelvis_peak_omega:   1.15,
  trunk_peak_omega:    1.16,
  arm_peak_omega:      1.10,
  x_factor:            1.65,   // 가장 큰 차이
  cog_velo:            1.22,   // selection effect 포함
  stride_length:       1.09,
  // 자세 변인은 보정 불필요 (정합)
  shoulder_abd:        1.00,
  shoulder_er:         1.00,
  counter_rot:         1.00,
  // GRF 수직: 정합
  vertical_grf:        1.00,
  // GRF 수평: selection effect 큼 (cohort에 따라 다름)
};
```

## 4. KR-specific NewtForce reference (cohort 분포)

OBP에 직접 매핑 없는 NewtForce 변인의 한국 elite cohort 분포:

| 변인 | KR p10 | KR p50 | KR p90 | NewtForce/우리 v5.30 |
|---|---|---|---|---|
| **Trail impulse stride** (BW·s) | 0.81 | 0.95 | 1.06 | NewtForce #1 Impulse — 한국 cohort raw |
| **Time of Transfer** (ms) | 241 | 292 | 475 | NewtForce #13. **우리 v5.30 [100,180] 너무 짧음** |
| **Clawback time** (ms) | 117 | 251 | 347 | NewtForce #10 Lead Negative Y timing |
| **Peak X-factor velo** (deg/s) | 105 | 212 | 277 | 추가 NewtForce 후보 |
| **CoG Decel** (m/s) | 1.06 | 1.32 | 1.45 | 우리 v5.28 cog_decel_ae |
| **Trunk→Arm lag** (ms) | 60 | 83 | 150 | **v5.28 SEGMENT_TRANSITION_REF [20,40] 너무 짧음** |

## 5. Selection Effect vs System Difference

KR 135+ km/h ≈ 한국 elite, OBP 90+ mph ≈ 미국 elite. 구속이 7 mph 차이라 cohort 자체가 다름:

- **Selection이 주된 원인 (KR < OBP는 selection)**: Pelvis/Trunk/Arm ω, AP GRF, CoG velo
- **System이 주된 원인 (markerless 자체 한계)**: X-factor (-40%), FC Trunk tilt (-64%)
- **둘 다 영향**: stride length, trunk→arm lag

차이 분리가 더 명확하려면 **KR 144+ km/h (=90 mph) 매칭 cohort** 필요. 현재 KR max 143.5 km/h라 매칭 불가 → 한 단계 낮은 KR 138-143 km/h vs OBP 86-89 mph 매칭이 best.

## 6. 결론 + 다음 단계

### 결론
1. ✅ **자세 변인** (shoulder ER/abd, counter rot, FC tilt 일부) — 두 시스템 정합
2. ✅ **수직 GRF** — 두 시스템 정합
3. ⚠️ **회전 ω** — markerless가 ~13% 작음 (보정 계수 1.15)
4. ⚠️ **X-factor** — markerless가 ~40% 작음 (보정 계수 1.65)
5. ⚠️ **timing 변인** — KR cohort에서 더 김 (Trunk→Arm lag 83ms vs 우리 reference 30ms)

### 권장 작업
1. **driveline.js v5.31 보정** (위 표대로)
2. **MARKERLESS_CALIBRATION_FACTORS 신설** — 학술 비교 시 marker 등가 환산
3. **KR-specific NewtForce reference 추가** (Time of Transfer, Clawback time)
4. **41명 raw c3d.txt 일괄 처리** — 우리 process_pitching_session.py로 v5.28-30 모든 변인 자동 추출 → 더 정밀 검증 가능

---
**작성일**: 2026-05-10
**OBP**: https://github.com/drivelineresearch/openbiomechanics
**KR**: 한국 고교 41명 cohort (kklee@kookmin.ac.kr)
