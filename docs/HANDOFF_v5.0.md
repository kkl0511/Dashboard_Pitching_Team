# v5.0 핸드오프 — 매뉴얼 v2 호환 대시보드

**시작일**: 2026-05-09
**완료일**: 2026-05-10
**전제 매뉴얼**: `docs/측정_프로토콜_매뉴얼_v2.docx`
**마지막 안정 빌드**: v5.0 (2026-05-10 — 전체 파이프라인 완료, end-to-end 검증 OK)

## 진행 상황 (2026-05-10 — v5.0 전체 완료 ✓)

| 파일 | 상태 |
|---|---|
| `src/js/analytics.js` | ✅ VELO_GROUP_NORMS에 `pp_peak_takeoff_bm` 추가 |
| `src/js/data.js` | ✅ 가상 fitness 데이터 `pp` 블록 추가 |
| `src/js/render.js` | ✅ `renderHPAssessment` Grip → Plyo Push Up 교체 |
| `src/js/io.js` | ✅ `importValdCSV`에 pp_* 3컬럼 인식 추가 (29/32 graceful) |
| `dashboard.html` | ✅ 재빌드 완료 (306,239 bytes) |
| `dashboard_mobile.html` | ✅ 재빌드 완료 (316,392 bytes) |
| `scripts/process_pitching_session.py` | ✅ `EXPECTED_FITNESS_COLS` + `process_fitness_csv` 추가, `02_forcedecks/all_forcedecks.csv` 28/31컬럼 auto-detect |
| `scripts/build_coach_deck.js` | ✅ HP Assessment Grip → Plyo PP 교체 (`m.fitness.pp.peak_takeoff_force_bm_n_kg`), `/tmp` 권한충돌 fix |
| PPTX 재생성 | ✅ `코치미팅_1차_2026-05-15.pptx` 2018 KB · 23슬라이드 (Plyo PP 20회 / Grip 0회) |
| Git commit + push | ✅ v5.0 완료 commit |

---

## 한 줄 요약

매뉴얼 v2.0이 정의한 **Driveline HP Assessment 6축 완전 호환** + **32컬럼 wide CSV** 양식을 대시보드 코드에 반영. 핵심 변화는 **Plyo Push Up (PP) 3컬럼 추가** + HP Assessment 카드 5변인 → 6변인.

---

## 매뉴얼 v2가 강제하는 데이터 스키마 변경

### CSV 32컬럼 wide format (29 → 32)

기존 v1.1 (29컬럼) — 식별 8 + 세션 2 + CMJ 5 + SJ+EUR 4 + Pogo 3 + IMTP 5
v2.0 (32컬럼)   — **+ Plyo Push Up 3** (`pp_*`)

신규 3컬럼:
| 컬럼명 | 단위 | 의미 |
|---|---|---|
| `pp_peak_takeoff_force_bm_n_kg` | N/kg | 추진력 피크 (단축성 마지막) |
| `pp_peak_eccentric_force_bm_n_kg` | N/kg | 신장성 피크 (충격 흡수) |
| `pp_asymmetry_pct` | % | 좌우 비대칭 (<10% 정상) |

### 명칭 변경

- **Hop Test** (Driveline HP 표준) — 구 "Pogo Jump"
  - CSV 컬럼명은 **`pogo_*` 유지** (호환성). UI 라벨만 "Hop Test"로 표시

---

## 영향받는 파일 + 변경 내용

### 1. `src/js/data.js` ⭐ 핵심
**무엇**: fitness 샘플 데이터(20명) + 파서

- [ ] `genMeasurements()` 또는 fitness 가상 데이터 생성 부분에 `pp_peak_takeoff`, `pp_peak_eccentric`, `pp_asymmetry` 추가
- [ ] CSV 파서 (`parseForceDecksCSV` 또는 `importFitnessCSV`)가 32컬럼 자동 인식
- [ ] 누락 시 (29컬럼만) graceful degradation — `null` 처리

### 2. `src/js/analytics.js` ⭐ 핵심
**무엇**: HP Assessment 변수 목록 + VELO_GROUP_NORMS

- [ ] `HP_ASSESSMENT_VARS` 배열 (5개 → 6개) — `pp_peak_takeoff_force_bm_n_kg` 추가
- [ ] `VELO_GROUP_NORMS`에 그룹별 PP 평균값 추가 (참고: Driveline 공개 norm)
  ```js
  // 참고치 (Driveline HP HS Pitcher norms — 추정)
  미달 (<128 km/h):   pp_peak_takeoff ~7.5  N/kg
  평균 (128-133):     pp_peak_takeoff ~9.0
  우수 (133-138):     pp_peak_takeoff ~10.5
  Elite (138+):       pp_peak_takeoff ~12.0
  ```
- [ ] (선택) `PHYSICAL_VELO_MODEL`에 PP 변수 회귀 weight 추가 — β ≈ 0.5~0.8 km/h per N/kg

### 3. `src/js/render.js` ⭐ 핵심
**무엇**: HP Assessment 카드

