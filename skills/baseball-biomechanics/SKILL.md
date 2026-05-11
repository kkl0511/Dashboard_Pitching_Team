---
name: baseball-biomechanics
description: 야구 투수 바이오메카닉스 분석을 위한 범용 reference. Driveline 5 모델 (Arm Action / Posture / Rotation / Block / CoG), HP Composite 6축, ETE (분절간 에너지 전달 효율), GRF (지면 반력) 핵심 변인 정의 + Elite 임계값 + 측정 방법론. c3d 파일 처리, Chart.js 시각화, Theia/Visual3D pipeline 작업 시 자동 trigger.
---

# 야구 투수 바이오메카닉스 — Reference Skill

야구 투수 메카닉 분석에 필요한 핵심 framework + 변인 + 임계값을 정리한 범용 reference.
출처: Driveline Pitching Assessment, Aguinaldo & Escamilla, Naito & Fujii, MacWilliams 등.

## Driveline 5 모델 (메카닉 평가)

각 축 100 = HS group 평균, 130+ = elite (90+ mph cohort).

### 1. 팔동작 (Arm Action) — 6 변인

| 변인 | 단위 | Elite 기준 | 의미 |
|---|---|---|---|
| Layback (Pitching_Shoulder_Angle_Z max) | deg | ≈ 190° | 어깨 최대 외회전. 클수록 sling-shot ↑. 220° 초과 시 부상 위험 |
| Elbow Extension Velo (Pitching_Elbow_Ang_Vel_X peak) | deg/s | ≈ 2,318 | 너무 이른 신전 = valgus stress (Tommy John) |
| Shoulder Abduction at FP (Pitching_Shoulder_Angle_Y at FC) | deg | ≈ 84° (90±10) | 너무 낮으면 sidearm |
| Scap Load at FP (Pitching_Shoulder_Angle_X at FC) | deg | ≈ 51° | 견갑 retraction |
| Shoulder Rotation Velo (Pitching_Shoulder_Ang_Vel_Z peak) | deg/s | ≈ 4,673 | 4,500+ = elite. IR 폭발력 |
| Elbow Flexion at FP (Pitching_Elbow_Angle_X at FC) | deg | ≈ 102° (90~110) | 90 미만 = inverted W |

### 2. 자세 (Posture) — 6 변인

| 변인 | 단위 | Elite 기준 | 의미 |
|---|---|---|---|
| X-factor (Trunk_wrt_Pelvis_Angle_Z max) | deg | ≈ 50° | 골반-몸통 분리각. 30° 미만 = 분리 부족 |
| Counter Rot (Trunk_Angle_Z windup peak) | deg | ≈ −38° (Driveline 변환) | 와인드업 반대 회전 |
| Forward Tilt at FP (Trunk_Angle_X at FC) | deg | ≈ +4° (5±5) | 음수 = standing tall |
| Torso Rotation at FP (Trunk_Angle_Z at FC) | deg | ≈ +2° (closed) | Early opening = 구속 손실 |
| Side Bend at MER (Trunk_Angle_Y at MER) | deg | ≈ 22° (20~30) | high arm slot 유지 |
| Torso Rotation at BR (Trunk_Angle_Z at BR) | deg | ≈ +111° (Driveline 변환) | 110+ = full follow-through |

### 3. 회전 속도 (Rotation) — 2 변인

| 변인 | 단위 | Elite 기준 |
|---|---|---|
| Pelvis Rotation Velo (Pelvis_Ang_Vel_Z peak) | deg/s | ≈ 597 (600+ elite) |
| Trunk Rotation Velo (Thorax_Ang_Vel_Z peak) | deg/s | ≈ 965 (Speed Gain Trunk/Pelvis = 1.4~2.0) |

### 4. 앞다리 제동 (Block) — 4 변인

