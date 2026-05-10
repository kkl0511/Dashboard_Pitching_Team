/**
 * driveline.js — Driveline framework (메카닉 5축 + HP 체력 6축)
 *
 * 분리: v5.25 (analytics.js에서 추출, 2576 → 2227 lines)
 * 의존: 없음 (analytics.js보다 먼저 로드되어도 OK, 단독 모듈)
 * 사용: ANALYTICS export로 통합 (analytics.js 끝에서 통합)
 *
 * 메모리 reference:
 *   ~/memory/reference_driveline_pitching_report.md  (메카닉 5 모델)
 *   ~/memory/reference_driveline_hp_assessment.md    (체력 HP 6축)
 *
 * PDF reference:
 *   docs/references/Driveline_PitchingAssessment_{EN,KR}_sample.pdf
 *   docs/references/Driveline_HP_Assessment_{Initial,Retest}_sample.pdf
 *
 * 주요 export (window.ANALYTICS에 통합):
 *   DRIVELINE_5_MODELS / drivelineMetricScore / drivelineFiveModelDiagnosis / drivelineMechanicalCeiling
 *   DRIVELINE_HP_6_MODELS / drivelineHPScore / drivelineHPVeloGroup / drivelineHPDiagnosis
 */

/* v5.23: Driveline 5 모델 framework — Mechanical Composite Scores+
 *   학술 출처: Driveline Pitching Assessment 표준 (PDF reference 메모리 참고)
 *
 *   각 모델 100점 = median elite (90+ mph cohort), 150점 = ceiling
 *   Total score = 모델별 가중평균 (영향력 = 구속 상관계수)
 *
 *   영향력 순위 (구속 / Velocity Above Expected):
 *   1. Posture     — 구속 1위 / AE 2위 (X-factor + trunk control 통합)
 *   2. Arm Action  — 구속 2위 / AE 1위 (메카닉 효율 핵심)
 *   3. CoG         — 구속 3위 / AE 5위 (무게중심 이동 속도)
 *   4. Rotation    — 구속 4위 / AE 3위 (Trunk + Pelvis ω)
 *   5. Block       — 구속 5위 / AE 4위 (Lead leg block)
 */
const DRIVELINE_5_MODELS = {
  arm_action: {
    label: '🚀 Arm Action',
    sub:   '팔 동작 — 어깨/팔꿈치 효율',
    velo_rank: 2, ae_rank: 1, weight: 0.22,
    metrics: {
      layback:           {label:'Layback (어깨 최대 외회전)',  unit:'deg',    median_elite: 190,  per_1mph: 5,    importance:'high'},
      elbow_ext_velo:    {label:'Elbow Extension Velo',       unit:'deg/s',  median_elite: 2318, per_1mph: 203,  importance:'med'},
      shoulder_abd_fp:   {label:'Shoulder Abduction at FP',   unit:'deg',    median_elite: 84,   per_1mph: 10,   importance:'med'},
      scap_load_fp:      {label:'Scap Load at FP',            unit:'deg',    median_elite: 51,   per_1mph: 16,   importance:'med'},
      shoulder_rot_velo: {label:'Shoulder Rotation Velo',     unit:'deg/s',  median_elite: 4673, per_1mph: 588,  importance:'med'},
      elbow_flex_fp:     {label:'Elbow Flexion at FP',        unit:'deg',    median_elite: 102,  per_1mph: 35,   importance:'low'}
    }
  },
  posture: {
    label: '🛡 Posture',
    sub:   '자세 — FP~릴리즈 자세 유지',
    velo_rank: 1, ae_rank: 2, weight: 0.25,
    metrics: {
      hip_shoulder_sep_fp: {label:'Peak Hip-Shoulder Sep at FP (X-factor)', unit:'deg', median_elite: 30,  per_1mph: 3,  importance:'high'},
      torso_counter_rot:   {label:'Peak Torso Counter Rot',                  unit:'deg', median_elite: -38, per_1mph: 13, importance:'high'},
      torso_fwd_tilt_fp:   {label:'Torso Forward Tilt at FP',                unit:'deg', median_elite: 4,   per_1mph: 6,  importance:'high'},
      torso_rot_fp:        {label:'Torso Rotation at FP',                    unit:'deg', median_elite: 2,   per_1mph: 10, importance:'high'},
      torso_side_bend_mer: {label:'Torso Side Bend at MER',                  unit:'deg', median_elite: 25,  per_1mph: 3,  importance:'med'},
      torso_rot_br:        {label:'Torso Rotation at BR',                    unit:'deg', median_elite: 111, per_1mph: 6,  importance:'med'}
    }
  },
  rotation: {
    label: '🔄 Rotation',
    sub:   '회전 — Trunk + Pelvis 회전 속도',
    velo_rank: 4, ae_rank: 3, weight: 0.18,
    metrics: {
      torso_rot_velo:  {label:'Torso Rotation Velo',  unit:'deg/s', median_elite: 965, per_1mph: 40,  importance:'high'},
      pelvis_rot_velo: {label:'Pelvis Rotation Velo', unit:'deg/s', median_elite: 597, per_1mph: 128, importance:'low'}
    }
  },
  block: {
    label: '🦵 Block',
    sub:   '앞발 블록 — Lead leg 활용',
    velo_rank: 5, ae_rank: 4, weight: 0.15,
    metrics: {
      lead_knee_ext:        {label:'Lead Knee Extension',       unit:'deg',   median_elite: 11,  per_1mph: 5,   importance:'high'},
      stride_length:        {label:'Stride Length',             unit:'in',    median_elite: 58,  per_1mph: 5,   importance:'high'},
      cog_decel_ae:         {label:'CoG Decel AE',              unit:'m/s',   median_elite: 0.02,per_1mph: 0.35,importance:'med'},
      lead_knee_ext_velo:   {label:'Peak Lead Knee Ext Velo',   unit:'deg/s', median_elite: 316, per_1mph: 103, importance:'low'}
    }
  },
  cog: {
    label: '🎯 CoG',
    sub:   '무게중심 이동 — Drive 속도/감속',
    velo_rank: 3, ae_rank: 5, weight: 0.20,
    metrics: {
      cog_decel:    {label:'CoG Decel',    unit:'m/s', median_elite: 1.61, per_1mph: 0.15, importance:'high'},
      max_cog_velo: {label:'Max CoG Velo', unit:'m/s', median_elite: 2.84, per_1mph: 0.35, importance:'med'}
    }
  }
};

