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
    //   v3.9 갱신 — 41명 + 18명 = 59명 통합 cohort
    //   - 41명: raw data (Theia + 우리 parser, Humerus -490 보정 적용)
    //   - 18명: Accurate_Data (xlsx 처리값, CoG_Decel·GRF BW 단위 추가)
    //   IQR-clipped 선수별 median 의 percentile [p10/p25/p50/p75/p90]
    // ────────────────────────────────────────────────────
    pitching: {
      // 구속 — 41+16 = 57명 (18명 중 ball_speed 누락 2명)
      velocity_mean_kmh: { unit: 'km/h', p: [129.1, 131.9, 134.0, 137.7, 139.2], n: 57 },
      velocity_max_kmh:  { unit: 'km/h', p: [128.8, 132.4, 135.0, 138.9, 146.3], n: 41,
                           note: '41명만 (max 분리)' },
      // 메카닉 (59명 통합)
      pelvis_peak_dps:   { unit: 'deg/s', p: [523, 578, 631, 658, 706],  n: 59 },
      trunk_peak_dps:    { unit: 'deg/s', p: [785, 831, 885, 933, 990],  n: 59 },
      humerus_peak_dps:  { unit: 'deg/s', p: [3744, 3993, 4263, 4596, 4865], n: 59,
                           note: 'parser Humerus -490 보정 적용 (xlsx 처리값과 align)' },
      hand_peak_dps:     { unit: 'deg/s', p: [2547, 2778, 2987, 3208, 3325], n: 41,
                           note: '41명만 (Hand 변수 18명 데이터에 없음)' },
      x_factor_max_deg:  { unit: 'deg',   p: [20.8, 25.2, 32.2, 36.1, 42.2], n: 59 },
      // v3.9 신규 — 18명 Accurate_Data 에서만 (BBL v33.22 검증 변수)
      cog_decel:         { unit: 'm/s',   p: [1.08, 1.20, 1.32, 1.36, 1.49], n: 18,
                           note: 'BBL v33.22 검증된 핵심 변수 (Driveline 채택). 18명만' },
      knee_ext_change:   { unit: 'deg',   p: [-35.1, -20.8, -8.1, -1.4, 5.0], n: 18,
                           note: '음수=collapse, 양수=신전. fc→br 변화량' },
      er_max:            { unit: 'deg',   p: [171, 173, 175, 182, 184], n: 18 },
      stride_cm:         { unit: 'cm',    p: [132, 141, 146, 147, 158], n: 18 },
      // GRF — BW 단위 통일 (59명, 41명 N단위 → BW 환산 + 18명 BW)
      lead_grf_bw:       { unit: 'BW',    p: [1.72, 1.83, 2.02, 2.23, 2.56], n: 59,
                           note: '착지발 vertical peak / BW. 41명 N단위 환산 + 18명 처리값' },
      rear_grf_bw:       { unit: 'BW',    p: [1.40, 1.48, 1.62, 1.75, 1.86], n: 59,
                           note: '축발 vertical peak / BW' },
      // 호환성: 41명 N 단위 (deprecated, 신규 사용 X)
      lead_z_peak_n:     { unit: 'N',     p: [1395, 1538, 1641, 1812, 2245], n: 41 },
      rear_z_peak_n:     { unit: 'N',     p: [1103, 1268, 1352, 1444, 1563], n: 41 },
      fp1_z_peak_n:      { unit: 'N',     p: [1445, 1533, 1616, 1812, 1969], n: 41,
                           note: 'raw FP1 — lead_grf_bw 사용 권장' },
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

