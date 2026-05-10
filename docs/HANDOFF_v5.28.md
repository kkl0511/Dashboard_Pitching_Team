# 상동고 대시보드 v5.28 — Handoff

> **새 대화에서 이 파일부터 읽으세요.** 다음 한 줄로 컨텍스트 복원:
> ```
> Read docs/HANDOFF_v5.28.md
> ```

## 0. 한 줄 요약

상동고 20명 투수 4회 측정 통합 대시보드. **v5.28에서 §3-3 (에너지 흐름)과 §3-4 (지면반력) 카드를 학술 문헌 기반으로 심화**: (1) 분절간 ETE 4-transition + bottleneck 자동 식별 (Aguinaldo 2007/2019, Naito 2008), (2) GRF 수평 성분 + 임펄스 + 타이밍 (Kageyama 2014, MacWilliams 1998, Howenstein 2020). 모듈 합성 순서·검증 통과·dashboard.html 정상.

## 1. v5.28 주요 변경 (이번 대화 누적)

### §3-3 에너지·파워 — 분절간 ETE 추가
- **새 변인 (process_pitching_session.py)**:
  - 분절 peak frame: `peak_pelvis_frame`, `peak_trunk_frame`, `peak_humerus_frame`, `peak_forearm_frame`, `peak_hand_frame`
  - 4 transition lag (ms): `pelvis_to_trunk_lag_ms`, `trunk_to_humerus_lag_ms`, `humerus_to_forearm_lag_ms`, `forearm_to_hand_lag_ms`
  - 추가 분절 ω: `peak_forearm_v` (이전엔 미추출)
- **새 reference (driveline.js)**: `SEGMENT_TRANSITION_REF` — 4 transition × {lag_ideal, lag_acceptable, speed_gain_ideal, speed_gain_acceptable, fault 메시지, 인용}
- **새 분석 함수 (driveline.js)**: `segmentTransitionETE(input)` → m.energy.transitions에 매핑
  - 각 transition 점수 = lag×0.5 + gain×0.5
  - bottleneck 자동 식별 (가장 낮은 점수 = 가장 큰 누수)
- **새 시각화 (render_player_cards.js)**: 분절 chain + bottleneck 강조 박스 + 4-transition table

### §3-4 지면반력 — 수평 성분 + 임펄스 + 타이밍
- **핵심 통찰**: peak는 일회성 정점, **impulse(∫F·dt)가 운동량 변화의 본질**. 수직보다 **수평(추진+블록) 성분이 본질**. **타이밍**도 중요.
- **새 변인 (process_pitching_session.py)**:
  - Drive (FP1, 뒷발): `drive_propulsive_peak_pct_bw`, `drive_propulsive_impulse_pct_bw_s`, `drive_propulsive_peak_time_pct`
  - Lead (FP2, 앞발): `lead_braking_peak_pct_bw`, `lead_braking_impulse_pct_bw_s`, `lead_braking_peak_ms_after_fc`, `lead_block_duration_ms`
  - 비율: `horizontal_to_vertical_ratio`
- **Drive leg 동적 윈도우**: FC 이전 마지막 contiguous active block (FP1_Z > 50N). Theia 표준 분석 윈도우(FC-5 ~ BR+10)와 분리.
- **Lead leg 윈도우**: FC ~ BR + 30 frames (≈ +100ms)
- **임펄스 적분 dt = 1/300s** (c3d.txt 내부 sampling rate; force raw 1200Hz는 export 시 motion 300Hz에 동기화)
- **새 reference (driveline.js)**: `GRF_HORIZONTAL_REF` — 8 metric × {elite_range, acceptable_range, citation}
- **새 분석 함수 (driveline.js)**: `grfHorizontalAnalysis(g)` → m.grf.horizontal
  - drive_score (3 metric 평균) + lead_score (4 metric 평균) + ratio_score
  - 종합: drive 30% + lead 60% + ratio 10%
- **새 시각화 (render_player_cards.js)**: drive/lead/ratio 3개 박스 + 점수 표

### 좌표계 (Theia force plate, P01 검증)
- **Y-** = mound 방향 (drive leg push GRF Y-)
- **Y+** = home plate 방향 (lead leg는 +Y로 ground 밂 → reaction = body가 -Y로 가속 = braking)
- **Z+** = vertical, **X** = lateral

### 학술 reference 정리
**상세 노트**: `docs/references/EnergyFlow_GRF_Horizontal_v5.28.md`

핵심 인용:
- **Naito & Maruyama (2008)** Sports Biomech 7(2):166–180
- **Aguinaldo & Escamilla (2007, 2019)** Sports Biomech 18(1):69–78
- **Howenstein, Kipp, Sabick (2020)** J Biomech 99:109535
- **Werner et al. (2008)** Am J Sports Med 34(4):597–603
- **MacWilliams et al. (1998)** Am J Sports Med 26(1):66–71
- **Kageyama et al. (2014)** J Sports Sci Med 13:910–9
- **Guido & Werner (2012)** J Strength Cond Res 26(7):1782–5

### 검증 결과
- ✅ `node scripts/build_dashboard.js` 정상 (dashboard.html 486,583 bytes — 새 코드 +30KB)
- ✅ `bash skills/sangdong-dashboard/scripts/verify_build.sh` PASS 43 / FAIL 0
- ✅ 신규 함수 3개 + 상수 2개 모두 dashboard.html에 정확히 1회 등장
- ✅ 새 placeholder 2개 (`p-energy-transitions`, `p-grf-horizontal`) 포함
- ✅ P01 sample data parse_theia_trial 결과 정상 (None 처리도 graceful)

