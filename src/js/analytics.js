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

const ANALYTICS_VERSION = '3.0';

/* ────────────────────────────────────────────────────────────
   0. 학년별 벤치마크 (한국 고교 야구 투수 발달 단계)

   문헌 + KBO 유소년 통계 + Stodden(2001), Fleisig(2009) 추정.
   고1→고2→고3 으로 갈수록 골격 성장 + 근력 증가.
   ──────────────────────────────────────────────────────────── */

const GRADE_BENCHMARKS = {
  // 학년별 평균·표준편차 (예시 — 측정 누적되면 실측치로 갱신)
  1: {  // 고1
    velocity_mean: 124, velocity_sd: 6,         // km/h
    cmj_pp_bm_mean: 36, cmj_pp_bm_sd: 5,        // W/kg
    imtp_pf_bm_mean: 25, imtp_pf_bm_sd: 4,      // N/kg
    height_mean: 173, weight_mean: 67
  },
  2: {  // 고2
    velocity_mean: 130, velocity_sd: 6,
    cmj_pp_bm_mean: 41, cmj_pp_bm_sd: 5,
    imtp_pf_bm_mean: 29, imtp_pf_bm_sd: 4,
    height_mean: 178, weight_mean: 75
  },
  3: {  // 고3
    velocity_mean: 135, velocity_sd: 6,
    cmj_pp_bm_mean: 45, cmj_pp_bm_sd: 5,
    imtp_pf_bm_mean: 32, imtp_pf_bm_sd: 4,
    height_mean: 181, weight_mean: 79
  }
};

/**
 * 학년별 잠재구속 임계치 보정 — 발달 단계에 맞춤
 * 같은 측정값이라도 학년에 따라 "충분/부족" 판정이 다름
 */
const GRADE_LATENT_OFFSETS = {
  // value = (LATENT_VELOCITY_WEIGHTS의 th) + (학년별 offset)
  // 고1: 임계치 ↓ (낮은 기준), 고3: 임계치 ↑
  1: { trunk_peak_dps: -100, pelvis_peak_dps: -50, cmj_pp_bm: -5, imtp_pf_bm: -3, shoulder_er_deg: -10, stride_pct_height: -3 },
  2: { trunk_peak_dps:    0, pelvis_peak_dps:   0, cmj_pp_bm:  0, imtp_pf_bm:  0, shoulder_er_deg:   0, stride_pct_height:  0 },
  3: { trunk_peak_dps:  +50, pelvis_peak_dps: +25, cmj_pp_bm: +2, imtp_pf_bm: +1, shoulder_er_deg:  +5, stride_pct_height: +2 }
};

/**
 * 학년 기반 z-score percentile (해당 학년 코호트 내 순위)
 * @param {number} value 측정값
 * @param {number} grade 1|2|3
 * @param {string} metric  'velocity'|'cmj_pp_bm'|'imtp_pf_bm'
 * @returns {{percentile, z, grade, mean, sd}}
 */
function gradePercentile(value, grade, metric){
  const b = GRADE_BENCHMARKS[grade];
  if(!b || value == null || isNaN(value)) return null;
  const meanKey = metric + '_mean', sdKey = metric + '_sd';
  if(b[meanKey] == null) return null;
  const z = (value - b[meanKey]) / b[sdKey];
  // z → percentile (정규근사)
  const pct = Math.round(_normCdf(z) * 100);
  return { percentile: pct, z: Math.round(z*100)/100, grade,
           mean: b[meanKey], sd: b[sdKey] };
}

// 정규분포 CDF 근사 (Abramowitz & Stegun 26.2.17)
function _normCdf(z){
  if(z < -6) return 0; if(z > 6) return 1;
  const b1=0.319381530, b2=-0.356563782, b3=1.781477937,
        b4=-1.821255978, b5=1.330274429, p=0.2316419, c=0.39894228;
  if(z >= 0){
    const t = 1.0 / (1.0 + p*z);
    return 1.0 - c*Math.exp(-z*z/2) * t * (b1 + t*(b2 + t*(b3 + t*(b4 + t*b5))));
  } else {
    return 1.0 - _normCdf(-z);
  }
}

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
 * @param {number} [grade]  1|2|3 — 학년별 임계치 보정 (없으면 default 고2 기준)
 * @returns {{potential_kmh, gap_kmh, contributions, model, grade}}
 */
