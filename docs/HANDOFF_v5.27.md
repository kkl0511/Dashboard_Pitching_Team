# 상동고 대시보드 v5.27 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.27.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. **Driveline 5+6축 + 우리식 ELI 통합**. v5.26에서 render.js → 5개 모듈 분리, **v5.27에서 analytics.js → 3개, io.js → 4개로 추가 분리**. 현재 src/js/ 모듈 15개 체제. dashboard.html 동작 동일.

## 1. 현재 dashboard 구조 (5 섹션)

| 섹션 | 카드 | 출처 |
|---|---|---|
| **§1 현재 상태** | 헤더 KPI (실측·체력 향상·메카닉 천장·통합 향상) | OBP fitness model + Driveline ceiling |
| **§2 체력 (HP)** | HP Composite 6축 라디아 + Asymmetry + Velo Group cohort 비교표 | Driveline HP Assessment |
| **§3 메카닉** | §3-1 Driveline 5축 라디아 · §3-2 시간축 · §3-3 에너지·파워 · §3-4 지면반력 · §3-5 ELI 6 zone · §3-6 Action Plan | Driveline + 우리식 |
| **§4 결과** | 향상 시나리오 비교 | Combined model |
| **§5 종합 권장** | Bigger Lever 진단 | analytics |

## 2. 파일 구조 (v5.27 — 15개 src 모듈)

```
Dashboard_Pitching_Team/
├── src/
│   ├── index.html                    (1,028 lines — 5 섹션 골격)
│   ├── style.css
│   └── js/   ← v5.25 driveline 분리 → v5.26 render×5 분리 → v5.27 analytics×3 + io×4 분리
│       ├── driveline.js              (369) — Driveline 5+6축 framework
│       ├── analytics_velocity.js     (890) ★ v5.27 — OBP/KR/Driveline 속도 모델, 4·5·6축 진단, percentile/dualRef
│       ├── analytics_fitness.js      (488) ★ v5.27 — VALD_NORMS, gradeBenchmarks, 통계 헬퍼 (_normCdf, pairedTTest)
│       ├── analytics_mechanic.js     (855) ★ v5.27 — latentVelocity, commandComposite, ELI/GRF/Stuff/Composite + ANALYTICS export
│       ├── data.js                   (403)
│       ├── render_m1.js              (289) — TAB 1 종합 (M1 KPI/Grid/Table/Heatmap/Charts)
│       ├── render_player.js          (579) — TAB 2 진입 + renderPlayerView
│       ├── render_player_cards.js    (1,134) — v5.14 카드 렌더러 (메카닉/체력/ELI/Action) — 추가 분리 후보
│       ├── render_long.js            (263) — TAB 3 + TAB 4 (roster, 반기 비교, 장기 추적)
│       ├── render_common.js          (193) — chartOpts, switchTab, 이벤트, genMeasurementsFor
│       ├── io_apply.js               (279) ★ v5.27 — Theia JSON apply + analytics enrichment
│       ├── io_c3d.js                 (490) ★ v5.27 — c3d.txt 파서 + 합성 + JSON zone
│       ├── io_csv.js                 (390) ★ v5.27 — VALD/Rapsodo CSV 파서
│       ├── io_storage.js             (89)  ★ v5.27 — localStorage save/load
│       ├── reports_init.js           (452)
│       ├── svg_chart_stub.js         (158) — 모바일용
│       ├── render.js.bak_v5.25       (백업 — v5.26 분리 전)
│       ├── analytics.js.bak_v5.26    (백업 — v5.27 분리 전)
│       └── io.js.bak_v5.26           (백업 — v5.27 분리 전)
├── scripts/
│   ├── build_dashboard.js            ★ JS_MODULES 15개 등록
│   ├── process_pitching_session.py   (874 lines)
│   └── build_coach_deck.js
├── docs/
│   ├── HANDOFF_v5.0.md
│   ├── HANDOFF_v5.25.md
│   ├── HANDOFF_v5.26.md
│   ├── HANDOFF_v5.27.md  ← 이 파일
│   └── references/
└── dashboard.html                    (456KB · 빌드 결과물 — 직접 편집 X)
```