| 변인 | 단위 | Elite 기준 |
|---|---|---|
| Lead Knee Extension (Lead_Knee_Angle_X BR − FC) | deg | ≈ 11° (양수 = good block) |
| Stride Length (STRIDE_LENGTH_X) | cm | ≈ 147 (신장의 80~100%) |
| Peak Lead Knee Ext Velo (Lead_Knee_Ang_Vel_X peak) | deg/s | ≈ 316 |
| CoG Decel AE (회귀 잔차) | m/s | 양수 = 우수 block |

### 5. 체중이동 (CoG) — 2 변인

| 변인 | 단위 | Elite 기준 |
|---|---|---|
| Max CoG Velo (COM_displacement_Y d/dt peak) | m/s | ≈ 2.4 |
| CoG Decel (Max − BR velocity) | m/s | ≈ 1.32 |

## ETE — 분절간 에너지 전달 효율 (4 transition)

분절 peak ω 시각 차이 (lag, ms). 정상 = proximal-to-distal 순서.

| Transition | Elite Lag (ms) | 의미 |
|---|---|---|
| Pelvis → Trunk | 5~25 (markered) / 0~80 (markerless KR cohort) | 골반이 먼저 회전 후 몸통 |
| Trunk → Humerus | 50~110 (markered) / 40~130 (markerless) | Layback stretch-reflex 활용 |
| Humerus → Forearm | 5~20 | 너무 짧으면 너무 이른 elbow 신전 |
| Forearm → Hand | 5~15 | 손이 마지막 가속 |

음수 = 역전 (구속 손실). 점수: 100 = 정상, 60 미만 = 큰 leak.

## GRF — 지면 반력 (핵심 변인)

| 변인 | 단위 | Elite 기준 |
|---|---|---|
| Lead Vertical (FP1_Z peak) | %BW | 200~280 |
| Drive Vertical (FP2_Z peak) | %BW | 110~150 |
| Lead AP Braking Impulse (FP1_Y impulse 음수) | %BW·s | 18~28 |
| Drive AP Propulsive Impulse (FP2_Y impulse 양수) | %BW·s | 12~20 |
| LHEI (Lead Horizontal Energy Index) | 0~100 | 80+ = elite |

**중요**: FP1 / FP2 매핑은 사용 시스템 manual 확인 필수. V3D Manual 은 FP1=뒷발이지만 실제 측정 환경에 따라 다를 수 있음.

## HP Composite — 체력 6축 (Driveline HP Assessment)

각 축 100 = HS group 평균. 90+ mph cohort 목표 = ~130+.

| 축 | 약어 | 측정 변인 | 단위 | HS 평균 | 90+ mph cohort |
|---|---|---|---|---|---|
| 최대 힘 | Strength | IMTP Net Peak Force | N | 2316 | 2940 |
| 체중 대비 힘 | Rel. Strength | IMTP / BW | N/kg | 28 | 33.7 |
| 점프 파워 | Power | SJ Peak Power / BW | W/kg | 50 | 65 |
| 체중 대비 파워 | Rel. Power | CMJ Peak Power / BW | W/kg | 45 | 60 |
| 반응성 강도 | Reactive | Pogo RSI | m/s | 2.6 | 3.07 |
| 상체 파워 | Upper Power | Plyo Push Up Peak Force | N | (코호트별) | (코호트별) |

## 랩소도 (Pitch Tracking) — 핵심 변인

| 변인 | 단위 | Elite 기준 |
|---|---|---|
| 평균 구속 | km/h | 140+ (HS), 145+ (KBO) |
| 회전수 | rpm | 2400+ |
| True Spin (gyro 제외) | rpm | 2300+ |
| 회전 효율 (%) | % | 95+ |
| 수직 무브 (IVB) | cm | 45+ |
| 수평 무브 (HB) | cm | ±15-25 (구종) |
| 릴리스 연장 | m | 1.85+ (체감 +2 km/h) |
| Bauer Units (회전수/구속 mph) | — | 26+ |
| Stuff Score | 0-100 | 70+ = elite |
| Command Score | 0-100 | 70+ = elite |

## 핵심 이벤트 시점

```
Hand Sep → Max Knee Lift → Foot Plant (FP/FC) → MER → Ball Release (BR) → Max IR
   |              |              |              |          |              |
   와인드업       리프팅         앞발 착지      최대 외회전  공 릴리스      최대 내회전
```

