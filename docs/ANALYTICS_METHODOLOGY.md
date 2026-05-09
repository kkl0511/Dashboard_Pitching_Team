# 분석 방법론 (Analytics Methodology) — v3.1

대시보드의 잠재구속·ELI·composite score 산출 공식과 문헌 근거를 정리한 문서입니다.
모든 함수는 `src/js/analytics.js` 에 구현되어 있고, 브라우저에서 `window.ANALYTICS` 로 노출됩니다.

> **v3.0 (2026-05-09)**: ① 학년별 벤치마크·잠재구속 임계치·percentile (고1/2/3 분리),
> ② 제구 통합 점수 (Theia 운동학 + Rapsodo 결과 cross-validation), ③ fitness 점수가
> COMPOSITE_WEIGHTS·학년별 percentile·비대칭 반영하도록 재배선.

---

## 0. 학년별 처리 (v3.0 신규)

### GRADE_BENCHMARKS — 한국 고교 투수 발달 단계 기준

| 학년 | 평균 구속 | CMJ PP/BM | IMTP PF/BM | 평균 신장 |
|---|---|---|---|---|
| 고1 | 124 ± 6 km/h | 36 ± 5 W/kg | 25 ± 4 N/kg | 173 cm |
| 고2 | 130 ± 6 km/h | 41 ± 5 W/kg | 29 ± 4 N/kg | 178 cm |
| 고3 | 135 ± 6 km/h | 45 ± 5 W/kg | 32 ± 4 N/kg | 181 cm |

> 측정 누적되면 실제 코호트 평균·SD로 자동 갱신 권장.

### 학년별 percentile

`gradePercentile(value, grade, metric)` — 정규근사 z-score → percentile (0~100). 같은 학년 내 상대 위치를 보여줌. 학년이 다른 선수들끼리 직접 비교하지 않도록 차단.

### 잠재구속 임계치 보정

`LATENT_VELOCITY_WEIGHTS` 의 임계치 (θ) 가 학년별 offset 으로 자동 조정:

| 변수 | 고1 offset | 고2 offset | 고3 offset |
|---|---|---|---|
| trunk_peak_dps | −100 | 0 | +50 |
| pelvis_peak_dps | −50 | 0 | +25 |
| cmj_pp_bm | −5 | 0 | +2 |
| imtp_pf_bm | −3 | 0 | +1 |
| shoulder_er_deg | −10 | 0 | +5 |
| stride_pct_height | −3 | 0 | +2 |

같은 측정값이라도 고1에는 "충분", 고3에는 "부족" 판정 가능.

---

## 1. 잠재 구속 (Latent Velocity Regression)

### 모델

$$v_{\text{potential}} = v_{\text{measured}} + \sum_i \min(\text{cap}_i,\, w_i \cdot \max(0,\, x_i - \theta_i))$$

각 변수는 임계치(threshold) 이상에서만 구속에 기여하며, 변수별 최대 기여량(cap)이 있어 비현실적 외삽을 방지합니다. 총 gap은 8 km/h 로 상한 고정.

### 변수·가중치 (실측 단위 기준)

| 변수 | 임계치 (θ) | 가중치 (w, km/h per unit) | 최대 기여 | 출처 |
|---|---|---|---|---|
| 몸통 최대 회전속도 (deg/s) | 900 | 0.0050 | 4.0 km/h | Stodden 2001 |
| 골반 최대 회전속도 (deg/s) | 500 | 0.0040 | 3.0 km/h | Stodden 2001 |
| CMJ Peak Power / BM (W/kg) | 38 | 0.20 | 4.0 km/h | Lehman 2013 |
| IMTP Peak Force / BM (N/kg) | 28 | 0.15 | 3.0 km/h | Lehman 2013 |
| 앞발 수직 GRF / BW | 1.5 | 1.20 | 3.0 km/h | MacWilliams 1998 |
| 어깨 ER 최대 (deg) | 165 | 0.05 | 2.5 km/h | Werner 2008 |
| 스트라이드 / 신장 (%) | 85 | 0.30 | 3.0 km/h | Stodden 2001 |

### 해석 가이드

- **잔차 (residual) > 0 km/h**: 측정 구속이 잠재 추정보다 큼 → 효율 우수
- **잔차 ≈ 0 km/h**: 가용한 능력을 충분히 발현
- **잔차 < 0 km/h**: 잠재 미발현 → 기여도 상위 변수의 부족분이 개선 영역

---

## 2. Energy Leakage Index — ELI 6 Zones

각 zone 100점 = 이상적, 0점 = 완전 누수. 종합 ELI = 가용 zone 평균.

### Zone 정의·산출식·문헌 근거