**중요: dashboard.html 직접 편집 금지**. 항상 `src/` 편집 후 `node scripts/build_dashboard.js`.

**모듈 합성 순서 (build_dashboard.js JS_MODULES, 의존성 순)**:
```
driveline
  → analytics_velocity → analytics_fitness → analytics_mechanic   (mechanic 끝에 ANALYTICS export)
  → data
  → render_m1 → render_player → render_player_cards → render_long → render_common
  → io_apply → io_c3d → io_csv → io_storage
  → reports_init
```

빌드 후 모든 모듈은 단일 `<script>` 블록으로 concat → 같은 scope이라 `const`/`let` 그대로 보존됨.

## 3. 자주 쓰는 명령어

```bash
# 디렉토리 진입
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

# 빌드
node scripts/build_dashboard.js

# Theia c3d.txt 일괄 처리
python3 scripts/process_pitching_session.py

# 분리 후 무결성 빠른 검증 — 핵심 함수가 정확히 1회씩 등장하는지
for fn in predictVelocityOBP fiveAxisDiagnosis valdPercentile latentVelocity \
          eliScoresFromTheia parseC3DTxtTrial importRapsodoCSV saveToStorage \
          renderPlayerView v514_renderMechanicTables switchTab; do
  echo "$fn: $(grep -c "function $fn" dashboard.html)"
done   # 모두 1이어야 함
```

## 4. v5.27 주요 변경 (이번 대화 누적)

### analytics.js → 3 모듈

| 새 파일 | 줄 수 | 포함 |
|---|---|---|
| `analytics_velocity.js` | 890 | VELO_GROUPS, OBP_VELO_MODEL, predictVelocityOBP, AMATEUR/PRO_REFERENCE, REFERENCE_DISTRIBUTIONS, percentileVsRef, dualReferenceDiagnosis, expectedVelocityWithImprovement, expectedVelocityFromFitness, expectedVelocityCombined, MECHANIC/FITNESS_VARIABLE_MAP, fitnessAxisDiagnosis, fiveAxisDiagnosis, fourAxisDiagnosis, OBP_LEVEL_NORMS, PRO_REFERENCE_4AXIS, VELO_GROUP_NORMS, PHYSICAL_VELO_MODEL, predictedVelocity, aboveExpected, PER_1KMH_TARGETS, per1kmhRecommendation, combinedDiagnosis, KR_VELO_MODEL, predictMaxVelocityKR |
| `analytics_fitness.js` | 488 | VALD_NORMS (대형 테이블), valdPercentile, valdMultiTier, GRADE_BENCHMARKS, GRADE_LATENT_OFFSETS, gradePercentile, _normCdf, _mean, _sd, confidenceInterval, _tCritical, pairedTTest |
| `analytics_mechanic.js` | 855 | LATENT_VELOCITY_WEIGHTS, latentVelocity, commandComposite, _clamp01, DE_LEVA_PARAMS, selfCalcSegmentKE, transferScoreV2, eliScoresFromTheia, injuryRisk, GRF_BENCHMARKS, grfScore, stuffScore, STUFF_BENCHMARKS, COMPOSITE_WEIGHTS, compositeScore, percentileRank, **ANALYTICS export object + window.ANALYTICS 등록** |

### io.js → 4 모듈

| 새 파일 | 줄 수 | 포함 |
|---|---|---|
| `io_apply.js` | 279 | REAL_DATA_KEYS, parseTheiaJson, validateRecord, applyTheiaRecord, enrichWithAnalytics, mergeFitness, mergeEnergy, refreshAllAfterImport |
| `io_c3d.js` | 490 | parseC3DTxtTrial, synthesizeRecordFromTrials, setupJsonZone, downloadTemplate |
| `io_csv.js` | 390 | parseCSV, num, importValdCSV, detectAndNormalizeRapsodoV2, _stat, _rd, RAPSODO_BENCHMARKS, importRapsodoCSV, setupCSVZone, resetToSampleData |
| `io_storage.js` | 89 | STORAGE_KEY, __saveTimer, saveToStorage, loadFromStorage, clearStorage, updateStorageBadge |

