// ════════════════════════════════════════════════════════
//  variable-info.js — 변인 사전 + 처방 매핑 + computeTop3
//
//  VAR_INFO  : 20개 메카닉 변인의 정의/의미/cue/관찰 포인트
//  ETE_INFO  : 4개 분절간 transition lag 정보
//  RX_MAP    : 변인별 drill 처방 매핑
//  ETE_RX    : transition 별 처방 매핑
//  computeTop3: 가장 시급한 3개 변인 산출 (구속 손실 큰 순)
//
//  의존: helpers.js (modelLbl, WIN)
// ════════════════════════════════════════════════════════

const VAR_INFO = {
  'Layback (어깨 최대 외회전)':{
    def:'스트라이드 후 어깨가 최대로 뒤로 젖혀지는 외회전 각도',
    why:'클수록 sling-shot 효과 ↑ → 구속 ↑. 단 220° 초과 시 회전근개 과부하.',
    cue:'"공을 잡은 손이 머리 뒤까지 뒤로 떨어진다" — Layback 끝까지 가져가라',
    observe:'옆에서 보면 위팔이 어깨 라인 뒤로 넘어가는지. 90° 외전 + 충분한 외회전.'
  },
  'Elbow Extension Velo':{
    def:'팔꿈치 신전(펴짐) peak 각속도',
    why:'너무 이른 신전 = valgus stress ↑ (Tommy John). MER 직후 신전이 이상적.',
    cue:'"팔꿈치를 미리 펴지 말고 마지막 순간에 채라"',
    observe:'슬로우 모션에서 MER(최대 외회전) 시점에도 팔꿈치가 굽혀져 있는지.'
  },
  'Shoulder Abduction at FP':{
    def:'앞발 착지(FP) 시점 어깨 외전 각도',
    why:'90° ± 10° 정상. 너무 낮으면 sidearm → 부상 ↑. 너무 높으면 release 불안정.',
    cue:'"앞발 닿는 순간, 위팔이 어깨 높이에 — Y자가 아니라 T자 모양"',
    observe:'정면에서 본 FP 시점 위팔 라인이 수평인지.'
  },
  'Scap Load at FP':{
    def:'FP 시점 견갑(scapula) 후방 retraction 각도',
    why:'클수록 견갑 안정 + 광배 활성 → 구속 ↑. 작으면 라운드 숄더 → release 약화.',
    cue:'"등 뒤에서 어깨뼈 두 개가 만나도록 모았다가 던진다"',
    observe:'뒤에서 본 FP 시점 견갑이 척추쪽으로 모여있는지 (날개뼈 retraction).'
  },
  'Shoulder Rotation Velo':{
    def:'어깨 내회전 peak 각속도. 팔동작의 최종 explosive 단계.',
    why:'4,500+ deg/s = elite. Layback 충분 + explosive IR transition 이 핵심.',
    cue:'"채찍처럼 — 팔을 던지지 말고 손목을 채라"',
    observe:'Release 직전 위팔의 폭발적 내회전. 팔꿈치 위치는 고정, 손이 가속.'
  },
  'Elbow Flexion at FP':{
    def:'FP 시점 팔꿈치 굴곡 각도',
    why:'90~110° 정상. 90° 미만 = inverted W (부상). 130° 초과 = 너무 굽힘 (구속 손실).',
    cue:'"팔꿈치는 직각보다 살짝 더 굽혀 — 90~100° 사이"',
    observe:'FP 시점 팔꿈치가 직각 근처인지. L자보다 살짝 더 닫힌 V자.'
  },
  'Peak Hip-Shoulder Sep at FP (X-factor)':{
    def:'골반-몸통 최대 분리각 (X-factor)',
    why:'클수록 stretch-reflex ↑ → 구속 ↑. 30° 미만 = 분리 부족.',
    cue:'"골반은 먼저 홈쪽으로, 어깨는 끝까지 닫아둬라"',
    observe:'위에서 본 골반 라인과 어깨 라인의 어긋남 — 골반이 먼저 열린다.'
  },
  'Peak Torso Counter Rot':{
    def:'와인드업 시점 몸통 반대(3루) 회전 최대',
    why:'깊을수록 회전 거리 ↑ → torque ↑. 0° 근처 = under-rotation.',
    cue:'"등판이 타자한테 보이게 — 몸통을 더 감아라"',
    observe:'와인드업 정점에서 등이 타자에게 얼마나 보이는지.'
  },
  'Torso Forward Tilt at FP':{
    def:'FP 시점 시상면 trunk 전방 기울기',
    why:'+5° ± 5° 정상. 음수(standing tall) = 구속 손실. 너무 양수 = collapse.',
    cue:'"앞발 닿을 때 가슴은 살짝 앞으로 — 서있지 말고 앞으로 기대"',
    observe:'옆에서 본 FP 시점 trunk 가 약간 앞으로 기울어있는지.'
  },
  'Torso Rotation at FP':{
    def:'FP 시점 trunk Z (수평면 회전)',
    why:'Closed (0° 근처) = 회전 여지 큼 → 구속 ↑. Early opening = 구속 손실.',
    cue:'"앞발 닿을 때까지 가슴을 닫아둬 — 어깨 마지막에 열려라"',
    observe:'FP 시점 가슴이 타자를 향해 너무 일찍 열렸는지.'
  },
  'Torso Rotation at BR':{
    def:'Release 시점 trunk Z. 110°+ = full follow-through.',
    why:'90° 미만 = 회전 부족 (early stop). 110° 초과 = 완전 follow-through.',
    cue:'"끝까지 회전해라 — 글러브가 오른쪽 무릎(좌투는 왼쪽)까지 와야 한다"',
    observe:'follow-through 후 가슴이 1루 방향까지 회전했는지.'
  },
  'Torso Side Bend at MER':{
    def:'MER 시점 contralateral side bend (반대측 옆굴곡)',
    why:'20~30° 정상 — high arm slot 유지. 0° 근처 = sidearm.',
    cue:'"릴리스 직전 머리를 글러브쪽으로 — 몸통이 옆으로 기울게"',
    observe:'release 시점 머리가 글러브쪽으로 기울었는지 (overhand 일수록 큼).'
  },
  'Pelvis Rotation Velo':{
    def:'골반 axial peak 각속도. Kinetic chain 의 시작.',
    why:'600+ deg/s = elite. 골반이 빨라야 분절 카스케이드 효율.',
    cue:'"하체부터 회전 시작 — 골반이 어깨를 끌어가라"',
    observe:'골반이 먼저 열리고 어깨가 따라오는지.'
  },
  'Torso Rotation Velo':{
    def:'몸통 axial peak 각속도. 골반의 ~1.6× 가 정상.',
    why:'Speed Gain (Trunk/Pelvis) = 1.4~2.0 elite range.',
    cue:'"골반이 멈추는 순간 가슴이 폭발적으로 회전"',
    observe:'골반 회전이 멈춘 후 몸통이 가속되는 분리감.'
  },
  'Lead Knee Extension':{
    def:'앞발 무릎의 FC → BR 간 신전(펴짐) 변화량',
    why:'양수(신전) = good block. 음수(knee collapse) = 구속 손실 + 부상 위험.',
    cue:'"앞발 무릎을 펴면서 던져라 — 무릎이 무너지면 안된다"',
    observe:'옆에서 본 FP→BR 간 무릎이 펴지는지, 굽혀지는지.'
  },
  'Stride Length':{
    def:'Drive foot ↔ Lead foot 수평 거리 (FP 시점)',
    why:'신장의 80~100% = elite. 너무 짧으면 추진력 부족, 너무 길면 lead leg overload.',
    cue:'"보폭을 키 만큼 — 한 걸음 더 멀리 던진다고 생각해"',
    observe:'발자국 거리가 키와 비슷한지. 시각적으로 확인 가능.'
  },
  'CoG Decel AE':{
    def:'CoG 감속의 회귀 잔차. 구속 통제 후 lead leg 추가 효율.',
    why:'양수 = 구속 대비 우수 block. 음수 = block 효율 부족.',
    cue:'"앞발이 닿는 순간 벽에 부딪힌 듯 멈춰라 — 회전만 가속"',
    observe:'FP 후 몸통이 앞으로 더 나가는지, 그 자리에서 회전만 하는지.'
  },
  'Peak Lead Knee Ext Velo':{
    def:'앞발 무릎 신전 peak 각속도',
    why:'빠를수록 explosive block → trunk 회전 가속 ↑.',
    cue:'"앞발이 땅을 차고 일어선다는 느낌 — 무릎을 빠르게 펴라"',
    observe:'FP 직후 앞다리가 폭발적으로 펴지는 속도.'
  },
  'CoG Decel':{
    def:'CoG peak velocity 대비 BR 시점 감속량',
    why:'클수록 효과적 block (운동량 → 회전 변환). 작으면 lead leg 추진 약함.',
    cue:'"앞으로 나가던 몸을 앞다리로 멈춰서 — 그 힘으로 채라"',
    observe:'release 시점 몸통이 앞으로 더 흘러가는지, 멈추는지.'
  },
  'Max CoG Velo':{
    def:'몸 전체 무게중심의 홈 방향 peak 속도',
    why:'빠를수록 stride 단계 추진력 ↑. 1.5 m/s 미만 = 추진 부족.',
    cue:'"뒷발로 마운드를 차고 — 몸 전체를 홈쪽으로 던져라"',
    observe:'와인드업 후 holding 없이 곧바로 강한 추진이 있는지.'
  }
};