function latentVelocity(measured_kmh, bio = {}, fit = {}, grade = null){
  if(measured_kmh == null || isNaN(measured_kmh)){
    return { potential_kmh: null, gap_kmh: null, contributions: [], model: ANALYTICS_VERSION, grade };
  }
  const inputs = { ...bio, ...fit };
  const offsets = (grade && GRADE_LATENT_OFFSETS[grade]) || GRADE_LATENT_OFFSETS[2];
  const contributions = [];
  let totalGain = 0;
  for(const [key, spec] of Object.entries(LATENT_VELOCITY_WEIGHTS)){
    const x = inputs[key];
    if(x == null || isNaN(x)) continue;
    const adjThreshold = spec.th + (offsets[key] || 0);
    const above = Math.max(0, x - adjThreshold);
    const gain  = Math.min(spec.max, spec.w * above);
    if(gain > 0.05){
      contributions.push({
        var: key, value: x, threshold: adjThreshold, gain_kmh: Math.round(gain*10)/10,
        source: spec.src
      });
      totalGain += gain;
    }
  }
  totalGain = Math.min(totalGain, 8.0);
  const potential = measured_kmh + totalGain;
  return {
    potential_kmh: Math.round(potential*10)/10,
    gap_kmh:       Math.round(totalGain*10)/10,
    contributions: contributions.sort((a,b)=>b.gain_kmh - a.gain_kmh),
    model:         ANALYTICS_VERSION,
    grade
  };
}

/* ────────────────────────────────────────────────────────────
   3.5 제구 통합 (Command Composite) — Theia + Rapsodo
   같은 "제구"를 운동학(Theia)과 결과(Rapsodo) 두 source 로 측정.
   일치하면 신뢰 ↑, 불일치하면 측정 품질 경고.
   ──────────────────────────────────────────────────────────── */

/**
 * 제구 통합 점수 계산
 * @param {object} theiaConsistency  Theia 일관성 변수
 *   {release_height_sd_cm, wrist_pos_sd_cm, trunk_tilt_sd_deg}
 * @param {object} rapsodoCommand  Rapsodo 결과 변수
 *   {release_height_sd_cm, release_side_sd_cm, in_zone_pct, command_score}
 * @returns {{composite, theia_score, rapsodo_score, agreement, warnings}}
 */
function commandComposite(theiaConsistency = {}, rapsodoCommand = {}){
  // Theia consistency 점수 (운동학적 일관성, 100=완벽)
  let theiaScore = null;
  if(theiaConsistency.release_height_sd_cm != null){
    const rh = theiaConsistency.release_height_sd_cm;
    const wp = theiaConsistency.wrist_pos_sd_cm;
    const tt = theiaConsistency.trunk_tilt_sd_deg;
    // SD 임계: release_height 3cm·wrist 3cm·trunk_tilt 1.5deg → 100점
    let pen = 0;
    pen += Math.max(0, rh - 2) * 12;     // 2cm 초과부터 감점
    if(wp != null) pen += Math.max(0, wp - 2.5) * 8;
    if(tt != null) pen += Math.max(0, tt - 1.0) * 15;
    theiaScore = Math.max(0, Math.min(100, 100 - pen));
  }

  // Rapsodo 점수 (결과 일관성)
  let rapScore = null;
  if(rapsodoCommand.command_score != null){
    rapScore = rapsodoCommand.command_score;
  } else if(rapsodoCommand.in_zone_pct != null){
    // command_score 없으면 in_zone%로 산출
    rapScore = Math.min(100, rapsodoCommand.in_zone_pct * 1.4);  // 70% in-zone → 98점
  }

  // 통합
  const composite = (theiaScore != null && rapScore != null)
    ? Math.round(theiaScore * 0.5 + rapScore * 0.5)
    : (theiaScore != null ? Math.round(theiaScore) :
       rapScore != null ? Math.round(rapScore) : null);

  // Cross-validation — release_height_sd 두 source 일치도
  const warnings = [];
  let agreement = null;
  if(theiaConsistency.release_height_sd_cm != null && rapsodoCommand.release_height_sd_cm != null){
    const diff = Math.abs(theiaConsistency.release_height_sd_cm - rapsodoCommand.release_height_sd_cm);
    agreement = diff < 1 ? 'high' : diff < 2 ? 'medium' : 'low';
    if(agreement === 'low'){
      warnings.push(`Release height SD 불일치: Theia ${theiaConsistency.release_height_sd_cm}cm vs Rapsodo ${rapsodoCommand.release_height_sd_cm}cm — 측정 품질 검토`);
    }
  }
  // Theia 와 Rapsodo 점수 격차도 경고
  if(theiaScore != null && rapScore != null && Math.abs(theiaScore - rapScore) > 25){
    warnings.push(`두 source 점수 격차 큼 (Theia ${Math.round(theiaScore)} vs Rapsodo ${Math.round(rapScore)}) — 운동학 일관성과 실투 결과 사이 갭`);
  }

  return {
    composite,
    theia_score: theiaScore != null ? Math.round(theiaScore) : null,
    rapsodo_score: rapScore != null ? Math.round(rapScore) : null,
    agreement,
    warnings,
    formula: '0.5·Theia(kinematic SD) + 0.5·Rapsodo(release SD + in-zone%)'
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
  // v3.0 — 학년·제구 통합
  gradePercentile, commandComposite,
  // 상수 (UI 인용용)
  LATENT_VELOCITY_WEIGHTS,
  COMPOSITE_WEIGHTS,
  GRADE_BENCHMARKS,
  GRADE_LATENT_OFFSETS
};

// 브라우저 빌드에서 직접 접근 가능
if(typeof window !== 'undefined') window.ANALYTICS = ANALYTICS;