| Zone | 변수 | 이상값 | 점수 변환 | 출처 |
|---|---|---|---|---|
| **Z1** Sequential timing | pelvis→trunk lag, trunk→arm lag (ms) | 40, 35 | 100 − \|Δ\|·1.2 (각각) | Aguinaldo 2009 |
| **Z2** X-factor | 골반-상체 분리 max (deg) | ≥40° | 선형 (15→0, 40→100) | Stodden 2005 |
| **Z3** Lead block | lead knee 각도 변화 FC→release (deg) | ≥+5° (신전) | collapse(-10°→0, +5°→100) | MacWilliams 1998 |
| **Z4** Trunk at FC | 전방 기울기, 측방 기울기 (deg) | 30°, <15° | 100 − \|fwd-30\|·2 − max(0,lat-15)·3 | Matsuo 2001 |
| **Z5** Shoulder alignment | ER max (deg) | 165~185° | 범위 외 ±2점/deg 감점 | Werner 2008 |
| **Z6** Pelvis braking | pelvis_AV at trunk_max / pelvis_peak_AV | <0.3 | 0.3→100, 0.8→0 (선형) | Aguinaldo 2009 |

### 인과 chain (impact_kmh)

각 zone의 부족분이 구속 손실에 기여하는 가중치:

$$\text{impact} = -\frac{(100 - \text{zone\_score}) \cdot w_{\text{zone}}}{10}$$

| Zone | 가중치 (impact_w) |
|---|---|
| Z1 시퀀스 | 0.18 |
| Z2 X-factor | 0.15 |
| Z3 Lead block | 0.18 |
| Z4 Trunk at FC | 0.14 |
| Z5 Shoulder ER | 0.12 |
| Z6 Pelvis brake | 0.20 |

가중치는 위 문헌의 회귀계수에서 보수적으로 도출. **표시되는 손실은 추정값**이며 개별 선수에 대한 단정적 예측이 아닙니다.

---

## 2.5 제구 통합 점수 (Command Composite — v3.0 신규)

같은 "제구"를 두 source 로 측정하여 통합:

$$\text{command\_composite} = 0.5 \cdot \text{Theia}_{kinematic} + 0.5 \cdot \text{Rapsodo}_{result}$$

### Theia (운동학적 일관성)

trial-level SD 기반:
- `release_height_sd_cm`: 2cm 초과 시 12pt/cm 감점
- `wrist_pos_sd_cm`: 2.5cm 초과 시 8pt/cm 감점
- `trunk_tilt_sd_deg`: 1.0° 초과 시 15pt/° 감점

### Rapsodo (결과 일관성)

- `command_score` 가 있으면 그대로 사용
- 없으면 `in_zone_pct × 1.4` (70% in-zone → 98점)

### Cross-validation

- 두 source 의 `release_height_sd_cm` 가 **<1cm 차이** = high agreement
- 1~2cm = medium · ≥2cm = low (측정 품질 경고)
- 두 점수 격차 > 25점 = "운동학 일관성과 실투 결과 사이 갭" 경고

### UI 표시

선수 페이지의 "부상위험·제구일관성" 카드 하단에 통합 점수 + Theia/Rapsodo 분리 점수 + 경고 표시.

---

## 2.6 GRF 정식 산출 (v3.1 신규)

### LHEI (Lead Hip Energy Index)

$$\text{LHEI} = \frac{\text{lead vertical impulse (N·s)}}{\text{body mass (kg)} \times \text{pitch time (s)}}$$

- **≥ 1.20 N·s/kg**: 우수 (100점)
- **0.90 ~ 1.20**: 평균 (70~100 선형)
- **< 0.90**: 부족 (선형 감점)

문헌: MacWilliams (1998), Kageyama (2014).

### Force Balance Score

$$\text{Balance} = 100 - \tfrac{|\text{rear}_{\%BW} - 75| \times 1.2 \,+\, |\text{lead}_{\%BW} - 100| \times 1.0}{2}$$

이상점: rear push-off 75% BW, lead block 100% BW. 편차마다 감점.

### Asymmetry Score

좌우 lateral force 비대칭이 5% 초과부터 4pt/% 감점.

### Type 분류 (5가지)

| 조건 | 분류 |
|---|---|
| asymmetry > 15% | **좌우로 새는** |
| rear > 90% & lead < 70% | **뒤에 처지는** |
| rear < 60% & lead > 95% | **앞으로 쏟아지는** |
| rear > 90% & lead > 110% | **잠깐만 미는** |
| 그 외 | **균형형** |

### 종합 GRF Score

$$\text{GRF\_score} = 0.50 \cdot \text{LHEI} + 0.30 \cdot \text{Balance} + 0.20 \cdot \text{Asymmetry}$$

---

## 2.7 Stuff Score 정식화 (v3.1)

Driveline "Stuff+" 모델·Pitching Ninja·Baseball Savant 참조한 가법 모델.

### 가중

$$\text{Stuff} = 0.30 \cdot V_{score} + 0.25 \cdot B_{score} + 0.25 \cdot I_{score} + 0.20 \cdot H_{score}$$

### 각 변수

| 변수 | 산출 | 임계 |
|---|---|---|
| **Velocity** (mph) | z-score → percentile | 코호트별 평균/SD |
| **Bauer Units** = spin_rpm / vMph | z-score → percentile | 코호트별 평균/SD |
| **IVB** (inch) | 22 inch ≥ 100, 16 이하 0, 선형 | 절대값 |
| **HB** abs (inch) | 4 이하 100, 12 이상 0, 선형 | FB는 작을수록 좋음 |

