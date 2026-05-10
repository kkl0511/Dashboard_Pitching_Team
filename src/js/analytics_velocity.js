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

const ANALYTICS_VERSION = '4.0';

/* ────────────────────────────────────────────────────────────
   v4.0: Velo Group Stratification + Predicted Velo + AE

   Driveline 의 핵심 발견 — 동질 cohort 도 4-group stratification 으로
   분산을 의도적으로 만들면 R² 자연스럽게 ↑
   ──────────────────────────────────────────────────────────── */

// 한국 elite cohort 4-group stratification (구속 기준)
const VELO_GROUPS = {
  '미달':   { range: [0, 128],     label: '미달',   color: '#7e57c2', mph_equiv: '<80' },
  '평균':   { range: [128, 133],   label: '평균',   color: '#e91e63', mph_equiv: '80-82' },
  '우수':   { range: [133, 138],   label: '우수',   color: '#ff9800', mph_equiv: '82-86' },
  'Elite':  { range: [138, 999],   label: 'Elite',  color: '#ff6f00', mph_equiv: '86+' }
};

function veloGroup(velocity_kmh){
  for(const [k, v] of Object.entries(VELO_GROUPS)){
    if(velocity_kmh >= v.range[0] && velocity_kmh < v.range[1]) return k;
  }
  return null;
}

/* v5.10: OpenBiomechanics 기반 7-predictor Velocity Prediction Model
 *
 * Driveline OpenBiomechanics Project (https://github.com/drivelineresearch/openbiomechanics)
 *   411 trial × 100명 (32 HS + 314 College + 42 Indep + 23 MiLB)
 *   학습 R² = 0.372, RMSE = 6.07 km/h
 *   7 predictors: pelvis_dps, trunk_dps, arm_dps, x_factor, mass_kg, height_m, stride_pct
 *
 * v5.10 신규 — stride_pct (= stride_length_m / height_m, OBP 정의와 일치)
 *   STRIDE_LENGTH 컬럼은 c3d.txt에 single-value sparse → 전체 frame에서 추출
 *   한국 cohort median stride_pct 0.797 ≈ OBP median 0.837 (검증 통과)
 *
 * 한국 cohort 적용 시 median residual +8.1 km/h (메카닉 대비 효율 우수)
 *   → cohort 내 ranking이 정밀 (std 5.84 vs 5-pred 6.13)
 */
const OBP_VELO_MODEL = {
  intercept:       -2.0818,
  pelvis_dps_coef: -0.00539,
  trunk_dps_coef:  +0.03006,
  arm_dps_coef:    +0.00685,
  x_factor_coef:   +0.03426,
  mass_kg_coef:    +0.2469,
  height_m_coef:   +21.792,
  stride_pct_coef: +19.141,    // stride 길이 / 신장 비율 (0.7-1.0 range)
  r_squared:       0.372,
  rmse_kmh:        6.07,
  cv_r_squared:    0.28,
  n_train:         411,
  cohort:          'OBP 100명 (32 HS + 314 College + 42 Indep + 23 MiLB)',
  korean_bias:     +8.1,       // 한국 cohort median residual (effiency offset)
  reference:       'https://github.com/drivelineresearch/openbiomechanics'
};

/**
 * v5.10: OBP 7-predictor 모델로 메카닉 기반 구속 예측
 * @param {object} input  pelvis_dps, trunk_dps, arm_dps, x_factor, mass_kg, height_m, stride_pct
 *                        (stride_pct = stride_length_m / height_m, 0.7-1.0 range — OBP 정의)
 * @param {number} measuredKmh  실측 구속 (있으면 residual + efficiency_label 계산)
 * @param {boolean} applyKoreanBias  true면 한국 cohort bias 보정 (기본 false)
 * @returns {{predicted_kmh, residual_kmh, efficiency_label, basis}}
 */
function predictVelocityOBP(input, measuredKmh = null, applyKoreanBias = false){
  const M = OBP_VELO_MODEL;
  if(!input || input.pelvis_dps==null || input.trunk_dps==null || input.arm_dps==null) return null;
  // stride_pct fallback: stride_length / height_m → 없으면 cohort median 0.80
  const stridePct = input.stride_pct
                 ?? (input.stride_length && input.height_m ? input.stride_length / input.height_m : 0.80);
  const xFac = input.x_factor ?? 28;       // 한국 cohort median fallback
  let pred = M.intercept
           + M.pelvis_dps_coef * input.pelvis_dps
           + M.trunk_dps_coef  * input.trunk_dps
           + M.arm_dps_coef    * input.arm_dps
           + M.x_factor_coef   * xFac
           + M.mass_kg_coef    * (input.mass_kg ?? 80)
           + M.height_m_coef   * (input.height_m ?? 1.80)
           + M.stride_pct_coef * stridePct;
  if(applyKoreanBias) pred += M.korean_bias;
  const r = (x, p=1) => Math.round(x * Math.pow(10,p)) / Math.pow(10,p);
  const out = { predicted_kmh: r(pred), basis: 'OBP_7pred_n411', stride_pct_used: r(stridePct, 3) };
  if(measuredKmh != null){
    out.residual_kmh = r(measuredKmh - pred);
    // 한국 cohort 기준 +8 km/h 가 baseline → 라벨 임계 조정
    out.efficiency_label = out.residual_kmh > +15 ? '🔥 매우 효율'
                         : out.residual_kmh > +5  ? '✓ 효율 우수'
                         : out.residual_kmh > 0   ? '○ 평균'
                         : out.residual_kmh > -5  ? '△ 손실 있음'
                         : '⚠ 큰 효율 손실';
  }
  return out;
}

/* v5.11: 한국 고교 투수 평가용 이중 reference — 아마 / 프로
 *
 *   AMATEUR_REFERENCE (n=139, trial=804)
 *     = 한국 고1 41 + 한국 프로/대학 16 + OBP HS 7 + OBP College 75
 *     = "같은 발달 단계 (아마)" 비교
 *
 *   PRO_REFERENCE (n=18, trial=65)
 *     = OBP MiLB 6 + OBP Independent 12
 *     = "프로 elite goal" 비교
 *
 *   대시보드는 두 reference를 동시에 표시:
 *     "본인 → 아마 75%ile · 프로 25%ile"
 *
 *   주의: 측정 시스템 차이 (Theia 마커리스 vs OBP marker mocap)는 systematic bias가 있을 수 있음.
 *   percentile-based 비교가 절대값 비교보다 robust.
 */
const AMATEUR_REFERENCE = {
  label:           '아마 (한국 57 + OBP HS+College 82)',
  n_trial:         804,
  n_player:        139,
  pelvis_dps:      662,
  trunk_dps:       950,
  arm_dps:         4376,
  x_factor:        29.4,
  stride_pct:      0.806,
  hp_ratio_pct:    1491,
  velo_kmh_median: 135.1
};
const PRO_REFERENCE = {
  label:           '프로 (OBP MiLB+Independent 18)',
  n_trial:         65,
  n_player:        18,
  pelvis_dps:      780,
  trunk_dps:       1056,
  arm_dps:         4413,
  x_factor:        33.3,
  stride_pct:      0.828,
  hp_ratio_pct:    1190,
  velo_kmh_median: 142.6
};

