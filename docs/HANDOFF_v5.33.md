# 상동고 대시보드 v5.33 — Handoff

> **새 대화에서 이 파일부터 읽으세요:**
> ```
> Read docs/HANDOFF_v5.33.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. v5.32의 59명 통합 cohort 검증 후 발견된 골반 인식 한계를 **v5.33에서 SEGMENT_TRANSITION_REF에 weight 필드 신설 + segmentTransitionETE를 weighted average로 변경**해 markerless Theia의 골반(Pelvis) 인식 정확도 한계를 가중치 0.5로 수용. Bottleneck 식별도 weight 정규화로 false positive 방지.

## 1. v5.33 주요 변경

### A. 사용자 지침 반영

이전 v5.32 검증에서 발견된 4가지 차이:
1. **Pelvis→Trunk lag (xlsx 7ms vs 우리코드 37ms, +424%)** → markerless 골반 인식 한계, 가중치 낮춰 수용 ✅ **이번에 적용**
2. **Lead leg AP GRF (xlsx 134 vs 우리 12 %BW, 12배)** → FP1 인식 문제, 알고리즘 추후 교정 (다음 라운드)
3. **NewtForce Time of Transfer (1% 가용성)** → FP1·FP2 인식, 알고리즘 추후 교정
4. **R_Forearm 컬럼 누락** → 사용자 측정 환경 추가 export 요청

### B. driveline.js v5.33 변경

**1) SEGMENT_TRANSITION_REF에 weight 필드 추가**:

| Transition | weight | 근거 |
|---|---|---|
| pelvis_to_trunk | **0.5** | markerless 골반 인식 정확도 한계 (KR 코드 37ms vs xlsx 7ms 큰 차이) |
| trunk_to_humerus | 1.0 | KR cohort 정합 (xlsx 83 vs 우리 73ms) |
| humerus_to_forearm | 1.0 | (현재 R_Forearm 컬럼 미가용) |
| forearm_to_hand | 1.0 | |

**2) segmentTransitionETE 함수 변경**:
```js
// v5.33: weighted average + bottleneck 식별 weight 정규화
overall_score = Σ(score × weight) / Σ(weight)
bottleneck loss = (100 - score) × weight   // weight 낮은 transition은 bottleneck 후보 우선순위 ↓
```

**3) DRIVELINE_5_MODELS.rotation.metrics.pelvis_rot_velo**:
- importance: 'low' 유지 (이미 적용)
- 신규: `markerless_caveat` 메타 필드 추가 (UI 표시용)

### C. 동작 검증 (시뮬)

```
Pelvis→Trunk:    score 62, weight 0.5   (lag fault)
Trunk→Humerus:   score 86, weight 1.0   (정상)
Humerus→Forearm: score 100, weight 1.0
Forearm→Hand:    score 100, weight 1.0

→ overall_score (weighted): 91
   (단순 평균이었다면 87 — weight로 +4점 보상)

bottleneck: pelvis_to_trunk (loss 19 — 여전히 식별되지만 weight 0.5라 우선순위 작음)
```

### D. 검증 결과
- ✅ verify_build.sh: PASS 43 / FAIL 0
- ✅ dashboard.html 510,167 bytes
- ✅ weight: 0.5 (pelvis_to_trunk) 1회 등장
- ✅ markerless_caveat 3회 등장 (pelvis_to_trunk + pelvis_rot_velo)
- ✅ weighted bottleneck 식별 알고리즘 작동

## 2. 미완 / 다음 라운드

### 우선순위 높음 — 알고리즘 디버깅
1. **Lead leg AP GRF 알고리즘** — xlsx 134 vs 우리 12 %BW (12배 차이)
   - 윈도우 (FC ~ Lead toe-off) 적정한지 검증
   - 단일 trial step-by-step trace
2. **NewtForce Time of Transfer** — 1% 가용성
   - Drive Z peak frame 식별 결함
3. **Pelvis→Trunk lag 알고리즘 정합** (선택사항)
   - xlsx 7ms와 일치시키려면 peak detection 알고리즘 변경 필요
   - 현재는 weight 0.5로 수용 — 알고리즘 디버깅은 후순위

### 우선순위 중간
4. **R_Forearm_Ang_Vel 컬럼 추가** — 사용자 측정 시 Visual3D export 보강 (사용자 측 작업)
5. **render_player_cards.js의 분절간 ETE 카드에 markerless_caveat 표시 추가**
6. **41명 raw data.zip의 metadata 매핑** — 현재 ball_speed 매핑 69%, 한국 고1 정밀측정.xlsx에 추가 필요

### 우선순위 낮음 (장기)
7. **PPTX 코치덱 v5.33 재생성**
8. **render_player_cards.js 추가 세분화** (~1,360줄)
9. **백업 파일 정리** (.bak v5.25/26/27)

## 3. KR 통합 cohort 데이터 (v5.32에서 처리)

| Source | 선수 | Trials |
|---|---|---|
| Accurate_Data.zip | 18명 | 153 |
| raw data.zip | 41명 | 365 |
| **통합 (공통 0)** | **59명** | **518 trials** |
| ball_speed 매핑 | — | 355 (69%) |
| 135+ km/h subset | 22명 | 126 trials |

가용성:
- Drive propulsive 96% ✅, 분절 ω peak 100% ✅
- Pelvis→Trunk lag 94% (정확도는 weight 0.5 적용)
- Trunk→Humerus lag 98% ✅
- Lead braking peak 1% ⚠ (다음 디버깅)

## 4. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"
node scripts/build_dashboard.js
bash skills/sangdong-dashboard/scripts/verify_build.sh

# segmentTransitionETE 가중치 검증 (브라우저 콘솔)
# 또는 Node에서:
node -e "
const fs = require('fs');
eval(fs.readFileSync('src/js/driveline.js','utf8'));
const t = segmentTransitionETE({
  peak_pelvis_v: 600, peak_trunk_v: 700, peak_humerus_v: 4500,
  peak_forearm_v: 5500, peak_hand_v: 6000,
  pelvis_to_trunk_lag_ms: 50, trunk_to_humerus_lag_ms: 80,
  humerus_to_forearm_lag_ms: 18, forearm_to_hand_lag_ms: 10
});
console.log('overall:', t.overall_score, 'bottleneck:', t.bottleneck);
"
```

## 5. 학술 노트

- `docs/references/EnergyFlow_GRF_Horizontal_v5.28.md` — 분절간 ETE + GRF 수평
- `docs/references/OBP_validation_v5.29.md` — OBP cohort 검증
- `docs/references/KR_vs_OBP_markerless_v_marker_v5.31.md` — 시스템 차이
- `docs/references/KR_combined_cohort_v5.32.md` — 59명 통합 보고서

## 6. 새 대화 시작 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.33.md를 읽고 작업을 이어가주세요.
```

---
**v5.33 완료**: 2026-05-10
**핵심 변경**: SEGMENT_TRANSITION_REF에 weight 필드 + weighted bottleneck/overall_score
**연락처**: kklee@kookmin.ac.kr
