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

const ANALYTICS_VERSION = '3.8';

/* ────────────────────────────────────────────────────────────
   v3.8-2: BBL VELO_REGRESSION_v33_22 — 외부 reference 회귀 모델
   출처: kkl0511/Uplift_Pitching_Report (BBL n=169 sessions, OLS)
   - 학습 R²    = 0.377
   - LOO-CV R² = 0.268 (cross-validation 검증 통과)
   - 한국 고교 + 고2~고3 mixed cohort
   우리 LATENT_VELOCITY_WEIGHTS 와 cross-check reference
   ──────────────────────────────────────────────────────────── */

const BBL_VELO_MODEL = {
  intercept: 15.6232,
  // 비표준화 계수 (km/h per unit)
  coefs: {
    max_x_factor_mean:                   0.177448,
    lead_knee_ext_change_fc_to_br_mean:  0.022827,
    proper_sequence_binary_mean:         8.733000,   // ★ β=0.276 (1순위)
    pelvis_to_trunk_lag_ms_sd:           0.000924,
    elbow_ext_vel_max_mean:              0.001245,
    height_m:                            40.227000,  // ★ β=0.235
    weight_kg:                           0.007000,
    cmj_pp_bm:                           0.051000,
    imtp_pp_bm:                          0.309000,
    grip_strength:                       0.280420,   // ★ β=0.266 (2순위)
    cog_decel:                           3.282000,   // v33.22 신규 (Driveline 검증)
  },
  // 비어있을 때 사용할 코호트 평균 (BBL imputation)
  defaults: {
    max_x_factor_mean:                   31.0,
    lead_knee_ext_change_fc_to_br_mean:  3.0,
    proper_sequence_binary_mean:         0.92,
    pelvis_to_trunk_lag_ms_sd:           14.0,
    elbow_ext_vel_max_mean:              1450.0,
    height_m:                            1.78,
    weight_kg:                           76.0,
    cmj_pp_bm:                           45.0,
    imtp_pp_bm:                          27.0,
    grip_strength:                       55.0,
    cog_decel:                           1.5,
  },
  R2: 0.377, R2_loo: 0.268, n: 169,
  source: 'BBL Uplift Pitching Report v33.22 (kkl0511)',
  // 표준화 β 1~5순위 (UI 인용)
  top5_beta: ['proper_sequence (+0.276)', 'grip_strength (+0.266)',
              'height (+0.235)', 'max_x_factor (+0.214)', 'cog_decel (+0.183)']
};

/**
 * BBL 외부 회귀모델로 max velocity 예측
 * @param {object} input  10~11 변수 (없으면 코호트 mean으로 imputation)
 * @returns {{predicted_kmh, used_imputation, contributors}}
 */
function predictMaxVelocityBBL(input = {}){
  const m = BBL_VELO_MODEL;
  let pred = m.intercept;
  const used_imputation = [];
  const contributors = [];
  for(const [k, c] of Object.entries(m.coefs)){
    let v = input[k];
    if(v == null || isNaN(v)){
      v = m.defaults[k]; used_imputation.push(k);
    }
    const contribution = c * v;
    pred += contribution;
    contributors.push({ var: k, value: v, coef: c, contribution: Math.round(contribution*10)/10 });
  }
  return {
    predicted_kmh: Math.round(pred*10)/10,
    used_imputation,
    contributors: contributors.sort((a,b)=>b.contribution-a.contribution),
    source: m.source,
    R2: m.R2,
    R2_loo: m.R2_loo,
    n: m.n
  };
}

/* ────────────────────────────────────────────────────────────
   v3.2 — VALD College Baseball 노메이티브 데이터 (USA, College, N≈수백)
   각 항목 1·25·50·75·99 percentile (lo→hi). Imbalance·Ratio 는 별도 처리.
   출처: VALD Normative Data Report — College Baseball (사용자 제공)
   ──────────────────────────────────────────────────────────── */

