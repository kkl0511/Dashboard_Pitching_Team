# MODULE_MAP — 함수/객체 → 모듈 lookup table (v5.27)

15개 모듈에 분산된 주요 함수·상수·전역변수를 빠르게 찾기 위한 표.

## driveline.js (369 lines)

**Driveline framework 정의 — 5+6축 모델 + 진단 헬퍼**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `DRIVELINE_5_MODELS` | const | 메카닉 5축 정의 (Arm Action / Posture / Rotation / Block / CoG) |
| `DRIVELINE_HP_6_MODELS` | const | 체력 6축 정의 (Strength / Rel Strength / Power / Rel Power / Reactive / Upper Power) |
| `drivelineMetricScore` | function | 단일 metric → 점수 (median elite 100 기준) |
| `drivelineFiveModelDiagnosis` | function | 5축 종합 진단 |
| `drivelineMechanicalCeiling` | function | mph 환산 천장 계산 |
| `drivelineHPScore` | function | 6축 단일 점수 |
| `drivelineHPVeloGroup` | function | Velo Group cohort 비교 |
| `drivelineHPDiagnosis` | function | HP 종합 진단 |

## analytics_velocity.js (890 lines)

**속도 모델·진단·norm — 모든 속도 예측 관련**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `ANALYTICS_VERSION` | const | 4.0 |
| `VELO_GROUPS` | const | <80 / 80-85 / 85-90 / 90+ |
| `veloGroup` | function | 속도 → group 라벨 |
| `OBP_VELO_MODEL` | const | OpenBiomechanics 회귀 weights |
| `predictVelocityOBP` | function | OBP 모델 예측 |
| `AMATEUR_REFERENCE` / `PRO_REFERENCE` | const | 한국·MLB reference 분포 |
| `REFERENCE_DISTRIBUTIONS` | const | 통합 분포 |
| `percentileVsRef` | function | reference 대비 percentile |
| `dualReferenceDiagnosis` | function | 이중 reference 진단 |
| `expectedVelocityWithImprovement` | function | 변인별 향상 시 속도 |
| `expectedVelocityFromFitness` | function | 체력만 기반 예측 |
| `expectedVelocityCombined` | function | 메카닉+체력 통합 |
| `MECHANIC_VARIABLE_MAP` / `FITNESS_VARIABLE_MAP` | const | 변인 효과 매핑 |
| `fitnessAxisDiagnosis` | function | 체력 6축 진단 |
| `fiveAxisDiagnosis` / `fourAxisDiagnosis` | function | 메카닉 진단 |
| `OBP_LEVEL_NORMS` / `PRO_REFERENCE_4AXIS` / `VELO_GROUP_NORMS` | const | 레벨별 reference |
| `PHYSICAL_VELO_MODEL` / `predictedVelocity` / `aboveExpected` | const/function | physical 회귀 |
| `PER_1KMH_TARGETS` / `per1kmhRecommendation` | const/function | 1 km/h 향상 효과 |
| `combinedDiagnosis` | function | 체력 한계 vs 메카닉 비효율 진단 |
| `KR_VELO_MODEL` | const | 한국 고교 회귀 모델 (59명 OLS) |
| `predictMaxVelocityKR` | function | KR 모델 예측 |

## analytics_fitness.js (488 lines)

**VALD·Grade benchmarks + 통계 헬퍼**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `VALD_NORMS` | const | College Baseball normative (대형 테이블) |
| `valdPercentile` / `valdMultiTier` | function | VALD percentile 산출 |
| `GRADE_BENCHMARKS` | const | 한국 고교 학년별 벤치마크 |
| `GRADE_LATENT_OFFSETS` | const | 잠재 구속 offset |
| `gradePercentile` | function | 학년 percentile |
| `_normCdf` / `_mean` / `_sd` | function | 통계 헬퍼 |
| `confidenceInterval` / `_tCritical` / `pairedTTest` | function | 신뢰구간·t-test |

## analytics_mechanic.js (855 lines)

**ELI/GRF/Stuff/Composite + ANALYTICS export**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `LATENT_VELOCITY_WEIGHTS` | const | 잠재 구속 회귀 weights |
| `latentVelocity` | function | bio + fit + grade 결합 잠재 구속 |
| `commandComposite` | function | Theia + Rapsodo 제구 통합 |
| `_clamp01` | function | 0-100 clamp |
| `DE_LEVA_PARAMS` | const | De Leva (1996) 분절 파라미터 |
| `selfCalcSegmentKE` | function | 분절 KE_rot 자체 계산 |
| `transferScoreV2` | function | 힘 전달 점수 |
| `eliScoresFromTheia` | function | ELI 6 zone 정식 산출 |
| `injuryRisk` | function | 부상 위험도 |
| `GRF_BENCHMARKS` / `grfScore` | const/function | GRF 점수 |
| `STUFF_BENCHMARKS` / `stuffScore` | const/function | Stuff 점수 |
| `COMPOSITE_WEIGHTS` / `compositeScore` | const/function | 종합 점수 |
| `percentileRank` | function | 코호트 percentile |
| **`ANALYTICS`** | const | **모든 함수·상수 export object** |
| `window.ANALYTICS = ANALYTICS` | top-level | 브라우저 전역 등록 |

## data.js (403 lines)

**선수 명단 + 측정 sample 생성**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `PLAYERS` | const | 20명 명단 |
| `SESSIONS` | const | 4회 측정 |
| `genMeasurements` | function | sample 데이터 생성 |
| `seedRand`, `r1`, `r2`, `avg`, `fmt` | function | 헬퍼 |

