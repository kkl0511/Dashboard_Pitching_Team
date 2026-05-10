# 상동고 대시보드 v5.31 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.31.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. v5.30 OBP 90+ subset 검증 후, **v5.31에서 KR 41명 cohort (markerless Theia 가공 데이터, n=140 trials, 18명) 도착 → KR 135+ km/h subset (n=47, 14명) vs OBP 90+ mph subset (n=54) 직접 비교 → markerless ↔ marker 시스템 차이 정량화**. 보정 2개 + MARKERLESS_CALIBRATION_FACTORS 신설.

## 1. v5.31 주요 변경

### 데이터 입수
- `sample_data/KR_pitching_processing.xlsx` (140 trials × 36 cols, 18명)
- `sample_data/KR_HS1_meta.xlsx` (356 trials metadata)
- `sample_data/OBP_*.csv` (v5.30 보존)

### KR markerless vs OBP marker 비교 결과

| 카테고리 | KR p50 | OBP p50 | 시스템 차이 |
|---|---|---|---|
| **정합 (≤5%)** | — | — | Shoulder ER/Abd, Counter Rot, P→T lag, 수직 GRF |
| Pelvis peak ω | 630 | 726 | -13.2% |
| Trunk peak ω | 910 | 1058 | -14.0% |
| Arm peak ω | 4184 | 4608 | -9.2% |
| Peak X-factor | 21.6 | 34.6 | **-37.6%** |
| FC X-factor | 18.5 | 33.5 | **-44.8%** |
| Trail vertical GRF | 144 %BW | 139 %BW | +3.5% (정합) |
| Lead vertical GRF | 229 %BW | 218 %BW | +5.2% (정합) |

### driveline.js v5.31 보정 (2개)

| 위치 | 변인 | v5.30 | **v5.31** | 근거 |
|---|---|---|---|---|
| `SEGMENT_TRANSITION_REF` | `trunk_to_humerus.lag_ideal_ms` | [20, 40] | **[50, 110]** | KR 실측 trunk_to_arm p10-p90 = 60-150ms |
| `NEWTFORCE_8_METRICS` | `time_of_transfer.elite_range` | [100, 180] | **[240, 320]** | KR Trail→Lead vGRF p10-p50 = 241-292ms |

### 신규: MARKERLESS_CALIBRATION_FACTORS

driveline.js에 새 상수 + 두 함수 (`markerEquivalent`, `markerlessEquivalent`).
학술 논문 작성 시 markerless ↔ marker 환산:

```js
markerEquivalent('pelvis_peak_omega', 630)    // → 725 (×1.15)
markerEquivalent('x_factor_peak', 21.6)       // → 35.6 (×1.65)
markerlessEquivalent('x_factor_peak', 35)     // → 21.2 (학술 reference 보정)
```

핵심 factor:
- 회전 ω: ×1.10–1.16
- X-factor peak: ×1.65 (가장 큰 시스템 차이)
- X-factor at FC: ×1.80
- 자세 / 수직 GRF: ×1.00 (정합)

### KR-only NewtForce reference (KR 41명 cohort)

| 변인 | KR p10 | KR p50 | KR p90 |
|---|---|---|---|
| Trail impulse stride (BW·s) | 0.81 | 0.95 | 1.06 |
| Time of Transfer (ms) | 241 | 292 | 475 |
| Clawback time (ms) | 117 | 251 | 347 |
| Trunk→Arm lag (ms) | 60 | 83 | 150 |
| CoG Decel (m/s) | 1.06 | 1.32 | 1.45 |

### 검증 결과
- ✅ verify_build.sh: PASS 43 / FAIL 0
- ✅ dashboard.html 507,962 bytes
- ✅ 모든 v5.31 신규 함수/상수 dashboard에 1회 등장

## 2. 미완 / 다음 단계

### 우선순위 높음
1. **Accurate_Data.zip + raw data.zip의 c3d.txt 일괄 처리** — process_pitching_session.py로 v5.28-30 신규 변인 (drive_propulsive_*, lead_braking_*, segment_transitions, NewtForce 신규 3개) 자동 추출
2. **추출 결과로 KR cohort full distribution 분석** — Trail impulse stride raw 단위 확인 (BW·s 또는 다른?), KR cohort에서 v5.28-30 변인 모두 추출 가능 확인
3. **통계 검정** — Mann-Whitney U test로 KR vs OBP 차이의 유의성

### 우선순위 중간
4. **MARKERLESS_CALIBRATION_FACTORS UI 통합** — 대시보드 §3-3·§3-4에서 marker reference와 비교 시 자동 환산 표시
5. **render_player_cards.js 추가 세분화** (~1,360줄)

### 우선순위 낮음
6. **PPTX 코치덱 v5.31 재생성**
7. **백업 파일 정리** (.bak v5.25/26/27)

## 3. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

node scripts/build_dashboard.js
bash skills/sangdong-dashboard/scripts/verify_build.sh

# v5.31 markerless ↔ marker 환산 검증 (브라우저 콘솔)
# markerEquivalent('pelvis_peak_omega', 630) → ~725
# markerlessEquivalent('x_factor_peak', 35) → ~21.2

# KR vs OBP 비교 결과 재현 (sample_data 사용)
python3 -c "
import openpyxl, csv
wb = openpyxl.load_workbook('sample_data/KR_pitching_processing.xlsx', data_only=True)
ws = wb.active
hdr = [ws.cell(1,c).value for c in range(1,ws.max_column+1)]
rows = [{hdr[i]: ws.cell(r,i+1).value for i in range(len(hdr))} for r in range(2, ws.max_row+1)]
high = [r for r in rows if r.get('ball_speed') and float(r['ball_speed'])>=135]
print(f'KR 135+: {len(high)} trials, {len(set(r[\"player\"] for r in high))}명')
"
```

## 4. 메모리 reference

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축

## 5. 학술 노트

- `docs/references/EnergyFlow_GRF_Horizontal_v5.28.md` — 분절간 ETE + GRF 수평
- `docs/references/OBP_validation_v5.29.md` — OBP cohort 분포 검증
- `docs/references/KR_vs_OBP_markerless_v_marker_v5.31.md` — 시스템 차이 정량화

## 6. 새 대화 시작 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.31.md를 읽고 작업을 이어가주세요.
```

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
**KR cohort**: 41명 (uploaded), 18명 가공 + 14명 135+km/h subset
**OBP**: https://github.com/drivelineresearch/openbiomechanics