// v3.3: 3-tier cohort 구조 — VALD_NORMS[cohort][test][metric]
//   'college' = USA College Baseball (mid-tier reference)
//   'mlb'     = USA MLB (top-tier ceiling)
//   'kr_hs_elite' = 한국 중3→고1 우수 투수 실측 (N=15~30, 2025/02 측정)
const VALD_NORMS = {
  college: {
  // CMJ (ForceDecks Countermovement Jump)
  cmj: {
    conc_pp_bm:        { unit: 'W/kg', p: [46, 55, 60, 64, 77] },
    ecc_pp_bm:         { unit: 'W/kg', p: [10, 19, 23, 29, 41] },
    jump_height_cm:    { unit: 'cm',   p: [31, 42, 47, 51, 63] },
    rsi_modified:      { unit: 'm/s',  p: [0.358, 0.536, 0.609, 0.691, 0.907] },
    ft_ct_ratio:       { unit: '',     p: [0.56, 0.74, 0.81, 0.89, 1.10] },
    ecc_decel_impulse: { unit: 'N/s',  p: [75.4, 119.5, 138.4, 157.6, 202.0] }
  },
  // Drop Jump
  drop_jump: {
    rsi:               { unit: '',     p: [0.87, 1.17, 1.46, 1.74, 2.77] },
    contact_time:      { unit: 's',    p: [0.19, 0.38, 0.46, 0.53, 0.62] }
  },
  // Squat Jump (RFD only — JH·PP는 CMJ 와 유사)
  squat_jump: {
    conc_rfd:          { unit: 'N/s',  p: [962, 3397, 4408, 5862, 10391] },
    conc_impulse:      { unit: 'N·s',  p: [185, 237, 258, 282, 342] }
  },
  // Single Leg Jump (좌우 각각 측정 후 평균)
  slj: {
    conc_pp_bm:        { unit: 'W/kg', p: [29, 35, 39, 43, 52] },
    jump_height_cm:    { unit: 'cm',   p: [14, 21, 24, 27, 34] },
    rsi_modified:      { unit: 'm/s',  p: [0.146, 0.248, 0.295, 0.344, 0.507] }
  },
  // Loaded CMJ (체중 부하 조건)
  lcmj: {
    conc_pp_bm:        { unit: 'W/kg', p: [35, 40, 43, 48, 57] },
    jump_height_cm:    { unit: 'cm',   p: [20, 24, 27, 29, 36] }
  },
  // Hip Adduction/Abduction - 45 (ForceFrame)
  hip_45: {
    add_force_n:       { unit: 'N',    p: [251, 387, 462, 525, 631] },
    abd_force_n:       { unit: 'N',    p: [327, 416, 466, 526, 618] },
    add_imbalance_pct: { unit: '%',    p: [0.2, 2.2, 5.2, 7.8, 14.6], lower_better: true },
    abd_imbalance_pct: { unit: '%',    p: [0.1, 2.3, 3.9, 6.8, 10.7], lower_better: true },
    add_abd_ratio:     { unit: '',     p: [0.66, 0.87, 1.01, 1.07, 1.30] }
  },
  // Hip Adduction/Abduction - Supine Knee
  hip_supine: {
    add_force_n:       { unit: 'N',    p: [204, 361, 418, 499, 606] },
    abd_force_n:       { unit: 'N',    p: [205, 342, 427, 492, 589] },
    add_imbalance_pct: { unit: '%',    p: [0.2, 3.2, 7.1, 13.8, 27.3], lower_better: true },
    abd_imbalance_pct: { unit: '%',    p: [0.3, 2.0, 3.7, 6.7, 12.7], lower_better: true }
  },
  // Shoulder ER/IR - Supine 90° AB
  shoulder_er_ir: {
    er_force_n:        { unit: 'N',    p: [116, 147, 166, 188, 236] },
    ir_force_n:        { unit: 'N',    p: [95, 142, 162, 179, 232] },
    er_imbalance_pct:  { unit: '%',    p: [0, 4, 9, 15, 28], lower_better: true },
    ir_imbalance_pct:  { unit: '%',    p: [0, 5, 10, 17, 32], lower_better: true },
    er_ir_ratio:       { unit: '',     p: [0.78, 0.95, 1.02, 1.11, 1.30] }
  },
  // Nordic Hamstring (편측 + 양측 합)
  nordic: {
    force_n:           { unit: 'N',    p: [229, 359, 419, 466, 571] },
    imbalance_pct:     { unit: '%',    p: [0.2, 3.0, 6.3, 11.2, 23.1], lower_better: true }
  }
  },  // ── college 끝 ──

  // ════════════════════════════════════════════════════════
  //   MLB (USA Pro) — 더 엄격한 elite ceiling reference
  // ════════════════════════════════════════════════════════
  mlb: {
    cmj: {
      conc_pp_bm:        { unit: 'W/kg', p: [45, 56, 60, 65, 78] },
      ecc_pp_bm:         { unit: 'W/kg', p: [10, 21, 26, 31, 43] },
      jump_height_cm:    { unit: 'cm',   p: [30.5, 39.6, 43.7, 48.0, 58.4] },  // in→cm 변환
      ft_ct_ratio:       { unit: '',     p: [0.55, 0.76, 0.85, 0.94, 1.17] },
      conc_peak_force_n: { unit: 'N',    p: [1712, 2263, 2514, 2780, 3433] },
      rsi_modified:      { unit: 'm/s',  p: [0.36, 0.56, 0.65, 0.74, 0.97] },
      conc_impulse:      { unit: 'N·s',  p: [196.7, 250.2, 271.9, 294.2, 346.8] },
      conc_impulse_100ms:{ unit: 'N·s',  p: [76.4, 118.3, 137.1, 156.8, 208.2] }
    },
    sj: {
      jump_height_cm:    { unit: 'cm',   p: [27.2, 36.6, 40.6, 44.7, 55.1] },
      rsi_modified:      { unit: 'm/s',  p: [0.44, 0.79, 0.96, 1.15, 1.61] },
      conc_pp_bm:        { unit: 'W/kg', p: [44, 54, 59, 64, 75] },
      conc_peak_force_n: { unit: 'N',    p: [1631, 2119, 2313, 2525, 3047] }
    },
    hop: {  // Pogo / Hop test
      best_rsi:          { unit: '',     p: [0.45, 1.08, 1.34, 1.62, 2.31] },
      best_jh_cm:        { unit: 'cm',   p: [9.61, 20.61, 25.71, 30.77, 43.54] },
      active_stiffness:  { unit: 'N/m',  p: [15926, 33662, 41488, 49378, 71420] },
      contact_time_s:    { unit: 's',    p: [0.253, 0.205, 0.187, 0.172, 0.144], lower_better: true }
    },
    imtp: {
      peak_force_n:      { unit: 'N',    p: [2097, 2994, 3394, 3874, 5155] },
      peak_force_bm:     { unit: 'N/kg', p: [24.2, 32.5, 36.3, 41.1, 53.7] }
    },
    nordic: {
      force_n:           { unit: 'N',    p: [257, 394, 450, 505, 645] },
      asymmetry_pct:     { unit: '%',    p: [23.2, 11.3, 6.6, 3.1, 0.1], lower_better: true }
    },
    iso_prone: {  // ISO Prone (NordBord)
      force_n:           { unit: 'N',    p: [181, 306, 362, 421, 570] }
    },
    hip_45: {
      add_force_n:       { unit: 'N',    p: [226, 394, 470, 541, 708] },
      abd_force_n:       { unit: 'N',    p: [309, 432, 490, 552, 699] },
      add_asymmetry_pct: { unit: '%',    p: [14.6, 7.1, 4.0, 1.9, 0.1], lower_better: true },
      abd_asymmetry_pct: { unit: '%',    p: [12.7, 6.2, 3.6, 1.7, 0.0], lower_better: true },
      add_abd_ratio:     { unit: '',     p: [0.54, 0.83, 0.95, 1.06, 1.36] }
    },
    hip_supine: {
      add_force_n:       { unit: 'N',    p: [206, 370, 443, 515, 670] },
      abd_force_n:       { unit: 'N',    p: [292, 421, 472, 530, 677] }
    },
    shoulder_ir_er: {
      ir_force_n:        { unit: 'N',    p: [112, 173, 204, 239, 322] },
      er_force_n:        { unit: 'N',    p: [110, 166, 192, 221, 290] },
      ir_asymmetry_pct:  { unit: '%',    p: [31.6, 15.9, 9.6, 4.6, 0.2], lower_better: true },
      er_asymmetry_pct:  { unit: '%',    p: [30.5, 15.3, 9.1, 4.5, 0.1], lower_better: true },
      ir_er_ratio:       { unit: '',     p: [0.69, 0.95, 1.06, 1.18, 1.48] }
    },
    grip: {
      peak_force_n:      { unit: 'N',    p: [432, 575, 632, 689, 831] },
      rfd:               { unit: 'N/s',  p: [559, 1492, 2169, 2950, 4718] }
    },
    shoulder_rom: {  // DynaMo seated, elbow 90°
      ir_avg_deg:        { unit: 'deg',  p: [36.2, 53.2, 61.3, 69.7, 88.9] },
      ir_max_deg:        { unit: 'deg',  p: [37.7, 55.1, 63.4, 72.2, 92.8] },
      er_avg_deg:        { unit: 'deg',  p: [99.2, 115.6, 122.5, 129.8, 148.3] },
      er_max_deg:        { unit: 'deg',  p: [101.3, 118.1, 125.0, 132.5, 151.2] }
    }
  },

  // ════════════════════════════════════════════════════════
  //   KR HS Elite — 한국 중3→고1 우수 투수 실측 (2025/02, N=15~30)
  //   Pitcher.zip 데이터에서 mean ± SD 추출.
  //   percentile 변환: lo=mean-2sd, p25=mean-0.674sd, p50=mean, p75=mean+0.674sd, p99=mean+2sd
  // ════════════════════════════════════════════════════════
  kr_hs_elite: {
    cmj: {
      jump_height_cm:    { unit: 'cm',   p: [22.3, 30.4, 34.5, 38.6, 46.8], n: 15 },
      rsi_modified:      { unit: 'm/s',  p: [0.30, 0.42, 0.48, 0.54, 0.66], n: 15 },
      conc_pf_bm:        { unit: 'N/kg', p: [19.9, 23.7, 25.7, 27.6, 31.4], n: 15 }
    },
    sj: {
      jump_height_cm:    { unit: 'cm',   p: [24.0, 30.3, 33.5, 36.7, 43.0], n: 15 },
      takeoff_pf_bm:     { unit: 'N/kg', p: [20.4, 23.2, 24.7, 26.2, 29.0], n: 15 },
      conc_max_rfd:      { unit: 'N/s',  p: [2429, 9959, 13788, 17617, 25147], n: 15 }
    },
    nordic: {
      l_max_force_n:     { unit: 'N',    p: [229, 328, 379, 429, 528], n: 30 },
      r_max_force_n:     { unit: 'N',    p: [275, 359, 403, 446, 530], n: 30 },
      asymmetry_pct:     { unit: '%',    p: [-13.0, -0.3, 6.2, 12.7, 25.4], n: 30, lower_better: true }
    },
    shoulder_ir_er: {
      l_max_force_n:     { unit: 'N',    p: [88, 140, 167, 193, 246], n: 30 },
      r_max_force_n:     { unit: 'N',    p: [100, 147, 171, 195, 242], n: 30 },
      asymmetry_pct:     { unit: '%',    p: [-23.7, -6.1, 2.9, 11.9, 29.5], n: 30, lower_better: true }
    },
    grip: {
      l_max_force_kg:    { unit: 'kg',   p: [44.6, 53.9, 58.7, 63.5, 72.8], n: 16 },
      r_max_force_kg:    { unit: 'kg',   p: [45.8, 55.7, 60.8, 65.9, 75.7], n: 16 }
    },
    sprint_30m: {
      total_s:           { unit: 's',    p: [4.12, 4.43, 4.58, 4.74, 5.04], n: 30, lower_better: true },
      velocity3_ms:      { unit: 'm/s',  p: [6.80, 7.48, 7.82, 8.16, 8.84], n: 30 }
    },
    body: {
      bw_kg:             { unit: 'kg',   p: [63.9, 77.7, 84.7, 91.6, 105.4], n: 15 }
    },
    // ────────────────────────────────────────────────────
    //   v3.6 갱신 — parser 정확화 (헤더 자동 매핑) 후 재산출
    //   N=41, 선수당 median (IQR clipped). c3d.txt 컬럼 라벨 기반.
    // ────────────────────────────────────────────────────
    pitching: {
      // 구속 (xlsx 별도 데이터 — 변경 없음)
      velocity_mean_kmh: { unit: 'km/h', p: [117.0, 130.8, 133.3, 137.8, 145.4], n: 41 },
      velocity_max_kmh:  { unit: 'km/h', p: [128.8, 132.4, 135.0, 138.9, 146.3], n: 41 },
      // v3.6 정확한 메카닉 변수 (이전 잘못된 magnitude 계산 → Z 컴포넌트 single-axis)
      pelvis_peak_dps:   { unit: 'deg/s', p: [523, 572, 632, 657, 695],  n: 41 },
      trunk_peak_dps:    { unit: 'deg/s', p: [785, 826, 870, 908, 966],  n: 41 },
      humerus_peak_dps:  { unit: 'deg/s', p: [4419, 4496, 4777, 5160, 5418], n: 41, note: 'Theia v3d processing artifact 가능성 — 단위 검증 필요' },
      hand_peak_dps:     { unit: 'deg/s', p: [2547, 2778, 2987, 3208, 3325], n: 41 },
      shoulder_peak_dps: { unit: 'deg/s', p: [3813, 3953, 4223, 4543, 4641], n: 41, note: 'Theia v3d processing artifact 가능성' },
      elbow_peak_dps:    { unit: 'deg/s', p: [392, 468, 561, 737, 777],   n: 41 },
      x_factor_max_deg:  { unit: 'deg',   p: [25.8, 30.9, 33.7, 39.4, 43.5], n: 41 },
      // GRF — v3.7 자동 분류 (peak Z 큰 쪽=lead, 작은 쪽=rear)
      // 측정 환경마다 FP1/FP2 매핑 다름 (좌투/우투, 셋업) → 자동 분류로 robust
      lead_z_peak_n:     { unit: 'N',     p: [1395, 1538, 1641, 1812, 2245], n: 41,
                           note: '착지발 (앞발 block). 41명 N=41, 자동 분류 후' },
      rear_z_peak_n:     { unit: 'N',     p: [1103, 1268, 1352, 1444, 1563], n: 41,
                           note: '축발 (뒷발 push-off). 자동 분류 후' },
      // 호환성 (이전 fp1/fp2 라벨 — 사용 권장 안 함, 자동 분류 결과 사용)
      fp1_z_peak_n:      { unit: 'N',     p: [1445, 1533, 1616, 1812, 1969], n: 41,
                           note: 'raw FP1 — 측정 환경 따라 lead 또는 rear. lead_z_peak_n 사용 권장' },
      fp2_z_peak_n:      { unit: 'N',     p: [1163, 1268, 1377, 1444, 1557], n: 41 }
    },
    // 41명 신체 통계
    body_pitchers: {
      height_cm:         { unit: 'cm', p: [175, 181, 184, 188, 190], n: 41 },
      weight_kg:         { unit: 'kg', p: [72, 80, 84, 88, 93], n: 41 }
    }
  }
};