const ETE_INFO = {
  'pelvis_to_trunk':{
    def:'골반 peak ω → 몸통 peak ω 시간 차',
    why:'정상: 골반 먼저, 몸통 늦게(5~25ms). 음수=역전, 구속 손실.',
    cue:'"하체 회전을 먼저 끝내고 가슴을 따라가게 — 동시에 가지 마라"',
    observe:'골반 회전이 명확히 먼저 시작되는지.'
  },
  'trunk_to_humerus':{
    def:'몸통 peak ω → 위팔 peak ω 시간 차',
    why:'클수록 stretch-reflex 활용. 너무 짧으면 동시 발화 (속도 손실).',
    cue:'"몸통이 회전하는 동안 팔은 뒤에 남아있어라 — Layback 유지"',
    observe:'몸통 회전 중 위팔이 뒤로 끌려가는 모양인지.'
  },
  'humerus_to_forearm':{
    def:'위팔 peak ω → 아래팔 peak ω 시간 차',
    why:'너무 짧으면 너무 이른 elbow 신전 → valgus stress ↑.',
    cue:'"팔꿈치는 마지막에 펴라 — 위팔 가속 끝나고 채라"',
    observe:'슬로우에서 elbow 신전이 늦게 일어나는지.'
  },
  'forearm_to_hand':{
    def:'아래팔 peak ω → 손 peak ω 시간 차',
    why:'손이 마지막 가속 단계. 역전 시 release 약화.',
    cue:'"손목을 마지막 순간에 채라 — 손가락 끝까지 가속"',
    observe:'release 직전 손목 스냅이 살아있는지.'
  }
};