/* v5.11: 한국 cohort player별 trial-level 분포 (percentile 산출용)
 *   ascending sort 된 trial-level 값 배열. percentileRank() 함수와 함께 사용.
 *   AMATEUR / PRO 두 distribution 따로 보유.
 */
const REFERENCE_DISTRIBUTIONS = {
  AMATEUR: {
    pelvis_dps: [400, 500, 550, 600, 630, 660, 690, 720, 760, 820, 900, 990],   // p1..p99 추정
    trunk_dps:  [700, 800, 870, 920, 950, 980, 1010, 1050, 1100, 1170, 1240],
    arm_dps:    [3500, 3800, 4100, 4250, 4376, 4500, 4650, 4800, 4950, 5200, 5600],
    x_factor:   [15, 20, 24, 27, 29.4, 32, 35, 38, 42, 47],
    stride_pct: [0.65, 0.71, 0.74, 0.77, 0.81, 0.84, 0.87, 0.90, 0.94],
    hp_ratio_pct:[800, 1050, 1200, 1350, 1491, 1650, 1800, 2000, 2400]
  },
  PRO: {
    pelvis_dps: [600, 670, 720, 750, 780, 810, 850, 900, 970],
    trunk_dps:  [950, 1000, 1030, 1050, 1056, 1080, 1110, 1140, 1180],
    arm_dps:    [3900, 4150, 4280, 4380, 4413, 4480, 4570, 4670, 4830],
    x_factor:   [22, 27, 30, 32, 33.3, 35, 38, 41, 46],
    stride_pct: [0.72, 0.76, 0.79, 0.82, 0.83, 0.85, 0.87, 0.89, 0.92],
    hp_ratio_pct:[700, 850, 990, 1100, 1190, 1300, 1450, 1650, 1900]
  }
};

/**
 * v5.11: 본인 metric을 reference distribution에서의 percentile로 변환 (0-100)
 *   더 robust — 절대값 측정시스템 차이 우회
 *
 * @param {number} value     본인 측정값
 * @param {string} metric    'pelvis_dps' | 'trunk_dps' | ...
 * @param {string} refName   'AMATEUR' | 'PRO'
 * @param {boolean} higherIsBetter   기본 true. (X-factor·stride·H/P 등은 true; 만약 어떤 metric이 lower=better면 false)
 * @returns {number} percentile (0-100)
 */
function percentileVsRef(value, metric, refName='AMATEUR', higherIsBetter=true){
  if(value == null || isNaN(value)) return null;
  const dist = REFERENCE_DISTRIBUTIONS[refName]?.[metric];
  if(!dist || !dist.length) return null;
  // 'value보다 작은 분포 비율' = percentile (linear interpolation)
  let i = 0;
  while(i < dist.length && dist[i] < value) i++;
  let pct;
  if(i === 0) pct = 0;
  else if(i >= dist.length) pct = 100;
  else {
    const lo = dist[i-1], hi = dist[i];
    const r = (value - lo) / (hi - lo);
    pct = ((i - 1 + r) / dist.length) * 100;
  }
  return higherIsBetter ? Math.round(pct) : Math.round(100 - pct);
}

/**
 * v5.11: 메카닉 metric 진단 — 아마와 프로 두 reference 동시 비교
 * @param {object} input  pelvis_dps, trunk_dps, arm_dps, x_factor, stride_pct, hp_ratio_pct
 * @returns {object} metric별 {amateur_pctile, pro_pctile, diagnosis}
 */
function dualReferenceDiagnosis(input){
  const out = {};
  const metrics = ['pelvis_dps','trunk_dps','arm_dps','x_factor','stride_pct','hp_ratio_pct'];
  for(const m of metrics){
    if(input[m] == null) continue;
    const a = percentileVsRef(input[m], m, 'AMATEUR');
    const p = percentileVsRef(input[m], m, 'PRO');
    let label = '';
    if(p >= 75) label = '🔥 프로 상위 (' + p + '%ile)';
    else if(p >= 50) label = '✓ 프로 평균 이상';
    else if(p >= 25) label = '○ 프로 평균 이하';
    else if(a >= 75) label = '✓ 아마 상위 · △ 프로 부족';
    else if(a >= 50) label = '○ 아마 평균';
    else label = '⚠ 아마 평균 이하 (' + a + '%ile)';
    out[m] = {amateur_pctile: a, pro_pctile: p, label: label, value: input[m]};
  }
  return out;
}

/**
 * v5.12: 메카닉 개선 시 기대 구속 (코치/선수용 핵심 KPI)
 *
 *   현재 본인 메카닉 → OBP 모델 → predicted_self
 *   프로 메카닉(PRO_REFERENCE)으로 교체(신체조건 유지) → predicted_pro
 *   기대 향상 = predicted_pro − predicted_self  (model-internal 차이만 사용)
 *   → 한국 cohort systematic bias 자동 우회
 *
 *   "메카닉 활용도" 라는 추상적 개념 대신 "메카닉 개선으로 기대하는 구속" 직관적 메시지
 *
 * @param {object} input  pelvis_dps, trunk_dps, arm_dps, x_factor, stride_pct, mass_kg, height_m
 * @param {number} measuredKmh  실측 구속
 * @returns {{predicted_self, predicted_pro, expected_gain, expected_velo, message}}
 */
function expectedVelocityWithImprovement(input, measuredKmh){
  const M = OBP_VELO_MODEL;
  if(!input || input.pelvis_dps==null || input.trunk_dps==null || input.arm_dps==null) return null;
  const r = (x, p=1) => Math.round(x * Math.pow(10,p)) / Math.pow(10,p);
  const stridePctSelf = input.stride_pct
                     ?? (input.stride_length && input.height_m ? input.stride_length / input.height_m : 0.80);
  const xFacSelf = input.x_factor ?? 28;
  const massKg   = input.mass_kg ?? 80;
  const heightM  = input.height_m ?? 1.80;

  const predict = (pelvis, trunk, arm, xfac, stride) =>
    M.intercept + M.pelvis_dps_coef*pelvis + M.trunk_dps_coef*trunk + M.arm_dps_coef*arm
                + M.x_factor_coef*xfac + M.mass_kg_coef*massKg + M.height_m_coef*heightM
                + M.stride_pct_coef*stride;

  // v5.15: 각 metric별로 "본인 vs 프로 중 prediction에 유리한 쪽" 사용
  //   coef >= 0 (큰 값이 좋음) → max(self, pro)
  //   coef <  0 (작은 값이 좋음) → min(self, pro)
  //   본인이 이미 프로보다 우수한 metric은 본인 값 유지 → gain ≥ 0 보장
  const useBetter = (selfV, proV, coef) => coef >= 0 ? Math.max(selfV, proV) : Math.min(selfV, proV);

  const predSelf = predict(input.pelvis_dps, input.trunk_dps, input.arm_dps, xFacSelf, stridePctSelf);
  const predPro  = predict(
    useBetter(input.pelvis_dps, PRO_REFERENCE.pelvis_dps, M.pelvis_dps_coef),
    useBetter(input.trunk_dps,  PRO_REFERENCE.trunk_dps,  M.trunk_dps_coef),
    useBetter(input.arm_dps,    PRO_REFERENCE.arm_dps,    M.arm_dps_coef),
    useBetter(xFacSelf,         PRO_REFERENCE.x_factor,   M.x_factor_coef),
    useBetter(stridePctSelf,    PRO_REFERENCE.stride_pct, M.stride_pct_coef)
  );
  const gain = predPro - predSelf;
  const expectedVelo = (measuredKmh != null) ? measuredKmh + gain : null;

  let message = '';
  if(measuredKmh == null) message = '실측 구속 없음';
  else if(gain < 0.5) message = '이미 메카닉 잠재 발달 — 신체조건/release efficiency 발달이 다음 단계';
  else if(gain < 2)   message = '메카닉 개선으로 약 +' + r(gain) + ' km/h 향상 기대 (작지만 의미 있음)';
  else if(gain < 5)   message = '메카닉 개선으로 +' + r(gain) + ' km/h 향상 기대 — 4축 약점 발달 권장';
  else                message = '메카닉 개선 잠재 +' + r(gain) + ' km/h — 4축 모두 큰 향상 여지';

  return {
    predicted_self: r(predSelf),
    predicted_pro:  r(predPro),
    expected_gain:  r(gain),
    expected_velo:  expectedVelo != null ? r(expectedVelo) : null,
    measured_velo:  measuredKmh,
    message: message
  };
}

