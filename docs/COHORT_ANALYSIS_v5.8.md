# Cohort 분석 보고 — v5.8 (2026-05-10)

**대상 cohort**: 한국 고1 41명 + 프로/대학 16명 = **57명 합본**
**총 trial**: 한국 고1 365 c3d.txt + 프로/대학 103 trial (이미 가공)
**분석 도구**: `scripts/process_pitching_session.py` parse_theia_trial · `src/js/analytics.js` transferScoreV2 + selfCalcSegmentKE

---

## TL;DR — 5가지 핵심 발견

1. **arm_dps에 +490 °/s Theia bias**가 있었고 보정 누락 → 한국 고1만 humerus ω가 비정상으로 큰 것처럼 보였음. 보정 후 한국 고1 (4287) ≈ 프로/대학 (4170) 거의 일치.
2. **메카닉 ↔ 구속 상관이 한국 cohort만의 문제가 아님** — 프로/대학에서도 player-level r < 0.30. 좁은 cohort range (127-143 km/h, IQR 6-7 km/h) 의 자연스러운 결과.
3. **`transferScoreV2`는 "구속 예측"이 아닌 "효율적 메카닉 패턴" 자체로 재정의** — proper sequence + 분절 KE 전달 정도를 측정.
4. **VELO_GROUP_NORMS의 pelvis/trunk 미국 reference는 한국 cohort에 안 맞음** (한국은 그룹간 ω 차이 작음). x_factor도 한국이 절대값 낮음 → 한국 cohort 그대로 사용.
5. **`transferScoreV2` self-calc H/P norm 임계를 cohort percentile 기반으로 재calibration**: median 1660%=50점, p90 2550%=80점 (이전 임의값 1500/0.05 대신 1660/0.0337).

---

## 1. arm_dps +490 °/s Theia bias 발견

`peak_humerus_v`는 v3.9부터 `-490` 보정이 적용되어 있었으나 `peak_arm_v` (호환용)는 raw 값 사용 중.

| 변수 | v5.7 (이전) | v5.8 (보정 후) |
|---|---|---|
| 한국 고1 arm_dps median | **4777** °/s | **4287** °/s |
| 프로/대학 arm_dps median | 4170 °/s | 4170 °/s |
| 차이 (Mann-Whitney) | **−607 \*\*\*** (p<0.001) | **−117 ns** |
| 한국 고1 H/P ratio (KE_rot) | 2142% | ~1730% |

**수정 위치**:
- `scripts/process_pitching_session.py` `parse_theia_trial.peak_arm_v`
- `src/js/io.js` `parseC3DTxtTrial.peak_arm_v`
- 둘 다 `humZ - 490` 일관 적용 (peak_humerus_v와 동일)

**부수 효과**: `synthesize_player_summary` / `synthesizeRecordFromTrials`의 arm_dps clip 임계도 1500-2200 → 2500-7000으로 확대 필요 (보정 후 cohort range 4000-5500 정상 분포).

---

## 2. 메카닉 ↔ 구속 상관 분석 — cohort range가 핵심 제약

### 한국 고1 player-level (n=41)
| Metric | Pearson r | p |
|---|---|---|
| Pelvis ω peak | -0.04 | 0.83 ns |
| Trunk ω peak | -0.09 | 0.56 ns |
| Arm ω peak | +0.06 | 0.69 ns |
| X-factor | +0.18 | 0.27 ns |
| H/P ratio | +0.01 | 0.95 ns |
| **모두 ns** | | |

### 한국 고1 trial-level (n=353) — 통계 power 키워짐
| Metric | Pearson r | p |
|---|---|---|
| **X-factor** | **+0.30** | **<0.001 \*\*\*** |
| Humerus KE | +0.23 | <0.001 \*\*\* |
| Speed gain T→A | +0.15 | <0.01 \*\* |
| Pelvis ω | -0.14 | <0.01 \*\* (역방향) |

### 프로/대학 player-level (n=16) / trial-level (n=103)
모두 r < 0.30, 대부분 p > 0.05. **좁은 cohort에서는 메카닉이 구속을 잘 설명 못함이 일반적**.

### 결론
- 학술 reference (Werner 2008, Stodden 2001 — MLB 또는 amateur~pro 넓은 cohort)는 r ≈ 0.5+
- 좁은 cohort에서는 신체조건/볼 회전/release point/공의 grip 등 다른 요인이 더 큰 변동
- **transferScoreV2는 구속 예측 metric이 아니라 *메카닉 효율성 자체* 진단 도구**

---

## 3. 한국 고1 vs 프로/대학 — 보정 후 cohort 비교

