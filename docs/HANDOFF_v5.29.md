# 상동고 대시보드 v5.29 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.29.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. v5.28의 §3-3 (분절간 ETE) + §3-4 (GRF 수평·임펄스·타이밍) 위에, **v5.29에서 NewtForce 핵심 8 변인 통합** (Florida Baseball Armory 표준 — Vanderbilt·TCU·Twins 사용). v5.28 변인 5개는 alias 매핑, 3개 신규 추출 (Turning Point Z, Lead Leg Negative Y, Time of Transfer).

## 1. v5.29 주요 변경 (이번 대화)

### NewtForce 핵심 8 변인 통합
- **시스템**: NewtForce instrumented pitching mound (Kyle Barker, Jacksonville). 사용처: Vanderbilt, TCU, Minnesota Twins (spring training), Florida Baseball Ranch
- **출처**: Florida Baseball Armory "Force Plate Metrics Chart Guide PDF" (2019) — 18 metrics 표준
- **사용자 협의**: 핵심 8개만 통합 (Impulse, Back/Lead Z/Y peak, Turning Point Z, Lead Negative Y, Time of Transfer)

### 8 변인 매핑 (5 alias + 3 신규)

| # | NewtForce | v5.28 alias / 신규 | Elite range |
|---|---|---|---|
| 1 | Impulse | drive_propulsive_impulse_pct_bw_s | 18–28 %BW·s |
| 2 | Back Leg Peak Z | rear_force_pct | 150–200 %BW |
| 3 | **Turning Point Z** | NEW v5.29 | 40–80 %BW |
| 4 | Lead Leg Peak Z | lead_force_pct | 180–280 %BW |
| 8 | Back Leg Peak Y | drive_propulsive_peak_pct_bw | 50–70 %BW |
| 9 | Lead Leg Peak Y | lead_braking_peak_pct_bw | 100–150 %BW |
| 10 | **Lead Leg Negative Y** | NEW v5.29 (claw back) | 30–80 %BW |
| 13 | **Time of Transfer** | NEW v5.29 (Back Z → Lead Z) | 100–180 ms |

### 코드 변경
- **driveline.js** (+136줄) — `NEWTFORCE_8_METRICS` 상수 + `newtforceCoreAnalysis(g)` 함수
- **process_pitching_session.py** — parse_theia_trial에 신규 3개 변인 추출 + synthesize_player_summary에 record 매핑
- **io_apply.js** — enrichWithAnalytics에 newtforceCoreAnalysis 호출 → m.grf.newtforce
- **index.html** — `<div id="p-grf-newtforce">` placeholder + footnote 갱신
- **render_player_cards.js** — v514_renderMechanicTables 끝에 NewtForce 시각화 (Amplitude 7 표 + Timing 1 카드)

### 좌표계 (Theia ↔ NewtForce)
| Axis | NewtForce | Theia (P01 검증) | 변환 |
|---|---|---|---|
| Z | down into ground | up | 부호 무관 (peak는 |Z|) |
| **Y+** | back/rubber (2루) | home plate | **부호 반전** |
| Y- | home plate | rubber | 부호 반전 |
| X | lateral | lateral | 동일 |

NewtForce Back Leg Peak Y (positive) = Theia FP1_Y의 negative max abs.

### 검증 결과
- ✅ `node scripts/build_dashboard.js` 정상 (dashboard.html 500,286 bytes — 새 코드 +14KB)
- ✅ `bash skills/sangdong-dashboard/scripts/verify_build.sh` PASS 43 / FAIL 0
- ✅ `function newtforceCoreAnalysis` 정확히 1회
- ✅ `const NEWTFORCE_8_METRICS` 정확히 1회
- ✅ `id="p-grf-newtforce"` 1회
- ✅ P01 sample data 동작 확인 (drive force plate 누락은 P01 한계)