/**
 * v5.23: 변인 값 → 점수 (100 = median elite, 150 = ceiling)
 *   linear: 50점 = median elite의 50%, 100점 = median elite, 150점 = median elite의 150%
 *   더 정확한 보간을 위해 per_1mph 적용 (median ± per_1mph 5번 = ±25점)
 */
function drivelineMetricScore(value, metric){
  if(value == null || isNaN(value)) return null;
  const me = metric.median_elite;
  const per = metric.per_1mph;
  if(me == null || per == null || per === 0) return null;
  // value - median_elite를 per_1mph 단위로 환산 → 1mph당 5점으로 score
  // 즉 +5 mph 기여 = +25점, +10 mph = +50점
  const mphEquivalent = (value - me) / per;
  const score = 100 + mphEquivalent * 5;
  return Math.max(20, Math.min(150, Math.round(score)));
}

/**
 * v5.23: Driveline 5 모델 진단
 * @param {object} input  메카닉 측정값 (우리 데이터 → Driveline 매핑)
 * @returns {object} 5 모델 점수 + Total + 강약
 */
function drivelineFiveModelDiagnosis(input){
  if(!input) return null;
  const out = {};
  // ── 우리 데이터 → Driveline 변인 매핑 ──
  const matched = {
    arm_action: {
      layback:           input.shoulder_er_max_deg ?? input.peak_shoulder_v ? input.shoulder_er_max_deg : null,
      elbow_ext_velo:    input.peak_elbow_v,
      shoulder_abd_fp:   input.shoulder_abd_fp_deg ?? null,
      scap_load_fp:      input.scap_load_fp_deg ?? null,
      shoulder_rot_velo: input.peak_shoulder_v ?? input.arm_dps,
      elbow_flex_fp:     input.elbow_flex_fp_deg ?? null
    },
    posture: {
      hip_shoulder_sep_fp: input.x_factor ?? input.x_factor_deg,
      torso_counter_rot:   input.torso_counter_rot_deg ?? null,
      torso_fwd_tilt_fp:   input.trunk_forward_tilt ?? input.trunk_tilt_at_fc_deg,
      torso_rot_fp:        input.torso_rot_fp_deg ?? null,
      torso_side_bend_mer: input.trunk_lateral_tilt ?? input.trunk_lat_tilt_deg,
      torso_rot_br:        input.torso_rot_br_deg ?? null
    },
    rotation: {
      torso_rot_velo:  input.trunk_dps,
      pelvis_rot_velo: input.pelvis_dps
    },
    block: {
      lead_knee_ext:      input.lead_knee_change ?? input.lead_knee_max,
      stride_length:      input.stride_length_in ?? (input.stride_length ? input.stride_length * 39.37 : null),  // m → in
      cog_decel_ae:       input.cog_decel_ae ?? null,
      lead_knee_ext_velo: input.lead_knee_ext_velo ?? null
    },
    cog: {
      cog_decel:    input.cog_decel ?? null,
      max_cog_velo: input.max_cog_velo ?? null
    }
  };

  // 각 모델 점수 = 가용 metric 평균 (importance 가중)
  for(const [modelKey, model] of Object.entries(DRIVELINE_5_MODELS)){
    const matched_vars = matched[modelKey];
    const scores = [];
    const metric_results = {};
    for(const [mkey, mdef] of Object.entries(model.metrics)){
      const v = matched_vars[mkey];
      const s = drivelineMetricScore(v, mdef);
      const wt = mdef.importance === 'high' ? 3 : mdef.importance === 'med' ? 2 : 1;
      metric_results[mkey] = {
        label:   mdef.label,
        value:   v,
        unit:    mdef.unit,
        median_elite: mdef.median_elite,
        per_1mph: mdef.per_1mph,
        importance: mdef.importance,
        score:   s
      };
      if(s != null){
        for(let i = 0; i < wt; i++) scores.push(s);
      }
    }
    out[modelKey] = {
      label: model.label,
      sub:   model.sub,
      velo_rank: model.velo_rank,
      ae_rank:   model.ae_rank,
      weight:    model.weight,
      score:     scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null,
      metrics:   metric_results,
      n_metrics_available: scores.length / scores.reduce((a,b,i,arr) => i === 0 ? 1 : a, 1)  // approx
    };
  }

  // Total score = 모델별 가중평균
  const validModels = Object.values(out).filter(m => m.score != null);
  if(validModels.length){
    const totalWeight = validModels.reduce((s,m) => s + m.weight, 0);
    const total = validModels.reduce((s,m) => s + m.score * m.weight, 0) / totalWeight;
    out.total = Math.round(total);
    // 강점/약점
    validModels.sort((a,b) => b.score - a.score);
    out.strength = validModels[0].label;
    out.weakness = validModels[validModels.length-1].label;
  }
  return out;
}

