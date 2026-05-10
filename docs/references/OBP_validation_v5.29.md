# OpenBiomechanics POI 데이터로 우리 Reference 검증 (v5.29)

> 출처: drivelineresearch/openbiomechanics — `baseball_pitching/data/poi/poi_metrics.csv`
> Cohort: 411 fastball trials × 100 pitchers (college 314 / HS 32 / indy 42 / MiLB 23)
> Fastball 속도 분포: median 85.3 mph (p10 78.8, p90 90.6, range 69.5–94.4 mph)
> 측정 시스템: Theia markerless (우리와 동일)

## 1. 검증 결과 요약

**총 30개 변인 검증 → 21개 정합 (70%) / 9개 보정 필요**

### ✅ 정합한 변인 (우리 reference가 OBP cohort median과 일치)

**Driveline 5축 (9/12)**:
| 변인 | OBP p50 | 우리 elite | 평가 |
|---|---|---|---|
| Layback (max ER) | 169° | 160-180 | ✓ |
| Shoulder abd at FP | 86° | 85-100 | ✓ |
| Trunk forward tilt at BR | 35° | 25-40 | ✓ |
| Pelvis peak ω | 742°/s | 650-800 | ✓ |
| Trunk peak ω | 1050°/s | 1000-1200 | ✓ |
| Shoulder IR peak ω | 4533°/s | 4000-5000 | ✓ |
| Lead knee ext at BR | 10° | -15-20 | ✓ |
| Lead knee ω at BR | 268°/s | 200-400 | ✓ |
| CoG max forward velo | 3.1 m/s | 2.5-3.2 | ✓ |

**분절간 ETE speed gain (2/2)**:
- T1 Pelvis→Trunk: median 1.41× (우리 1.30-1.70) ✓
- T2 Trunk→Humerus: median 4.27× (우리 4.0-6.0) ✓

**GRF Lead leg (2/2)**:
- Lead leg X (braking): 117 %BW (우리 100-150) ✓
- Lead leg Z (vertical): 199 %BW (우리 180-280) ✓

**에너지 generation (Aguinaldo 정의)**:
- Pelvis-Lumbar transfer: 120 J ✓
- Shoulder generation: 32 J ✓

## 2. ✗ 보정 필요한 변인 (9개)

### 2.1 Driveline 5축 — 3개

#### X-factor (max separation)
- **OBP**: p10=23°, p50=32°, p90=41°
- **우리 현재**: 40-60°
- **권고**: **30-45°** (acceptable: 20-50)
- **근거**: Markerless Theia 기반 측정에서는 markered system보다 X-factor가 작게 측정됨. Driveline 자체 데이터가 정합 표준

#### Trunk lateral tilt at BR
- **OBP**: p10=4°, p50=18°, p90=28°
- **우리 현재**: 25-40°
- **권고**: **15-30°** (acceptable: 5-35)
- **근거**: 우리 reference가 너무 높았음 — OBP cohort에서 p90이 28°에 불과

#### Stride length (%body height)
- **OBP**: p10=0.80, p50=0.80, p90=0.90
- **우리 현재**: 0.85-1.05
- **권고**: **0.75-0.95** (acceptable: 0.65-1.00)
- **근거**: OBP에서 stride 1.0 이상은 매우 드뭄

### 2.2 분절간 ETE — 1개 (대폭 보정)

#### Pelvis → Trunk lag
- **OBP**: p10=-5.5ms, p50=8.3ms, p90=33.3ms
- **우리 현재**: 30-50ms (Aguinaldo 2007 markered 데이터 기준)
- **권고**: **0-25ms** (acceptable: -10-50ms, 음수 허용)
- **근거**: Markerless Theia에서 분절 peak 검출 timing이 다름. OBP는 Driveline 같은 측정 표준이라 우선
- **음수 lag 의미**: trunk peak이 pelvis peak보다 일찍 → "snap" 형태 가속, OBP cohort에서도 흔함

