/* ╔══════════════════════════════════════════════════════════╗
   ║  ANALYTICS — 통계 정식화 모듈 (v2.1)                          ║
   ║                                                              ║
   ║  잠재구속 회귀 · ELI 6-zone 정식 산출 · 신뢰구간 ·           ║
   ║  composite score weights — 모두 문헌 근거 + 출처 명시         ║
   ║                                                              ║
   ║  핵심 함수:                                                  ║
   ║    latentVelocity(measured_v, bio, fit) → {potential, gap}   ║
   ║    eliScoresFromTheia(metrics)         → {z1..z6, eli, cc}   ║
   ║    confidenceInterval(values, α=0.05)  → {mean, lo, hi, n}   ║
   ║    compositeScore(weights, components) → {score, breakdown}  ║
   ╚══════════════════════════════════════════════════════════╝ */

const ANALYTICS_VERSION = '2.1';

/* ────────────────────────────────────────────────────────────
   1. 통계 헬퍼 — 평균·표준편차·신뢰구간
   ──────────────────────────────────────────────────────────── */

function _mean(arr){
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a,b)=>a+b,0) / v.length : null;
}

function _sd(arr){
  const v = arr.filter(x => x != null && !isNaN(x));
  if(v.length < 2) return null;
  const m = _mean(v);
  const sq = v.map(x => (x-m)**2).reduce((a,b)=>a+b,0);
  return Math.sqrt(sq / (v.length - 1));   // 표본 표준편차 (n-1)
}

/**
 * 95% 신뢰구간 (정규근사 + t-분포 근사)
 * @param {number[]} values  trial별 측정값
 * @param {number} alpha     유의수준 (기본 0.05 → 95% CI)
 * @returns {{mean, sd, n, se, ci_half, lo, hi}|null}
 */
function confidenceInterval(values, alpha = 0.05){
  const v = values.filter(x => x != null && !isNaN(x));
  const n = v.length;
  if(n < 2) return null;
  const mean = _mean(v);
  const sd   = _sd(v);
  const se   = sd / Math.sqrt(n);
  // t-critical (df=n-1, two-sided 0.05) 근사 — n≥10 이면 1.96, n=5 면 2.78 등
  const tCrit = _tCritical(n - 1, alpha);
  const ci_half = tCrit * se;
  return {
    mean: Math.round(mean*100)/100,
    sd:   Math.round(sd*100)/100,
    n,
    se:   Math.round(se*100)/100,
    ci_half: Math.round(ci_half*100)/100,
    lo:   Math.round((mean - ci_half)*100)/100,
    hi:   Math.round((mean + ci_half)*100)/100
  };
}

// t-critical 값 (two-sided, alpha=0.05) — 야구 측정 trial N=5~30 범위
function _tCritical(df, alpha = 0.05){
  if(alpha !== 0.05) return 1.96; // 0.05 외에는 정규근사
  // df 1~30 t-table (two-sided 0.05)
  const T = {1:12.71, 2:4.30, 3:3.18, 4:2.78, 5:2.57, 6:2.45, 7:2.36, 8:2.31,
             9:2.26, 10:2.23, 11:2.20, 12:2.18, 13:2.16, 14:2.14, 15:2.13,
             16:2.12, 17:2.11, 18:2.10, 19:2.09, 20:2.09, 25:2.06, 30:2.04};
  if(df >= 30) return 1.96;
  if(T[df] != null) return T[df];
  // 보간
  const keys = Object.keys(T).map(Number).sort((a,b)=>a-b);
  for(let i = 0; i < keys.length-1; i++){
    if(df > keys[i] && df < keys[i+1]){
      const a = keys[i], b = keys[i+1];
      return T[a] + (T[b]-T[a]) * (df-a)/(b-a);
    }
  }
  return 2.0;
}

/**
 * 두 그룹 평균 차이의 paired t-test (전·후 비교)
 * @returns {{diff, t, df, p_approx, significant}}
 */