- **FP/FC** (Foot Plant / Foot Contact): 앞발 착지 시점 — 메카닉 평가의 기준점
- **MER** (Maximum External Rotation): 어깨 최대 외회전 (Layback)
- **BR** (Ball Release): 공이 손에서 떨어지는 순간

## Visual3D 좌표계 (일반)

V3D 기본: X+ = 3루, Y+ = 홈, Z+ = 위 (lab frame)
**Driveline 모델은 다른 좌표계** — Trunk rotation 변인은 `(90 − V3D값)` 변환 필요. 다른 변인은 변환 불요.

## 측정 시스템

| 시스템 | 측정 항목 | 출력 |
|---|---|---|
| **Theia** | Markerless motion capture | Kinematic (관절 각도, 각속도) |
| **Force Plate** (AMTI) | 지면 반력 | GRF (kinetic) |
| **ForceDecks** (VALD) | CMJ / SJ / IMTP / Pogo | 체력 (HP Composite 6축) |
| **Rapsodo** | Pitch tracking | 구속, 회전, 무브, 릴리스 |
| **Visual3D** | Pipeline (Theia + GRF 통합) | c3d.txt export |

## 참고 문헌

- **Driveline Pitching Assessment** (5 모델 + Per 1mph)
- **Aguinaldo & Escamilla** (2007/2019) — proximal-to-distal sequence
- **Naito & Fujii** (2008) — kinetic chain
- **MacWilliams** (1998) / **Werner** (2008) — GRF
- **De Leva** (1996) — segment inertia
- **Howenstein** (2020) — NewtForce

모든 elite 기준은 **90+ mph (≈ 145 km/h) cohort 50th percentile**.

## 일반적 처방 매핑

| 약점 | 처방 |
|---|---|
| Layback 부족 | 어깨 모빌리티 (sleeper stretch) · long-toss · plyo-ball Layback drill |
| 어깨 외전 부족 | 셋업 단계 어깨 90° 외전 cueing · scap retraction throw |
| Scap Load 부족 | 광배·후면삼각근 강화 · scap retraction throw drill |
| Shoulder IR 속도 부족 | Layback 후 explosive 외→내회전 plyo throw · ball weight 진행 |
| X-factor 부족 | 골반-몸통 분리 throw · medball rotational throw · Pallof press |
| Counter Rot 부족 | 와인드업 시 몸통 반대 회전 강조 · stride 시 어깨 잔류 cueing |
| Forward Tilt 부족 | Front leg block + 코어 stability drill · medicine ball forward throw |
| Lead Knee Collapse | 앞발 착지 후 knee 신전 강조 · RDL · lateral squat |
| Stride 짧음 | Stride 거리 점진 증가 (체중 90%+) · towel drill |
| Lead AP Impulse 부족 | Lead leg AP impulse 18-28%BW·s 목표 · 앞발 block + 골반 braking 통합 |
| Pelvis 가속 부족 | Hip rotation banded drill · 골반 단독 회전 plyo |
| Trunk 가속 부족 | Medball rotational throw (heavy → light) · core power |
| Drive Vertical 부족 | Trail leg push-off drill · 마운드 압력 cueing |

## 친근 언어 변환 (선수/코치용 설명 시)

| 학술어 | 친근 언어 |
|---|---|
| Layback | 어깨 젖힘 |
| Scap Retraction | 견갑 모음 / 등 뒤 어깨뼈 모음 |
| X-factor | 골반-어깨 분리 |
| Counter Rotation | 등판이 타자에게 보이게 |
| Forward Tilt | 앞으로 기울임 |
| Lead Knee Collapse | 앞다리 무릎 무너짐 |
| Stride | 보폭 |
| Drive leg push-off | 뒷발 차기 |
| Proximal-to-distal | 안쪽부터 바깥쪽으로 (골반 → 손) |
| Kinetic chain | 힘 흐름 |
| Lag | 타이밍 차이 |
| Leak | 힘 새는 것 |