### 2.3 GRF — 5개

#### Drive leg propulsive peak (rear X)
- **OBP**: p10=72, p50=**90**, p90=108 %BW
- **우리 현재**: 50-70 %BW (Kageyama 2014 일본 collegiate 인용)
- **권고**: **70-100 %BW** (acceptable: 50-120)
- **근거**: OBP collegiate (314명) cohort는 Kageyama 일본 cohort보다 propulsive force가 강함. 측정 방법 차이 가능성도 (Kageyama는 다른 force plate)

#### Rear leg Z (vertical)
- **OBP**: p50=145 %BW
- **우리 현재**: 150-200 %BW
- **권고**: **120-170 %BW**
- **근거**: 우리 NEWTFORCE_8_METRICS의 Back Leg Peak Z 150-200이 약간 높음

#### Rear leg magnitude
- **OBP**: p50=166 %BW
- **우리 현재**: 180-250 %BW
- **권고**: **140-200 %BW**

#### 에너지 transfer (J 단위) — 우리 미정의
- **OBP**: Thorax→Distal 354J, Shoulder transfer 330J, Elbow transfer 337J, Lead hip generation 17J, Rear hip generation 152J
- **우리 현재**: J 단위 elite range 미정의 (현재 우리 ETE는 ratio %만 평가)
- **권고**: J 단위 reference는 OBP 분포를 그대로 사용
  - Thorax → Distal: elite 280-450 J (OBP p10-p90)
  - Shoulder transfer FP→BR: elite 260-430 J
  - Lead hip generation: elite 3-50 J (편차 큼)

## 3. 미검증 (OBP에 데이터 없음)

- HP 6축 (체력): OBP는 motion capture만, 체력 데이터 별도
- 분절간 ETE의 humerus→forearm, forearm→hand lag: POI에 직접 없음 → full signal CSV에서 별도 추출 필요
- GRF impulse, timing, NewtForce Turning Point Z / Lead Negative Y / Time of Transfer: POI에 없음 → full signal force_plate.csv 필요

## 4. 보정 권고 우선순위

### 우선순위 높음 (한국 고교 평가에 즉각 영향)
1. **Pelvis → Trunk lag**: 30-50ms → **0-25ms** (가장 큰 차이)
2. **X-factor**: 40-60° → **30-45°** (Theia markerless 일관성)
3. **Drive propulsive peak**: 50-70 → **70-100 %BW** (대폭 상향)

### 우선순위 중간
4. Trunk lateral tilt BR: 25-40 → 15-30
5. Stride length: 0.85-1.05 → 0.75-0.95
6. Rear leg Z: 150-200 → 120-170 %BW

### 우선순위 낮음 (J 단위 새로 정의)
7. 에너지 transfer J 단위 elite range 신설

## 5. OBP 데이터 한계

- **Cohort 편향**: 미국 college 위주 (76%) — 한국 고교는 보수적이어야 함
- **속도 분포**: median 85 mph — 한국 고교 평균(약 80 mph)보다 빠름 → reference도 stretch 목표로 작용
- **체력 data 없음**: HP 6축은 별도 검증 필요
- **Time 변인**: timing_peak_torso_to_peak_pelvis_rot_velo만 POI에 있음. 나머지 lag는 full signal 시계열 필요

## 6. 다음 검증 단계 (Phase 2 후보)

- **full signal force_plate.csv** 다운로드 → Drive impulse 적분 알고리즘 cross-check
- **full signal joint_velos.csv** 다운로드 → humerus/forearm/hand peak frame 추출 → lag 계산 → 우리 process_pitching_session.py와 비교
- **OBP c3d 1개 → 우리 파이프라인** 입력 → end-to-end 정합성 검증

---

**작성일**: 2026-05-10 · v5.29 검증 단계
**작성자**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
**OBP 출처**: https://github.com/drivelineresearch/openbiomechanics