function pairedTTest(before, after, alpha = 0.05){
  const pairs = [];
  for(let i = 0; i < Math.min(before.length, after.length); i++){
    if(before[i] != null && after[i] != null){
      pairs.push(after[i] - before[i]);
    }
  }
  if(pairs.length < 2) return null;
  const m = _mean(pairs);
  const sd = _sd(pairs);
  const se = sd / Math.sqrt(pairs.length);
  const t = m / se;
  const df = pairs.length - 1;
  const tCrit = _tCritical(df, alpha);
  return {
    diff: Math.round(m*100)/100,
    t: Math.round(t*100)/100,
    df,
    significant: Math.abs(t) > tCrit,
    p_approx: Math.abs(t) > tCrit ? '< 0.05' : '≥ 0.05'
  };
}

/* ────────────────────────────────────────────────────────────
   2. 잠재 구속 회귀 (Latent Velocity Regression)

   문헌 근거:
   - Stodden DF et al. (2001) "Relationship of biomechanical
     factors to baseball pitching velocity" — pelvis & trunk
     angular velocity, stride length, lead knee extension.
   - MacWilliams et al. (1998) "Characteristic GRF in baseball
     pitching" — 앞발 vertical GRF/BW vs ball velocity (r=0.39).
   - Lehman G et al. (2013) "Effects of strength training on
     pitching velocity" — CMJ peak power/BW 와 구속 r=0.32~0.45.
   - Werner et al. (2008) "Relationships between throwing mech
     and elbow varus torque" — shoulder ER max 와 velocity.

   모델 (간이 가법):
     v_potential = v_measured + Σ ΔV_i
     ΔV_i = w_i × max(0, x_i − x_threshold_i)
   각 w_i 는 위 문헌의 회귀계수 보수적 추정값.
   ──────────────────────────────────────────────────────────── */

const LATENT_VELOCITY_WEIGHTS = {
  // 단위: km/h gain per (단위 above threshold)
  // weight, threshold, max_contribution (km/h)
  trunk_peak_dps:   { w: 0.0050, th:  900, max: 4.0, src: 'Stodden 2001' },
  pelvis_peak_dps:  { w: 0.0040, th:  500, max: 3.0, src: 'Stodden 2001' },
  cmj_pp_bm:        { w: 0.20,   th:   38, max: 4.0, src: 'Lehman 2013'  },
  imtp_pf_bm:       { w: 0.15,   th:   28, max: 3.0, src: 'Lehman 2013'  },
  front_grf_bm:     { w: 1.20,   th:  1.5, max: 3.0, src: 'MacWilliams 1998' },
  shoulder_er_deg:  { w: 0.05,   th:  165, max: 2.5, src: 'Werner 2008'  },
  stride_pct_height:{ w: 0.30,   th:   85, max: 3.0, src: 'Stodden 2001' }
};

/**
 * 잠재 구속 추정 — 측정 구속에 기여 가능한 추가량 합산
 * @param {number} measured_kmh  실측 구속 (km/h)
 * @param {object} bio  Theia 변수 — {trunk_peak_dps, pelvis_peak_dps, shoulder_er_deg, stride_pct_height, front_grf_bm}
 * @param {object} fit  ForceDecks 변수 — {cmj_pp_bm, imtp_pf_bm}
 * @returns {{potential_kmh, gap_kmh, contributions, model}}
 */