const RX_MAP = {
  'Layback (어깨 최대 외회전)':'어깨 모빌리티 (sleeper stretch) · long-toss · plyo-ball Layback drill',
  'Shoulder Abduction at FP':'어깨 셋업 단계에서 외전 90° 유지 · scap retraction throw',
  'Scap Load at FP':'광배·후면삼각근 강화 · scap retraction throw drill',
  'Shoulder Rotation Velo':'Layback 후 explosive 외→내회전 plyo throw · ball weight 진행',
  'Peak Hip-Shoulder Sep at FP (X-factor)':'골반-몸통 분리 강조 throw · medball rotational throw',
  'Peak Torso Counter Rot':'와인드업 시 몸통 반대 회전 강조 · stride 시 어깨 잔류 cueing',
  'Torso Forward Tilt at FP':'FP 시점 trunk forward tilt 만들기 — front leg block + 코어 stability drill',
  'Torso Rotation at FP':'FP closed posture 유지 → release 직전 폭발적 회전',
  'Torso Rotation at BR':'follow-through trunk 회전 끝까지 (홈쪽 110°+)',
  'Torso Side Bend at MER':'release 직전 contralateral side bend drill',
  'Torso Rotation Velo':'medball rotational throw (heavy → light) · 코어 power',
  'Pelvis Rotation Velo':'골반 가속 drill (markerless 보정 caveat)',
  'Lead Knee Extension':'앞발 착지 후 knee 신전 강조 · RDL · lateral squat',
  'Stride Length':'Stride 거리 점진 증가 (체중 90%+ 권장) · towel drill',
  'CoG Decel AE':'앞발 block + 골반 braking 통합 drill',
  'Peak Lead Knee Ext Velo':'single leg jumping · 앞발 explosive block',
  'CoG Decel':'Lead leg AP impulse 18-28 %BW·s 목표 · 앞발 block + 골반 braking 통합',
  'Max CoG Velo':'explosive stride drill, KB swing'
};

