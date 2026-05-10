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
    label: '🚀 팔동작 (Arm Action)',
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
    label: '🛡 자세 (Posture)',
    sub:   '자세 — FP~릴리즈 자세 유지',
    velo_rank: 1, ae_rank: 2, weight: 0.25,
    metrics: {
      hip_shoulder_sep_fp: {label:'Peak Hip-Shoulder Sep at FP (X-factor)', unit:'deg', median_elite: 34,  per_1mph: 3,  importance:'high'},   // v5.30 OBP 90+ cohort p50=33.5°
      torso_counter_rot:   {label:'Peak Torso Counter Rot',                  unit:'deg', median_elite: -38, per_1mph: 13, importance:'high'},   // v5.30 OBP 90+ p50=-38.9° ✓ 유지
      torso_fwd_tilt_fp:   {label:'Torso Forward Tilt at FP',                unit:'deg', median_elite: 4,   per_1mph: 6,  importance:'high'},
      torso_rot_fp:        {label:'Torso Rotation at FP',                    unit:'deg', median_elite: 2,   per_1mph: 10, importance:'high'},
      torso_side_bend_mer: {label:'Torso Side Bend at MER',                  unit:'deg', median_elite: 22,  per_1mph: 3,  importance:'med'},    // v5.30 OBP 90+ p50=22.3°
      torso_rot_br:        {label:'Torso Rotation at BR',                    unit:'deg', median_elite: 111, per_1mph: 6,  importance:'med'}
    }
  },
  rotation: {
    label: '🔄 회전 속도 (Rotation)',
    sub:   '회전 — Trunk + Pelvis 회전 속도',
    velo_rank: 4, ae_rank: 3, weight: 0.18,
    metrics: {
      torso_rot_velo:  {label:'Torso Rotation Velo',  unit:'deg/s', median_elite: 965, per_1mph: 40,  importance:'high'},
      // v5.33: markerless Theia의 골반 인식 정확도 한계 — importance 'low' 유지 + 명시
      //   KR cohort에서 Pelvis ω peak는 marker 대비 -15% 작게 측정 (system difference)
      pelvis_rot_velo: {label:'Pelvis Rotation Velo', unit:'deg/s', median_elite: 597, per_1mph: 128, importance:'low', markerless_caveat:'Pelvis 인식 정확도 한계로 가중치 낮음'}
    }
  },
  block: {
    label: '🦵 앞다리 제동 (Block)',
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
    label: '🎯 체중이동 (CoG)',
    sub:   '무게중심 이동 — Drive 속도/감속',
    velo_rank: 3, ae_rank: 5, weight: 0.20,
    metrics: {
      // v5.36: KR markerless 보정 (xlsx 가공값 p50 기준)
      //   markered Driveline standard: cog_decel 1.61, max_cog_velo 2.84
      //   KR markerless cohort: cog_decel p50=1.32, max_cog_velo p50=2.50 — 시스템 차이 + selection effect
      cog_decel:    {label:'CoG Decel',    unit:'m/s', median_elite: 1.32, per_1mph: 0.10, importance:'high'},
      max_cog_velo: {label:'Max CoG Velo', unit:'m/s', median_elite: 2.50, per_1mph: 0.20, importance:'med'}
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

/* ────────────────────────────────────────────────────────────
   v5.28: 분절간 에너지 흐름 (Segment-to-Segment Energy Flow)

   학술 근거:
   - Naito & Maruyama (2008) "Mechanical Energy and joint power in pitching"
     Sports Biomech 7(2):166-180 — 분절간 power flow, joint contribution
   - Aguinaldo & Escamilla (2019) "Segmental Power for Pitchers"
     Sports Biomech 18(1):69-78 — 분절 power 시계열 + transfer 효율
   - Howenstein, Kipp, Sabick (2020) "Energy flow analysis to investigate trunk
     and arm injury during pitching" J Biomech 99:109535
   - Werner et al. (2008) "Kinematics and kinetics of elite windmill softball
     pitching" Am J Sports Med 34(4):597-603

   proximal-to-distal sequence: Drive→Pelvis→Trunk→Humerus→Forearm→Hand→Ball.
   각 transition은 (1) 시간차 lag (2) speed gain (3) energy transfer 3가지로 평가.
   ──────────────────────────────────────────────────────────── */

const SEGMENT_TRANSITION_REF = {
  // T1: Pelvis → Trunk (X-factor stretch & release)
  // Driveline OBP, Aguinaldo 2007 — elite pitcher: 30-50ms
  pelvis_to_trunk: {
    label_kr: '골반 → 몸통',
    label_en: 'Pelvis → Trunk',
    description: 'X-factor 분리 후 몸통 회전 점화',
    // v5.33 weight 0.5 — markerless Theia의 골반(Pelvis) 인식 정확도 한계
    //   Pelvis ω peak 자체가 marker 대비 -15% 작게, lag 검출도 fork (KR 코드 37ms vs xlsx 7ms)
    //   따라서 종합 점수에서 골반 의존 변인은 가중치를 낮춰 수용
    weight: 0.5,
    // v5.30 OBP 90+ mph cohort 검증: timing_peak_torso_to_peak_pelvis_rot_velo
    //   p10=-5.5ms, p50=8.3ms, p90=19.4ms — markerless Theia 표준 (markered Aguinaldo 2007의 30-50ms와 다름)
    lag_ideal_ms: [-5, 25],
    lag_acceptable_ms: [-15, 40],
    speed_gain_ideal: [1.30, 1.70],   // OBP p10=1.22, p50=1.41, p90=1.63 — 정합
    speed_gain_acceptable: [1.10, 1.90],
    fault_too_fast: '음수 lag — trunk peak이 pelvis보다 일찍 (snap 형태, 일부 elite도 보임)',
    fault_too_slow: '너무 느림 — 몸통 점화 지연 (timing 손실)',
    fault_low_gain: '몸통 가속 부족 — 코어/회전근 출력 약함',
    citation: 'Aguinaldo 2007 (markered) + OBP 90+ cohort (markerless)',
    markerless_caveat: '⚠ markerless 골반 인식 한계 반영 (가중치 0.5)'
  },

  // T2: Trunk → Humerus (shoulder loading & internal rotation)
  trunk_to_humerus: {
    label_kr: '몸통 → 위팔',
    label_en: 'Trunk → Humerus',
    description: '몸통 회전 → 어깨 가속 (내회전 점화)',
    weight: 1.0,   // 신뢰도 높음 — KR cohort (xlsx 83ms vs 우리코드 73ms) 정합
    // v5.31 KR markerless cohort 검증: trunk_to_arm p10-p90 = 60-150ms, p50 = 83ms
    //   markered Werner 2008의 20-40ms는 marker-based reference, markerless는 더 김
    lag_ideal_ms: [50, 110],
    lag_acceptable_ms: [30, 160],
    speed_gain_ideal: [4.0, 6.0],     // humerus_ω / trunk_ω
    speed_gain_acceptable: [3.0, 7.0],
    fault_too_fast: '몸통-팔 분리 부족 (어깨 너무 일찍 가속)',
    fault_too_slow: '어깨 외회전 점화 지연 (lay-back 부족)',
    fault_low_gain: '어깨 내회전 출력 부족 (rotator cuff 약함)',
    citation: 'Werner 2008 (markered) + KR 41명 cohort (markerless Theia)'
  },

  // T3: Humerus → Forearm (elbow extension)
  humerus_to_forearm: {
    label_kr: '위팔 → 아래팔',
    label_en: 'Humerus → Forearm',
    description: '어깨 내회전 + 팔꿈치 신전 결합',
    weight: 1.0,
    lag_ideal_ms: [10, 25],
    lag_acceptable_ms: [5, 35],
    speed_gain_ideal: [1.10, 1.40],   // forearm_ω / humerus_ω (≥1 — 추가 가속)
    speed_gain_acceptable: [0.90, 1.60],
    fault_too_fast: '팔꿈치 너무 일찍 신전 (외전 부담 증가)',
    fault_low_gain: '팔꿈치 신전 가속 부족 (forearm whip 약함)',
    citation: 'Aguinaldo 2019, Naito 2008'
  },

  // T4: Forearm → Hand (wrist snap)
  forearm_to_hand: {
    label_kr: '아래팔 → 손',
    label_en: 'Forearm → Hand',
    description: '손목 snap — 최종 ball velocity 가산',
    weight: 1.0,
    lag_ideal_ms: [5, 15],
    lag_acceptable_ms: [0, 25],
    speed_gain_ideal: [1.00, 1.30],
    speed_gain_acceptable: [0.85, 1.50],
    fault_low_gain: '손목 snap 부족 — 회전 부여 약화',
    citation: 'Naito 2008'
  }
};

/**
 * 분절간 ETE + lag 진단
 * @param {Object} input — { peak_pelvis_v, peak_trunk_v, peak_humerus_v, peak_forearm_v, peak_hand_v,
 *                           pelvis_to_trunk_lag_ms, trunk_to_humerus_lag_ms,
 *                           humerus_to_forearm_lag_ms, forearm_to_hand_lag_ms }
 * @returns {Object} — transition별 score + bottleneck 식별
 */
function segmentTransitionETE(input = {}){
  if(!input) return null;
  const out = {};
  const transitions = [
    { key: 'pelvis_to_trunk',     up: 'peak_pelvis_v',  down: 'peak_trunk_v',   lag: 'pelvis_to_trunk_lag_ms' },
    { key: 'trunk_to_humerus',    up: 'peak_trunk_v',   down: 'peak_humerus_v', lag: 'trunk_to_humerus_lag_ms' },
    { key: 'humerus_to_forearm',  up: 'peak_humerus_v', down: 'peak_forearm_v', lag: 'humerus_to_forearm_lag_ms' },
    { key: 'forearm_to_hand',     up: 'peak_forearm_v', down: 'peak_hand_v',    lag: 'forearm_to_hand_lag_ms' }
  ];

  for(const t of transitions){
    const ref = SEGMENT_TRANSITION_REF[t.key];
    const upV = input[t.up], downV = input[t.down], lagMs = input[t.lag];

    let speedGain = null, gainScore = null, gainStatus = null, gainFault = null;
    if(upV != null && downV != null && upV > 0){
      speedGain = downV / upV;
      const [gi_lo, gi_hi] = ref.speed_gain_ideal;
      const [ga_lo, ga_hi] = ref.speed_gain_acceptable;
      if(speedGain >= gi_lo && speedGain <= gi_hi){ gainScore = 100; gainStatus = 'ideal'; }
      else if(speedGain >= ga_lo && speedGain <= ga_hi){ gainScore = 70 + 30*(1 - Math.min(Math.abs(speedGain-(gi_lo+gi_hi)/2)/((gi_hi-gi_lo)/2 + 0.5), 1)); gainStatus = 'acceptable'; }
      else { gainScore = Math.max(20, 70 - Math.abs(speedGain-(gi_lo+gi_hi)/2)*30); gainStatus = 'fault'; }
      if(gainStatus === 'fault'){
        gainFault = speedGain < ga_lo ? (ref.fault_low_gain || ref.fault_too_slow) : (ref.fault_too_fast || ref.fault_low_gain);
      }
    }

    let lagScore = null, lagStatus = null, lagFault = null;
    if(lagMs != null){
      const [li_lo, li_hi] = ref.lag_ideal_ms;
      const [la_lo, la_hi] = ref.lag_acceptable_ms;
      if(lagMs >= li_lo && lagMs <= li_hi){ lagScore = 100; lagStatus = 'ideal'; }
      else if(lagMs >= la_lo && lagMs <= la_hi){ lagScore = 70 + 30*(1 - Math.min(Math.abs(lagMs-(li_lo+li_hi)/2)/((li_hi-li_lo)/2 + 0.5), 1)); lagStatus = 'acceptable'; }
      else { lagScore = Math.max(20, 70 - Math.abs(lagMs-(li_lo+li_hi)/2)*0.8); lagStatus = 'fault'; }
      if(lagStatus === 'fault'){
        lagFault = lagMs < la_lo ? ref.fault_too_fast : ref.fault_too_slow;
      }
    }

    // transition 종합점수 = lag 점수 × 0.5 + gain 점수 × 0.5
    let combined = null;
    if(gainScore != null && lagScore != null) combined = (gainScore + lagScore) / 2;
    else combined = gainScore || lagScore;

    out[t.key] = {
      label_kr: ref.label_kr,
      label_en: ref.label_en,
      description: ref.description,
      speed_gain: speedGain,
      speed_gain_ideal: ref.speed_gain_ideal,
      gain_score: gainScore,
      gain_status: gainStatus,
      gain_fault: gainFault,
      lag_ms: lagMs,
      lag_ideal_ms: ref.lag_ideal_ms,
      lag_score: lagScore,
      lag_status: lagStatus,
      lag_fault: lagFault,
      score: combined != null ? Math.round(combined) : null,
      weight: ref.weight ?? 1.0,                                // v5.33
      markerless_caveat: ref.markerless_caveat || null,
      citation: ref.citation
    };
  }

  // v5.33: bottleneck 식별 — score를 weight로 정규화 (낮은 weight transition은 bottleneck 후보 가중치 작음)
  //   markerless 골반 인식 한계로 인한 false positive 방지
  let bottleneck = null, minWeightedScore = Infinity;
  for(const [key, t] of Object.entries(out)){
    if(t && typeof t === 'object' && t.score != null && t.weight != null){
      // weighted score = score × weight (낮은 weight transition은 bottleneck 식별 우선순위 ↓)
      // 즉 weight=0.5인 pelvis_to_trunk가 score=50이어도 weighted=25이지만,
      // weight=1.0인 다른 transition이 score=40이면 weighted=40 → 다른 transition이 bottleneck
      // 정확히는 (1 - score)*weight 가 큰 쪽이 bottleneck (가장 큰 누수)
      const lossWeighted = (100 - t.score) * t.weight;
      const sortKey = -lossWeighted;   // 큰 loss = 작은 sortKey = bottleneck 후보
      if(sortKey < minWeightedScore){
        minWeightedScore = sortKey;
        bottleneck = key;
      }
    }
  }
  out.bottleneck = bottleneck;
  out.bottleneck_label = bottleneck ? out[bottleneck].label_kr : null;
  out.bottleneck_score = bottleneck ? out[bottleneck].score : null;
  out.bottleneck_weight = bottleneck ? out[bottleneck].weight : null;

  // v5.33: 종합 점수 — weighted average (markerless 한계 변인 가중치 낮춤)
  let weightedSum = 0, weightSum = 0;
  for(const t of Object.values(out)){
    if(t && typeof t === 'object' && t.score != null && t.weight != null){
      weightedSum += t.score * t.weight;
      weightSum   += t.weight;
    }
  }
  out.overall_score = weightSum > 0 ? Math.round(weightedSum / weightSum) : null;

  return out;
}

/* ────────────────────────────────────────────────────────────
   v5.28: GRF 수평 성분 + 임펄스 + 타이밍 (Horizontal-First GRF)

   학술 근거:
   - MacWilliams et al. (1998) "Characteristic ground-reaction forces in baseball
     pitching" Am J Sports Med 26(1):66-71 — lead leg braking peak 1.0-1.5 BW
   - Kageyama et al. (2014) "Difference between adolescent and collegiate baseball
     pitchers in the kinematics and kinetics of the lower limbs and trunk"
     J Sports Sci Med 13:910-9 — drive leg propulsive 50-70% BW + ball velocity 상관
   - Howenstein et al. (2020) "Energy flow analysis...trunk and arm injury"
     J Biomech 99:109535 — lead leg braking timing 30-50ms after FC
   - Guido & Werner (2012) "Lower-extremity ground reaction forces in collegiate
     baseball pitchers" J Strength Cond Res 26(7):1782-5
   - McNally et al. (2015) "The effect of an EMG biofeedback intervention on
     pitching pelvis motion control" J Sci Med Sport 18(2):225-30

   핵심 통찰: peak force는 일회성 정점 — 운동량 변화는 임펄스(∫F·dt)가 결정.
              수직(Z)보다 수평(Y, mound-axis) 성분이 추진+블록의 본질.
   ──────────────────────────────────────────────────────────── */

const GRF_HORIZONTAL_REF = {
  // Drive leg (FP1, 뒷발) — mound 방향으로 push
  drive_propulsive_peak_pct_bw: {
    label_kr: 'Drive leg 추진 peak',
    label_en: 'Drive Leg Propulsive Peak',
    unit: '%BW',
    // v5.32 KR 135+km/h cohort (xlsx 가공, n=47): Trail AP p25-p75 = 56-81 %BW
    //   v5.30 OBP 90+ (70-100)와 차이 — selection effect (KR median 137 vs OBP 91 mph≈146 km/h)
    //   한국 고교 cohort에는 KR 분포 우선 적용
    elite_range: [55, 80],         // KR p25-p75
    acceptable_range: [40, 95],    // KR p10-p90
    citation: 'KR 135+km/h cohort (markerless Theia, n=47) + OBP 90+ cohort'
  },
  drive_propulsive_impulse_pct_bw_s: {
    label_kr: 'Drive leg 추진 impulse',
    label_en: 'Drive Leg Propulsive Impulse',
    unit: '%BW·s',
    elite_range: [18, 28],          // 0.18-0.28 BW·s ≈ 25-40 %BW·ms 단순 환산용
    acceptable_range: [10, 40],
    citation: 'MacWilliams 1998'
  },
  drive_propulsive_peak_time_pct: {
    label_kr: 'Drive leg peak 시점',
    label_en: 'Drive Peak Timing',
    unit: '%stride',
    elite_range: [60, 85],          // stride 60-85% 시점에 peak (MKH→FC 기준)
    acceptable_range: [40, 95],
    citation: 'Kageyama 2014'
  },

  // Lead leg (FP2, 앞발) — body를 mound 방향으로 가속하기 위해 ground를 mound 반대로 밂 (braking)
  lead_braking_peak_pct_bw: {
    label_kr: 'Lead leg 블록 peak',
    label_en: 'Lead Leg Braking Peak',
    unit: '%BW',
    // v5.32 KR 135+km/h cohort (xlsx, n=47): Lead AP p25-p75 = 100-146 %BW
    //   MacWilliams 1998 (100-150)와 정합 ✓
    elite_range: [100, 145],
    acceptable_range: [80, 180],
    citation: 'MacWilliams 1998 + KR 135+ cohort (n=47)'
  },
  lead_braking_impulse_pct_bw_s: {
    label_kr: 'Lead leg 블록 impulse',
    label_en: 'Lead Leg Braking Impulse',
    unit: '%BW·s',
    elite_range: [18, 28],          // 0.18-0.28 BW·s — 운동량 흡수의 핵심
    acceptable_range: [10, 35],
    citation: 'MacWilliams 1998, Howenstein 2020'
  },
  lead_braking_peak_time_ms: {
    label_kr: 'Lead leg peak 타이밍 (FC 후)',
    label_en: 'Lead Braking Peak Timing',
    unit: 'ms after FC',
    elite_range: [30, 60],          // Howenstein 2020
    acceptable_range: [15, 90],
    citation: 'Howenstein 2020'
  },
  lead_block_duration_ms: {
    label_kr: 'Lead leg 블록 지속',
    label_en: 'Lead Block Duration (FC→BR)',
    unit: 'ms',
    elite_range: [120, 180],
    acceptable_range: [80, 240],
    citation: 'Howenstein 2020'
  },
  horizontal_to_vertical_ratio: {
    label_kr: '수평/수직 비율',
    label_en: 'Horizontal/Vertical Ratio',
    unit: '',
    elite_range: [0.50, 0.85],      // |Fy| / |Fz| at peak
    acceptable_range: [0.30, 1.10],
    citation: 'Kageyama 2014'
  }
};

/**
 * 단일 metric을 elite/acceptable range 기준으로 점수화 (0-100)
 */
function grfHorizontalMetricScore(value, def){
  if(value == null || isNaN(value)) return null;
  const [eLo, eHi] = def.elite_range;
  const [aLo, aHi] = def.acceptable_range;
  if(value >= eLo && value <= eHi) return 100;
  // elite 범위 밖이지만 acceptable 안: 70-95 사이 선형
  if(value >= aLo && value <= aHi){
    const eMid = (eLo + eHi)/2;
    const eHalf = (eHi - eLo)/2 + 0.5;
    const dev = Math.abs(value - eMid) / eHalf;
    return Math.round(70 + 30 * Math.max(0, 1 - dev));
  }
  // acceptable 밖: 20-65 선형 감점
  const aMid = (aLo + aHi)/2;
  const aHalf = Math.max(1, (aHi - aLo)/2);
  const dev = Math.abs(value - aMid) / aHalf;
  return Math.max(20, Math.round(70 - 50 * dev));
}

/* ────────────────────────────────────────────────────────────
   v5.29: NewtForce 핵심 8 변인 (Florida Baseball Armory 표준)

   학술 근거:
   - NewtForce instrumented pitching mound (Kyle Barker, Jacksonville)
   - Florida Baseball Armory "Force Plate Metrics Chart Guide" (2019)
     사용처: Vanderbilt, TCU, Minnesota Twins (spring training), Florida Baseball Ranch
   - 18개 표준 metrics 중 사용자 협의로 핵심 8개만 통합 (core indicator)

   NewtForce 좌표 정의:
   - Z+ = 수직 (down into ground)
   - Y+ = back/rubber (2루 방향)
   - Y- = home plate 방향
   - X+/− = lateral (1루/3루)

   Theia ↔ NewtForce 좌표계 매핑 (P01 검증 기반):
   - Theia +Y = home plate 방향 (anterior of pitcher)
   - 따라서 NewtForce Back Leg Peak Y (positive) = Theia FP1_Y의 negative absolute peak
                NewtForce Lead Leg Peak Y (negative) = Theia FP2_Y의 positive max
                Drive 동적 윈도우 = back leg push-off region
   ──────────────────────────────────────────────────────────── */

const NEWTFORCE_8_METRICS = {
  // === Amplitude (5) ===
  impulse: {
    nf_id: 1,
    label_kr: '추진 임펄스 (Back Leg)',
    label_en: 'Impulse',
    unit: '%BW·s',
    description: '뒷발 Y 방향 force × time 적분 — ball velocity의 #1 contributor',
    elite_range: [18, 28],     // v5.28 GRF_HORIZONTAL_REF와 일관
    acceptable_range: [10, 40],
    citation: 'NewtForce / MacWilliams 1998',
    alias_v528: 'drive_propulsive_impulse_pct_bw_s'   // 기존 변인 매핑
  },
  back_leg_peak_z: {
    nf_id: 2,
    label_kr: 'Back Leg Peak Z',
    label_en: 'Back Leg Peak Z',
    unit: '%BW',
    description: '뒷발(드라이브) 수직 force의 최대값 — push-off 정점',
    // v5.32 KR 135+ p25-p75=139-166 %BW (xlsx Trail vertical) ≈ OBP 90+ p10-p90=113-158 %BW
    elite_range: [135, 165],
    acceptable_range: [100, 195],
    citation: 'NewtForce / KR 135+ + OBP 90+ cohort',
    alias_v528: 'rear_z_peak_pct_bw'
  },
  turning_point_z: {
    nf_id: 3,
    label_kr: 'Turning Point Z',
    label_en: 'Turning Point Z',
    unit: '%BW',
    description: '뒷발 Z의 최저점 (lead leg landing 직전 unloading 시점)',
    elite_range: [40, 80],       // back leg가 잠깐 떠오를 때
    acceptable_range: [20, 110],
    citation: 'NewtForce',
    new_in_v529: true
  },
  lead_leg_peak_z: {
    nf_id: 4,
    label_kr: 'Lead Leg Peak Z',
    label_en: 'Lead Leg Peak Z',
    unit: '%BW',
    description: '앞발(리드) 수직 force의 최대값 — landing impact + block 정점',
    // v5.32 KR 135+ p25-p75=191-238 %BW (xlsx Lead vertical) — OBP 90+ 218 정합
    elite_range: [195, 240],
    acceptable_range: [160, 290],
    citation: 'NewtForce / KR 135+ + OBP 90+ cohort',
    alias_v528: 'lead_z_peak_pct_bw'
  },
  back_leg_peak_y: {
    nf_id: 8,
    label_kr: 'Back Leg Peak Y (Drive Propulsive)',
    label_en: 'Back Leg Peak Y',
    unit: '%BW',
    description: '뒷발 Y의 최대값 — rubber 방향 push 정점 (controlled push 평가)',
    // v5.32 drive_propulsive_peak_pct_bw와 alias 동기화 (KR 135+ p25-p75=56-81)
    elite_range: [55, 80],
    acceptable_range: [40, 95],
    citation: 'NewtForce / KR 135+ cohort',
    alias_v528: 'drive_propulsive_peak_pct_bw'
  },
  lead_leg_peak_y: {
    nf_id: 9,
    label_kr: 'Lead Leg Peak Y (Braking)',
    label_en: 'Lead Leg Peak Y',
    unit: '%BW',
    description: '앞발 Y의 minimum (negative spike) — body braking 정점',
    elite_range: [100, 150],
    acceptable_range: [60, 180],
    citation: 'NewtForce / MacWilliams 1998',
    alias_v528: 'lead_braking_peak_pct_bw'
  },
  lead_leg_negative_y: {
    nf_id: 10,
    label_kr: 'Lead Leg Negative Y (Claw Back)',
    label_en: 'Lead Leg Negative Y',
    unit: '%BW',
    description: '릴리스 후 swing leg retraction 시 lead leg Y 정점',
    elite_range: [30, 80],       // Florida Baseball Armory 가이드 추정
    acceptable_range: [10, 120],
    citation: 'NewtForce',
    new_in_v529: true
  },

  // === Timing (1) — 가장 중요한 timing metric ===
  time_of_transfer: {
    nf_id: 13,
    label_kr: 'Time of Transfer',
    label_en: 'Time of Transfer (Back Z → Lead Z)',
    unit: 'ms',
    description: 'Back Leg Peak Z → Lead Leg Peak Z — 에너지 전달 핵심 timing',
    // v5.31 KR markerless cohort: trail_to_lead_vgrf_peak_s p10-p90 = 241-475ms, p50=292ms
    //   NewtForce 100-180ms는 marker/Force-plate 표준이지만 KR markerless cohort 실측 더 김
    elite_range: [240, 320],
    acceptable_range: [180, 480],
    citation: 'NewtForce (marker reference) + KR 41명 cohort (markerless)',
    new_in_v529: true
  }
};

/**
 * NewtForce 핵심 8 변인 진단
 * @param {Object} g — m.grf — 8 metric 입력 (alias 자동 매핑)
 * @returns {Object} — 8 metric × {value, score, status} + amplitude/timing 부문 종합
 */
function newtforceCoreAnalysis(g = {}){
  if(!g) return null;
  const out = { metrics: {} };

  // 입력 매핑 (alias_v528 활용)
  const valueMap = {
    impulse:               g.drive_propulsive_impulse_pct_bw_s,
    back_leg_peak_z:       g.rear_force_pct != null ? g.rear_force_pct * 100 / 91 / 9.81 * 100 / 100 : null,  // 기존 rear_force_pct는 이미 %BW 환산값 — 확인 필요
    turning_point_z:       g.newtforce_turning_point_z_pct_bw,
    lead_leg_peak_z:       g.lead_force_pct != null ? g.lead_force_pct : null,   // 기존 동일
    back_leg_peak_y:       g.drive_propulsive_peak_pct_bw,
    lead_leg_peak_y:       g.lead_braking_peak_pct_bw,
    lead_leg_negative_y:   g.newtforce_lead_negative_y_pct_bw,
    time_of_transfer:      g.newtforce_time_of_transfer_ms
  };
  // back/lead Z는 기존 변인이 직접 %BW가 아닌 경우 별도 보정 — 일단 단순화: rear_force_pct/lead_force_pct를 그대로 사용 (기존 단위가 %BW에 가까운 값)
  valueMap.back_leg_peak_z = g.rear_force_pct;
  valueMap.lead_leg_peak_z = g.lead_force_pct;

  for(const [key, def] of Object.entries(NEWTFORCE_8_METRICS)){
    const v = valueMap[key];
    out.metrics[key] = {
      label_kr: def.label_kr,
      label_en: def.label_en,
      nf_id: def.nf_id,
      unit: def.unit,
      description: def.description,
      value: v,
      elite_range: def.elite_range,
      score: grfHorizontalMetricScore(v, def),
      citation: def.citation,
      new_in_v529: def.new_in_v529 || false
    };
  }

  // Amplitude vs Timing 그룹 종합
  const amplitudeKeys = ['impulse','back_leg_peak_z','turning_point_z','lead_leg_peak_z','back_leg_peak_y','lead_leg_peak_y','lead_leg_negative_y'];
  const timingKeys = ['time_of_transfer'];
  const amplScores = amplitudeKeys.map(k => out.metrics[k]?.score).filter(s => s != null);
  const timingScores = timingKeys.map(k => out.metrics[k]?.score).filter(s => s != null);
  out.amplitude_score = amplScores.length > 0 ? Math.round(amplScores.reduce((a,b)=>a+b,0) / amplScores.length) : null;
  out.timing_score    = timingScores.length > 0 ? Math.round(timingScores.reduce((a,b)=>a+b,0) / timingScores.length) : null;

  // 종합: amplitude 70% + timing 30% (NewtForce는 둘 다 강조하지만 amplitude가 변인 수가 많음)
  const parts = [];
  if(out.amplitude_score != null) parts.push({ s: out.amplitude_score, w: 0.70 });
  if(out.timing_score    != null) parts.push({ s: out.timing_score,    w: 0.30 });
  const totalW = parts.reduce((a,b)=>a+b.w,0);
  out.overall_score = totalW > 0 ? Math.round(parts.reduce((a,b)=>a+b.s*b.w,0) / totalW) : null;

  return out;
}

/**
 * GRF 수평 성분 종합 진단
 * @param {Object} g — { drive_propulsive_peak_pct_bw, drive_propulsive_impulse_pct_bw_s, ...
 *                       lead_braking_peak_pct_bw, lead_braking_impulse_pct_bw_s, ... }
 * @returns {Object} — drive/lead 부문별 점수 + 종합
 */
function grfHorizontalAnalysis(g = {}){
  if(!g) return null;
  const out = { drive: {}, lead: {}, ratio: {} };

  // Drive leg metrics
  const driveKeys = [
    'drive_propulsive_peak_pct_bw',
    'drive_propulsive_impulse_pct_bw_s',
    'drive_propulsive_peak_time_pct'
  ];
  for(const k of driveKeys){
    const def = GRF_HORIZONTAL_REF[k];
    out.drive[k] = {
      label_kr: def.label_kr,
      unit: def.unit,
      value: g[k],
      score: grfHorizontalMetricScore(g[k], def),
      elite_range: def.elite_range,
      citation: def.citation
    };
  }

  // Lead leg metrics
  const leadKeys = [
    'lead_braking_peak_pct_bw',
    'lead_braking_impulse_pct_bw_s',
    'lead_braking_peak_time_ms',
    'lead_block_duration_ms'
  ];
  for(const k of leadKeys){
    const def = GRF_HORIZONTAL_REF[k];
    out.lead[k] = {
      label_kr: def.label_kr,
      unit: def.unit,
      value: g[k],
      score: grfHorizontalMetricScore(g[k], def),
      elite_range: def.elite_range,
      citation: def.citation
    };
  }

  // 수평/수직 비율
  const r = GRF_HORIZONTAL_REF.horizontal_to_vertical_ratio;
  out.ratio.horizontal_to_vertical_ratio = {
    label_kr: r.label_kr,
    unit: r.unit,
    value: g.horizontal_to_vertical_ratio,
    score: grfHorizontalMetricScore(g.horizontal_to_vertical_ratio, r),
    elite_range: r.elite_range,
    citation: r.citation
  };

  // Drive 종합 (3개 평균)
  const dScores = Object.values(out.drive).map(x => x.score).filter(s => s != null);
  out.drive_score = dScores.length > 0 ? Math.round(dScores.reduce((a,b)=>a+b,0) / dScores.length) : null;

  // Lead 종합 (4개 평균)
  const lScores = Object.values(out.lead).map(x => x.score).filter(s => s != null);
  out.lead_score = lScores.length > 0 ? Math.round(lScores.reduce((a,b)=>a+b,0) / lScores.length) : null;

  // 종합: drive 30% + lead 60% + ratio 10% (lead block이 ball velocity와 가장 강한 상관)
  const parts = [];
  if(out.drive_score != null) parts.push({ s: out.drive_score, w: 0.30 });
  if(out.lead_score  != null) parts.push({ s: out.lead_score,  w: 0.60 });
  if(out.ratio.horizontal_to_vertical_ratio.score != null) parts.push({ s: out.ratio.horizontal_to_vertical_ratio.score, w: 0.10 });
  const totalW = parts.reduce((a,b)=>a+b.w,0);
  out.overall_score = totalW > 0 ? Math.round(parts.reduce((a,b)=>a+b.s*b.w,0) / totalW) : null;

  return out;
}

/* ────────────────────────────────────────────────────────────
   v5.30: 에너지 Transfer (J 단위) Reference

   학술 근거:
   - Aguinaldo & Escamilla (2019) — segmental energy flow definitions
   - Howenstein, Kipp, Sabick (2020) — J 단위 transfer 정량
   - OBP 90+ mph cohort (n=54) 검증 분포

   FP→BR 구간 분절간 에너지 transfer (J). OBP가 직접 제공하는 변인을 정의 그대로 사용.
   향후 우리 c3d.txt에서 자체 계산하려면 segment KE_rot 시계열 + 시간 적분 필요.
   ──────────────────────────────────────────────────────────── */

const ENERGY_TRANSFER_J_REF = {
  pelvis_lumbar_transfer_fp_br: {
    label_kr: '골반 → 몸통 (Pelvis-Lumbar)',
    label_en: 'Pelvis-Lumbar Transfer (FP→BR)',
    unit: 'J',
    elite_range: [100, 220],         // OBP 90+ p25-p75
    acceptable_range: [50, 320],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  thorax_distal_transfer_fp_br: {
    label_kr: '몸통 → 어깨 (Thorax-Distal)',
    label_en: 'Thorax-Distal Transfer (FP→BR)',
    unit: 'J',
    elite_range: [380, 460],         // OBP 90+ p25-p75
    acceptable_range: [300, 500],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  shoulder_transfer_fp_br: {
    label_kr: '어깨 transfer',
    label_en: 'Shoulder Transfer (FP→BR)',
    unit: 'J',
    elite_range: [350, 440],
    acceptable_range: [280, 480],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  shoulder_generation_fp_br: {
    label_kr: '어깨 generation',
    label_en: 'Shoulder Generation (FP→BR)',
    unit: 'J',
    elite_range: [25, 50],
    acceptable_range: [10, 70],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  elbow_transfer_fp_br: {
    label_kr: '팔꿈치 transfer',
    label_en: 'Elbow Transfer (FP→BR)',
    unit: 'J',
    elite_range: [370, 450],
    acceptable_range: [300, 500],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  lead_hip_generation_fp_br: {
    label_kr: 'lead hip generation',
    label_en: 'Lead Hip Generation (FP→BR)',
    unit: 'J',
    elite_range: [10, 28],
    acceptable_range: [0, 50],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  },
  rear_hip_generation_pkh_fp: {
    label_kr: 'rear hip generation',
    label_en: 'Rear Hip Generation (PKH→FP)',
    unit: 'J',
    elite_range: [140, 200],
    acceptable_range: [100, 250],
    citation: 'Aguinaldo 2019 / OBP 90+ cohort'
  }
};

/**
 * 에너지 Transfer (J 단위) 진단
 * @param {Object} e — { pelvis_lumbar_transfer_fp_br, thorax_distal_transfer_fp_br, ... }
 * @returns {Object} — 7 metric × {value, score, status}
 */
function energyTransferJAnalysis(e = {}){
  if(!e) return null;
  const out = { metrics: {} };
  for(const [key, def] of Object.entries(ENERGY_TRANSFER_J_REF)){
    const v = e[key];
    out.metrics[key] = {
      label_kr: def.label_kr,
      label_en: def.label_en,
      unit: def.unit,
      value: v,
      elite_range: def.elite_range,
      score: grfHorizontalMetricScore(v, def),  // 동일 scoring 함수 재사용
      citation: def.citation
    };
  }
  const scores = Object.values(out.metrics).map(m => m.score).filter(s => s != null);
  out.overall_score = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : null;
  return out;
}

/* ────────────────────────────────────────────────────────────
   v5.31: Markerless ↔ Marker 시스템 보정 계수

   학술 근거: KR 41명 cohort (markerless Theia, n=47 trials at 135+ km/h) vs
              OBP 100 pitchers (marker-based, n=54 trials at 90+ mph) p50 비교

   사용처:
   1. 학술 논문 작성 시 우리 markerless 값을 marker 등가로 환산
   2. marker reference 값 (Werner, Aguinaldo 등)을 markerless 등가로 역환산
   3. cohort 비교 보고서에서 시스템 차이 보정

   보정 방향: KR_markerless × factor ≈ OBP_marker
   ──────────────────────────────────────────────────────────── */

const MARKERLESS_CALIBRATION_FACTORS = {
  // 회전 ω peaks (KR markerless가 marker 대비 ~10-15% 작음)
  pelvis_peak_omega:    1.15,    // KR 630 × 1.15 ≈ 725 (OBP)
  trunk_peak_omega:     1.16,    // KR 910 × 1.16 ≈ 1058
  arm_peak_omega:       1.10,    // KR 4184 × 1.10 ≈ 4602

  // X-factor (가장 큰 시스템 차이 — pelvis+thorax 추정 누적)
  x_factor_peak:        1.65,    // KR 21.6 × 1.65 ≈ 35.6 (OBP 34.6)
  x_factor_fc:          1.80,    // KR 18.5 × 1.80 ≈ 33.3

  // CoG (selection effect 일부 포함)
  cog_velo:             1.22,    // KR 2.5 × 1.22 ≈ 3.05

  // Stride
  stride_length:        1.09,

  // 자세 변인 — 시스템 정합 (factor = 1)
  shoulder_abd_fp:      1.00,
  shoulder_er_max:      1.00,
  trunk_counter_rot:    1.00,    // 절댓값 기준
  // FC trunk forward tilt는 -64% 차이지만 부호·정의 이슈일 수 있음 (require validation)

  // 수직 GRF — 정합
  vertical_grf:         1.00,

  // 수평 GRF — selection effect 큼, 보정 보류
  horizontal_grf_drive: 1.34,    // KR 65 → OBP 87 (selection 일부)
  horizontal_grf_lead:  1.09,    // KR 113 → OBP 123

  // metadata
  cohort_kr_n:    47,
  cohort_kr_velo_min_kmh: 135,
  cohort_obp_n:   54,
  cohort_obp_velo_min_mph: 90,
  source_doc: 'docs/references/KR_vs_OBP_markerless_v_marker_v5.31.md'
};

/**
 * 우리 markerless 값을 marker 등가로 환산
 * @param {string} variableType — 'pelvis_peak_omega', 'x_factor_peak' 등 KEY
 * @param {number} markerlessValue — 우리 측정값
 * @returns {number} marker 등가값 (학술 비교용)
 */
function markerEquivalent(variableType, markerlessValue){
  const f = MARKERLESS_CALIBRATION_FACTORS[variableType];
  if(f == null || markerlessValue == null) return null;
  return markerlessValue * f;
}

/**
 * marker reference 값을 markerless 등가로 역환산
 * @param {string} variableType
 * @param {number} markerValue — 학술 reference (Werner, Aguinaldo 등) 값
 * @returns {number} markerless 등가값 (우리 측정과 비교용)
 */
function markerlessEquivalent(variableType, markerValue){
  const f = MARKERLESS_CALIBRATION_FACTORS[variableType];
  if(f == null || markerValue == null || f === 0) return null;
  return markerValue / f;
}