/**
 * VALD 코호트 percentile 산출 (3-tier: kr_hs_elite / college / mlb)
 * @param {number} value   측정값
 * @param {string} test    'cmj'|'drop_jump'|'hip_45'|'shoulder_er_ir'|'nordic'|...
 * @param {string} metric  'conc_pp_bm'|'rsi_modified'|...
 * @param {string} [cohort='college'] — 'kr_hs_elite' | 'college' | 'mlb'
 * @returns {{percentile, label, vald_p25, vald_p50, vald_p75, lower_better, cohort}}
 */
function valdPercentile(value, test, metric, cohort = 'college'){
  const norm = VALD_NORMS[cohort]?.[test]?.[metric];
  if(!norm || value == null || isNaN(value)) return null;
  const p = norm.p;   // [1, 25, 50, 75, 99]
  const ps = [1, 25, 50, 75, 99];
  // 측정값의 percentile 추정 (선형 보간)
  let percentile;
  if(norm.lower_better){
    // 낮은 값이 좋음 → percentile 반대로
    if(value <= p[0]) percentile = 99;
    else if(value >= p[4]) percentile = 1;
    else {
      for(let i = 0; i < 4; i++){
        if(value >= p[i] && value < p[i+1]){
          const ratio = (value - p[i]) / (p[i+1] - p[i]);
          percentile = Math.round(100 - (ps[i] + ratio * (ps[i+1] - ps[i])));
          break;
        }
      }
    }
  } else {
    if(value <= p[0]) percentile = 1;
    else if(value >= p[4]) percentile = 99;
    else {
      for(let i = 0; i < 4; i++){
        if(value >= p[i] && value < p[i+1]){
          const ratio = (value - p[i]) / (p[i+1] - p[i]);
          percentile = Math.round(ps[i] + ratio * (ps[i+1] - ps[i]));
          break;
        }
      }
    }
  }
  // 라벨
  let label;
  if(percentile >= 75) label = 'Elite';
  else if(percentile >= 50) label = 'Above Average';
  else if(percentile >= 25) label = 'Average';
  else label = 'Below Average';
  return {
    percentile, label, cohort,
    vald_p25: p[1], vald_p50: p[2], vald_p75: p[3], vald_p99: p[4],
    lower_better: norm.lower_better || false
  };
}