### 검증 결과

- ✅ `node scripts/build_dashboard.js` 정상 실행
- ✅ `dashboard.html` 456,492 bytes (450-500KB 범위 내)
- ✅ 27개 핵심 함수 + 12개 핵심 객체 모두 정확히 1회 등장
- ✅ `window.ANALYTICS` 등록 1회 (export object 정상 동작)
- ✅ 모듈 banner 15개 (분할 정확)
- ⚠️ 브라우저 콘솔 에러 — 사용자 확인 필요

## 5. v5.26 변경 (이전 누적, 참조용)

render.js (2,458줄) → 5개 모듈로 분리:
- render_m1, render_player, render_player_cards (1,134, 가장 큼), render_long, render_common

## 6. v5.25 변경 (이전 누적, 참조용)

- driveline.js 모듈 신설 (Driveline 5+6축 framework)
- §3-3 에너지·파워 카드, §3-4 지면반력 카드 추가
- HP Composite 6축 라디아, Velo Group cohort, Asymmetry 카드
- KPI 일관성 정리

## 7. 메모리 reference (영구 저장)

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축 + Velo Group cohort

## 8. 다음 대화 작업 후보

### 우선순위 높음
1. ~~render.js 모듈 분리~~ ✅ v5.26 완료
2. ~~analytics.js 분리~~ ✅ v5.27 완료
3. ~~io.js 분리~~ ✅ v5.27 완료
4. **render_player_cards.js 추가 세분화** (1,134줄, 여전히 큼)
   - 후보: render_card_radar(263), render_card_mechanic(424), render_card_rapsodo(235), render_card_hp(215)
   - 함수 경계는 명확 — v514_* / render* 함수 단위로 잘라야 안전
5. **실측 데이터 검증** — 41명 cohort + 4회 측정 후 Velo Group 분포·Driveline 점수 합리성 검증
6. **1차/2차 측정 dual radar overlay** — Driveline HP에서 자연스러운 패턴

### 우선순위 중간
7. **ForceDecks 32컬럼 CSV에 Plyo Push Up 추가** — Upper Body Power 축 자동 채워짐
8. **process_pitching_session.py에 fitness 처리 보강**
9. **PPTX 코치덱 v5.27 재생성** — 새 모듈 구조 반영

### 우선순위 낮음 (장기)
10. **백업 파일 정리** — render.js.bak_v5.25, analytics.js.bak_v5.26, io.js.bak_v5.26 (충분히 안정 동작 확인 후 삭제)

## 9. 새 대화 시작 안내 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.27.md를 읽고 작업을 이어가주세요.
[추가로 하고 싶은 작업 한 줄]
```

또는 더 간결하게:

```
HANDOFF_v5.27 읽고 [작업 내용] 해줘.
```

**메모리 자동 로드**: 새 대화 시작 시 `MEMORY.md`가 자동 로드되므로 user role / 프로젝트 컨텍스트 / Driveline reference는 즉시 사용 가능.

## 10. 검증 체크리스트 (대화 종료 전 매번)

- [ ] `node scripts/build_dashboard.js` 정상 실행
- [ ] `dashboard.html` 파일 크기 합리적 (450-500KB 범위)
- [ ] 핵심 함수/객체가 dashboard.html에 정확히 1회 등장 (중복·누락 0)
- [ ] `window.ANALYTICS = ANALYTICS` 1회 등록 확인
- [ ] 모듈 banner 개수 = JS_MODULES 배열 길이
- [ ] 새 카드 ID grep 확인: `grep -c "id=\"p-NEW-CARD-ID\"" dashboard.html` → 1
- [ ] sample 데이터로 Driveline 진단 점수 합리적 (0-200 범위)
- [ ] 브라우저 콘솔 에러 없는지 (사용자 확인 요청)

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