/**
 * v5.13: 체력 향상 시 기대 구속 (PHYSICAL_VELO_MODEL 활용)
 *
 *   본인 체력 → predicted_self_fitness
 *   Elite 체력 (VELO_GROUP_NORMS Elite) → predicted_elite_fitness
 *   향상 = elite − self  (model-internal 차이만 사용)
 *   신체조건(height/weight)은 본인 값 유지 — "체력 변수만 elite로 끌어올렸을 때"
 *
 * @param {object} input  cmj_pp_bm, imtp_pf_bm, hop_rsi, grip_kg, height_cm, weight_kg
 * @param {number} measuredKmh  실측 구속
 * @returns {{predicted_self, predicted_elite, expected_gain, expected_velo, message}}
 */
function expectedVelocityFromFitness(input, measuredKmh){
  const M = PHYSICAL_VELO_MODEL;
  if(!input) return null;
  const r = (x, p=1) => Math.round(x * Math.pow(10,p)) / Math.pow(10,p);
  // Elite 체력 reference (VELO_GROUP_NORMS Elite — 학술 추정)
  const eliteFit = { cmj_pp_bm: 32, imtp_pf_bm: 32, hop_rsi: 2.7, grip_kg: 65 };
  // v5.15: 본인이 이미 elite보다 우수한 체력 변수는 본인 값 유지 → gain ≥ 0
  let predSelf = M.intercept, predElite = M.intercept;
  for(const [k, c] of Object.entries(M.coefs)){
    const selfV = input[k] != null && !isNaN(input[k]) ? input[k] : M.defaults[k];
    let eliteV;
    if(k === 'height_cm' || k === 'weight_kg'){
      eliteV = selfV;   // 신체조건은 본인 값 유지
    } else {
      const eRef = eliteFit[k] ?? selfV;
      // 양수 coef: 큰 값이 좋음 → max(self, elite)
      // 음수 coef: 작은 값이 좋음 → min(self, elite)
      eliteV = c >= 0 ? Math.max(selfV, eRef) : Math.min(selfV, eRef);
    }
    predSelf  += c * selfV;
    predElite += c * eliteV;
  }
  const gain = predElite - predSelf;
  let message = '';
  if(measuredKmh == null) message = '실측 구속 없음';
  else if(gain < 0.5) message = '체력이 이미 elite 수준 — 메카닉 발달이 다음 단계';
  else if(gain < 3)   message = '체력 향상으로 +' + r(gain) + ' km/h 기대 — CMJ/IMTP 우선';
  else if(gain < 6)   message = '체력 향상 잠재 +' + r(gain) + ' km/h — 4가지 fitness 변수 종합 발달';
  else                message = '체력 향상 잠재 +' + r(gain) + ' km/h — 큰 향상 여지';

  return {
    predicted_self:  r(predSelf),
    predicted_elite: r(predElite),
    expected_gain:   r(gain),
    expected_velo:   measuredKmh != null ? r(measuredKmh + gain) : null,
    measured_velo:   measuredKmh,
    message: message
  };
}

/**
 * v5.13: 체력 + 메카닉 모두 향상 시 통합 기대 구속
 *   가법 합산 — 두 모델의 향상량을 단순 더함
 *   학술 한계: cross-term interaction 무시 (단순화)
 */
function expectedVelocityCombined(mechInput, fitInput, measuredKmh){
  const r = (x, p=1) => Math.round(x * Math.pow(10,p)) / Math.pow(10,p);
  const mech = expectedVelocityWithImprovement(mechInput, measuredKmh);
  const fit  = expectedVelocityFromFitness(fitInput, measuredKmh);
  const mGain = mech?.expected_gain ?? 0;
  const fGain = fit?.expected_gain ?? 0;
  const totalGain = mGain + fGain;
  let message = '';
  if(measuredKmh == null) message = '실측 구속 없음';
  else if(totalGain < 1) message = '이미 종합 잠재 도달 — release/spin 등 기타 요인 발달';
  else if(totalGain < 5) message = '통합 향상으로 +' + r(totalGain) + ' km/h 기대';
  else if(totalGain < 10) message = '통합 향상 잠재 +' + r(totalGain) + ' km/h — 메카닉/체력 모두 발달 권장';
  else                    message = '통합 향상 잠재 +' + r(totalGain) + ' km/h — 큰 발달 여지';

  return {
    mechanic_gain:  r(mGain),
    fitness_gain:   r(fGain),
    expected_gain:  r(totalGain),
    expected_velo:  measuredKmh != null ? r(measuredKmh + totalGain) : null,
    measured_velo:  measuredKmh,
    message:        message,
    bigger_lever:   mGain > fGain ? '메카닉' : '체력'
  };
}

/* v5.25: Driveline framework는 src/js/driveline.js로 분리됨
 *   DRIVELINE_5_MODELS, DRIVELINE_HP_6_MODELS, drivelineFiveModelDiagnosis,
 *   drivelineMechanicalCeiling, drivelineHPDiagnosis 등 — driveline.js 참고.
 *   ANALYTICS export는 그대로 유지 (build_dashboard.js가 driveline.js 먼저 로드).
 */


/* v5.18: 메카닉 변인 → 구속·제구 효과 매핑 (학술 출처)
 *   학술 출처: Stodden 2001, Werner 2008, Aguinaldo & Escamilla 2019, Naito 2014
 *   메카닉 7 변인 (4축 라디아의 raw 변인)
 */