/**
 * 3-tier cohort 동시 비교 — 한국 elite, College, MLB 에서 각각 percentile 산출
 * @returns {{kr_hs_elite, college, mlb}}
 */
function valdMultiTier(value, test, metric){
  return {
    kr_hs_elite: valdPercentile(value, test, metric, 'kr_hs_elite'),
    college:     valdPercentile(value, test, metric, 'college'),
    mlb:         valdPercentile(value, test, metric, 'mlb')
  };
}

/* ────────────────────────────────────────────────────────────
   0. 학년별 벤치마크 (한국 고교 야구 투수 발달 단계)

   문헌 + KBO 유소년 통계 + Stodden(2001), Fleisig(2009) 추정.
   고1→고2→고3 으로 갈수록 골격 성장 + 근력 증가.
   ──────────────────────────────────────────────────────────── */

// v3.3 갱신: 고1 데이터를 한국 중3→고1 elite 실측 (N=15~30) 으로 보정
// 단, "elite" 평균이라 일반 평균보다 높음 → 고1 일반 평균은 elite 평균 - 4 W/kg 정도로 추정
// 출처: Pitcher.zip (2025/02/03 측정)
const GRADE_BENCHMARKS = {
  // v3.5 보정: 41명 elite 코호트의 p75/p85/p90 을 학년별 reference (고교 전반)
  // 41명 자체가 한국 elite (구속 상위 10% 추정) → 그 안에서 학년 발달분 차등
  // 고1 = p75 (이미 elite 진입), 고2 = p85, 고3 = p90 (성숙 elite)
  1: {  // 고1 reference = 41명 elite p75
    velocity_mean: 137.8, velocity_sd: 5.2,        // 41명 elite p75
    velocity_max_mean: 138.9, velocity_max_sd: 5.1, // 41명 max p75
    // 체력: Pitcher.zip ForceDecks (15명, p50 사용 — 별도 코호트)
    cmj_pp_bm_mean: 25.7, cmj_pp_bm_sd: 2.9,
    cmj_jh_mean:    34.5, cmj_jh_sd:    6.1,
    cmj_rsi_mean:   0.48, cmj_rsi_sd:   0.09,
    imtp_pf_bm_mean: 25, imtp_pf_bm_sd: 4,
    sj_jh_mean:     33.5, sj_jh_sd:     4.7,
    nordic_force_mean: 390, nordic_force_sd: 70,
    // 메카닉: v3.6 parser 정확화 후 재산출 — 41명 elite p75
    pelvis_peak_dps_mean: 657, pelvis_peak_dps_sd: 66,    // p75 (이전 1077 ✗)
    trunk_peak_dps_mean:  908, trunk_peak_dps_sd:  68,    // p75 신규
    x_factor_mean:       39.4, x_factor_sd:        7.0,   // p75 신규
    // 신체: 41명 elite p75
    height_mean: 188, height_sd: 4.0,
    weight_mean: 88, weight_sd: 6.0,
    n_kr_elite: 41,
    reference_type: 'p75 of 41 elite cohort'
  },
  2: {  // 고2 reference = 41명 elite p85 (학년 발달 1년)
    velocity_mean: 138.5, velocity_sd: 5.2,        // p85 추정 (p75=137.8, p90=139.2)
    velocity_max_mean: 140.0, velocity_max_sd: 5.1,
    cmj_pp_bm_mean: 27.5, cmj_pp_bm_sd: 2.9,        // 발달분 +1.8 W/kg
    cmj_jh_mean:    37, cmj_jh_sd:    6,
    cmj_rsi_mean:   0.52, cmj_rsi_sd: 0.10,
    imtp_pf_bm_mean: 28, imtp_pf_bm_sd: 4,
    sj_jh_mean:     36, sj_jh_sd:     5,
    nordic_force_mean: 420, nordic_force_sd: 70,
    pelvis_peak_dps_mean: 676, pelvis_peak_dps_sd: 66,   // p85 추정 (v3.6 보정)
    height_mean: 189, weight_mean: 90,
    reference_type: 'p85 of 41 elite cohort (estimated)'
  },
  3: {  // 고3 reference = 41명 elite p90 (성숙 elite)
    velocity_mean: 139.2, velocity_sd: 5.2,        // 41명 p90
    velocity_max_mean: 141.5, velocity_max_sd: 5.1,
    cmj_pp_bm_mean: 29, cmj_pp_bm_sd: 2.9,
    cmj_jh_mean:    40, cmj_jh_sd:    6,
    cmj_rsi_mean:   0.55, cmj_rsi_sd: 0.10,
    imtp_pf_bm_mean: 31, imtp_pf_bm_sd: 4,
    sj_jh_mean:     38, sj_jh_sd:     5,
    nordic_force_mean: 450, nordic_force_sd: 70,
    pelvis_peak_dps_mean: 695, pelvis_peak_dps_sd: 66,   // 41명 p90 (v3.6 보정)
    height_mean: 190, weight_mean: 92,
    reference_type: 'p90 of 41 elite cohort'
  }
};

