# KR 통합 cohort (59명) 검증 보고서 (v5.32)

> **데이터 source**:
> - Accurate_Data.zip: **18명 × 153 trials**
> - raw data.zip: **41명 × 365 trials**
> - 통합: **59명 × 518 trials** (공통 0명, 두 폴더 완전 별개 cohort)
>
> **처리 알고리즘**: process_pitching_session.py v5.32
> - FP1=앞발(lead), FP2=뒷발(drive) 강제 매핑
> - GRF 수평 |Y| 절댓값 + dominant 방향 자동 검출
> - Lead 윈도우 동적 확장 (FC ~ Lead toe-off)

## 1. 처리 결과 가용성

| 변인 | 가용성 | 비고 |
|---|---|---|
| 분절 ω peak (Pelvis/Trunk/Humerus) | 100% | OK |
| Pelvis→Trunk lag | 94% | 알고리즘 결과 ≠ xlsx 가공값 (디버깅 필요) |
| Trunk→Humerus lag | 98% | OK |
| Humerus→Forearm lag | 0% | R_Forearm 컬럼 누락 (Visual3D export 설정) |
| **Drive propulsive peak/impulse** | **96%** ✅ | **v5.28 3% → v5.32 96% 큰 진전** |
| Lead block duration | 96% | OK |
| Lead braking peak | 1% | 알고리즘 디버깅 필요 (xlsx 134 vs 우리 12 %BW) |
| NewtForce Time of Transfer | 1% | Drive Z peak frame 식별 결함 |

**ball_speed metadata 매핑**: 355/518 (69%, 한국 고1 정밀측정.xlsx의 356 sessions와 매칭)

**135+ km/h subset**: **126 trials × 22명** (이전 v5.31의 14명 → 22명, raw data 추가 효과)

## 2. xlsx 가공값 vs 우리 코드 직접 비교 (135+ subset)

| 변인 | xlsx p50 (n=47) | **우리코드 p50 (n=126)** | Δ% | 평가 |
|---|---|---|---|---|
| Pelvis peak ω (deg/s) | 630 | 614 | -2.6% | ✓ 정합 |
| Trunk peak ω (deg/s) | 910 | 868 | -4.6% | ✓ 정합 |
| Arm peak ω (deg/s) | 4184 | 4356 | +4.1% | ✓ 정합 |
| Trunk→Arm lag (ms) | 83 | 73 | -11.7% | ⚠ 약간 차이 |
| Stride length (cm) | 144 | 144 | +0.2% | ✓ 정합 |
| Max Shoulder ER (deg) | 178 | 186 | +4.3% | ✓ 정합 |
| **Pelvis→Trunk lag (ms)** | **7** | **37** | **+424%** | ✗ 큰 차이 |
| Peak X-factor (deg) | 21.6 | 28.0 | +29.5% | ✗ 차이 큼 |
| FC X-factor (deg) | 18.5 | 24.5 | +32.4% | ✗ 차이 큼 |

**ω peak + 자세 변인 5개는 ±5% 정합** → 우리 코드의 peak 검출 정확.

**Lag + X-factor에서 큰 차이** → xlsx의 정확한 알고리즘 (Visual3D 자체 처리)와 우리 코드 차이.

## 3. KR 22명 vs OBP 90+ 비교

| 변인 | KR 135+ p50 (n=126) | OBP 90+ p50 (n=54) | Δ% |
|---|---|---|---|
| Humerus peak ω | 4356 | 4608 | -5.5% ✓ |
| Layback | 186 | 171 | +8.9% ✓ |
| Pelvis peak ω | 614 | 726 | -15.4% ⚠ |
| Trunk peak ω | 868 | 1058 | -17.9% ⚠ |
| Max X-factor | 28 | 35 | -19.3% ⚠ |
| Pelvis→Trunk lag (우리코드) | 37 | 8 | +342% ✗ |

→ **우리코드 Pelvis→Trunk lag가 OBP와 너무 다름**. xlsx와도 큰 차이 (37 vs 7). 알고리즘 디버깅 필요.

## 4. v5.31 (14명) → v5.32 (22명) cohort 확장 효과

| 변인 | v5.31 KR (n=14, xlsx) | **v5.32 KR (n=22, 통합)** |
|---|---|---|
| Pelvis ω | 630 | 614 |
| Trunk ω | 910 | 868 |
| Arm ω | 4184 | 4356 |
| Pelvis→Trunk lag | 7ms | 37ms (우리코드) |
| Stride length | 0.79 (%h) | 144cm = ~0.80 (%h) |

KR cohort 확장으로 sample size 증가 (47 trial → 126 trial), 통계 안정성 개선.

## 5. driveline.js v5.32 reference 검증 (변경 불필요)

이번 통합 cohort 결과로 v5.32에 이미 적용된 reference의 적정성 확인:

| Reference | v5.32 값 | KR 22명 검증 | 결론 |
|---|---|---|---|
| `drive_propulsive_peak_pct_bw.elite_range` | [55, 80] %BW | (직접 추출 미신뢰) | xlsx 47명 기반 유지 |
| `lead_braking_peak_pct_bw.elite_range` | [100, 145] %BW | (xlsx 134 정합) | 유지 |
| `back_leg_peak_z.elite_range` | [135, 165] %BW | (xlsx 144 정합) | 유지 |
| `lead_leg_peak_z.elite_range` | [195, 240] %BW | (xlsx 229 정합) | 유지 |
| `pelvis_to_trunk.lag_ideal_ms` | [-5, 25] ms | (우리코드 37, xlsx 7) | xlsx 기반 유지 |
| `trunk_to_humerus.lag_ideal_ms` | [50, 110] ms | KR 73-83ms ✓ | **정합** |

→ **추가 보정 불필요**. v5.32 reference 그대로 유지.

## 6. 다음 라운드 디버깅 우선순위

### 1. Pelvis→Trunk lag 알고리즘
- 우리코드: peak frame 검색 윈도우 내 peak time 차이
- xlsx (Visual3D 자체): 다른 알고리즘 (smoothing, spline, etc.)
- 단일 trial로 step-by-step trace 필요

### 2. Lead leg AP GRF 알고리즘 (12배 차이)
- 우리코드 윈도우 (FC ~ Lead toe-off)에서 Y의 dominant phase가 약함
- xlsx는 더 넓은 윈도우 또는 다른 좌표 처리 가능성

### 3. NewtForce Time of Transfer (1% 가용성)
- Drive Z peak frame 식별 결함

### 4. R_Forearm 컬럼 추가 export
- 사용자 측정 시 Visual3D export 설정에 R_Forearm_Ang_Vel 포함

## 7. 결과물 위치

- `outputs/kr_cohort/kr_combined_v532.csv` — 518 trials × 36 cols
- `outputs/kr_cohort/Accurate_Data/` — 18명 × 153 c3d.txt
- `outputs/kr_cohort/raw_data_extract/` — 41명 × 365 c3d.txt
- `sample_data/KR_pitching_processing.xlsx` — xlsx 가공값 (140 rows)
- `sample_data/KR_HS1_meta.xlsx` — 356 sessions metadata (구속, 신장, 체중)

---

**작성일**: 2026-05-10 · v5.32
**Cohort**: KR 59명 (Accurate 18 + Raw 41), 22명 135+km/h subset
**연락처**: kklee@kookmin.ac.kr