### P01 sample 결과 (2026-05-15)
| # | NewtForce | 실측 | Elite |
|---|---|---|---|
| 4 | Lead Leg Peak Z | 16 %BW | 180–280 (매우 약함) |
| 9 | Lead Leg Peak Y | 0.9 %BW | 100–150 (매우 약함) |
| 10 | Lead Leg Negative Y | 1.7 %BW @ BR+497ms | 30–80 |

다른 5개는 drive leg force plate 누락으로 None. **P01의 force plate 위치 점검 필요**.

## 2. 현재 모듈 체제 (v5.29 — src/js 15개 동일)

```
driveline.js (369 → 712 → ~860줄)        ★ v5.28 SEGMENT_TRANSITION_REF + GRF_HORIZONTAL_REF
                                           ★ v5.29 NEWTFORCE_8_METRICS + newtforceCoreAnalysis
analytics_velocity.js (890)
analytics_fitness.js (488)
analytics_mechanic.js (855)
data.js (403)
render_m1.js (289)
render_player.js (579)
render_player_cards.js (1,134 → 1,260+ → ~1,360줄)  ★ v5.28 §3-3·§3-4 + v5.29 §3-4 NewtForce 카드
render_long.js (263)
render_common.js (193)
io_apply.js (279 → 330 → ~360)            ★ v5.28 transitions·horizontal · v5.29 newtforce 호출 추가
io_c3d.js (490)
io_csv.js (390)
io_storage.js (89)
reports_init.js (452)
```

## 3. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

node scripts/build_dashboard.js
bash skills/sangdong-dashboard/scripts/verify_build.sh

# v5.29 NewtForce 신규 변인 검증
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from process_pitching_session import parse_theia_trial
t = parse_theia_trial('sample_data/2026-05-15_1차측정/01_theia/P01_LYH/Fastball RH Markerless 1.c3d.txt')
for k in ['newtforce_turning_point_z_pct_bw','newtforce_lead_negative_y_pct_bw','newtforce_lead_negative_y_ms_after_br','newtforce_time_of_transfer_ms']:
    print(f'  {k}: {t.get(k)}')
"
```

## 4. 다음 작업 후보

### 우선순위 높음
1. **실측 cohort 41명 검증** — NewtForce 변인이 cohort 분포에서 합리적인지 확인. Elite range를 한국 고교 기준으로 percentile-based 재calibrate.
2. **P01 force plate 위치 점검** — Drive leg 누락 원인 확인 (선수 setup 또는 hardware)
3. **NewtForce 18 변인 추가 통합** — 현재 핵심 8개. X축 변인 (Iron Pyramid X, Turning Point X, Final Connection X) + 세부 timing 6개 추가 가능

### 우선순위 중간
4. **render_player_cards.js 추가 세분화** (~1,360줄) — render_card_radar / mechanic / energy / grf / newtforce / hp 분리
5. **Bilateral asymmetry** — drive/lead leg propulsive·braking impulse asymmetry index (McNally 2015)
6. **Force plate raw 1200Hz 직접 처리** — 현재 c3d.txt 내부 300Hz. raw 1200Hz를 별도 처리하면 timing 해상도 4배 향상

### 우선순위 낮음 (장기)
7. **PPTX 코치덱 v5.29 재생성**
8. **백업 파일 정리** — v5.25/26/27 .bak 파일들 (안정 후 삭제)

## 5. 메모리 reference (영구 저장)

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축

## 6. 새 대화 시작 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.29.md를 읽고 작업을 이어가주세요.
```

## 7. 검증 체크리스트

- [ ] `node scripts/build_dashboard.js` 정상
- [ ] `bash skills/sangdong-dashboard/scripts/verify_build.sh` PASS 43 / FAIL 0
- [ ] dashboard.html 500-520KB 범위
- [ ] 핵심 함수/객체 1회 등장
- [ ] 브라우저 콘솔 에러 없는지 (사용자 확인)

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
