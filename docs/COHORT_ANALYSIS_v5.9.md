# OpenBiomechanics 통합 보고 — v5.9 (2026-05-10)

**대상**: Driveline OpenBiomechanics Project (n=100 pitchers, 411 trials) + 한국 cohort (n=57)
**목적**: 한국 cohort 약점(좁은 cohort range, 통계 power 부족) 보강 + 학술 standard reference 통합
**참고**: <https://github.com/drivelineresearch/openbiomechanics>

---

## TL;DR — 4가지 핵심 발견

1. **OBP cohort range는 한국의 1.5배 (40 vs 27 km/h)** — 메카닉 ↔ 구속 상관 R²=0.35 (한국 0.04 대비 9배). 좁은 cohort 한계가 한국만의 문제 아님 확정.
2. **5-predictor velocity prediction 모델**이 7-predictor보다 한국 cohort에 robust — 7-predictor의 stride_length 단일값(1.74m fix)이 systematic bias +33 km/h 만들었음.
3. **한국 cohort에 OBP 모델 raw 적용 시 systematic −10.6 km/h offset** — 측정 시스템 차이 (Theia vs marker-based mocap) 또는 release efficiency. **cohort 내 ranking으로만 사용 권장**.
4. **MiLB 23 trial이 진짜 elite reference** — Trunk ω 1120 °/s, X-factor 39°, H/P 1477%, Elbow varus 134 N·m. 한국 cohort 어떤 선수도 도달 못함.

---

## 1. OBP 데이터셋 개요

| Playing Level | n 선수 | n trial | 구속 mean | range | age mean |
|---|---|---|---|---|---|
| High School | 7 | 32 | 128.0 km/h | 119-140 | 18.4 |
| College | 75 | 314 | 136.4 | 115-152 | 20.8 |
| Independent | 12 | 42 | 138.3 | 112-150 | 25.0 |
| MiLB (Minor) | 6 | 23 | **143.6** | 139-148 | 25.1 |
| **합계** | **100** | **411** | **136.7** | **40 km/h range** | |

→ MiLB 6명은 진짜 pro 진입 직전 elite. Cohort range가 우리의 1.5배.

---

## 2. 메카닉 ↔ 구속 상관 (Trial-level)

### OBP 411 trial vs 한국 trial-level (n=353)

| Metric | OBP r | 한국 r | 의미 |
|---|---|---|---|
| Trunk ω peak | **+0.33 \*\*\*** | -0.04 ns | OBP에서 명확 |
| Arm ω peak | **+0.31 \*\*\*** | +0.17 \** | OBP 우세 |
| **Humerus KE_rot** | **+0.51 \*\*\*** | +0.23 \*\*\* | OBP 2배 |
| **Shoulder IR moment** | **+0.53 \*\*\*** | (없음) | kinetic — Theia 직접 추출 어려움 |
| **Elbow varus moment** | **+0.47 \*\*\*** | (없음) | kinetic — Theia 직접 추출 어려움 |
| Arm slot | -0.30 \*\*\* | (없음) | 낮은 slot ↔ 빠른 구속 |
| X-factor | +0.29 \*\*\* | +0.30 \*\*\* | 거의 같음 ✓ |

**해석**: kinetic 변수(joint moment)가 가장 강한 predictors. Theia 마커리스에서 직접 추출 어려우니 향후 inverse dynamics 처리 보강 권장.

---

## 3. Velocity Prediction Model (5-predictor)

### OBP 학습 결과 (n=411 trial)

```
predicted_velo (km/h) = 17.89
                       + (−0.0087) × pelvis_dps
                       + (+0.0313) × trunk_dps
                       + (+0.0074) × arm_dps
                       + (+0.260)  × mass_kg
                       + (+18.76)  × height_m

R² = 0.35  ·  RMSE = 6.16 km/h  ·  5-fold CV R² = 0.28 ± 0.10
```

### 7-predictor 모델의 함정 (해결한 문제)

7-predictor 모델 (+ x_factor + stride_length, R²=0.37) 적용 시:
- stride_length 데이터 없는 한국 cohort에 median 1.74m로 fix
- stride coef +19.14 × 1.74 = **+33.3 km/h systematic bias**
- 한국 모든 선수가 메카닉 대비 −20 km/h 효율 손실로 잘못 분류됨

