// ════════════════════════════════════════════════════════
//  helpers.js — 공용 글로벌 상태 + 헬퍼 함수
//  모든 다른 모듈이 의존하는 base. 가장 먼저 로드.
// ════════════════════════════════════════════════════════

// ─── 글로벌 상태 ───
let WIN = null;                  // dashboard.html (iframe contentWindow)
let CURRENT_PID = null;          // 선수별 탭 현재 선수
let CURRENT_TREND_PID = null;    // 장기 추적 탭 현재 선수
let CURRENT_TAB = 'team';        // 현재 활성 탭

// ─── DOM 헬퍼 ───
function $(id){ return document.getElementById(id); }

// ─── Driveline 5 모델 진단 (iframe 의 ANALYTICS 호출) ───
function computeDvl5(p, m){
  const A = WIN?.ANALYTICS;
  if(!A?.drivelineFiveModelDiagnosis) return null;
  return A.drivelineFiveModelDiagnosis({
    shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
    peak_shoulder_v: m.sequence?.peak_shoulder_v,
    peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
    arm_dps:         m.sequence?.arm_dps,
    shoulder_abd_fp_deg:    m.faults?.shoulder_abd_fp_deg,
    scap_load_fp_deg:       m.faults?.scap_load_fp_deg,
    elbow_flex_fp_deg:      m.faults?.elbow_flex_fp_deg,
    x_factor:               m.faults?.x_factor_deg,
    trunk_forward_tilt:     m.faults?.trunk_tilt_at_fc_deg,
    trunk_lateral_tilt:     m.faults?.trunk_lat_tilt_deg,
    torso_counter_rot_deg:  m.faults?.torso_counter_rot_deg,
    torso_rot_fp_deg:       m.faults?.torso_rot_fp_deg,
    torso_rot_br_deg:       m.faults?.torso_rot_br_deg,
    trunk_dps:  m.sequence?.trunk_dps,
    pelvis_dps: m.sequence?.pelvis_dps,
    lead_knee_change:   m.faults?.lead_knee_change,
    stride_length:      m.faults?.stride_length_m,
    lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
    cog_decel:    m.cog?.decel,
    cog_decel_ae: m.cog?.decel_ae,
    max_cog_velo: m.cog?.max_velo
  });
}

// ─── 5 모델 점수 → composite (단순 평균) ───
function compositeScore(dvl5){
  if(!dvl5) return 0;
  const scores = ['arm_action','posture','rotation','block','cog']
    .map(k => dvl5[k]?.score).filter(s => s != null);
  return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
}

// ─── 점수 → 등급 (Driveline 표준) ───
function gradeOf(s){
  return s >= 110 ? {cls:'elite', lbl:'Elite+'} :
         s >= 90  ? {cls:'elite', lbl:'Elite'}  :
         s >= 70  ? {cls:'above', lbl:'Above'}  :
         s >= 50  ? {cls:'avg',   lbl:'Avg'}    :
         s >= 30  ? {cls:'below', lbl:'Below'}  :
                    {cls:'poor',  lbl:'Poor'};
}

// ─── 5 모델 한국어 라벨 ───
function modelLbl(k){
  return ({arm_action:'팔동작', posture:'자세', rotation:'회전 속도', block:'앞다리 제동', cog:'체중이동'})[k] || k;
}

// ─── 단위 부착 숫자 표시 ───
function formatVal(v, unit){
  if(v == null) return '—';
  if(unit === 'm/s') return v.toFixed(2);
  return Math.round(v) + (unit ? ' ' + unit : '');
}

// ─── hex → rgba (alpha 반투명) ───
function hex2rgba(h, a){
  const r = parseInt(h.slice(1,3),16),
        g = parseInt(h.slice(3,5),16),
        b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