### 코호트별 벤치마크 (`STUFF_BENCHMARKS`)

| 코호트 | Velo (mph) | Bauer |
|---|---|---|
| KBO | 88 ± 3 | 25.5 ± 1.5 |
| HS  | 80 ± 4 | 24.0 ± 1.8 |
| **HS-1** | 77 ± 4 | 23.0 ± 2.0 |
| **HS-2** | 81 ± 4 | 24.0 ± 1.8 |
| **HS-3** | 84 ± 4 | 25.0 ± 1.8 |

학년 코호트 자동 선택 (선수.grade 가 있으면 `HS-{grade}`).
같은 130 km/h 라도 HS-1 에서는 우수, HS-3 에서는 평균.

### 한계

- Driveline 모델은 미국 프로 데이터 기반. 한국 고교 환경에서 weight 조정 가능성 있음.
- 측정 누적되면 자체 회귀로 가중치 재조정 권장.

---

## 3. Composite Score Weights

`COMPOSITE_WEIGHTS` 에 정식화. UI에서 인용 가능.

| 카테고리 | 구성 요소 | 가중치 |
|---|---|---|
| **velocity** | 측정 구속 percentile / 일관성 / 잠재 달성률 | 0.40 / 0.20 / 0.40 |
| **sequence** | ETE / SpeedGain / SeqOrder / LagTiming | 0.35 / 0.25 / 0.20 / 0.20 |
| **fault** | 일관성 / 부상위험 / 결함횟수 | 0.40 / 0.35 / 0.25 |
| **fitness** | CMJ PP/BM / IMTP PF/BM / 좌우대칭 | 0.40 / 0.40 / 0.20 |

---

## 4. 신뢰구간 (Confidence Interval)

trial-level 측정 (N≈10~12)에 대한 95% CI:

$$\bar{x} \pm t_{n-1, 0.025} \cdot \frac{s}{\sqrt{n}}$$

t-critical은 자유도 1~30 표 lookup, 30 이상은 정규근사 1.96.

### 함수 시그니처

```js
ANALYTICS.confidenceInterval(values, alpha=0.05)
// → { mean, sd, n, se, ci_half, lo, hi }
```

### Paired t-test (전·후 비교)

회차 1 vs 회차 3 (상반기 vs 하반기 Theia+GRF) 비교에 사용.
유의 판단은 |t| > t_crit 기준의 직관적 보고만 — 다중 비교 보정은 수행하지 않음.

---

## 5. 한계·주의 사항

1. **회귀 계수는 문헌 기반 합의 추정값** — 우리 코호트 (N=20 고교 투수)에 fit 된 값이 아님. 1년 측정 데이터가 누적되면 자체 회귀로 재추정 권장.
2. **ELI zone 점수는 단일 trial 평균** — trial-to-trial variability 미반영. CI는 향후 trial-level 데이터로 개선.
3. **causal_chain의 km/h 손실은 추정** — 단일 변수의 한계 효과로 해석. 변수 간 상호작용 미고려.
4. **Uplift 회차** (markerless GRF 없음): ELI의 zone 3, 4, 6은 제한적이며 leakage 산출 안 됨.
5. **다중 비교 보정 미수행** — 여러 지표를 동시 검정 시 타입 I 오류율 증가 가능.

---

## 6. 문헌

- Aguinaldo AL, Chambers H. *Correlation of throwing mechanics with elbow valgus load in adult baseball pitchers.* Am J Sports Med. 2009;37(10):2043-8.
- Lehman G, Drinkwater EJ, Behm DG. *Correlation of throwing velocity to the results of lower-body field tests in male college baseball players.* J Strength Cond Res. 2013;27(4):902-8.
- MacWilliams BA, Choi T, Perezous MK, Chao EYS, McFarland EG. *Characteristic ground-reaction forces in baseball pitching.* Am J Sports Med. 1998;26(1):66-71.
- Matsuo T, Escamilla RF, Fleisig GS, Barrentine SW, Andrews JR. *Comparison of kinematic and temporal parameters between different pitch velocity groups.* J Appl Biomech. 2001;17(1):1-13.
- Stodden DF, Fleisig GS, McLean SP, Lyman SL, Andrews JR. *Relationship of pelvis and upper torso kinematics to pitched baseball velocity.* J Appl Biomech. 2001;17(2):164-72.
- Stodden DF, Fleisig GS, McLean SP, Andrews JR. *Relationship of biomechanical factors to baseball pitching velocity: within pitcher variation.* J Appl Biomech. 2005;21(1):44-56.
- Werner SL, Suri M, Guido JA, Meister K, Jones DG. *Relationships between ball velocity and throwing mechanics in collegiate baseball pitchers.* J Shoulder Elbow Surg. 2008;17(6):905-8.

---

*v2.1 (2026-05-09): 잠재구속 회귀·ELI 정식 산출·신뢰구간·composite weights — analytics.js로 모듈화.*