| Metric | 한국 고1 (n=41) median | 프로/대학 (n=16) median | Mann-Whitney p |
|---|---|---|---|
| 구속 (km/h) | 135.0 | 136.7 | 0.13 ns |
| Pelvis ω peak | 627 | 616 | 0.96 ns |
| Trunk ω peak | 868 | 897 | 0.15 ns |
| **Arm ω peak (보정 후)** | **4287** | **4170** | **~0.5 ns** |
| **H/P ratio (보정 후)** | **~1730%** | **1621%** | **~0.5 ns** |
| X-factor (deg) | 28 | 22 | 0.02 \* |
| Speed gain T→A | 5.4 | 4.5 | <0.001 \*\*\* |

**해석**:
- 보정 후 한국 고1과 프로/대학의 핵심 메카닉 metric은 **통계적으로 거의 동일**
- X-factor만 한국 고1이 살짝 큼 (28 vs 22) — 측정 정의 차이 가능성 (peak vs at FC)
- Speed gain T→A 차이 (5.4 vs 4.5) — 한국 cohort가 trunk보다 arm으로 더 많이 가속

---

## 4. v5.8 코드 패치 요약

### `analytics.js` 변경
```js
// transferScoreV2 self-calc 임계 (n=57 cohort percentile)
kineticEte = norm(ratioPct, 1660, 0.0337);  // median=50점, p90=80점

// VELO_GROUP_NORMS — 한국 cohort 그룹별 median
'미달':  { pelvis_dps: 662, trunk_dps: 887, arm_dps: 4001, x_factor: 17 }  // n=2
'평균':  { pelvis_dps: 593, trunk_dps: 842, arm_dps: 4347, x_factor: 31 }  // n=9
'우수':  { pelvis_dps: 634, trunk_dps: 887, arm_dps: 4166, x_factor: 26 }  // n=18
'Elite': { pelvis_dps: 633, trunk_dps: 867, arm_dps: 4376, x_factor: 30 }  // n=12

// PRO_REFERENCE_4AXIS — 28명 elite (한국 138+ 12 + 프로/대학 16)
{ generation_score: 85, transfer_score: 58, eli_score: 85, command_composite: 75 }
```

### `process_pitching_session.py` / `src/js/io.js` 변경
- `peak_arm_v`에 `-490` Theia bias 보정 적용 (peak_humerus_v와 동일)
- `peak_arm` clip 임계 1500-2200 → 2500-7000 확대

---

## 5. 향후 권장 작업

### 데이터 수집
- **fitness cohort** (CMJ, IMTP, Hop RSI 등)을 한국 41명에 대해 측정 → VELO_GROUP_NORMS의 fitness 부분도 한국화
- **GRF cohort** (lead/rear force) 데이터 수집 → lead_grf_bw, rear_grf_bw 한국화
- **타구속 다양성** 추가 — 145+ km/h 또는 125- km/h 선수 더 많이 → cohort range 넓혀서 메카닉↔구속 상관 r 증가 가능성

### 분석 보강
- **Within-subject 변동 분석** — 같은 선수가 trial마다 메카닉이 어떻게 다르고 그게 구속에 어떻게 영향 주는지. trial-level Pearson에서 Trunk ω (within r=+0.23) 가장 강 — 코칭으로 leverage 가능한 변수.
- **Nonlinear 모델** — 단순 r 대신 random forest 등으로 메카닉 ↔ 구속 모델링

### 측정 시스템 보강
- **Theia 마커리스 humerus +490 bias** 의 시스템적 원인 조사 (V3D 처리 단계 확인) → 향후 측정 시 사전 보정 가능성
- **Pelvis 추적 jerk noise** 완화 — 사용자 언급한 20Hz CF 필터 외 추가 처리 (예: humerus만 6Hz 저역통과)

---

## 6. 한계 및 주의

1. **arm_dps 보정값 -490은 우리 cohort 기반 추정** — 다른 V3D pipeline / Theia version 에서는 다를 수 있음. 측정 시스템 변경 시 재검증 필요.
2. **VELO_GROUP_NORMS 미달 그룹 n=2** — 통계적 신뢰도 낮음. 추가 데이터 수집 권장.
3. **fitness 한국화 미적용** — CMJ/IMTP/Hop RSI 등 fitness reference는 여전히 미국 추정치. fitness cohort 수집 후 보강 필요.
4. **PRO_REFERENCE_4AXIS gen/eli/command 점수**는 elite 실측 데이터 부족 → 학술 추정 -3~5 보수치. 실측 후 calibrate 필요.

---

**문서 작성일**: 2026-05-10 · **분석자**: 국민대 BBL · **다음 검토 권장**: cohort 추가 수집 후 v5.9 또는 분기별