/**
 * v5.23: Mechanical Ceiling 산출 — 메카닉이 150점 도달 시 기대 구속
 *   현재 측정 구속 + 메카닉 향상 잠재 (각 모델 (150 - 현재 점수)/5 × per_1mph 합산)
 */
function drivelineMechanicalCeiling(diagnosis, measuredKmh){
  if(!diagnosis || measuredKmh == null) return null;
  let ceilingMph = measuredKmh / 1.60934;  // km/h → mph
  let totalAddedMph = 0;
  for(const [k, m] of Object.entries(diagnosis)){
    if(!m || typeof m !== 'object' || m.score == null) continue;
    if(m.score < 150){
      const addedMph = (150 - m.score) / 5;   // 5점 = 1 mph 기여
      totalAddedMph += addedMph * m.weight;
    }
  }
  ceilingMph += totalAddedMph;
  return {
    ceiling_mph: Math.round(ceilingMph * 10) / 10,
    ceiling_kmh: Math.round(ceilingMph * 1.60934 * 10) / 10,
    added_mph_potential: Math.round(totalAddedMph * 10) / 10,
    added_kmh_potential: Math.round(totalAddedMph * 1.60934 * 10) / 10
  };
}

/* v5.25: Driveline HP Assessment 6축 framework — 체력 평가
 *   학술 출처: Driveline High Performance Assessment (PDF reference 메모리 참고)
 *
 *   6 축 (각 100점 = HS group 평균):
 *     1. Strength       — IMTP Net Peak Force (절대 힘)
 *     2. Relative Strength — IMTP NPF / BW (체중 대비 힘)
 *     3. Power          — Squat Jump Peak Power (절대 파워)
 *     4. Relative Power — CMJ Peak Power / BW (체중 대비 파워, 구속 강한 상관)
 *     5. Reactive Strength — Hop Test RSI (반응성 강도)
 *     6. Upper Body Power — Plyo Push Up Peak Force (상체 파워; 우리 미측정)
 *
 *   Velo Group cohort: <80 / 80-85 / 85-90 / 90+ mph (Driveline cohort 평균)
 *   reference 값: HP Assessment Retest sample (n 큰 cohort, 2024-10) 기반 추정 + Driveline 일반 norm
 */