const MECHANIC_VARIABLE_MAP = {
  'pelvis_dps':   {label:'Pelvis ω peak',    short:'골반 회전속도',   unit:'°/s', goodKR: 634, mlb: 800,  effect:'velo', priority:2, purpose:'⚾ 분절 시퀀스 첫 단계 (Stodden 2001)'},
  'trunk_dps':    {label:'Trunk ω peak',     short:'몸통 회전속도',   unit:'°/s', goodKR: 887, mlb: 1100, effect:'velo', priority:1, purpose:'⚾⚾ 가장 강한 within-subject 상관 (Werner 2008, r=+0.5)'},
  'arm_dps':      {label:'Arm ω peak',       short:'팔 회전속도(IR)', unit:'°/s', goodKR: 4200, mlb: 4500, effect:'velo', priority:2, purpose:'⚾ Shoulder internal rotation peak'},
  'x_factor':     {label:'X-factor',         short:'골반-상체 분리각', unit:'°',   goodKR: 26,  mlb: 39,   effect:'velo', priority:1, purpose:'⚾⚾ Stodden 2001 — 분리 각도 ↔ 구속 r=+0.30'},
  'stride_pct':   {label:'Stride %height',   short:'스트라이드 비율', unit:'%',   goodKR: 80,  mlb: 83,   effect:'velo', priority:2, purpose:'⚾ Drive leg push-off 거리'},
  'hp_ratio_pct': {label:'H/P KE_rot ratio', short:'분절 에너지 균형', unit:'%',   goodKR: 1310, mlb: 1190, effect:'cmd_velo', priority:2, purpose:'🎯⚾ 작을수록 분절 균형 (프로 1190 < 한국 우수 1310)', lowerBetter: true},
  'ete_pct':      {label:'ETE 전달율',       short:'에너지 전달 효율', unit:'%',   goodKR: 80,  mlb: 85,   effect:'velo', priority:3, purpose:'⚾ 분절 간 KE 전달 (Aguinaldo 2019)'}
};

/* v5.17: 17개 fitness 변인의 본인/한국우수/MLB 학술 reference + 효과 매핑
 *   학술 출처: Lehman 2013, Driveline HP Assessment, Werner 2008, McGuigan 2018
 *   17 변인 = 4 측정 (CMJ 5 + SJ 4 + Pogo 3 + IMTP 5)
 */
const FITNESS_VARIABLE_MAP = {
  // CMJ
  'cmj_jh':       {test:'CMJ', label:'CMJ Jump Height', short:'CMJ JH', unit:'cm', goodKR: 36, mlb: 47, effect:'velo', priority:2, purpose:'하지 폭발력'},
  'cmj_pp_bm':    {test:'CMJ', label:'CMJ Peak Power / BM', short:'CMJ PP/BM', unit:'W/kg', goodKR: 28, mlb: 60, effect:'velo', priority:1, purpose:'⚾⚾ Drive leg push-off (구속 핵심)'},
  'cmj_rsi_mod':  {test:'CMJ', label:'CMJ RSI-modified', short:'RSI-mod', unit:'m/s', goodKR: 0.55, mlb: 0.65, effect:'velo', priority:3, purpose:'Slow SSC 효율'},
  'cmj_conc_pf':  {test:'CMJ', label:'CMJ Conc PF / BM', short:'CMJ Conc PF', unit:'N/kg', goodKR: 42, mlb: 50, effect:'velo', priority:3, purpose:'가속 phase 힘'},
  'cmj_ec_ratio': {test:'CMJ', label:'Ecc:Conc Ratio', short:'E:C Ratio', unit:'', goodKR: 1.05, mlb: 1.10, effect:'cmd', priority:4, purpose:'🎯 신장-단축 균형 (제구)'},
  // SJ
  'sj_jh':        {test:'SJ',  label:'SJ Jump Height', short:'SJ JH', unit:'cm', goodKR: 35, mlb: 42, effect:'velo', priority:3, purpose:'순수 concentric'},
  'sj_pp_bm':     {test:'SJ',  label:'SJ Peak Power / BM', short:'SJ PP/BM', unit:'W/kg', goodKR: 32, mlb: 52, effect:'velo', priority:2, purpose:'SSC 없는 가속력'},
  'sj_conc_pf':   {test:'SJ',  label:'SJ Conc PF / BM', short:'SJ Conc PF', unit:'N/kg', goodKR: 36, mlb: 42, effect:'velo', priority:3, purpose:'Concentric strength'},
  'eur':          {test:'SJ',  label:'EUR (CMJ JH / SJ JH)', short:'EUR', unit:'', goodKR: 1.05, mlb: 1.10, effect:'velo', priority:2, purpose:'⚾⚾ SSC 활용도 (1.10+ 우수)'},
  // Pogo
  'pogo_rsi':     {test:'Pogo',label:'Pogo RSI', short:'Pogo RSI', unit:'m/s', goodKR: 2.4, mlb: 2.7, effect:'velo', priority:1, purpose:'⚾⚾ Fast SSC, FC reactive (구속 핵심)'},
  'pogo_ct':      {test:'Pogo',label:'Mean Contact Time', short:'Contact Time', unit:'ms', goodKR: 140, mlb: 130, effect:'cmd', priority:2, purpose:'🎯 Stiffness · 낮을수록 좋음 (제구)', lowerBetter: true},
  'pogo_jh':      {test:'Pogo',label:'Mean JH', short:'Pogo JH', unit:'cm', goodKR: 28, mlb: 32, effect:'velo', priority:3, purpose:'반응 점프 능력'},
  // IMTP
  'imtp_pf':      {test:'IMTP',label:'IMTP Peak Force', short:'IMTP PF', unit:'N', goodKR: 2400, mlb: 3000, effect:'velo', priority:3, purpose:'절대 최대힘 (체중 미보정)'},
  'imtp_pf_bm':   {test:'IMTP',label:'IMTP Peak Force / BM', short:'IMTP PF/BM', unit:'N/kg', goodKR: 28, mlb: 32, effect:'velo', priority:1, purpose:'⚾⚾ 상대 최대근력 (구속 핵심)'},
  'imtp_rfd':     {test:'IMTP',label:'IMTP RFD 0-100ms', short:'RFD 0-100', unit:'N/s', goodKR: 9000, mlb: 12000, effect:'velo', priority:1, purpose:'⚾⚾ 폭발적 힘 발현 (구속 최우선)'},
  'imtp_f100':    {test:'IMTP',label:'Force at 100ms / BM', short:'F@100ms', unit:'N/kg', goodKR: 23, mlb: 28, effect:'velo', priority:2, purpose:'Early acceleration'},
  'imtp_asym':    {test:'IMTP',label:'Asymmetry', short:'Asymmetry', unit:'%', goodKR: 5, mlb: 3, effect:'cmd_inj', priority:1, purpose:'🎯⚠ 좌우 균형 (제구·부상)', lowerBetter: true}
};

/**
 * v5.17: 체력 6각 라디아 (구속·제구 핵심 6 변인)
 *   - ⚾ 폭발 발현 (IMTP RFD 0-100ms) — 구속 핵심
 *   - ⚾ 최대 근력 (IMTP Peak Force / BM) — 구속 핵심
 *   - ⚾ 하지 폭발 (CMJ Peak Power / BM) — 구속 핵심
 *   - ⚾ 발 반응성 (Pogo RSI) — 구속 핵심
 *   - 🎯 접촉 효율 (Pogo Mean Contact Time) — 제구
 *   - ⚠ 좌우 균형 (IMTP Asymmetry) — 제구 + 부상
 */
