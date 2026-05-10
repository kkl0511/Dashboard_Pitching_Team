# 상동고 대시보드 v5.30 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.30.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. v5.27의 모듈 분리, v5.28의 §3-3·§3-4 심화(분절간 ETE + GRF 수평·임펄스·타이밍), v5.29의 NewtForce 8 변인 통합 후, **v5.30에서 OpenBiomechanics POI 데이터(90+ mph cohort n=54)로 우리 reference 검증 + 5개 핵심 보정 + ENERGY_TRANSFER_J_REF 신설**.

## 1. v5.30 주요 변경 (이번 대화)

### OBP 90+ mph cohort 검증
- **데이터**: drivelineresearch/openbiomechanics POI CSV (411 trial → 90+ mph 54 trial)
- **저장**: `sample_data/OBP_poi_metrics.csv`, `sample_data/OBP_metadata.csv`
- **검증 보고서**: `docs/references/OBP_validation_v5.29.md`
- **30개 변인 검증**: 21개 정합 (70%) / 9개 보정 필요

### driveline.js 5개 핵심 보정 (`v5.30 OBP 90+` 주석으로 추적)

| 변인 | 이전 | OBP 90+ p50 | v5.30 보정 |
|---|---|---|---|
| **DRIVELINE_5_MODELS** `hip_shoulder_sep_fp.median_elite` | 30° | 33.5° | **34°** |
| **DRIVELINE_5_MODELS** `torso_side_bend_mer.median_elite` | 25° | 22.3° | **22°** |
| **SEGMENT_TRANSITION_REF** `pelvis_to_trunk.lag_ideal_ms` | [30, 50] | 8.3 ms | **[-5, 25]** (음수 허용 — markerless Theia 표준) |
| **GRF_HORIZONTAL_REF** `drive_propulsive_peak.elite_range` | [50, 70] %BW | 87 %BW | **[70, 100]** (Kageyama 일본 cohort → OBP 미국 cohort) |
| **NEWTFORCE_8_METRICS** `back_leg_peak_z.elite_range` | [150, 200] %BW | 139 %BW | **[120, 160]** |
| **NEWTFORCE_8_METRICS** `back_leg_peak_y.elite_range` | [50, 70] %BW | (= drive_prop) | **[70, 100]** |

### 신규 ENERGY_TRANSFER_J_REF (driveline.js)

OBP 90+ cohort에서 직접 추출한 J 단위 에너지 transfer reference (Aguinaldo 2019 정의):

| 변인 | Elite (J) | OBP 90+ p50 |
|---|---|---|
| `pelvis_lumbar_transfer_fp_br` | 100-220 | 143 |
| `thorax_distal_transfer_fp_br` | 380-460 | 432 |
| `shoulder_transfer_fp_br` | 350-440 | 403 |
| `shoulder_generation_fp_br` | 25-50 | 40 |
| `elbow_transfer_fp_br` | 370-450 | 411 |
| `lead_hip_generation_fp_br` | 10-28 | 17 |
| `rear_hip_generation_pkh_fp` | 140-200 | 160 |

새 함수: `energyTransferJAnalysis(e)` → 7 metric × {value, score, citation} + overall_score.

### OBP 좌표계 vs 우리 Theia
- OBP: X+ = 2nd base → home plate (mound축), Y+ = first base, Z+ = up
- 우리 Theia: Y+ = home plate (anterior of pitcher)
- 좌표 축 이름은 다르지만 같은 mound axis와 매핑 가능

### 검증 결과 (verify_build.sh)
- ✅ PASS 43 / FAIL 0
- ✅ dashboard.html 504,471 bytes (이전 v5.29 500 → +4 KB, ENERGY_TRANSFER_J_REF + 함수)
- ✅ 모든 보정값 dashboard.html에 반영됨 (grep 확인)

### 정합 확인된 우리 reference (변경 없음)
- Pelvis peak ω (650-800), Trunk peak ω (1000-1200), Shoulder IR (4000-5000) — OBP 정합 ✓
- Layback (160-180), Shoulder abd at FP (85-100), Trunk forward tilt at BR (25-40) ✓
- T1 Pelvis→Trunk gain (1.30-1.70), T2 Trunk→Humerus gain (4.0-6.0) ✓
- Lead leg X braking (100-150), Lead leg Z (180-280) ✓
- CoG max forward velo (2.5-3.2), Stride length (0.85-1.05) ✓ (90+ subset에서)
- torso_counter_rot (-38°) — OBP 90+ p50=-38.9° 거의 완벽 정합

## 2. 미검증 항목 (Phase 2 후보)

POI에 직접 없어 full signal CSV 다운로드 후 검증 필요:
- T2/T3/T4 transition lag (humerus, forearm, hand peak frame)
- GRF impulse, timing
- NewtForce Turning Point Z, Lead Negative Y, Time of Transfer
- Drive leg propulsive impulse 적분 알고리즘

## 3. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

node scripts/build_dashboard.js
bash skills/sangdong-dashboard/scripts/verify_build.sh

# OBP 90+ subset로 우리 reference 재검증 (스크립트 위치 미정 — 필요 시 작성)
python3 -c "
import csv
with open('sample_data/OBP_poi_metrics.csv') as f: rows = list(csv.DictReader(f))
ff90 = [r for r in rows if r.get('pitch_type','').upper()=='FF' and float(r.get('pitch_speed_mph',0))>=90.0]
print(f'OBP 90+ mph: {len(ff90)} trials')
"
```

## 4. 다음 작업 후보

### 우선순위 높음
1. **실측 cohort 41명 도착 후 percentile-based 재calibrate** — OBP는 미국, 우리는 한국 고교라 추가 보정 필요할 수 있음
2. **OBP full signal CSV로 Phase 2 검증** — joint_velos.csv (T2-T4 lag), force_plate.csv (impulse + timing)
3. **OBP c3d 1개 → 우리 process_pitching_session.py end-to-end** — 파이프라인 호환성

### 우선순위 중간
4. **에너지 transfer J 단위 자체 계산** — 현재 process_pitching_session.py는 ratio %만. Aguinaldo 2019 정의로 J 단위 추출 추가
5. **render_player_cards.js 추가 세분화** (~1,360줄)
6. **Bilateral asymmetry** — drive/lead leg propulsive·braking impulse asymmetry index

### 우선순위 낮음 (장기)
7. **PPTX 코치덱 v5.30 재생성**
8. **백업 파일 정리** (.bak v5.25/26/27)

## 5. 메모리 reference

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축

## 6. 새 대화 시작 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.30.md를 읽고 작업을 이어가주세요.
```

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
**OBP 출처**: https://github.com/drivelineresearch/openbiomechanics