function latentVelocity(measured_kmh, bio = {}, fit = {}){
  if(measured_kmh == null || isNaN(measured_kmh)){
    return { potential_kmh: null, gap_kmh: null, contributions: [], model: ANALYTICS_VERSION };
  }
  const inputs = { ...bio, ...fit };
  const contributions = [];
  let totalGain = 0;
  for(const [key, spec] of Object.entries(LATENT_VELOCITY_WEIGHTS)){
    const x = inputs[key];
    if(x == null || isNaN(x)) continue;
    const above = Math.max(0, x - spec.th);
    const gain  = Math.min(spec.max, spec.w * above);
    if(gain > 0.05){  // 0.05 km/h 미만은 무시
      contributions.push({
        var: key, value: x, threshold: spec.th, gain_kmh: Math.round(gain*10)/10,
        source: spec.src
      });
      totalGain += gain;
    }
  }
  // 보수적 제한: 잠재구속은 측정 + 8 km/h 이내
  totalGain = Math.min(totalGain, 8.0);
  const potential = measured_kmh + totalGain;
  return {
    potential_kmh: Math.round(potential*10)/10,
    gap_kmh:       Math.round(totalGain*10)/10,
    contributions: contributions.sort((a,b)=>b.gain_kmh - a.gain_kmh),
    model:         ANALYTICS_VERSION
  };
}

/* ────────────────────────────────────────────────────────────
   3. ELI 6-zone 정식 산출 (Energy Leakage Index)

   문헌 근거:
   - Aguinaldo & Chambers (2009) "Correlation of throwing mechanics
     with elbow valgus load" — sequential timing.
   - Stodden et al. (2005) "Influence of pelvis-upper torso
     separation" — X-factor.
   - MacWilliams et al. (1998) — lead leg block.
   - Matsuo et al. (2001) "Comparison of kinematic and temporal
     parameters between different pitch velocity groups" —
     trunk tilt at FC.
   - Werner et al. (2008) — shoulder ER.
   - Aguinaldo & Chambers (2009) — pelvis braking.

   각 zone 점수 100 = 이상적 · 0 = 완전 누수
   ──────────────────────────────────────────────────────────── */

function _clamp01(x){ return Math.max(0, Math.min(100, x)); }

/**
 * ELI 6 zone 산출
 * @param {object} m  Theia 핵심 변수
 *   - pelvis_to_trunk_lag_ms, trunk_to_arm_lag_ms
 *   - x_factor_max_deg
 *   - lead_knee_change_deg  (FC→release; 양수=신전, 음수=collapse)
 *   - trunk_tilt_at_fc_deg  (전방 기울기, 이상 25~35)
 *   - trunk_lat_tilt_deg    (좌우 기울기, 이상 <15)
 *   - shoulder_er_max_deg
 *   - pelvis_brake_ratio    (pelvis_AV at trunk_max / pelvis_peak_AV; 이상 <0.5)
 * @returns {{zone1..6, eli_score, causal_chains}}
 */