### P01 sample 검증 결과 (2026-05-15)
- **분절 lag**:
  - Pelvis→Trunk 16.7ms (X-factor 분리 부족 가능)
  - Trunk→Humerus 66.7ms (어깨 ER 점화 지연 — bottleneck)
  - Humerus→Forearm 3.3ms (너무 빠름)
  - Forearm→Hand -6.7ms (시퀀스 깨짐, 측정 노이즈 가능)
- **Lead leg braking**: 0.9 %BW (elite 100-150과 비교 시 매우 약함)
- **Drive leg**: force plate에 안 올라감 (None — 측정 환경 점검 필요)

## 2. 현재 모듈 체제 (v5.28 — src/js 15개)

v5.27과 동일. 분리 구조 유지하면서 driveline.js와 render_player_cards.js만 확장.

```
driveline.js (369 → 712줄)               ★ v5.28 NEW: SEGMENT_TRANSITION_REF + GRF_HORIZONTAL_REF + 분석 함수
analytics_velocity.js (890)
analytics_fitness.js (488)
analytics_mechanic.js (855)
data.js (403)
render_m1.js (289)
render_player.js (579)
render_player_cards.js (1,134 → ~1,260) ★ v5.28: §3-3·§3-4 새 sub-section
render_long.js (263)
render_common.js (193)
io_apply.js (279 → ~330)                 ★ v5.28: enrichWithAnalytics에 transitions/horizontal 호출 추가
io_c3d.js (490)
io_csv.js (390)
io_storage.js (89)
reports_init.js (452)
```

`scripts/process_pitching_session.py` 추가 변인 추출 (parse_theia_trial 본체 + synthesize_player_summary 양쪽).

## 3. 자주 쓰는 명령어

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"

# 빌드
node scripts/build_dashboard.js

# 검증
bash skills/sangdong-dashboard/scripts/verify_build.sh

# v5.28 새 변인 직접 검증 (단일 trial)
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from process_pitching_session import parse_theia_trial
t = parse_theia_trial('sample_data/2026-05-15_1차측정/01_theia/P01_LYH/Fastball RH Markerless 1.c3d.txt')
for k in ['pelvis_to_trunk_lag_ms','trunk_to_humerus_lag_ms','humerus_to_forearm_lag_ms','forearm_to_hand_lag_ms','drive_propulsive_peak_pct_bw','drive_propulsive_impulse_pct_bw_s','lead_braking_peak_pct_bw','lead_braking_impulse_pct_bw_s','lead_braking_peak_ms_after_fc','lead_block_duration_ms','horizontal_to_vertical_ratio']:
    print(f'  {k}: {t.get(k)}')
"
```

## 4. 다음 작업 후보

### 우선순위 높음
1. **실측 cohort 41명 검증** — 새 변인이 cohort 분포에서 합리적인지 확인. Elite range를 한국 고교 기준으로 재calibrate.
2. **Drive leg 동적 윈도우 강건화** — FP1 활성 구간이 여러 개일 때 main motion 식별 (P01처럼 trial 끝에 stationary 활성이 있을 때)
3. **Force plate raw 1200Hz 직접 활용** — 현재 c3d.txt 내부 300Hz로 작업 중. raw 1200Hz를 별도 처리하면 timing 해상도 4배 향상 (특히 lead braking peak timing)

### 우선순위 중간
4. **Bilateral asymmetry** — drive/lead leg propulsive·braking impulse asymmetry index (McNally 2015)
5. **Vertical impulse** — trunk forward tilt와 vertical impulse 관계 (Werner 2008 lower body biomechanics)
6. **분절 ETE Kinetic version** — 현재 kinematic gain (ω ratio)만. ½Iω² 기반 KE_rot ratio도 함께 (Naito 2008 충실)
7. **Joint power 시계열** — 현재 peak power scalar만. P-D power flow 시간 흐름 시각화 (Aguinaldo 2019)
8. **render_player_cards.js 추가 세분화** (1,260줄+) — render_card_radar / mechanic / energy_grf / hp 분리

### 우선순위 낮음 (장기)
9. **PPTX 코치덱 v5.28 재생성**
10. **백업 파일 정리** — render.js.bak_v5.25, analytics.js.bak_v5.26, io.js.bak_v5.26 (v5.27, v5.28 안정 확인 후)

## 5. 메모리 reference (영구 저장)

- `~/memory/MEMORY.md` — 인덱스
- `~/memory/reference_driveline_pitching_report.md` — 메카닉 5 모델
- `~/memory/reference_driveline_hp_assessment.md` — HP 6축 + Velo Group cohort

## 6. 새 대화 시작 안내 — 한 줄 부트스트랩

```
프로젝트는 /Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team/ 입니다.
docs/HANDOFF_v5.28.md를 읽고 작업을 이어가주세요.
[추가로 하고 싶은 작업 한 줄]
```

또는 더 간결하게:

```
HANDOFF_v5.28 읽고 [작업 내용] 해줘.
```

## 7. 검증 체크리스트 (대화 종료 전 매번)

- [ ] `node scripts/build_dashboard.js` 정상 실행
- [ ] `bash skills/sangdong-dashboard/scripts/verify_build.sh` PASS 43 / FAIL 0
- [ ] dashboard.html 크기 합리적 (450-500KB 범위)
- [ ] 핵심 함수/객체가 dashboard.html에 정확히 1회 등장
- [ ] HANDOFF + 메모리 인덱스 갱신 (버전 bump)
- [ ] 브라우저 콘솔 에러 없는지 (사용자 확인 요청)

---

**연락처**: kklee@kookmin.ac.kr · 국민대 스포츠과학과 야구 바이오메카닉스