function fitnessAxisDiagnosis(input){
  if(!input) return null;
  const M = FITNESS_VARIABLE_MAP;
  // VELO_GROUP_NORMS 기반 보간 (기존 cmj_pp_bm/imtp_pf_bm/hop_rsi/pp_peak_takeoff_bm은 그대로)
  // 그 외 변인은 한국 우수=75점, MLB=90점 보간 (단순화)
  function pctileScore(value, key){
    if(value == null || isNaN(value)) return null;
    const def = M[key]; if(!def) return null;
    const goodK = def.goodKR, mlb = def.mlb;
    if(goodK == null || mlb == null) return null;
    // lowerBetter: Asymmetry 같은 경우 (낮을수록 좋음)
    const lower = !!def.lowerBetter;
    if(lower){
      if(value <= mlb) return Math.min(100, 90 + (mlb - value) / mlb * 10);
      if(value >= goodK * 2) return 0;
      // mlb=3 → 90점, goodKR=5 → 75점, value=10 → 30점 정도
      return Math.round(Math.max(0, Math.min(100, 90 - (value - mlb) / (goodK - mlb) * 15 - Math.max(0, value - goodK) * 6)));
    }
    if(value >= mlb) return Math.round(Math.min(100, 90 + (value - mlb) / mlb * 10));
    if(value < goodK / 2) return 0;
    if(value < goodK) return Math.round(Math.max(0, 50 + (value - goodK) / goodK * 100));
    // goodK ≤ value < mlb → 75-90 점 보간
    return Math.round(75 + (value - goodK) / (mlb - goodK) * 15);
  }

  // v5.21: 6 핵심 변인 — 사용자 지정 라벨 (투수 직관 우선)
  const out = {
    rfd:        {label:'⚡ 힘 발휘 속도',          sub:'0.1초 안에 빠르게 힘 발휘',        short:'IMTP RFD 0-100ms',         value: input.imtp_rfd,      unit:'N/s',  goodKR: M.imtp_rfd.goodKR,    mlb: M.imtp_rfd.mlb,    score: pctileScore(input.imtp_rfd,    'imtp_rfd'),    effect:'⚾⚾ 구속 핵심', purpose: M.imtp_rfd.purpose},
    strength:   {label:'💪 최대 근력',             sub:'정적 최대 힘 (다리·체간)',         short:'IMTP Peak Force / BM',     value: input.imtp_pf_bm,    unit:'N/kg', goodKR: M.imtp_pf_bm.goodKR,  mlb: M.imtp_pf_bm.mlb,  score: pctileScore(input.imtp_pf_bm,  'imtp_pf_bm'),  effect:'⚾⚾ 구속 핵심', purpose: M.imtp_pf_bm.purpose},
    explosive:  {label:'🦵 점프 파워',             sub:'다리 폭발력 (마운드 박차기)',       short:'CMJ Peak Power / BM',      value: input.cmj_pp_bm,     unit:'W/kg', goodKR: M.cmj_pp_bm.goodKR,   mlb: M.cmj_pp_bm.mlb,   score: pctileScore(input.cmj_pp_bm,   'cmj_pp_bm'),   effect:'⚾⚾ 구속 핵심', purpose: M.cmj_pp_bm.purpose},
    reactive:   {label:'🦶 착지발 이용 능력',       sub:'앞발 착지 시 반발력 활용',         short:'Pogo RSI',                 value: input.pogo_rsi,      unit:'m/s',  goodKR: M.pogo_rsi.goodKR,    mlb: M.pogo_rsi.mlb,    score: pctileScore(input.pogo_rsi,    'pogo_rsi'),    effect:'⚾⚾ 구속 핵심', purpose: M.pogo_rsi.purpose},
    contact:    {label:'⏱ 짧은 시간에 힘 발휘 능력', sub:'발 접촉 시간 (↓ 좋음)',           short:'Pogo Mean Contact Time',   value: input.pogo_ct,       unit:'ms',   goodKR: M.pogo_ct.goodKR,     mlb: M.pogo_ct.mlb,     score: pctileScore(input.pogo_ct,     'pogo_ct'),     effect:'🎯 제구',       purpose: M.pogo_ct.purpose,     lowerBetter: true},
    asymmetry:  {label:'⚖️ 좌우 힘 차이',          sub:'좌·우 비대칭 (↓ 좋음)',           short:'IMTP Asymmetry',           value: input.imtp_asym,     unit:'%',    goodKR: M.imtp_asym.goodKR,   mlb: M.imtp_asym.mlb,   score: pctileScore(input.imtp_asym,   'imtp_asym'),   effect:'🎯⚠ 제구·부상', purpose: M.imtp_asym.purpose,   lowerBetter: true}
  };
  // 강점/약점 + 평균
  const arr = Object.entries(out).filter(([k,v]) => v.score != null).map(([k,v]) => ({k, ...v}));
  arr.sort((a,b) => b.score - a.score);
  const valid = arr.length;
  const avg = valid ? Math.round(arr.reduce((s,x) => s + x.score, 0) / valid) : null;
  out.summary = {
    avg_score: avg,
    strength: arr[0]?.label || '—',
    weakness: arr[valid-1]?.label || '—',
    n_valid: valid
  };
  return out;
}

/**
 * v5.22: 5축 메카닉 진단 — 선수/코치용 명확한 라벨
 *   1. 🌀 회전 속도 — 골반·몸통·팔 분절 가속 (ω peak)
 *   2. ⏱ 가속 순서 — proper sequence 시퀀싱 타이밍
 *   3. ✂️ 골반-상체 분리 — X-factor (분리각, 클수록 좋음)
 *   4. 💧 누수 회피 — ELI 6 zone 자세 결함 회피
 *   5. 🦶 지면반력 활용 — 축발 추진 + 앞발 블로킹 (LHEI)
 *
 *   reference: 본인 1 + 고교 상위 10% (75점 line) + MLB (90점 line)
 *
 * @param {object} input  메카닉 변수들 + GRF
 * @returns {object} 5축 점수 + 강약 진단
 */
function fiveAxisDiagnosis(input){
  const out = {};
  // 1. 회전 속도 — pelvis/trunk/arm ω 종합 percentile (아마 기준)
  const rp = [percentileVsRef(input.pelvis_dps, 'pelvis_dps','AMATEUR'),
              percentileVsRef(input.trunk_dps, 'trunk_dps','AMATEUR'),
              percentileVsRef(input.arm_dps,   'arm_dps',  'AMATEUR')].filter(x=>x!=null);
  out.rotation = {
    score: rp.length ? Math.round(rp.reduce((a,b)=>a+b,0)/rp.length) : null,
    label: '🌀 회전 속도',
    sub:   '골반·몸통·팔 분절 가속',
    detail:'pelvis ω + trunk ω + arm ω peak 종합'
  };
  // 2. 가속 순서 — speed gain 기반 timing
  let timingScore = null;
  if(input.speed_gain_pt != null){
    timingScore = Math.max(20, Math.min(98, 50 + (input.speed_gain_pt - 1.4) * 100));
  }
  out.sequencing = {
    score: timingScore != null ? Math.round(timingScore) : null,
    label: '⏱ 가속 순서',
    sub:   '골반→몸통→팔 순차 가속',
    detail:'speed gain (1.4 한국 median, 1.7 MLB)'
  };
  // 3. 골반-상체 분리 — X-factor + stride
  const sp = [percentileVsRef(input.x_factor, 'x_factor','AMATEUR'),
              percentileVsRef(input.stride_pct, 'stride_pct','AMATEUR')].filter(x=>x!=null);
  out.separation = {
    score: sp.length ? Math.round(sp.reduce((a,b)=>a+b,0)/sp.length) : null,
    label: '✂️ 골반-상체 분리',
    sub:   'X-factor (클수록 비축 에너지 큼)',
    detail:'X-factor 분리각 + stride length 활용'
  };
  // 4. 누수 회피 — ELI 6 zone (점수 ↑ = 누수 ↓)
  out.leakage = {
    score: input.eli_score != null ? Math.round(input.eli_score) : null,
    label: '💧 누수 회피',
    sub:   '6 zone 자세 결함 회피',
    detail:'lead leg block · trunk control · pelvis brake 등 6 zone'
  };
  // 5. 지면반력 활용 — LHEI (또는 GRF score)
  const grfScore = input.lhei ?? input.grf_score ?? null;
  out.grf = {
    score: grfScore != null ? Math.round(grfScore) : null,
    label: '🦶 지면반력 활용',
    sub:   '축발 추진 + 앞발 블로킹',
    detail:'LHEI (Lower-half Effectiveness Index) — Rear/Lead GRF 종합'
  };

  // 강점/약점
  const arr = ['rotation','sequencing','separation','leakage','grf']
    .map(k => ({k, ...out[k]})).filter(x => x.score != null)
    .sort((a,b) => b.score - a.score);
  out.strength = arr[0]?.label || '—';
  out.weakness = arr[arr.length-1]?.label || '—';
  out.avg_score = arr.length ? Math.round(arr.reduce((s,x)=>s+x.score,0)/arr.length) : null;
  return out;
}