/**
 * 학년별 잠재구속 임계치 보정 — 발달 단계에 맞춤
 * 같은 측정값이라도 학년에 따라 "충분/부족" 판정이 다름
 */
// v3.6 정확한 매핑: 41명 elite 코호트의 학년별 percentile 임계
// LATENT_VELOCITY_WEIGHTS.pelvis_peak_dps.th = 500 (Stodden 2001 일반)
// 고1=p75(657), 고2=p85(676), 고3=p90(695) → offset = p − 500
// LATENT_VELOCITY_WEIGHTS.trunk_peak_dps.th = 900 → 41명 p75=908 (offset +8)
const GRADE_LATENT_OFFSETS = {
  // value = (LATENT_VELOCITY_WEIGHTS의 th) + (학년별 offset)
  1: { trunk_peak_dps:  -75, pelvis_peak_dps: +157, cmj_pp_bm: -12.3, imtp_pf_bm: -3, shoulder_er_deg: -10, stride_pct_height: -3 },
  2: { trunk_peak_dps:   -8, pelvis_peak_dps: +176, cmj_pp_bm: -10.5, imtp_pf_bm:  0, shoulder_er_deg:   0, stride_pct_height:  0 },
  3: { trunk_peak_dps:  +66, pelvis_peak_dps: +195, cmj_pp_bm:  -9,    imtp_pf_bm: +1, shoulder_er_deg:  +5, stride_pct_height: +2 }
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
  // v3.8 — BBL 외부 회귀 모델
  predictMaxVelocityBBL, BBL_VELO_MODEL,
  // 상수 (UI 인용용)
  LATENT_VELOCITY_WEIGHTS,
  COMPOSITE_WEIGHTS,
  GRADE_BENCHMARKS,
  GRADE_LATENT_OFFSETS,
  GRF_BENCHMARKS,
  STUFF_BENCHMARKS,
  VALD_NORMS
};

// 브라우저 빌드에서 직접 접근 가능
if(typeof window !== 'undefined') window.ANALYTICS = ANALYTICS;