- [ ] `renderHPAssessment()` — 5 ridge plot → 6 ridge plot
- [ ] 6번째 row: "Plyo Push Up — 추진력" + 본인 위치 ▼
- [ ] 카드 높이 조정 (5 row → 6 row 맞춰 padding 조정)
- [ ] 라벨: "Pogo" → "Hop Test"로 변경 (UI만)

### 4. `scripts/process_pitching_session.py`
**무엇**: fitness CSV 표준화

- [ ] `EXPECTED_FITNESS_COLS` 리스트에 `pp_peak_takeoff_force_bm_n_kg`, `pp_peak_eccentric_force_bm_n_kg`, `pp_asymmetry_pct` 추가
- [ ] 32컬럼 / 29컬럼 모두 처리 (auto-detect)
- [ ] `fitness_master.csv` 출력에 pp_* 3컬럼 포함

### 5. `scripts/build_coach_deck.js`
**무엇**: PPTX 코치 미팅 deck

- [ ] HP Assessment mini ridge plot — 5 → 6 변인
- [ ] 우측 panel 6 row 맞춰 fontSize·gap 미세 조정 (현재 5 row 기준)

### 6. `scripts/build_dashboard.js` 또는 `dashboard.html` 재빌드
- [ ] 위 src/* 수정 후 `node scripts/build_dashboard.js` 실행
- [ ] `dashboard.html` + `dashboard_mobile.html` 새로 생성
- [ ] Git commit + push (선택)

---

## 작업 순서 권장

```
1. data.js          — 샘플 데이터 + 파서에 pp_* 추가 (가장 작은 변경)
2. analytics.js     — HP_ASSESSMENT_VARS + VELO_GROUP_NORMS PP 추가
3. render.js        — renderHPAssessment 6 ridge plot
4. 빌드 + 브라우저 검증 (P01 카드에서 6 변수 ridge plot 확인)
5. process_pitching_session.py — 32컬럼 호환
6. build_coach_deck.js — PPTX 6 변인
7. PPTX 재생성 + 검증
8. Git commit + push
```

---

## 검증 체크리스트

- [ ] `dashboard.html` 브라우저 로드 → P01 선수 페이지 → HP Assessment 카드에 **6 ridge plot** 표시
- [ ] 6번째 row가 "Plyo Push Up" 라벨, 본인 위치 ▼ 표시
- [ ] 4축 라이다 차트는 변경 없음 (4축 한국어 그대로 유지)
- [ ] CSV 32컬럼 업로드 → 정상 인입
- [ ] CSV 29컬럼 (legacy) 업로드 → pp_* `null`로 graceful 처리
- [ ] PPTX `코치미팅_1차_2026-05-15.pptx` 재생성 → P01 슬라이드 6 변인 확인

---

## 주의사항

1. **CSV 컬럼명 호환**: `pogo_*` 유지 (UI만 "Hop Test"). 자동 처리 스크립트 + 파서 호환성 보장.
2. **graceful degradation**: 기존 v1.1 CSV (29컬럼) 업로드 시 깨지지 않게 `??` 또는 `if (val !== null)` 패턴.
3. **VELO_GROUP_NORMS**: Driveline 공개 norm 참고 — 정확한 수치는 Driveline HP Initial 리포트 (`uploads/HP Assessment Initial.pdf`) 참고.
4. **PHYSICAL_VELO_MODEL**: PP 추가 시 intercept 재보정 필요 (default 입력 시 한국 elite 134 km/h 유지).
5. **Sample data 20명**: PP 평균치 ~9.5 N/kg, σ ~1.5로 가상 생성. 실측 들어오면 자동 대체.

---

## 참고 — 매뉴얼 v2의 32컬럼 헤더 (한 줄)

```
athlete_external_id,athlete_name,date_of_birth,sex,height_cm,weight_kg,bmi,handedness,test_date,session_id,cmj_jump_height_cm,cmj_peak_power_bm_w_kg,cmj_rsi_modified_ms,cmj_concentric_peak_force_bm_n_kg,cmj_eccentric_concentric_force_ratio,sj_jump_height_cm,sj_peak_power_bm_w_kg,sj_concentric_peak_force_bm_n_kg,eur,pogo_rsi_ms,pogo_mean_contact_time_ms,pogo_mean_jump_height_cm,imtp_peak_vertical_force_n,imtp_peak_vertical_force_bm_n_kg,imtp_rfd_0_100ms_n_s,imtp_force_at_100ms_bm_n_kg,imtp_asymmetry_pct,pp_peak_takeoff_force_bm_n_kg,pp_peak_eccentric_force_bm_n_kg,pp_asymmetry_pct
```

---

## 다음 대화 시작 멘트 (복사용)

> 매뉴얼 v2가 정의한 32컬럼 wide CSV (Plyo Push Up 3컬럼 추가)에 맞춰 대시보드를 v5.0으로 업데이트해줘. `docs/HANDOFF_v5.0.md` 참고. data.js → analytics.js → render.js → 빌드 → 검증 → 파이썬/PPTX 업데이트 순서로 진행.