// v5.12 호환 유지
function fourAxisDiagnosis(input){
  const out = {};
  // Power
  const pp = [percentileVsRef(input.pelvis_dps, 'pelvis_dps','AMATEUR'),
              percentileVsRef(input.trunk_dps, 'trunk_dps','AMATEUR'),
              percentileVsRef(input.arm_dps,   'arm_dps',  'AMATEUR')].filter(x=>x!=null);
  const ppPro = [percentileVsRef(input.pelvis_dps, 'pelvis_dps','PRO'),
                 percentileVsRef(input.trunk_dps, 'trunk_dps','PRO'),
                 percentileVsRef(input.arm_dps,   'arm_dps',  'PRO')].filter(x=>x!=null);
  out.power = {
    score: pp.length ? Math.round(pp.reduce((a,b)=>a+b,0)/pp.length) : null,
    pro:   ppPro.length ? Math.round(ppPro.reduce((a,b)=>a+b,0)/ppPro.length) : null,
    label: '⚡ 힘 (Power)',
    desc:  '분절 회전속도 종합 — 골반·몸통·팔'
  };
  // Separation
  const sp = [percentileVsRef(input.x_factor, 'x_factor','AMATEUR'),
              percentileVsRef(input.stride_pct, 'stride_pct','AMATEUR')].filter(x=>x!=null);
  const spPro = [percentileVsRef(input.x_factor, 'x_factor','PRO'),
                 percentileVsRef(input.stride_pct, 'stride_pct','PRO')].filter(x=>x!=null);
  out.separation = {
    score: sp.length ? Math.round(sp.reduce((a,b)=>a+b,0)/sp.length) : null,
    pro:   spPro.length ? Math.round(spPro.reduce((a,b)=>a+b,0)/spPro.length) : null,
    label: '✂️ 분리 (Separation)',
    desc:  'X-factor 분리 + stride 활용도'
  };
  // Timing — speed gain (proper sequence) 기반
  // speed_gain_pt 1.4 (한국 cohort median) 기준, 이상 1.7-2.0 (프로)
  // speed_gain_ta 5.4 (한국) ~ 4.5 (프로 — H/P 보면 프로가 trunk 큰 만큼 ta는 작음)
  let timingScore = null, timingPro = null;
  if(input.speed_gain_pt != null){
    timingScore = Math.max(20, Math.min(98, 50 + (input.speed_gain_pt - 1.4) * 100));
    timingPro   = Math.max(20, Math.min(98, 50 + (input.speed_gain_pt - 1.7) * 80));
  }
  out.timing = {
    score: timingScore != null ? Math.round(timingScore) : null,
    pro:   timingPro != null ? Math.round(timingPro) : null,
    label: '⏱ 타이밍 (Timing)',
    desc:  '분절 간 가속 비율 — 골반→몸통→팔 순차 가속'
  };
  // Stability — ELI score (기존 학술 정의 그대로)
  out.stability = {
    score: input.eli_score != null ? Math.round(input.eli_score) : null,
    pro:   input.eli_score != null ? Math.max(20, Math.round(input.eli_score - 5)) : null,    // 프로는 5점 더 엄격
    label: '🛡 안정성 (Stability)',
    desc:  '6 zone 자세 결함 회피 — 일관된 메카닉'
  };

  // 강점/약점 진단
  const arr = [
    {k:'power', v:out.power}, {k:'timing', v:out.timing},
    {k:'separation', v:out.separation}, {k:'stability', v:out.stability}
  ].filter(x=>x.v.score != null);
  arr.sort((a,b)=>b.v.score - a.v.score);
  out.strength = arr[0]?.v.label || '—';
  out.weakness = arr[arr.length-1]?.v.label || '—';
  return out;
}

/* v5.9: OpenBiomechanics playing-level 별 메카닉 reference (학술 standard)
 *   Driveline OBP 100명 cohort의 level별 trial median
 *   한국 cohort 별도 norm은 VELO_GROUP_NORMS 유지 (한국 고1/평균/우수/Elite)
 *   대시보드는 두 reference를 병행 표시 가능 — "한국 동급 vs OBP 학술 standard" */
const OBP_LEVEL_NORMS = {
  'HS': {     // High School (n=32 trial, 7명, 평균 128 km/h)
    pelvis_dps: 721, trunk_dps: 1032, arm_dps: 4419, x_factor: 35,
    elbow_velo: 2350, hp_ratio_pct: 1279, elbow_varus_moment: 94,
    velo_kmh_median: 128
  },
  'College': { // College (n=314 trial, 75명, 평균 137 km/h)
    pelvis_dps: 742, trunk_dps: 1051, arm_dps: 4571, x_factor: 32,
    elbow_velo: 2464, hp_ratio_pct: 1310, elbow_varus_moment: 110,
    velo_kmh_median: 137
  },
  'Indep': {   // Independent (n=42 trial, 12명, 평균 138 km/h)
    pelvis_dps: 804, trunk_dps: 1030, arm_dps: 4420, x_factor: 30,
    elbow_velo: 2444, hp_ratio_pct: 1126, elbow_varus_moment: 121,
    velo_kmh_median: 141
  },
  'MiLB': {    // Minor League (n=23 trial, 6명, 평균 144 km/h) — 진짜 elite
    pelvis_dps: 726, trunk_dps: 1120, arm_dps: 4388, x_factor: 39,
    elbow_velo: 2329, hp_ratio_pct: 1477, elbow_varus_moment: 134,
    velo_kmh_median: 144
  }
};