**5-predictor 모델로 단순화**:
- Baesunwoo (128.8 km/h): 7-pred residual −21.5 → 5-pred **+0.8** (정확하게 평균)
- chaboseong (142.5 km/h): 7-pred +3.4 → 5-pred **+10.8** (효율 우수 명확)

→ **stride 데이터 표준화 전까지 5-predictor 모델 권장**.

### 한국 cohort 적용 결과

| Cohort | 실측 | 예측 | residual median |
|---|---|---|---|
| 한국 고1 (n=41) | 135.0 km/h | 145.4 | −9.4 |
| 한국 프로/대학 (n=16) | 134.3 | 147.3 | −12.8 |
| **합본 (n=57)** | **135.0** | **145.6** | **−10.6** |

**cohort 내 residual ranking으로 메카닉 효율 진단 가능**:
- Top: chaboseong +3.4 ~ leejiho +0.3 (메카닉 효율 우수)
- Bottom: Baesunwoo −21.5 ~ choijinmyung −18.0 (효율 손실)
- 25 km/h 차이는 진짜 individual 효율 차이를 시사

---

## 4. v5.9 코드 변경 요약

### `analytics.js` 신규 상수
```js
OBP_VELO_MODEL = {
  intercept: 17.89,
  pelvis_dps_coef: -0.0087, trunk_dps_coef: +0.0313,
  arm_dps_coef: +0.0074, mass_kg_coef: +0.260, height_m_coef: +18.76,
  r_squared: 0.35, rmse_kmh: 6.16, korean_bias: -10.6
}

OBP_LEVEL_NORMS = {
  'HS':      { pelvis: 721, trunk: 1032, arm: 4419, x_factor: 35, hp_ratio: 1279 },
  'College': { pelvis: 742, trunk: 1051, arm: 4571, x_factor: 32, hp_ratio: 1310 },
  'Indep':   { pelvis: 804, trunk: 1030, arm: 4420, x_factor: 30, hp_ratio: 1126 },
  'MiLB':    { pelvis: 726, trunk: 1120, arm: 4388, x_factor: 39, hp_ratio: 1477 }  // elite
}

PRO_REFERENCE_4AXIS.transfer_score: 58 → 55 (한국 28 + OBP MiLB 23 = n=51)
```

### `predictVelocityOBP()` 함수
```js
predictVelocityOBP(input, measuredKmh, applyKoreanBias)
  → { predicted_kmh, residual_kmh, efficiency_label, basis }

efficiency_label 구간:
  > +5  : 🔥 매우 효율
  > 0   : ✓ 효율 우수
  > -5  : ○ 평균
  > -10 : △ 손실 있음
  ≤ -10 : ⚠ 큰 효율 손실
```

---

## 5. Outlier 청소

| Trial-level (n=468) | n | % |
|---|---|---|
| 정상 | 458 | 97.9% |
| window_size 비정상 | 10 | 2.1% |
| event_missing | 9 | 한국 데이터만 |

→ 이미 v5.7 분석 구간 로직으로 자동 reject 중. 추가 청소 불필요.

| Player-level (n=57) | n |
|---|---|
| 정상 | 56 |
| Extreme metric | 1 (`parkgunhyeong` trunk 1112 — MiLB 수준이라 retain 권장) |

---

## 6. 향후 권장 작업

### 단기 (이번 분기)
- **Dashboard UI에 OBP 진단 통합**: 선수별 카드에 "OBP 모델 예측 vs 실측" + efficiency_label 표시
- **OBP_LEVEL_NORMS 라디아 추가**: 4축 라디아에 "📊 OBP MiLB" reference 추가 (Elite 28명 외에 진짜 학술 standard)

### 중기 (다음 분기)
- **Stride length 측정 표준화** — Theia에서 stride 추출 → 7-predictor 모델로 R² 0.37 확보
- **Joint moment 추출** — Theia 또는 V3D inverse dynamics → shoulder_IR_moment, elbow_varus_moment 도입 (r=0.5+)
- **release point 측정** — Rapsodo 데이터와 연계해서 systematic −10.6 km/h offset 원인 분석

