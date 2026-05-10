# 상동고 대시보드 v5.32 — Handoff

> **새 대화에서 이 파일부터 읽으세요:**
> ```
> Read docs/HANDOFF_v5.32.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. v5.31의 KR vs OBP 시스템 비교 후, **v5.32에서 FP1/FP2 매핑 수정 (사용자 confirmed: FP1=앞발/lead, FP2=뒷발/drive — 기존 매뉴얼 v1.1 표기 반대로 잘못됐었음)** + **KR 통합 cohort 59명 × 518 trials 일괄 처리 (Accurate_Data 18명 + raw data 41명) + KR 135+km/h subset (n=22명, 126 trials) 가공값 + 우리코드 분포 비교 + driveline.js GRF/NewtForce elite_range 4개 정밀화**.

## 1. v5.32 주요 변경

### A. FP1/FP2 매핑 수정 (가장 중요)

**기존 v1.1 매뉴얼**: "FP1=축발(뒷발), FP2=착지발(앞발)" — **반대로 잘못됨**.
**v5.32 수정**: **FP1=앞발(lead/착지발), FP2=뒷발(rear/drive/축발)** ← 사용자 confirmed.

`scripts/process_pitching_session.py`:
- 기존: peak Z 큰 쪽이 lead라는 가정으로 자동 swap
- v5.32: 강제 매핑 — **FP1=lead, FP2=drive 무조건**

### B. KR 통합 cohort 59명 × 518 trials 일괄 처리

| Source | 선수 | Trials |
|---|---|---|
| Accurate_Data.zip | 18명 | 153 |
| raw data.zip | 41명 | 365 |
| **통합 (공통 0)** | **59명** | **518 trials** |

처리 결과 (v5.32 알고리즘):

| 변인 | v5.28 가용성 | **v5.32 가용성** |
|---|---|---|
| Drive propulsive peak/impulse | 3% (4/153) | **96% (496/518)** ✅ |
| Pelvis→Trunk lag | — | **94% (488/518)** |
| Trunk→Humerus lag | — | **98% (507/518)** |
| Lead block duration | — | **96% (496/518)** |
| Lead braking peak | 76% (117/153) | 1% (3/518) ⚠️ |
| NewtForce Time of Transfer | 2% | 1% (디버깅 필요) |

**Drive 96% 확보가 큰 진전** (FP1/FP2 매핑 수정 결정적). Lead/NewtForce는 알고리즘 추가 디버깅 필요 (다음 라운드).

ball_speed metadata 매핑: 355/518 (69%, 한국 고1 정밀측정.xlsx 기반).
**135+ km/h subset: 126 trials, 22명** (이전 v5.31의 14명 → 22명 확장).

### B-2. xlsx 가공값 vs 우리코드 직접 비교 (135+ subset)

| 변인 | xlsx p50 (n=47) | 우리코드 p50 (n=126) | Δ% | 평가 |
|---|---|---|---|---|
| Pelvis ω | 630 | 614 | -2.6% | ✓ 정합 |
| Trunk ω | 910 | 868 | -4.6% | ✓ 정합 |
| Arm ω | 4184 | 4356 | +4.1% | ✓ 정합 |
| Trunk→Arm lag | 83ms | 73ms | -11.7% | ⚠ 약간 차이 |
| Stride length | 144cm | 144cm | +0.2% | ✓ 정합 |
| Max Shoulder ER | 178° | 186° | +4.3% | ✓ 정합 |
| **Pelvis→Trunk lag** | **7ms** | **37ms** | **+424%** | ✗ 큰 차이 |
| Peak X-factor | 21.6 | 28.0 | +29.5% | ✗ 차이 |
| FC X-factor | 18.5 | 24.5 | +32.4% | ✗ 차이 |

→ **ω peak + 자세 5개 정합** (코드 정확). **Lag + X-factor 알고리즘 디버깅 필요**.

### C. KR cohort GRF 변인 — xlsx 가공값을 ground truth로

우리 process_pitching_session.py의 GRF 알고리즘이 **xlsx 가공값보다 12배 작게 측정** (예: lead AP 12 %BW vs xlsx 134 %BW). 진짜 reference는 xlsx 쪽이 맞음. 코드 디버깅은 추후, 일단 **xlsx 가공값을 KR cohort reference로 채택**:

| 변인 | KR 135+ p25-p75 (xlsx, n=47) | OBP 90+ p10-p90 |
|---|---|---|
| Trail (Drive) vertical | 139-166 %BW | 113-158 %BW |
| Trail AP/Y (Drive propulsive) | **56-81 %BW** | 77-104 %BW |
| Lead vertical | 191-238 %BW | 185-253 %BW |
| Lead AP/Y (braking) | **100-146 %BW** | 108-145 %BW |
| Trail impulse stride (BW·s) | 0.86-0.98 | (n/a in OBP POI) |
| Trail→Lead vGRF time (Time of Transfer) | 263-375 ms | (n/a) |
| Clawback time | 131-333 ms | (n/a) |

### D. driveline.js v5.32 보정 (4개)

| 변인 | v5.30/31 | **v5.32** | 근거 |
|---|---|---|---|
| `GRF_HORIZONTAL_REF.drive_propulsive_peak.elite_range` | [70, 100] | **[55, 80]** | KR 135+ p25-p75 |
| `GRF_HORIZONTAL_REF.lead_braking_peak.elite_range` | [100, 150] | **[100, 145]** | KR 135+ p25-p75 (정합 양호) |
| `NEWTFORCE_8_METRICS.back_leg_peak_z.elite_range` | [120, 160] | **[135, 165]** | KR 135+ p25-p75 |
| `NEWTFORCE_8_METRICS.lead_leg_peak_z.elite_range` | [180, 280] | **[195, 240]** | KR 135+ p25-p75 |
| `NEWTFORCE_8_METRICS.back_leg_peak_y.elite_range` | [70, 100] | **[55, 80]** | drive_propulsive와 alias 동기화 |

### E. 검증 결과
- ✅ verify_build.sh: PASS 43 / FAIL 0
- ✅ dashboard.html 508,249 bytes
- ✅ FP1=lead 강제 매핑 process_pitching_session.py 적용
- ✅ Drive propulsive 추출 가용성 3% → 92%

## 2. 미완 / 다음 라운드

### 우선순위 높음
1. **Lead leg AP GRF 알고리즘 디버깅** — xlsx 134 %BW vs 우리 12 %BW (12배 차이)
   - 윈도우 (FC ~ Lead toe-off) 적정한지
   - Y 좌표계 부호 + force plate orientation 재검증
   - leeyoungha_3 trial로 step-by-step trace
2. **NewtForce Time of Transfer 알고리즘 디버깅** — 현재 2% 가용성
3. **R_Forearm_Ang_Vel 컬럼 누락 처리** — KR 153 trial 모두 forearm 변인 없음. 사용자 c3d export 설정 추가 필요

### 우선순위 중간
4. **xlsx 가공값을 io_apply.js에서 직접 import 옵션** — process_pitching_session.py 우회 경로
5. **41명 → 20명 (상동고 cohort) subset** — Accurate_Data 18명 중 상동고 선수 식별
6. **render_player_cards.js 추가 세분화**

### 우선순위 낮음
7. **PPTX 코치덱 v5.32 재생성**
8. **백업 파일 정리**
9. **매뉴얼 v3 작성** — FP1/FP2 표기 수정 (착지발/앞발 = FP1)

## 3. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

node scripts/build_dashboard.js
bash skills/sangdong-dashboard/scripts/verify_build.sh

# c3d.txt 일괄 처리 (Accurate_Data 폴더)
# (사용자가 다음 측정 시 동일 패턴으로 처리)
```

## 4. 메모리 reference

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md`
- `~/memory/reference_driveline_hp_assessment.md`

## 5. 학술 노트

- `docs/references/EnergyFlow_GRF_Horizontal_v5.28.md`
- `docs/references/OBP_validation_v5.29.md`
- `docs/references/KR_vs_OBP_markerless_v_marker_v5.31.md`

## 6. 새 대화 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.32.md를 읽고 작업을 이어가주세요.
```

---
**v5.32 완료**: 2026-05-10
**KR cohort**: 18명 가공 (xlsx) + 14명 135+km/h subset
**연락처**: kklee@kookmin.ac.kr