// 4-group 별 체력·메카닉 변수 평균 (59명 통합 기반 추정)
// 추후 측정 누적 시 자동 갱신
// v5.0: Driveline HP Assessment 6축 호환 — pp_peak_takeoff_bm 추가
// v5.8: 4축 능력 라디아 — 한국 12명 (138+) + 프로/대학 16명 = 28명 elite cohort 실측 기반
// v5.9: OBP MiLB 23 trial 추가로 transfer_score 재calibrate (n=51)
//   transferScoreV2 self-calc mode에서 OBP MiLB H/P 1477% → norm(1477, 1660, 0.0337) = 44 점
//   28명 한국+프로 elite mean 58과 평균하면 ~51 — 보수적으로 55 적용
//   다른 축들은 elite 실측 데이터 부족 — 학술 reference 추정 유지
const PRO_REFERENCE_4AXIS = {
  generation_score:  85,  // 출력 — Elite power 생성 (실측 데이터 부족 → 학술 추정 -3 보수)
  transfer_score:    55,  // v5.9 — 한국 28명 + OBP MiLB 23 trial 합본 평균 (재calibrated)
  eli_score:         85,  // 누수 — 자세 결함 부족 (학술 추정 -5 보수)
  command_composite: 75,  // 제구 — 프로도 stuff 우선 (학술 추정 -5 보수)
  label: '📊 Elite ref (n=51 · 한국 28 + OBP MiLB 23)'
};

// v5.8: pelvis_dps, trunk_dps, arm_dps, x_factor를 한국 41명 cohort 그룹별 median으로 교체
//   (이전 미국 Driveline 추정치와 패턴이 다름: 한국은 group간 ω 차이 작음, x_factor 절대값 낮음)
//   fitness 부분(cmj/imtp/hop/grip/pp)은 기존 추정 reference 유지 (별도 fitness cohort 데이터 필요)
//   GRF (lead_grf_bw, rear_grf_bw)도 기존 유지 (한국 GRF cohort 데이터 미수집)
const VELO_GROUP_NORMS = {
  '미달': {
    cmj_pp_bm: 22, cmj_jh_cm: 30, imtp_pf_bm: 22, hop_rsi: 1.8, grip_kg: 50,
    pp_peak_takeoff_bm: 7.5,
    pelvis_dps: 662, trunk_dps: 887, arm_dps: 4001, x_factor: 17,   // v5.8 한국 (n=2 — 외삽 주의)
    lead_grf_bw: 1.7, rear_grf_bw: 1.4
  },
  '평균': {
    cmj_pp_bm: 25, cmj_jh_cm: 33, imtp_pf_bm: 25, hop_rsi: 2.1, grip_kg: 55,
    pp_peak_takeoff_bm: 9.0,
    pelvis_dps: 593, trunk_dps: 842, arm_dps: 4347, x_factor: 31,   // v5.8 한국 (n=9)
    lead_grf_bw: 1.95, rear_grf_bw: 1.55
  },
  '우수': {
    cmj_pp_bm: 28, cmj_jh_cm: 36, imtp_pf_bm: 28, hop_rsi: 2.4, grip_kg: 60,
    pp_peak_takeoff_bm: 10.5,
    pelvis_dps: 634, trunk_dps: 887, arm_dps: 4166, x_factor: 26,   // v5.8 한국 (n=18)
    lead_grf_bw: 2.15, rear_grf_bw: 1.65
  },
  'Elite': {
    cmj_pp_bm: 32, cmj_jh_cm: 40, imtp_pf_bm: 32, hop_rsi: 2.7, grip_kg: 65,
    pp_peak_takeoff_bm: 12.0,
    pelvis_dps: 633, trunk_dps: 867, arm_dps: 4376, x_factor: 30,   // v5.8 한국 (n=12)
    lead_grf_bw: 2.35, rear_grf_bw: 1.75
  }
};

/* ────────────────────────────────────────────────────────────
   Predicted Velo (체력만 예측) — Driveline HP Assessment 모방

   회귀: velocity ~ height + weight + cmj_pp_bm + imtp_pf_bm + hop_rsi + grip
   이건 실측 누적 시 자체 fit 권장. 현재는 변수별 baseline + 가중치
   ──────────────────────────────────────────────────────────── */

const PHYSICAL_VELO_MODEL = {
  // v4.3-A: intercept 보정 — default 값 입력 시 한국 elite mean (134 km/h) 도달
  // 역산: 134 = intercept + 18.3 + 6.88 + 10.8 + 8.1 + 9.6 + 8.7 → intercept = 71.6
  intercept: 71.6,
  coefs: {
    height_cm:    0.10,    // 1cm = +0.1 km/h
    weight_kg:    0.08,
    cmj_pp_bm:    0.40,
    imtp_pf_bm:   0.30,
    hop_rsi:      4.0,
    grip_kg:      0.15
  },
  defaults: {  // 59명 cohort mean
    height_cm: 183, weight_kg: 86,
    cmj_pp_bm: 27, imtp_pf_bm: 27, hop_rsi: 2.4, grip_kg: 58
  },
  // v4.3-A: 비현실 cap (한국 고교 elite 분포 기준)
  cap_min: 110,  // 미달 그룹 최저
  cap_max: 145,  // 41명 elite max=145.4
  note: 'Driveline HP Assessment 스타일 — 체력+신체만으로 구속 baseline 산출. Cap 110~145 km/h.'
};

/**
 * 체력+신체만으로 구속 예측 (Predicted Velo)
 * @returns {{predicted_kmh, group, contributors}}
 */
function predictedVelocity(input = {}){
  const m = PHYSICAL_VELO_MODEL;
  let pred = m.intercept;
  const contributors = [];
  for(const [k, c] of Object.entries(m.coefs)){
    const v = input[k] != null && !isNaN(input[k]) ? input[k] : m.defaults[k];
    const contribution = c * v;
    pred += contribution;
    contributors.push({ var: k, value: v, contribution: Math.round(contribution*10)/10 });
  }
  // v4.3-A: 비현실 cap 적용
  const raw = pred;
  let capped = false;
  if(pred < m.cap_min) { pred = m.cap_min; capped = 'min'; }
  if(pred > m.cap_max) { pred = m.cap_max; capped = 'max'; }
  return {
    predicted_kmh: Math.round(pred*10)/10,
    raw_predicted_kmh: Math.round(raw*10)/10,
    capped,
    group: veloGroup(pred),
    contributors: contributors.sort((a,b)=>b.contribution-a.contribution),
    source: m.note
  };
}

/**
 * AE (Above Expected) — 메카닉 효율 점수
 * @param {number} measured_kmh  실측 구속
 * @param {number} predicted_kmh  체력 baseline
 * @returns {{ae_kmh, label, description}}
 */
function aboveExpected(measured_kmh, predicted_kmh){
  if(measured_kmh == null || predicted_kmh == null) return null;
  const ae = Math.round((measured_kmh - predicted_kmh) * 10) / 10;
  let label, description;
  if(ae >= 3){
    label = '★ 메카닉 우수';
    description = `체력 ${predicted_kmh} → 실측 ${measured_kmh} (메카닉으로 +${ae} 추가)`;
  } else if(ae >= -3){
    label = '● 적정';
    description = `체력만큼 발현 (${ae >= 0 ? '+' : ''}${ae} km/h)`;
  } else {
    label = '⚠ 메카닉 발달 여지';
    description = `체력 ${predicted_kmh} 잠재력 대비 실측 ${measured_kmh} (${ae} km/h 미발현)`;
  }
  return { ae_kmh: ae, label, description, measured_kmh, predicted_kmh };
}