## render_m1.js (289 lines)

**TAB 1 종합 (M1)**

| 함수 | 역할 |
|---|---|
| `renderM1KPI` | 헤더 KPI |
| `renderProgressGrid` | 데이터 입력 진척도 |
| `buildM1Table` | 선수별 종합 표 |
| `renderM1Heatmap` | heatmap |
| `renderM1Charts` | 차트들 |
| `m1Sort`, `chartsM1` | let (정렬 상태, chart 인스턴스) |

## render_player.js (579 lines)

**TAB 2 진입 + renderPlayerView (거대 함수)**

| 함수 | 역할 |
|---|---|
| `renderPlayerSelect` | 드롭다운 |
| `renderPlayerView` | 선수 상세 메인 (모든 카드 호출 진입점) |
| `chartsP` | let (chart 인스턴스 캐시) |

## render_player_cards.js (1,134 lines)

**v5.14 카드 렌더러 — 가장 큼, 추가 분리 후보**

| 함수 | 역할 |
|---|---|
| `v514_moveFitnessCards` | 체력 카드를 §2로 이동 |
| `v516_renderFitnessHexRadar` | 체력 6축 라디아 |
| `v514_renderMechanicTables` | 메카닉 5축 + 시간축 + 에너지·파워 + 지면반력 + ELI |
| `v514_renderActionPlan` | Action Plan |
| `v514_renderSummaryAction` | 종합 권장 |
| `renderRapsodoFB` | 구속/구질 FB 카드 |
| `renderOutcomeDiagnosis` | 결과 진단 (체력 한계 vs 메카닉 비효율) |
| `renderHPAssessment` | HP 평가 (Velo Group 분포) |
| `renderTierOverlay` | 3-tier 코호트 overlay |
| `renderFitnessCards` | 체력 raw 카드 |
| `chartFitnessRadar`, `RAP_COHORT` | let |

## render_long.js (263 lines)

**TAB 3 + TAB 4**

| 함수 | 역할 |
|---|---|
| `renderRoster` | 선수 명단 |
| `renderScheduleHalves` | 측정 일정 |
| `halfAvg`, `gradeOf` | 헬퍼 |
| `renderHalfComparison` | 반기 비교 |
| `renderLongTab` | 장기 추적 차트 |
| `METRIC_DEFS`, `chartHC`, `hcSort`, `chartLong` | const/let |

## render_common.js (193 lines)

**공통 차트 옵션 + 탭 전환 + 이벤트**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `CHART_PALETTE` | const | colorblind-safe 팔레트 |
| `chartOpts` | function | Chart.js 공통 옵션 |
| `switchTab` | function | 탭 전환 |
| `genMeasurementsFor` | function | 1명용 sample 생성 (선수 추가 시) |
| top-level event listeners | — | tab-btn click, roster-search input, roster-add/export click |

## io_apply.js (279 lines)

**Theia JSON apply + analytics enrichment**

| 함수 | 역할 |
|---|---|
| `parseTheiaJson` | Theia JSON 파싱 |
| `validateRecord` | 레코드 검증 |
| `applyTheiaRecord` | DATA[pid][sid]에 적용 |
| `enrichWithAnalytics` | ANALYTICS 호출해 점수 enrichment |
| `mergeFitness` / `mergeEnergy` | 데이터 병합 |
| `refreshAllAfterImport` | 전체 다시 렌더 |
| `REAL_DATA_KEYS` | const Set | 실측 마커 |

## io_c3d.js (490 lines)

**Visual3D c3d.txt 파서 (인-브라우저)**

| 함수 | 역할 |
|---|---|
| `parseC3DTxtTrial` | 단일 trial 파싱 |
| `synthesizeRecordFromTrials` | 여러 trial → 평균 record |
| `setupJsonZone` | drag-and-drop zone 와이어업 |
| `downloadTemplate` | 템플릿 다운로드 |

## io_csv.js (390 lines)

**ForceDecks (VALD) + Rapsodo CSV 파서**

| 함수 | 역할 |
|---|---|
| `parseCSV` | 범용 CSV 파서 |
| `num`, `_stat`, `_rd` | 헬퍼 |
| `importValdCSV` | ForceDecks 32컬럼 (or 28컬럼 legacy) |
| `detectAndNormalizeRapsodoV2` | Rapsodo 자동 감지 |
| `RAPSODO_BENCHMARKS` | const |
| `importRapsodoCSV` | Rapsodo 임포트 |
| `setupCSVZone` | drag-and-drop |
| `resetToSampleData` | sample로 리셋 |

## io_storage.js (89 lines)

**localStorage save/load**

| 심볼 | 종류 | 비고 |
|---|---|---|
| `STORAGE_KEY` | const | 'sangdong_dashboard_v1' |
| `__saveTimer` | let | debounce timer |
| `saveToStorage` / `loadFromStorage` / `clearStorage` | function | 저장·복원·삭제 |
| `updateStorageBadge` | function | UI 표시 |

## reports_init.js (452 lines)

**리포트 + 초기 와이어업 (DOMContentLoaded)**

선수별 리포트, 코치덱 미리보기, 초기 렌더링 진입점.

---

## 빠른 grep 명령

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

# 함수가 어느 모듈에 있는지 찾기
grep -l "function FUNCTION_NAME" src/js/*.js

# 함수 정의 라인 보기
grep -n "function FUNCTION_NAME" src/js/*.js

# 모듈 합성 순서 확인
grep -A 20 "JS_MODULES" scripts/build_dashboard.js
```