const DRIVELINE_HP_6_MODELS = {
  strength: {
    label:    'Strength',
    label_kr: '최대 힘',
    sub:      'IMTP Net Peak Force',
    weight:   0.18,
    metric_key: 'imtp_npf',                                  // CSV → m.fitness.imtp.peak_force_n
    unit: 'N',
    velo_group: { '<80': 1900, '80-85': 2400, '85-90': 2750, '90+': 2940 }, // Driveline cohort 평균
    hs_avg:   2316,                                          // HS group 평균 (composite score 100 기준)
    higher_better: true
  },
  rel_strength: {
    label:    'Relative Strength',
    label_kr: '체중 대비 힘',
    sub:      'IMTP NPF / BW',
    weight:   0.18,
    metric_key: 'imtp_pf_bm',
    unit: 'N/kg',
    velo_group: { '<80': 24.4, '80-85': 28.1, '85-90': 32.0, '90+': 33.7 }, // 환산 (3.09 → 30.3 N/kg)
    hs_avg:   28,                                            // 우리 cohort 평균 정도
    higher_better: true
  },
  power: {
    label:    'Power',
    label_kr: '점프 파워',
    sub:      'Squat Jump Peak Power / BW',
    weight:   0.18,
    metric_key: 'sj_pp_bm',                                  // SJ peak power per BW (W/kg, 우리 파싱 키)
    unit: 'W/kg',
    velo_group: { '<80': 40, '80-85': 50, '85-90': 58, '90+': 65 }, // 추정 BW로 환산
    hs_avg:   50,                                            // HS group 평균
    higher_better: true
  },
  rel_power: {
    label:    'Relative Power',
    label_kr: '체중 대비 파워',
    sub:      'CMJ Peak Power / BW',
    weight:   0.20,                                          // 구속 최강 상관 → 가중 강조
    metric_key: 'cmj_pp_bm',
    unit: 'W/kg',
    velo_group: { '<80': 38, '80-85': 45, '85-90': 52, '90+': 60 },
    hs_avg:   45,
    higher_better: true
  },
  reactive: {
    label:    'Reactive Strength',
    label_kr: '반응성 강도',
    sub:      'Hop Test RSI',
    weight:   0.16,
    metric_key: 'pogo_rsi',
    unit: 'm/s',
    velo_group: { '<80': 2.4, '80-85': 2.6, '85-90': 2.8, '90+': 3.07 },
    hs_avg:   2.6,
    higher_better: true
  },
  upper_power: {
    label:    'Upper Body Power',
    label_kr: '상체 파워',
    sub:      'Plyo Push Up Peak Force (미측정)',
    weight:   0.10,                                          // 우리 미측정이라 가중 낮춤
    metric_key: 'plyo_push_up_pf',                           // 측정 시 자동 채워짐
    unit: 'N',
    velo_group: { '<80': 800, '80-85': 983, '85-90': 1100, '90+': 1200 },
    hs_avg:   983,
    higher_better: true,
    not_measured: true                                       // 미측정 표시
  }
};

/* Driveline HP 단일 변인 → Composite Score (100=HS group 평균)
 *   직선 스케일: HS 평균 = 100, 그 위/아래로 비례
 *   상한 200 (2배), 하한 0
 */
function drivelineHPScore(value, hsAvg, higherBetter){
  if(value == null || hsAvg == null || hsAvg === 0) return null;
  let ratio = value / hsAvg;
  if(!higherBetter) ratio = 1 / ratio;
  const score = Math.round(ratio * 100);
  return Math.max(0, Math.min(200, score));
}

/* Driveline HP — Velo Group 분류 (본인 위치)
 *   value를 4 cohort 평균과 비교 → 가장 가까운 cohort 반환
 */
function drivelineHPVeloGroup(value, veloGroupRefs){
  if(value == null || !veloGroupRefs) return null;
  const groups = ['<80', '80-85', '85-90', '90+'];
  let best = groups[0], bestDist = Infinity;
  for(const g of groups){
    const ref = veloGroupRefs[g];
    if(ref == null) continue;
    const d = Math.abs(value - ref);
    if(d < bestDist) { bestDist = d; best = g; }
  }
  return best;
}

/* Driveline HP 6축 진단 (체력 평가 메인 함수)
 *   input:
 *     {imtp_npf, imtp_pf_bm, sj_pp, cmj_pp_bm, pogo_rsi, plyo_push_up_pf}
 *   output:
 *     {strength: {value, score, velo_group, ...}, ..., overall_score}
 */
function drivelineHPDiagnosis(input){
  if(!input) return null;
  const out = {};
  let weightedSum = 0, weightSum = 0;
  for(const [key, def] of Object.entries(DRIVELINE_HP_6_MODELS)){
    const v = input[def.metric_key];
    const score = drivelineHPScore(v, def.hs_avg, def.higher_better);
    const vg    = drivelineHPVeloGroup(v, def.velo_group);
    out[key] = {
      label:    def.label,
      label_kr: def.label_kr,
      sub:      def.sub,
      unit:     def.unit,
      value:    v,
      score:    score,
      velo_group: vg,
      hs_avg:   def.hs_avg,
      velo_group_refs: def.velo_group,
      weight:   def.weight,
      not_measured: def.not_measured || false
    };
    if(score != null && !def.not_measured){
      weightedSum += score * def.weight;
      weightSum   += def.weight;
    }
  }
  out.overall_score = weightSum > 0 ? Math.round(weightedSum / weightSum) : null;
  return out;
}