const ETE_RX = {
  'pelvis_to_trunk':'골반→몸통 lag 보정 — 골반 단독 회전 후 몸통 따라가기 drill',
  'trunk_to_humerus':'몸통→위팔 lag 보정 — Layback 유지 → 폭발적 내회전 plyo',
  'humerus_to_forearm':'위팔→아래팔 — 너무 이른 elbow 신전 방지 (valgus stress ↑)',
  'forearm_to_hand':'아래팔→손 — release 시점 손 가속 cueing (towel drill)'
};

// ── Top 3 후보 산출 헬퍼 ──
function infoFor(c){
  if(c.type === 'ete') return ETE_INFO[c.model||''] || null;
  return VAR_INFO[c.var_lbl] || null;
}

function diagnosisFor(c){
  if(c.elite == null || c.value == null) return null;
  const diff = c.value - c.elite;
  const absPct = Math.abs(diff/c.elite*100);
  const dir = diff < 0 ? '부족' : '초과';
  const sev = absPct >= 30 ? '큰' : absPct >= 15 ? '중간' : '작은';
  return `Elite 기준 대비 <b>${Math.abs(diff).toFixed(diff%1?1:0)}${c.unit||''}</b> ${dir} (<b>${absPct.toFixed(0)}% ${sev} gap</b>) → 잠재 구속 <b>${c.loss.toFixed(1)} km/h</b> 손실로 환산.`;
}

function drillFor(c){
  if(c.type === 'ete') return ETE_RX[c.model||''] || '해당 분절 transition 강화';
  return RX_MAP[c.var_lbl] || c.var_lbl + ' 강화 drill';
}

// ── 가장 시급한 3개 변인 ──
function computeTop3(dvl5, m){
  if(!dvl5) return [];
  const candidates = [];
  ['arm_action','posture','rotation','block','cog'].forEach(mk => {
    const md = dvl5[mk]; if(!md || !md.metrics) return;
    Object.values(md.metrics).forEach(mt => {
      if(mt.value == null || mt.median_elite == null || !mt.per_1mph) return;
      const diff_kmh = (mt.value - mt.median_elite) / mt.per_1mph * 1.609;
      if(diff_kmh < 0 && mt.importance === 'high'){
        candidates.push({type:'driveline', model_lbl:modelLbl(mk), var_lbl:mt.label, value:mt.value, elite:mt.median_elite, unit:mt.unit||'', loss:Math.abs(diff_kmh)});
      }
    });
  });
  if(WIN.segmentTransitionETE){
    const trans = WIN.segmentTransitionETE({
      peak_pelvis_v: m.sequence?.pelvis_dps,
      peak_trunk_v:  m.sequence?.trunk_dps,
      peak_humerus_v:m.sequence?.arm_dps,
      peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
      peak_hand_v:    m.sequence?.peak_hand_v ?? m.energy?.transfer?.peak_forearm_v,
      pelvis_to_trunk_lag_ms:    m.energy?.transfer?.pelvis_to_trunk_lag_ms,
      trunk_to_humerus_lag_ms:   m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
      humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
      forearm_to_hand_lag_ms:    m.energy?.transfer?.forearm_to_hand_lag_ms
    });
    if(trans){
      ['pelvis_to_trunk','trunk_to_humerus','humerus_to_forearm','forearm_to_hand'].forEach(k => {
        const t = trans[k]; if(!t || t.score == null || t.score >= 95) return;
        const loss = (100 - t.score) * 0.06;
        candidates.push({type:'ete', model:k, model_lbl:'분절간 흐름', var_lbl:t.label_kr || k, value:t.score, elite:100, unit:'점', loss});
      });
    }
  }
  candidates.sort((a,b) => b.loss - a.loss);
  return candidates.slice(0, 3);
}