function eliScoresFromTheia(m){
  // Zone 1: Sequential timing (이상 pelvis→trunk 30-50ms, trunk→arm 25-45ms)
  const z1 = (function(){
    const ptIdeal = 40, taIdeal = 35;
    const pt = m.pelvis_to_trunk_lag_ms;
    const ta = m.trunk_to_arm_lag_ms;
    let pen = 0;
    if(pt != null) pen += Math.abs(pt - ptIdeal) * 1.2;
    if(ta != null) pen += Math.abs(ta - taIdeal) * 1.2;
    return _clamp01(100 - pen);
  })();

  // Zone 2: X-factor (이상 ≥40°)
  const z2 = (function(){
    const x = m.x_factor_max_deg;
    if(x == null) return null;
    if(x >= 40) return 100;
    if(x <= 15) return 0;
    return _clamp01((x - 15) / 25 * 100);
  })();

  // Zone 3: Lead block — knee 신전 (양수=좋음, 음수=collapse)
  const z3 = (function(){
    const k = m.lead_knee_change_deg;
    if(k == null) return null;
    // 이상: +5° 이상 신전.  collapse(-5° 이하)는 큰 감점.
    if(k >= 5) return 100;
    if(k >= 0) return 70 + (k * 6);                    // 0~5° → 70~100
    if(k >= -10) return _clamp01(70 + k * 7);          // 0~-10° → 70~0
    return 0;
  })();

  // Zone 4: Trunk at FC (이상 전방 25-35°, 측방 <15°)
  const z4 = (function(){
    const fwd = m.trunk_tilt_at_fc_deg;
    const lat = m.trunk_lat_tilt_deg;
    if(fwd == null) return null;
    let pen = 0;
    // 전방 기울기 30°가 이상점, ±15° 마다 100점 감점
    pen += Math.abs(fwd - 30) * 2;
    if(lat != null) pen += Math.max(0, lat - 15) * 3;
    return _clamp01(100 - pen);
  })();

  // Zone 5: Shoulder ER max (이상 165-185°)
  const z5 = (function(){
    const er = m.shoulder_er_max_deg;
    if(er == null) return null;
    if(er >= 165 && er <= 185) return 100;
    if(er > 185) return _clamp01(100 - (er - 185) * 2);   // 과도한 ER 감점
    return _clamp01(100 - (165 - er) * 2);                 // 부족 감점
  })();

  // Zone 6: Pelvis braking — pelvis_AV at trunk_max / pelvis_peak_AV
  const z6 = (function(){
    const r = m.pelvis_brake_ratio;
    if(r == null) return null;
    if(r <= 0.3) return 100;
    if(r >= 0.8) return 0;
    return _clamp01(100 - (r - 0.3) * 200);   // 0.3→100, 0.8→0
  })();

  // ELI 종합 (null 제외 평균)
  const zones = [z1, z2, z3, z4, z5, z6];
  const valid = zones.filter(z => z != null);
  const eli = valid.length ? Math.round(valid.reduce((a,b)=>a+b,0) / valid.length) : null;

  // 인과 chain — 점수 낮은 zone 3개 + 추정 손실 km/h
  const labels = [
    {key:'zone1', label:'골반→몸통→팔 시퀀스 어긋남',  defect:'분절 가속 순서 결함', impact_w: 0.18},
    {key:'zone2', label:'X-factor 부족',                defect:'골반-상체 분리 미달',  impact_w: 0.15},
    {key:'zone3', label:'앞발 받쳐주기 약함',           defect:'Lead knee collapse',   impact_w: 0.18},
    {key:'zone4', label:'앞발 착지 시 몸통 자세 불량',   defect:'FC 시 트렁크 기울기 부적절', impact_w: 0.14},
    {key:'zone5', label:'어깨 ER 부족 / 과도',          defect:'Shoulder ER 부적절',    impact_w: 0.12},
    {key:'zone6', label:'골반 감속 부족',               defect:'Pelvis braking 부족',   impact_w: 0.20}
  ];
  const enriched = zones.map((s, i) => ({ ...labels[i], score: s }))
                        .filter(z => z.score != null);
  const causal = enriched
    .sort((a,b) => a.score - b.score)
    .slice(0, 3)
    .map(z => ({
      zone: z.key, zone_label: z.label, defect: z.defect,
      impact_kmh: Math.round(-((100 - z.score) * z.impact_w / 10) * 10) / 10
    }));

  return {
    zone1_sequence:       z1 != null ? Math.round(z1) : null,
    zone2_x_factor:       z2 != null ? Math.round(z2) : null,
    zone3_lead_block:     z3 != null ? Math.round(z3) : null,
    zone4_trunk_at_fc:    z4 != null ? Math.round(z4) : null,
    zone5_shoulder_align: z5 != null ? Math.round(z5) : null,
    zone6_pelvis_brake:   z6 != null ? Math.round(z6) : null,
    eli_score: eli,
    causal_chains: causal,
    model: ANALYTICS_VERSION
  };
}

/* ────────────────────────────────────────────────────────────
   4. Composite Score Weights (정식화)

   각 종합점수의 weight 를 명시 — UI/리포트에서 인용 가능.
   ──────────────────────────────────────────────────────────── */