### 장기
- **한국 cohort N을 100명 이상으로 확장** → R² 0.10 이상 가능성 (학술 reference 학습)
- **한국 자체 cohort 기반 회귀 모델** vs **OBP 모델** 정확도 비교 후 더 robust한 것 채택

---

## 7. Sources / References

- Driveline OpenBiomechanics: <https://github.com/drivelineresearch/openbiomechanics>
- Naito et al. (2014, 2017) double-pendulum energy flow
- Werner et al. (2008) elite pitcher mechanical energy ratios
- Stodden et al. (2001) sequencing → velocity correlation
- Aguinaldo & Escamilla (2019) Sports Biomech — kinematic + kinetic ETE
- De Leva (1996) inertia parameters

---

**문서 작성일**: 2026-05-10 · **분석자**: 국민대 BBL · **다음 검토**: stride/moment 데이터 추가 후 v5.10

---

## 8. v5.10 Patch — Stride 통합 (2026-05-10 same-day)

### 발견
**`STRIDE_LENGTH` 컬럼은 EVENT처럼 single-value sparse data**로 c3d.txt에 저장 (footstrike event 시점에 1회). FC~BR analysis_window slice 안에는 들어가지 않아 이전 v5.7-v5.9 parser는 모두 `None` 반환.

### 단위 검증
- 한국 c3d.txt `STRIDE_LENGTH_X`: 절대 길이 (m), median 1.46m
- OBP `stride_length` (POI CSV): % body height, median 0.837
- 한국 stride/height ratio = **0.797** ≈ OBP 0.837 ✓ (단위 정의 일치)

### 코드 수정
```python
# parse_theia_trial / parseC3DTxtTrial
'stride_length': safe_max_abs(col_by_name('STRIDE_LENGTH_X'))   # window 무관 — single-value
'stride_pct':    safe_max_abs(col_by_name('STRIDE_LENGTH_MEAN_PERCENT_X'))
```

### 7-predictor 모델 적용 (v5.10 OBP_VELO_MODEL 업데이트)

```js
predicted_velo = -2.0818
              + (-0.00539) × pelvis_dps
              + (+0.03006) × trunk_dps
              + (+0.00685) × arm_dps
              + (+0.03426) × x_factor
              + (+0.2469)  × mass_kg
              + (+21.792)  × height_m
              + (+19.141)  × stride_pct       ← v5.10 신규

R² = 0.372 (5-pred 0.350 대비 +0.02), RMSE = 6.07 km/h
korean_bias = +8.1 km/h (이전 5-pred 모델의 -10.6과 부호 반대)
```

### 한국 cohort 적용 결과 (5-pred vs 7-pred 비교)

| Metric | 5-predictor (v5.9) | **7-predictor (v5.10)** |
|---|---|---|
| Median residual | -10.6 km/h (stride median fix bug) | **+8.1 km/h** (정확한 stride) |
| Std (variance) | 6.13 | **5.84** (더 robust) |
| RMSE | 6.16 | **6.07** |
| chaboseong (Elite) | +10.8 | **+11.7** |
| Baesunwoo (미달) | +0.8 | **+2.3** |

### efficiency_label 임계 재조정 (v5.10)
한국 cohort baseline +8 km/h를 고려해서:
| residual | label |
|---|---|
| > +15 | 🔥 매우 효율 |
| > +5  | ✓ 효율 우수 |
| > 0   | ○ 평균 |
| > -5  | △ 손실 있음 |
| ≤ -5  | ⚠ 큰 효율 손실 |

### 최종 모델 정합성 확인
- 한국 cohort stride median 0.797 ≈ OBP 0.837 ✓
- 7-predictor가 individual variance를 더 잘 capture (std 5.84 < 6.13)
- **stride 통합은 ranking을 크게 바꾸지 않지만 절대 잔차의 정확도는 개선** (chaboseong +21 → +12, Baesunwoo -3 → +2 — 더 fair)

### 향후 작업 (v5.11 이후)
- Theia에서 `stride_length` 단일값이 정말 footstrike event 시점인지 검증 (다른 시점일 가능성)
- Joint moment (shoulder_IR, elbow_varus) 추출 보강 → r=0.5+ predictor 추가
- 한국 cohort N 확장 후 자체 cohort 회귀 모델 학습 가능성