/* ────────────────────────────────────────────────────────────
   Per 1 km/h Effect Size (Driveline 스타일)

   각 변수의 1 km/h 향상에 필요한 변화량 — 실용적 importance
   ──────────────────────────────────────────────────────────── */

const PER_1KMH_TARGETS = {
  // 메카닉 변수
  pelvis_peak_dps:  { unit: 'deg/s', per_1kmh: 100, label: 'Pelvis peak velocity' },
  trunk_peak_dps:   { unit: 'deg/s', per_1kmh: 70,  label: 'Trunk peak velocity' },
  x_factor_max_deg: { unit: '°',     per_1kmh: 5,   label: 'X-factor (분리각)' },
  lead_knee_ext:    { unit: '°',     per_1kmh: 5,   label: 'Lead knee extension' },
  stride_pct:       { unit: '%',     per_1kmh: 3,   label: 'Stride / 신장' },
  // 체력 변수 (실용적 단위)
  cmj_jh_cm:        { unit: 'cm',    per_1kmh: 2.5, label: 'CMJ Jump Height' },
  cmj_pp_bm:        { unit: 'W/kg',  per_1kmh: 2.5, label: 'CMJ Peak Power/BM' },
  imtp_pf_bm:       { unit: 'N/kg',  per_1kmh: 3.3, label: 'IMTP Force/BM' },
  hop_rsi:          { unit: '',      per_1kmh: 0.25,label: 'Hop RSI' },
  grip_kg:          { unit: 'kg',    per_1kmh: 6.7, label: 'Grip Strength' },
  // 자세
  trunk_lateral_tilt:{ unit: '°',    per_1kmh: 7,   label: 'Trunk lateral tilt (역방향)' },
};

function per1kmhRecommendation(varKey, currentValue, targetGroup = 'Elite'){
  const t = PER_1KMH_TARGETS[varKey];
  if(!t) return null;
  const target = VELO_GROUP_NORMS[targetGroup]?.[varKey];
  if(target == null) return null;
  const gap = target - currentValue;
  const km_h_potential = gap / t.per_1kmh;
  return {
    var: varKey, label: t.label, current: currentValue,
    target_value: target, target_group: targetGroup,
    gap, per_1kmh: t.per_1kmh,
    km_h_potential: Math.round(km_h_potential * 10) / 10,
    description: `${currentValue}${t.unit} → ${target}${t.unit} (${targetGroup}) = ${km_h_potential>=0?'+':''}${km_h_potential.toFixed(1)} km/h`
  };
}

/* ────────────────────────────────────────────────────────────
   Combined Diagnosis — "체력 한계 vs 메카닉 비효율" 자동 진단
   ──────────────────────────────────────────────────────────── */

function combinedDiagnosis(measured_kmh, predicted_velo_obj, ae_obj){
  if(!measured_kmh || !predicted_velo_obj || !ae_obj) return null;
  const physical_pct = veloGroup(predicted_velo_obj.predicted_kmh);
  const measured_pct = veloGroup(measured_kmh);
  const ae = ae_obj.ae_kmh;

  let primary_finding, recommendation;
  if(physical_pct === '미달' && ae >= 3){
    primary_finding = '체력이 가장 큰 ceiling — 체력 발달이 가장 큰 효과';
    recommendation = 'CMJ 파워, IMTP 힘, Hop RSI 향상 우선. 메카닉은 이미 효율 우수.';
  } else if(ae < -3){
    primary_finding = '메카닉 비효율로 체력 잠재력 미발현';
    recommendation = `${Math.abs(ae)} km/h 만큼 메카닉 교정 잠재력. ELI 인과 chain Top 3 즉시 적용.`;
  } else if(ae >= 3 && physical_pct !== 'Elite'){
    primary_finding = '메카닉 효율 우수 — 다음 ceiling 은 체력';
    recommendation = '체력 발달 (CMJ·IMTP·Hop) 시 추가 구속 발현 가능.';
  } else if(physical_pct === 'Elite' && measured_pct === 'Elite'){
    primary_finding = '체력 + 메카닉 모두 Elite — 미세 조정만 남음';
    recommendation = '인과 chain 최약점 1~2개 zone 미세 교정.';
  } else {
    primary_finding = '균형 — 체력·메카닉 동시 발달 권장';
    recommendation = '두 영역 병행 훈련.';
  }
  return {
    measured_kmh, measured_group: measured_pct,
    predicted_kmh: predicted_velo_obj.predicted_kmh, predicted_group: physical_pct,
    ae_kmh: ae, ae_label: ae_obj.label,
    primary_finding, recommendation
  };
}

/* ────────────────────────────────────────────────────────────
   v3.9: KR_VELO_MODEL — 한국 고교 elite 자체 회귀 모델
   출처: 41명 (raw data) + 18명 (Accurate_Data) = 59명 통합 OLS
   - 학습 R² = 0.073
   - LOO-CV R² = -0.159 (음수 — range restriction)

   ⚠ 한계: 신체+메카닉만으로 elite cohort 안의 ranking 어려움
       (모든 선수가 비슷한 신체·메카닉 — 변동이 작음)
       Pearson r=0.27 은 약한 신호. 추가 변수 (timing, technique)
       또는 더 큰 cohort 필요.
   사용 의도: 측정 표준값 reference 만, ranking 보조 X
   ──────────────────────────────────────────────────────────── */

const KR_VELO_MODEL = {
  intercept: 97.60,
  coefs: {
    pelvis_peak_dps:    0.00206,    // 0.206 km/h per +100 deg/s
    trunk_peak_dps:    -0.00063,    // 매우 작음 (effectively 0)
    x_factor_max_deg:  -0.09199,    // ★ 음수 (elite cohort range restriction artifact)
    height_cm:          0.20959,    // 0.21 km/h per +1cm
    weight_kg:          0.00533     // 매우 작음
  },
  defaults: {  // 59명 cohort mean
    pelvis_peak_dps:    621.2,
    trunk_peak_dps:     884.2,
    x_factor_max_deg:   31.2,
    height_cm:          183.1,
    weight_kg:          86.1
  },
  R2: 0.073, R2_loo: -0.159, n: 57,
  source: '한국 고1 elite 통합 (41명 raw_data + 18명 Accurate_Data, 2025-2026)',
  warning: 'elite cohort range restriction — ranking 능력 약함 (Pearson r=0.27). reference 용도로만 사용.'
};

/**
 * 한국 cohort 자체 회귀로 max velocity 예측 (참고용)
 * @returns {{predicted_kmh, contributors, R2, warning}}
 */
function predictMaxVelocityKR(input = {}){
  const m = KR_VELO_MODEL;
  let pred = m.intercept;
  const contributors = [];
  for(const [k, c] of Object.entries(m.coefs)){
    const v = input[k] != null && !isNaN(input[k]) ? input[k] : m.defaults[k];
    const contribution = c * v;
    pred += contribution;
    contributors.push({ var: k, value: v, coef: c, contribution: Math.round(contribution*10)/10 });
  }
  return {
    predicted_kmh: Math.round(pred*10)/10,
    contributors: contributors.sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)),
    source: m.source, R2: m.R2, R2_loo: m.R2_loo, n: m.n,
    warning: m.warning
  };
}