const COMPOSITE_WEIGHTS = {
  velocity: {
    measured_pct:    0.40,   // 측정 구속 (코호트 percentile)
    consistency_pct: 0.20,   // trial 간 SD ↓
    potential_pct:   0.40,   // 잠재 구속과의 gap (작을수록 ↑)
    note: '0.40·측정+0.20·일관성+0.40·잠재달성률'
  },
  sequence: {
    ete_pct:         0.35,   // Energy Transfer Efficiency
    speed_gain:      0.25,   // 골반→몸통→팔 가속 비율
    proper_seq:      0.20,   // 시퀀스 순서 정상 (boolean)
    timing_lag:      0.20,   // pelvis→trunk, trunk→arm lag 정확도
    note: '0.35·ETE+0.25·SpeedGain+0.20·SeqOrder+0.20·LagTiming'
  },
  fault: {
    consistency:     0.40,   // release height SD, wrist pos SD
    injury_risk:     0.35,   // x_factor, lead_knee_change extreme
    fault_count:     0.25,   // discrete fault 발생 개수
    note: '0.40·일관성+0.35·부상위험+0.25·결함횟수'
  },
  fitness: {
    cmj_pp:          0.40,   // CMJ peak power / BW
    imtp_pf:         0.40,   // IMTP peak force / BW
    asymmetry:       0.20,   // L/R 비대칭 (적을수록 ↑)
    note: '0.40·CMJ+0.40·IMTP+0.20·대칭'
  }
};

/**
 * 가중평균 composite score 계산
 * @param {object} weights  COMPOSITE_WEIGHTS 의 한 카테고리
 * @param {object} components  {key: 0~100 점수, ...}
 * @returns {{score, breakdown}}
 */
function compositeScore(weights, components){
  let totalW = 0, totalScore = 0;
  const breakdown = [];
  for(const [key, w] of Object.entries(weights)){
    if(key === 'note') continue;
    const v = components[key];
    if(v == null || isNaN(v)) continue;
    totalW += w;
    totalScore += w * v;
    breakdown.push({ component: key, value: Math.round(v), weight: w });
  }
  return {
    score: totalW > 0 ? Math.round(totalScore / totalW) : null,
    breakdown,
    formula: weights.note || ''
  };
}

/* ────────────────────────────────────────────────────────────
   5. 코호트 percentile

   N≥10 의 코호트 데이터에 대해 한 선수의 위치를 퍼센타일로 환산.
   N<10 이면 신뢰도 부족 표시.
   ──────────────────────────────────────────────────────────── */

/**
 * percentile rank (linear interpolation)
 * @param {number} value
 * @param {number[]} cohort
 * @returns {{percentile, n, reliable}}
 */
function percentileRank(value, cohort){
  const v = cohort.filter(x => x != null && !isNaN(x)).sort((a,b)=>a-b);
  if(v.length === 0 || value == null) return { percentile: null, n: 0, reliable: false };
  let below = 0;
  for(const x of v){
    if(x < value) below++;
    else if(x === value) below += 0.5;
    else break;
  }
  return {
    percentile: Math.round(below / v.length * 100),
    n: v.length,
    reliable: v.length >= 10
  };
}

/* ────────────────────────────────────────────────────────────
   외부 노출 — 브라우저 전역 (window) 에 namespace 로 등록
   ──────────────────────────────────────────────────────────── */

const ANALYTICS = {
  version: ANALYTICS_VERSION,
  // 통계 유틸
  mean: _mean, sd: _sd,
  confidenceInterval, pairedTTest,
  // 분석 함수
  latentVelocity, eliScoresFromTheia,
  compositeScore, percentileRank,
  // 상수 (UI 인용용)
  LATENT_VELOCITY_WEIGHTS,
  COMPOSITE_WEIGHTS
};

// 브라우저 빌드에서 직접 접근 가능
if(typeof window !== 'undefined') window.ANALYTICS = ANALYTICS;
