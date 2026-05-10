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

// v3.5-3 검증: 41명 한국 elite 코호트 자체 회귀 결과 — pelvis_peak ↔ velocity R=-0.10
// (range restriction — elite 는 이미 pelvis power 충분, 차이 없음)
// 따라서 문헌 가중치 유지. 자체 회귀는 일반/혼합 코호트에서 의미 있음.
// 한국 elite 평균 구속 133.6 km/h 자체가 ceiling reference 로 작동.
const LATENT_VELOCITY_WEIGHTS = {
  // 단위: km/h gain per (단위 above threshold)
  trunk_peak_dps:   { w: 0.0050, th:  900, max: 4.0, src: 'Stodden 2001 (univariate r≈0.4)' },
  pelvis_peak_dps:  { w: 0.0040, th:  500, max: 3.0, src: 'Stodden 2001 (한국 elite N=41 fit R=-0.10, range restriction)' },
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
/**
 * v5.8: Mechanical Energy 자체 계산 — De Leva (1996) 인체 관성 모델
 *
 * V3D export에 Mechanical_Energy 컬럼이 없을 때 angular velocity peak로 KE_rot 추정.
 * (V3D ME는 KE_total = KE_trans + KE_rot + PE 합산이라 정의가 다를 수 있음 →
 *  학술적 일관성을 위해 모든 trial에 자체 계산 KE_rot 사용 권장)
 *
 * 학술 근거: De Leva (1996) "Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters"
 *   J. Biomech 29(9), 1223-1230. Korean adult male approximation.
 *
 *   I_segment_z = m_segment × (k_z × L_segment)²
 *   KE_rot_peak = 0.5 × I × ω_peak²   (ω in rad/s)
 *
 *   m, L, k 비율 (BW, stature 대비):
 *   ┌──────────┬─────────┬──────────┬─────────┐
 *   │ Segment  │ m / BW  │ L / stat │ k_z / L │
 *   ├──────────┼─────────┼──────────┼─────────┤
 *   │ Pelvis   │ 10.1%   │  9.4%    │ 49.7%   │
 *   │ Trunk    │ 43.5%   │ 37.8%    │ 32.3%   │
 *   │ Humerus  │  2.7%   │ 18.6%    │ 28.5%   │
 *   └──────────┴─────────┴──────────┴─────────┘
 *
 * @param {string} segment  'pelvis' | 'trunk' | 'humerus'
 * @param {number} bodyMassKg
 * @param {number} statureM
 * @param {number} omegaPeakDegPerSec  peak angular velocity (deg/s)
 * @returns {number} KE_rot peak in Joules
 */
const DE_LEVA_PARAMS = {
  pelvis:  { m_frac: 0.101, L_frac: 0.094, k_frac: 0.497 },
  trunk:   { m_frac: 0.435, L_frac: 0.378, k_frac: 0.323 },
  humerus: { m_frac: 0.027, L_frac: 0.186, k_frac: 0.285 }
};
function selfCalcSegmentKE(segment, bodyMassKg, statureM, omegaPeakDegPerSec){
  const p = DE_LEVA_PARAMS[segment];
  if(!p || bodyMassKg == null || statureM == null || omegaPeakDegPerSec == null) return null;
  const m = p.m_frac * bodyMassKg;                     // segment mass (kg)
  const L = p.L_frac * statureM;                       // segment length (m)
  const I = m * Math.pow(p.k_frac * L, 2);             // moment of inertia (kg·m²)
  const omegaRad = omegaPeakDegPerSec * Math.PI / 180; // rad/s
  return 0.5 * I * omegaRad * omegaRad;                // KE_rot in J
}

/**
 * v5.5: 힘 전달(Energy Transfer) 점수 — Kinematic + Kinetic 결합
 *
 * 학술 근거:
 *   - Aguinaldo & Escamilla (2019) Sports Biomech — kinematic sequencing + energy magnitude
 *   - Naito et al. (2014, 2017) double-pendulum 모델 — energy flow ratios
 *   - Werner et al. (2008) — elite pitcher mech energy ratios
 *
 * 두 측면을 50:50 가중평균:
 *   1) Kinematic ETE (시간 차원) — ete_pct + speed_gain_pt + speed_gain_ta
 *      proper sequence 타이밍이 맞고 분절 간 속도 증폭이 크면 높음
 *   2) Kinetic ETE (에너지 차원) — humerus_J / pelvis_J × 100
 *      골반 mech_energy가 팔/손까지 잘 전달되면 ratio 65-85%
 *
 * 한쪽 입력만 있을 때는 그 쪽만 사용 (graceful degradation).
 *
 * @param {object} input  — 다음 키들 중 일부 (모두 선택):
 *   ete_pct, speed_gain_pt, speed_gain_ta,
 *   mech_energy_pelvis_J, mech_energy_trunk_J, mech_energy_humerus_J
 * @returns {{score, kinematic, kinetic_ete, ratio_humerus_to_pelvis_pct, basis}}
 */
function transferScoreV2(input = {}){
  const norm = (v, base, mult) => Math.max(20, Math.min(98, 50 + (v - base) * mult));
  const r = (x, p = 0) => x == null ? null : Math.round(x * Math.pow(10, p)) / Math.pow(10, p);

  // (1) Kinematic ETE — 시퀀싱 측면
  let kinematic = null;
  if(input.ete_pct != null && input.speed_gain_pt != null && input.speed_gain_ta != null){
    kinematic = norm(input.ete_pct, 75, 1.5)*0.4
              + norm(input.speed_gain_pt*100, 150, 0.4)*0.3
              + norm(input.speed_gain_ta*100, 200, 0.3)*0.3;
  }

  // (2) Kinetic ETE — 에너지 전달 측면. V3D ME 정의 vs self-calc KE_rot 정의가 다르므로 분기
  //   V3D mode (Mechanical_Energy 컬럼 사용): ratio 학술 reference 65-90% (Werner 2008)
  //   self-calc KE_rot mode (ω²·I): ratio 800-3000%, 1500%≈50점 임시 calibration
  //   (cohort 누적 후 percentile-based로 재calibrate 권장)
  let kineticEte = null, ratioPct = null;
  const pJ = input.mech_energy_pelvis_J;
  const hJ = input.mech_energy_humerus_J;
  const meBasis = input.me_basis || 'V3D';   // 'V3D' | 'self_calc_KE_rot'
  if(pJ != null && hJ != null && pJ > 0){
    ratioPct = (hJ / pJ) * 100;
    if(meBasis === 'self_calc_KE_rot'){
      // v5.8: 한국 고1 + 프로/대학 합본 cohort (n=57) percentile-based calibration
      //   median 1660 = 50점, p90 2550 = 80점, mult = 30/890 = 0.0337
      //   학술 reference 65-90% (Werner)와는 다른 scale (KE_rot vs KE_total 정의 차이)
      kineticEte = norm(ratioPct, 1660, 0.0337);
    } else {
      kineticEte = norm(ratioPct, 65, 0.8);       // V3D mode (학술 reference)
    }
  }

  // 가중평균 (둘 다 있으면 50:50)
  let score = null, basis = 'none';
  if(kinematic != null && kineticEte != null){
    score = 0.5 * kinematic + 0.5 * kineticEte; basis = 'combined';
  } else if(kinematic != null){
    score = kinematic;  basis = 'kinematic_only';
  } else if(kineticEte != null){
    score = kineticEte; basis = 'kinetic_only';
  }

  return {
    score:                       r(score),
    kinematic:                   r(kinematic),
    kinetic_ete:                 r(kineticEte),
    ratio_humerus_to_pelvis_pct: r(ratioPct, 1),
    basis: basis,
    me_basis: meBasis           // v5.8: 'V3D' or 'self_calc_KE_rot'
  };
}

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
  // v3.8-3: BBL Uplift fault_images SVG 매핑 추가
  const labels = [
    {key:'zone1', label:'골반→몸통→팔 시퀀스 어긋남',  defect:'분절 가속 순서 결함', impact_w: 0.18, image:'EarlyRelease.png'},
    {key:'zone2', label:'X-factor 부족',                defect:'골반-상체 분리 미달',  impact_w: 0.15, image:'FlyingOpen.png'},
    {key:'zone3', label:'앞발 받쳐주기 약함',           defect:'Lead knee collapse',   impact_w: 0.18, image:'KneeCollapse.png'},
    {key:'zone4', label:'앞발 착지 시 몸통 자세 불량',   defect:'FC 시 트렁크 기울기 부적절', impact_w: 0.14, image:'Sway.png'},
    {key:'zone5', label:'어깨 ER 부족 / 과도',          defect:'Shoulder ER 부적절',    impact_w: 0.12, image:'ForearmFlyout.png'},
    {key:'zone6', label:'골반 감속 부족',               defect:'Pelvis braking 부족',   impact_w: 0.20, image:'GettingOutFront.png'}
  ];
  const enriched = zones.map((s, i) => ({ ...labels[i], score: s }))
                        .filter(z => z.score != null);
  const causal = enriched
    .sort((a,b) => a.score - b.score)
    .slice(0, 3)
    .map(z => ({
      zone: z.key, zone_label: z.label, defect: z.defect,
      impact_kmh: Math.round(-((100 - z.score) * z.impact_w / 10) * 10) / 10,
      image: z.image  // v3.8-3: 결함 시각 이미지 파일명
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
   3.55 부상 위험도 정식 산출 (v3.2 신규)

   문헌 근거:
   - Fleisig et al. (2012, ASMI) — elbow/shoulder injury risk in pitching
   - Aguinaldo & Chambers (2009) — sequential timing → elbow valgus torque
   - Eckard et al. (2020) — workload + asymmetry → shoulder injury
   - Opar et al. (2015) — Nordic strength asymmetry → hamstring injury

   여러 위험 요인을 가중 합산해 0~100 risk_score 산출.
   ──────────────────────────────────────────────────────────── */

/**
 * 부상 위험도 정식 산출
 * @param {object} m  관련 변수
 *   {x_factor_max_deg, lead_knee_change_deg, trunk_lat_tilt_deg,
 *    pelvis_to_trunk_lag_ms, elbow_W, shoulder_er_max_deg,
 *    imtp_asymmetry_pct, nordic_imbalance_pct, shoulder_er_ir_ratio,
 *    hip_imbalance_pct, fault_count}
 * @returns {{risk_score, risk_level, contributors, recommendations}}
 */
function injuryRisk(m = {}){
  const factors = [];
  let totalRisk = 0;

  // ① X-factor 과도 (>55°): elbow valgus torque 급증
  if(m.x_factor_max_deg != null){
    if(m.x_factor_max_deg > 55){
      const r = Math.min(20, (m.x_factor_max_deg - 55) * 1.2);
      factors.push({ var:'x_factor', value:m.x_factor_max_deg, risk:r,
                     reason:`X-factor ${m.x_factor_max_deg}° > 55° (분리 과다)` });
      totalRisk += r;
    }
  }
  // ② Lead knee collapse (<-10°): kinetic chain leak + 무릎 부담
  if(m.lead_knee_change_deg != null && m.lead_knee_change_deg < -10){
    const r = Math.min(15, Math.abs(m.lead_knee_change_deg + 10) * 1.5);
    factors.push({ var:'lead_knee', value:m.lead_knee_change_deg, risk:r,
                   reason:`Lead knee ${m.lead_knee_change_deg}° collapse (앞발 무너짐)` });
    totalRisk += r;
  }
  // ③ Trunk lateral tilt (>20°): 어깨 부담 + 부정확
  if(m.trunk_lat_tilt_deg != null && m.trunk_lat_tilt_deg > 20){
    const r = Math.min(12, (m.trunk_lat_tilt_deg - 20) * 1.0);
    factors.push({ var:'trunk_lat', value:m.trunk_lat_tilt_deg, risk:r,
                   reason:`Trunk lateral tilt ${m.trunk_lat_tilt_deg}° (옆으로 기울어짐)` });
    totalRisk += r;
  }
  // ④ Pelvis-trunk timing 충돌 (<25ms): kinetic chain 단락 → 팔 부담
  if(m.pelvis_to_trunk_lag_ms != null && m.pelvis_to_trunk_lag_ms < 25){
    const r = Math.min(15, (25 - m.pelvis_to_trunk_lag_ms) * 1.2);
    factors.push({ var:'pt_lag', value:m.pelvis_to_trunk_lag_ms, risk:r,
                   reason:`Pelvis→trunk lag ${m.pelvis_to_trunk_lag_ms}ms < 25ms (timing 충돌)` });
    totalRisk += r;
  }
  // ⑤ Shoulder ER 과도 (>185°): rotator cuff 부담
  if(m.shoulder_er_max_deg != null && m.shoulder_er_max_deg > 185){
    const r = Math.min(12, (m.shoulder_er_max_deg - 185) * 0.8);
    factors.push({ var:'shoulder_er', value:m.shoulder_er_max_deg, risk:r,
                   reason:`Shoulder ER ${m.shoulder_er_max_deg}° > 185° (회전근개 부담)` });
    totalRisk += r;
  }
  // ⑥ IMTP 비대칭 (>10%): 좌우 force 불균형
  if(m.imtp_asymmetry_pct != null && m.imtp_asymmetry_pct > 10){
    const r = Math.min(10, (m.imtp_asymmetry_pct - 10) * 1.2);
    factors.push({ var:'imtp_asym', value:m.imtp_asymmetry_pct, risk:r,
                   reason:`IMTP 좌우 비대칭 ${m.imtp_asymmetry_pct}% > 10%` });
    totalRisk += r;
  }
  // ⑦ Nordic 비대칭 (>11%, VALD 75th percentile): 햄스트링 부상 위험
  if(m.nordic_imbalance_pct != null && m.nordic_imbalance_pct > 11){
    const r = Math.min(10, (m.nordic_imbalance_pct - 11) * 1.0);
    factors.push({ var:'nordic_asym', value:m.nordic_imbalance_pct, risk:r,
                   reason:`Nordic 비대칭 ${m.nordic_imbalance_pct}% > 11% (햄스트링)` });
    totalRisk += r;
  }
  // ⑧ Shoulder ER/IR 비율 < 0.95: rotator cuff imbalance
  if(m.shoulder_er_ir_ratio != null && m.shoulder_er_ir_ratio < 0.95){
    const r = Math.min(10, (0.95 - m.shoulder_er_ir_ratio) * 30);
    factors.push({ var:'er_ir_ratio', value:m.shoulder_er_ir_ratio, risk:r,
                   reason:`Shoulder ER:IR ${m.shoulder_er_ir_ratio} < 0.95 (회전근개 불균형)` });
    totalRisk += r;
  }
  // ⑨ Hip 비대칭 (>13%, VALD 75th): 골반-하지 불균형
  if(m.hip_imbalance_pct != null && m.hip_imbalance_pct > 13){
    const r = Math.min(8, (m.hip_imbalance_pct - 13) * 0.8);
    factors.push({ var:'hip_asym', value:m.hip_imbalance_pct, risk:r,
                   reason:`Hip 비대칭 ${m.hip_imbalance_pct}% > 13%` });
    totalRisk += r;
  }

  totalRisk = Math.min(100, Math.round(totalRisk));
  let level;
  if(totalRisk >= 50)      level = 'high';
  else if(totalRisk >= 25) level = 'mid';
  else                     level = 'low';

  // 권장 (가장 높은 risk 3개)
  const top3 = factors.sort((a,b)=>b.risk-a.risk).slice(0, 3);
  const recommendations = top3.map(f => {
    const tipMap = {
      x_factor:    'X-factor 점진적 감소 — hip-shoulder 분리 ROM 조절',
      lead_knee:   'Lead leg 강화 (단일하지 box jump, RFE split squat)',
      trunk_lat:   'Anti-lateral flexion core (suitcase carry, side plank)',
      pt_lag:      'Sequencing drill — medicine ball rotational throw',
      shoulder_er: 'ER ROM 점진 회복 + cuff isometric',
      imtp_asym:   '좌우 균등 unilateral training (split squat, single-leg DL)',
      nordic_asym: 'Nordic curl progressive (낮은 쪽 추가 set)',
      er_ir_ratio: 'Cuff 외회전 강화 (band ER, side-lying ER)',
      hip_asym:    'Lateral hip 강화 + Copenhagen plank'
    };
    return { factor: f.var, value: f.value, recommendation: tipMap[f.var] || '추가 분석 필요' };
  });

  return {
    risk_score: totalRisk,
    risk_level: level,
    contributors: factors.sort((a,b)=>b.risk-a.risk),
    recommendations
  };
}

/* ────────────────────────────────────────────────────────────
   3.6 GRF 정식 산출 (v3.1) — LHEI · force balance · type

   문헌 근거:
   - MacWilliams et al. (1998) "Characteristic GRF in baseball pitching"
     — rear leg push-off ~75% BW, lead leg block ~80~120% BW
   - Kageyama et al. (2014) — lead leg vertical impulse 와 ball velocity
     상관 r=0.50~0.60
   - McNally et al. (2015) — pitchers with GRF 패턴 4분류
   ──────────────────────────────────────────────────────────── */

// v3.7 갱신: 41명 한국 elite 자동 분류 후 실측 기반
// lead median = 195% BW, rear median = 161% BW (BW 840N 기준 — 84kg)
const GRF_BENCHMARKS = {
  rear_force_pct_ideal:  160,   // 41명 elite median: rear 1352N / 84kg ≈ 161% BW
  lead_force_pct_ideal:  195,   // 41명 elite median: lead 1641N / 84kg ≈ 195% BW
  asymmetry_max:         15,
  lhei_excellent:        1.20,
  lhei_acceptable:       0.90,
  source: 'KR HS Elite N=41 (자동 FP1/FP2 분류 후)'
};

/**
 * GRF 정식 산출 — Lead Hip Energy Index + force balance + type
 * @param {object} g  GRF 변수
 *   {rear_force_pct_bw, lead_force_pct_bw, lead_vertical_impulse_n_s, body_mass_kg, pitch_time_ms,
 *    lateral_force_asymmetry_pct}
 * @returns {{lhei, lhei_score, balance_score, asymmetry_score, type, grf_score, components}}
 */
function grfScore(g = {}){
  // ── LHEI (Lead Hip Energy Index) ──
  // = lead_vertical_impulse / body_mass / pitch_time
  let lhei = null, lheiScore = null;
  if(g.lead_vertical_impulse_n_s != null && g.body_mass_kg && g.pitch_time_ms){
    lhei = g.lead_vertical_impulse_n_s / g.body_mass_kg / (g.pitch_time_ms / 1000);
    lhei = Math.round(lhei*100)/100;
    if(lhei >= GRF_BENCHMARKS.lhei_excellent) lheiScore = 100;
    else if(lhei >= GRF_BENCHMARKS.lhei_acceptable) lheiScore = 70 + (lhei - 0.90) * 100;
    else lheiScore = Math.max(0, lhei / 0.90 * 70);
    lheiScore = Math.round(_clamp01(lheiScore));
  }
  // ── Force balance ──
  // rear ideal=75% (60~95 OK), lead ideal=100% (75~120 OK)
  let balanceScore = null;
  if(g.rear_force_pct_bw != null && g.lead_force_pct_bw != null){
    const rearPen = Math.abs(g.rear_force_pct_bw - GRF_BENCHMARKS.rear_force_pct_ideal) * 1.2;
    const leadPen = Math.abs(g.lead_force_pct_bw - GRF_BENCHMARKS.lead_force_pct_ideal) * 1.0;
    balanceScore = Math.round(_clamp01(100 - (rearPen + leadPen) / 2));
  }
  // ── Lateral asymmetry ──
  let asymScore = null;
  if(g.lateral_force_asymmetry_pct != null){
    const a = g.lateral_force_asymmetry_pct;
    asymScore = Math.round(_clamp01(100 - Math.max(0, a - 5) * 4));
  }
  // ── Type 분류 (5가지) ──
  let type = '데이터 부족';
  if(g.rear_force_pct_bw != null && g.lead_force_pct_bw != null){
    const r = g.rear_force_pct_bw, l = g.lead_force_pct_bw;
    const asym = g.lateral_force_asymmetry_pct;
    if(asym != null && asym > GRF_BENCHMARKS.asymmetry_max) type = '좌우로 새는';
    else if(r > 90 && l < 70)              type = '뒤에 처지는';
    else if(r < 60 && l > 95)              type = '앞으로 쏟아지는';
    else if(r > 90 && l > 110)             type = '잠깐만 미는';
    else                                   type = '균형형';
  }
  // ── 종합 GRF score = 0.50 LHEI + 0.30 balance + 0.20 asymmetry ──
  const validPieces = [lheiScore, balanceScore, asymScore].filter(x => x != null);
  const weights     = [0.50, 0.30, 0.20];
  let grfScore_ = null;
  if(validPieces.length){
    let totalW = 0, totalS = 0;
    [lheiScore, balanceScore, asymScore].forEach((s, i) => {
      if(s != null){ totalS += s * weights[i]; totalW += weights[i]; }
    });
    grfScore_ = Math.round(totalS / totalW);
  }
  return {
    lhei, lhei_score: lheiScore,
    balance_score:    balanceScore,
    asymmetry_score:  asymScore,
    type,
    grf_score: grfScore_,
    components: { lhei, balance: balanceScore, asymmetry: asymScore },
    formula: '0.50·LHEI + 0.30·Balance + 0.20·Asymmetry'
  };
}

/* ────────────────────────────────────────────────────────────
   3.7 Stuff Score 정식화 (v3.1)

   문헌 근거:
   - Driveline Baseball "Stuff+" 모델 (공개 자료)
   - Pitching Ninja, Baseball Savant — velocity·spin·movement 기반 평가
   - Bauer Units = spin_rpm / velocity_mph (≥26 우수)

   가중:  velocity 0.30 · bauer 0.25 · IVB 0.25 · HB 0.20
   단, 학년 또는 코호트 percentile 사용 (절대값 비교 위험)
   ──────────────────────────────────────────────────────────── */

/**
 * @param {object} m  Rapsodo 평균값
 *   {velocity_kmh, spin_rpm, ivb_cm, hb_cm, spin_efficiency_pct}
 * @param {string} cohort  'KBO'|'HS' (학년 추가 시 'HS-1' 등)
 * @returns {{stuff_score, components, breakdown, cohort, formula}}
 */
function stuffScore(m = {}, cohort = 'HS'){
  const COH = STUFF_BENCHMARKS[cohort] || STUFF_BENCHMARKS.HS;
  const breakdown = [];
  // velocity (mph) — z-score → percentile
  let vScore = null;
  if(m.velocity_kmh != null){
    const vMph = m.velocity_kmh / 1.60934;
    const z = (vMph - COH.velo_mph_mean) / COH.velo_mph_sd;
    vScore = Math.round(_clamp01(_normCdf(z) * 100));
    breakdown.push({ var: 'velocity', value: Math.round(vMph*10)/10, unit: 'mph', score: vScore, weight: 0.30 });
  }
  // Bauer Units (spin/vMph)
  let bScore = null;
  if(m.spin_rpm != null && m.velocity_kmh != null){
    const bauer = m.spin_rpm / (m.velocity_kmh / 1.60934);
    const z = (bauer - COH.bauer_mean) / COH.bauer_sd;
    bScore = Math.round(_clamp01(_normCdf(z) * 100));
    breakdown.push({ var: 'bauer', value: Math.round(bauer*10)/10, unit: '', score: bScore, weight: 0.25 });
  }
  // IVB (Induced Vertical Break) — 18~24 inch (45~60cm) 우수
  let iScore = null;
  if(m.ivb_cm != null){
    const ivbInch = m.ivb_cm / 2.54;
    // 단순 임계: 22 inch 이상 100, 16 이하 0, 그 사이 선형
    if(ivbInch >= 22) iScore = 100;
    else if(ivbInch <= 16) iScore = 0;
    else iScore = Math.round((ivbInch - 16) / 6 * 100);
    breakdown.push({ var: 'ivb', value: Math.round(ivbInch*10)/10, unit: 'inch', score: iScore, weight: 0.25 });
  }
  // HB (Horizontal Break) — 절대값 8 inch 이하 우수 (FB는 작을수록 좋음)
  let hScore = null;
  if(m.hb_cm != null){
    const hbInch = Math.abs(m.hb_cm / 2.54);
    if(hbInch <= 4) hScore = 100;
    else if(hbInch >= 12) hScore = 0;
    else hScore = Math.round(100 - (hbInch - 4) * 12.5);
    breakdown.push({ var: 'hb_abs', value: Math.round(hbInch*10)/10, unit: 'inch', score: hScore, weight: 0.20 });
  }
  // 종합 Stuff Score
  let total = null;
  if(breakdown.length){
    let totalW = 0, totalS = 0;
    breakdown.forEach(b => { totalS += b.score * b.weight; totalW += b.weight; });
    total = Math.round(totalS / totalW);
  }
  return {
    stuff_score: total,
    components:  breakdown,
    cohort,
    formula: '0.30·Velocity + 0.25·Bauer + 0.25·IVB + 0.20·HB(abs)'
  };
}

const STUFF_BENCHMARKS = {
  // mph 단위 (1 mph ≈ 1.609 km/h)
  KBO:    { velo_mph_mean: 88, velo_mph_sd: 3, bauer_mean: 25.5, bauer_sd: 1.5 },  // KBO 평균
  HS:     { velo_mph_mean: 80, velo_mph_sd: 4, bauer_mean: 24.0, bauer_sd: 1.8 },  // 한국 고교 전체
  'HS-1': { velo_mph_mean: 77, velo_mph_sd: 4, bauer_mean: 23.0, bauer_sd: 2.0 },  // 고1
  'HS-2': { velo_mph_mean: 81, velo_mph_sd: 4, bauer_mean: 24.0, bauer_sd: 1.8 },  // 고2
  'HS-3': { velo_mph_mean: 84, velo_mph_sd: 4, bauer_mean: 25.0, bauer_sd: 1.8 }   // 고3
};

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
    // v3.5-2 확장: 5개 ForceDecks 변수 + 비대칭. 0.20 + 0.15 + 0.15 + 0.15 + 0.15 + 0.20 = 1.00
    cmj_pp:          0.20,   // CMJ peak power / BW (절대 power)
    imtp_pf:         0.15,   // IMTP peak force / BW (max strength)
    rsi_modified:    0.15,   // CMJ RSI-Modified (reactive strength)
    pogo_rsi:        0.15,   // Pogo RSI (plyometric reactivity — 투구 폭발력)
    imtp_rfd:        0.15,   // IMTP RFD 0~100ms (force 산출 속도)
    asymmetry:       0.20,   // L/R 비대칭 평균 (CMJ + IMTP + Nordic, 작을수록 ↑)
    note: '0.20·CMJ_PP+0.15·IMTP_PF+0.15·RSI-Mod+0.15·Pogo_RSI+0.15·IMTP_RFD+0.20·비대칭'
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
  // v3.1 — GRF · Stuff
  grfScore, stuffScore,
  // v3.2 — VALD norms · injury risk
  valdPercentile, injuryRisk,
  // v3.3 — 3-tier cohort 비교
  valdMultiTier,
  // v3.9 — 한국 자체 회귀 모델
  predictMaxVelocityKR, KR_VELO_MODEL,
  // v4.0 — Velo Group, Predicted Velo, AE, Per 1 km/h, Combined Diagnosis
  veloGroup, VELO_GROUPS, VELO_GROUP_NORMS,
  predictedVelocity, PHYSICAL_VELO_MODEL,
  aboveExpected, per1kmhRecommendation, PER_1KMH_TARGETS,
  combinedDiagnosis,
  // 상수 (UI 인용용)
  LATENT_VELOCITY_WEIGHTS,
  COMPOSITE_WEIGHTS,
  GRADE_BENCHMARKS,
  GRADE_LATENT_OFFSETS,
  GRF_BENCHMARKS,
  STUFF_BENCHMARKS,
  VALD_NORMS,
  // v5.4: 4축 라디아 Elite reference
  PRO_REFERENCE_4AXIS,
  // v5.5: 힘 전달 점수 (Kinematic + Kinetic ETE 결합)
  transferScoreV2,
  // v5.8: De Leva (1996) self-calc segment KE_rot
  selfCalcSegmentKE,
  DE_LEVA_PARAMS,
  // v5.9: OpenBiomechanics 통합 — Velocity Prediction Model + Level별 reference
  OBP_VELO_MODEL,
  predictVelocityOBP,
  OBP_LEVEL_NORMS,
  // v5.11: 한국 고교 평가용 이중 reference + percentile 진단
  AMATEUR_REFERENCE,
  PRO_REFERENCE,
  REFERENCE_DISTRIBUTIONS,
  percentileVsRef,
  dualReferenceDiagnosis,
  // v5.12: 코치/선수용 핵심 KPI + 4축 능력 진단
  expectedVelocityWithImprovement,
  fourAxisDiagnosis,
  // v5.22: 5축 메카닉 진단 (회전속도/가속순서/분리/누수회피/지면반력)
  fiveAxisDiagnosis,
  // v5.23: Driveline 5 모델 framework
  DRIVELINE_5_MODELS,
  drivelineMetricScore,
  drivelineFiveModelDiagnosis,
  drivelineMechanicalCeiling,
  // v5.25: Driveline HP Assessment 6축 framework (체력)
  DRIVELINE_HP_6_MODELS,
  drivelineHPScore,
  drivelineHPVeloGroup,
  drivelineHPDiagnosis,
  // v5.13: 체력/통합 향상 시나리오
  expectedVelocityFromFitness,
  expectedVelocityCombined,
  // v5.16: 체력 6축 진단
  fitnessAxisDiagnosis,
  // v5.17: 17 변인 학술 reference + 효과 매핑
  FITNESS_VARIABLE_MAP,
  // v5.18: 메카닉 변인 효과 매핑
  MECHANIC_VARIABLE_MAP
};

// 브라우저 빌드에서 직접 접근 가능
if(typeof window !== 'undefined') window.ANALYTICS = ANALYTICS;
