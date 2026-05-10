#!/usr/bin/env node
/**
 * V3D c3d.txt → 대시보드 직접 업로드 매뉴얼
 * 목적: 후작업 (컬럼명 변경, 단위 변환, 좌표계 회전, 부호 반전 등) 없이
 *      v3d export 결과물을 곧바로 https://kkl0511.github.io/Dashboard_Pitching_Team 에 업로드
 *      → 자동으로 5 모델 라디아·시퀀스·GRF·에너지 손실 Top 3 산출
 */
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');
const fs = require('fs');

const COLOR = {
  primary: '1F3864', accent: '2E75B6', muted: '656D76',
  good: '1A7F37', warn: 'BC4C00', bad: 'CF222E',
  panel: 'F6F8FA', panel2: 'EFF3F8', line: 'D0D7DE',
  required: 'CF222E', optional: '656D76'
};
const FONT = 'Malgun Gothic';
const SZ = { body:18, small:16, tiny:14, h1:26, h2:22, h3:20, h4:18 };

function p(text, opts={}){
  const runs = Array.isArray(text) ? text : [{text}];
  return new Paragraph({
    spacing: opts.spacing ?? {after: 100},
    alignment: opts.align ?? AlignmentType.LEFT,
    indent: opts.indent,
    ...opts.props,
    children: runs.map(r => new TextRun({
      text: r.text, bold: r.bold, italics: r.italic, color: r.color,
      size: r.size ?? SZ.body, font: FONT
    }))
  });
}
function h1(text){ return p(text, {props:{heading: HeadingLevel.HEADING_1}}); }
function h2(text){ return p(text, {props:{heading: HeadingLevel.HEADING_2}}); }
function h3(text){ return p(text, {props:{heading: HeadingLevel.HEADING_3}}); }

function bullet(text, level=0, color){
  return new Paragraph({
    numbering: {reference: 'bullets', level},
    spacing: {after: 60},
    children: [new TextRun({text, color, size: SZ.body, font: FONT})]
  });
}
function num(text, level=0){
  return new Paragraph({
    numbering: {reference: 'numbers', level},
    spacing: {after: 60},
    children: [new TextRun({text, size: SZ.body, font: FONT})]
  });
}
function note(text, color=COLOR.warn){
  return new Paragraph({
    spacing: {before: 80, after: 100},
    border: {left: {style: BorderStyle.SINGLE, size: 24, color, space: 8}},
    indent: {left: 200},
    children: [new TextRun({text, size: SZ.small, italics: true, color, font: FONT})]
  });
}
function code(text){
  return new Paragraph({
    spacing: {before: 30, after: 30},
    shading: {fill: COLOR.panel, type: ShadingType.CLEAR},
    indent: {left: 200, right: 100},
    children: [new TextRun({text, size: SZ.small, font: 'Consolas', color: '24292F'})]
  });
}

const border = {style: BorderStyle.SINGLE, size: 1, color: COLOR.line};
const borders = {top:border, bottom:border, left:border, right:border};
function cell(text, opts={}){
  const txt = Array.isArray(text) ? text : [{text}];
  return new TableCell({
    borders,
    width: {size: opts.w, type: WidthType.DXA},
    shading: opts.bg ? {fill: opts.bg, type: ShadingType.CLEAR} : undefined,
    margins: {top: 50, bottom: 50, left: 80, right: 80},
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: txt.map(r => new TextRun({
        text: r.text, bold: r.bold, color: r.color,
        size: opts.tiny ? SZ.tiny : SZ.small, font: r.font ?? FONT
      }))
    })]
  });
}
function tbl(rows, cols, tinyTxt=false){
  const totalW = 9000;
  const colW = cols.map(c => Math.round(totalW * c));
  return new Table({
    width: {size: totalW, type: WidthType.DXA},
    columnWidths: colW,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => typeof c === 'string'
        ? cell(c, {w: colW[j], bg: i===0 ? COLOR.panel : undefined, tiny: tinyTxt})
        : cell(c.text || c, {w: colW[j], bg: i===0 ? COLOR.panel : c.bg, align: c.align, tiny: tinyTxt}))
    }))
  });
}

// ─── 콘텐츠 ───
const content = [
  // 표지
  p([{text:'V3D c3d.txt 직접 업로드 매뉴얼', bold:true, size:38, color:COLOR.primary}], {align: AlignmentType.CENTER, spacing:{after:200}}),
  p([{text:'후작업 0건 — 대시보드에 곧바로 import 하면 모든 변인 자동 산출', size:22, color:COLOR.muted}], {align: AlignmentType.CENTER, spacing:{after:100}}),
  p([{text:'v1.0 · 국민대 스포츠과학과 · 2026-05', size:18, color:COLOR.muted}], {align: AlignmentType.CENTER, spacing:{after:240}}),
  p([
    {text:'본 매뉴얼은 ', size:SZ.body},
    {text:'v3d 에서 export 한 c3d.txt 파일이 ', bold:true, size:SZ.body},
    {text:'대시보드 (https://kkl0511.github.io/Dashboard_Pitching_Team) 에 업로드되었을 때 ', size:SZ.body},
    {text:'후작업 없이 모든 변인이 산출되도록', bold:true, color:COLOR.bad, size:SZ.body},
    {text:' 지키는 ', size:SZ.body},
    {text:'export 사양', bold:true, size:SZ.body},
    {text:'을 정리. 컬럼명·단위·좌표계·event·force plate channel 의 표준을 그대로 따라야 함.', size:SZ.body}
  ], {spacing:{after:200}}),
  p([
    {text:'사용 흐름 (한 페이지 요약)', bold:true, size:SZ.body, color:COLOR.primary}
  ], {spacing:{before:120, after:80}}),
  num('Theia + AMTI 측정 → c3d 파일 생성'),
  num('V3D 에서 본 매뉴얼 §3~§5 사양대로 컬럼·event·좌표계 처리'),
  num('V3D File > Export > C3D Text → {선수명}_{날짜}_{trial}.c3d.txt'),
  num('§6 체크리스트 5분 점검'),
  num('대시보드 “Theia c3d Import” 창에 drag-drop'),
  num('자동 산출 — 5 모델 라디아 · 시퀀스 · ETE · GRF · 에너지 손실 Top 3'),
  new Paragraph({children:[new PageBreak()]}),

  // §1 개요
  h1('§1. 핵심 원칙 — 후작업 0건의 조건'),
  p([
    {text:'대시보드의 c3d.txt 파서 (', bold:true},
    {text:'process_pitching_session.py', font:'Consolas'},
    {text:') 가 인식하는 ', bold:true},
    {text:'정확한 컬럼명·단위·부호 convention 을 v3d export 시점에 맞춰야 함', bold:true, color:COLOR.bad},
    {text:'. 다음 5 가지를 만족하면 후작업 불필요:'}
  ]),
  num('컬럼명 표준 — 본 매뉴얼 §3 표 그대로 (대소문자, _X/_Y/_Z 접미사 포함)'),
  num('단위 — angle ° / ang vel °/s / force N / position m / time s'),
  num('좌표계 — lab frame: X+ = 3루, Y+ = 홈, Z+ = 위 (RHP 기준)'),
  num('Force plate — FP1 = 뒷발 (drive leg), FP2 = 앞발 (lead leg). AMTI 채널 매핑'),
  num('Event — Footstrike (FC), Release (BR) 정확히 마킹'),

  // §2 파일 구조
  h1('§2. c3d.txt 파일 구조 (V3D Text export 기본)'),
  p('파서가 읽는 행 구조:'),
  tbl([
    ['행', '내용', '예시'],
    ['Row 1', 'V3D 출력 path/metadata (무시됨)', 'C:\\\\Users\\\\...\\\\Fastball 1.c3d'],
    ['Row 2', '변수명 (Variable name)', 'TIME → Pelvis_Angle → Pelvis_Angle → Pelvis_Angle → Trunk_Angle ...'],
    ['Row 3', 'LINK_MODEL_BASED 또는 ORIGINAL', 'LINK_MODEL_BASED'],
    ['Row 4', 'ORIGINAL 또는 추가 메타', 'ORIGINAL'],
    ['Row 5', '컴포넌트 (X / Y / Z / 0 / ITEM)', 'X, Y, Z'],
    ['Row 6+', '데이터 (frame 별, tab-separated)', '0.0033 → 1.234 → -2.345 ...'],
  ], [0.10, 0.55, 0.35]),
  p('', {spacing:{after:80}}),
  note('파서는 Row 2 (변수명) + Row 5 (컴포넌트) 를 결합해 "변수명_컴포넌트" 키로 매핑 (예: Pelvis_Angle + Z → Pelvis_Angle_Z). 컴포넌트 누락 시 변수명 자체를 키로 사용.'),

  // §3 필수 컬럼 (가장 중요)
  h1('§3. 필수 컬럼 — V3D 에서 정확한 이름으로 export'),
  note('컬럼명은 대소문자·언더스코어 위치·접미사 모두 일치해야 함. 없는 컬럼이 있으면 해당 변인은 — 로 표시되며 라디아·시퀀스·일부 진단 불완전.', COLOR.bad),

  h2('§3.1 시간 (필수, 1개)'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '비고'],
    ['TIME', '0 (or X)', 's', '파서는 TIME_0, TIME_X, TIME 순으로 시도'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§3.2 Force Plate (필수, 6개) — FP1 = 뒷발, FP2 = 앞발'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['FP1', 'X / Y / Z', 'N', '뒷발 (drive leg, RHP=우측발). Y+ = 홈 방향. Z+ = 위'],
    ['FP2', 'X / Y / Z', 'N', '앞발 (lead leg, RHP=좌측발). Y+ = 홈 방향'],
  ], [0.20, 0.18, 0.12, 0.50]),
  p('', {spacing:{after:80}}),
  note('AMTI 채널이 swap 되면 모든 GRF 변인이 거꾸로 산출됨. 측정 직전 발 올림 테스트로 확인. V3D 의 Force Plate Calibration 에서 FP1=Channel 1 (뒷발 위치), FP2=Channel 2 (앞발 위치) 매핑.', COLOR.bad),

  h2('§3.3 Pelvis (골반) — 4개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['Pelvis_Angle', 'X / Y / Z', '°', '시상면 / 관상면 / 수평면 회전'],
    ['Pelvis_Ang_Vel', 'X / Y / Z', '°/s', '각속도 (Z 가 핵심 — 골반 회전 ω)'],
  ], [0.22, 0.18, 0.10, 0.50]),
  p('', {spacing:{after:80}}),

  h2('§3.4 Trunk / Thorax (몸통) — 7개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['Trunk_Angle', 'X / Y / Z', '°', 'X=Forward Tilt, Y=Side Bend, Z=Rotation. lab frame'],
    ['Thorax_Ang_Vel (= Trunk_Ang_Vel)', 'X / Y / Z', '°/s', '몸통 각속도. Z 가 핵심'],
    ['Trunk_wrt_Pelvis_Angle', 'Z', '°', '골반 대비 몸통 상대 회전 = X-factor'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§3.5 Pitching Arm (투구 팔) — 8개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['Pitching_Shoulder_Angle', 'X / Y / Z', '°', 'X=관상면(scap load), Y=외전, Z=외회전(layback)'],
    ['Pitching_Shoulder_Ang_Vel', 'Z', '°/s', '어깨 회전 ω (release 시 peak)'],
    ['Pitching_Elbow_Angle', 'X / Y / Z', '°', 'X=굴곡(flex)/신전(ext)'],
    ['Pitching_Elbow_Ang_Vel', 'X', '°/s', 'Elbow extension velocity'],
    ['Pitching_Humerus_Ang_Vel', 'Z', '°/s', '위팔 ω peak'],
    ['Pitching_Hand_Ang_Vel', 'X', '°/s', '손 ω peak'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§3.6 Forearm (전완) — 1개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['R_Forearm_Ang_Vel', 'Z', '°/s', '아래팔 ω peak (LHP는 L_Forearm)'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§3.7 Lead Leg + Drive Leg — 2개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['Lead_Knee_Angle', 'X', '°', '앞무릎 신전·굴곡. FC→BR 변화량 = block 강도'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),
  note('V3D 에서 RHP 의 lead = left, drive = right. LHP 는 반대. Pipeline 에서 자동으로 lead/drive 매핑 (handedness flag 사용).', COLOR.accent),

  h2('§3.8 관절 좌표 (위치) — 9개 (선택, V3D markerless)'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['R_Shoulder', 'X / Y / Z', 'm', '오른어깨 keypoint 위치'],
    ['R_Elbow', 'X / Y / Z', 'm', '오른팔꿈치'],
    ['R_WRIST (대문자)', 'X / Y / Z', 'm', '오른손목 (Theia 기본 출력 형식)'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§3.9 Center of Mass — 1개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['COM_displacement', 'Y', 'm', '체중심 전후 위치 (홈 방향). Visual3D Whole_Body_CoM 기능 활성화 필요'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),
  note('CoG_Decel + Max CoG Velo 산출 핵심. V3D 의 Compute Model Based Item > Whole_Body_Center_of_Mass 으로 추출 → numerical differentiation (5 frame central difference) 로 velocity 산출 후 export.', COLOR.warn),

  h2('§3.10 분절 역학적 에너지 (Mechanical Energy) — 3개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['Pelvis_Mechanical_Energy', 'X', 'J', '½ × I × ω² (De Leva 1996 분절 관성)'],
    ['Trunk_Mechanical_Energy', 'X', 'J', '몸통 회전 운동에너지'],
    ['R_Humerus_ME', 'X', 'J', '위팔 회전 운동에너지'],
  ], [0.30, 0.18, 0.12, 0.40]),
  p('', {spacing:{after:80}}),
  note('V3D 에서 직접 산출 안 됨. Custom Pipeline 필요: ME = 0.5 × Inertia × Ang_Vel². De Leva 1996 anthropometric inertia (segment-specific).', COLOR.warn),

  h2('§3.11 관절 파워 (Power Scalar) — 8개'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['R_Shoulder_Power_Scalar / L_Shoulder_Power_Scalar', 'X', 'W', '어깨 관절 파워. + 가속에 기여, − 흡수'],
    ['R_Elbow_Power_Scalar / L_Elbow_Power_Scalar', 'X', 'W', '팔꿈치 관절 파워'],
    ['R_Hip_Power_Scalar / L_Hip_Power_Scalar', 'X', 'W', '고관절 파워'],
    ['R_Knee_Power_Scalar / L_Knee_Power_Scalar', 'X', 'W', '무릎 관절 파워'],
  ], [0.45, 0.10, 0.10, 0.35]),
  p('', {spacing:{after:80}}),
  note('V3D 의 Compute Joint Power → Scalar component 출력. 좌우 모두 추출 권장 (drive/lead 다리 별도 평가).', COLOR.accent),

  h2('§3.12 Stride — 2개 (선택)'),
  tbl([
    ['컬럼명', '컴포넌트', '단위', '의미'],
    ['STRIDE_LENGTH', 'X', 'm', 'Drive 발 → Lead 발 horizontal distance at FC'],
    ['STRIDE_LENGTH_MEAN_PERCENT', 'X', '%', 'Stride length / pitcher height × 100'],
  ], [0.40, 0.15, 0.10, 0.35]),
  p('', {spacing:{after:80}}),

  // §4 Events
  h1('§4. Events 마킹 (필수, 2개)'),
  p('파서는 다음 두 EVENT 컬럼을 찾음. V3D 의 Event marking pipeline 으로 trial 마다 추가:'),

  tbl([
    ['Event 이름', '대시보드 alias', 'V3D 검출 방법', '단위'],
    ['Footstrike', 'FC, Foot Contact', 'FP2 (앞발) Z 축 reading > 50 N 처음 frame', 's (event time)'],
    ['Release', 'BR, Ball Release', 'Pitching_Hand peak ω 직후 frame', 's (event time)'],
  ], [0.18, 0.18, 0.50, 0.14]),
  p('', {spacing:{after:80}}),

  h3('V3D Event 추가 절차'),
  num('Pipeline → Add Event → Event Name = "Footstrike". Threshold: FP2_Z > 50 N 첫 frame.'),
  num('동일 방식으로 "Release" event 추가. Threshold: Pitching_Hand_Ang_Vel_X 가 max 인 frame.'),
  num('Event 가 정확한지 trial 별로 graph 로 검증 (FC 시 FP2 Z 가 막 상승하는 시점, BR 시 hand ω peak 직후).'),

  note('대시보드 v5.34 부터 event 가 잘못 마킹되어도 (frame 1 또는 마지막 frame 등) FP1_Z 활성 block 으로 자동 fallback. 그러나 정확한 event 마킹이 모든 변인의 정확도를 높임.', COLOR.accent),

  // §5 좌표계 + 부호
  h1('§5. 좌표계 + 부호 convention (대시보드와 동일하게 맞추기)'),

  h2('§5.1 Lab frame (RHP 기준)'),
  tbl([
    ['축', '방향', '의미', '검증 방법'],
    ['X+', '마운드 → 3루', '우투수의 우측', 'Pelvis_Angle_X = 0° (정면 정지 자세)'],
    ['Y+', '마운드 → 홈', '투구 진행 방향', '직립 자세에서 CoM_displacement_Y = 0'],
    ['Z+', '지면 → 위', '수직 위', '직립 자세에서 발 high = ground level'],
  ], [0.10, 0.30, 0.30, 0.30]),
  p('', {spacing:{after:80}}),

  h2('§5.2 Driveline 정합 — 자동 산출되는 값 (대시보드 입력 시)'),
  tbl([
    ['변인', '본 좌표계 lab Z 측정값', '대시보드 변환 결과', 'Elite 기준'],
    ['Trunk_Angle_Z at FC (windup 시 닫힘)', '+95° ~ +120°', '90 − value = −5° ~ −30°', '≈ 0° (closed)'],
    ['Trunk_Angle_Z at BR (follow-through 열림)', '−15° ~ −30°', '90 − value = 105° ~ 120°', '≈ +111°'],
    ['Trunk_Angle_Z peak before FC (counter rot)', '+120° ~ +130°', '90 − value = −30° ~ −40°', '≈ −38°'],
    ['Trunk_Angle_X at FC (forward tilt)', '+5° (앞으로 숙임) / -5° (뒤로)', '그대로 사용', '≈ +4°'],
  ], [0.30, 0.25, 0.25, 0.20]),
  p('', {spacing:{after:80}}),

  h2('§5.3 Force Plate Y 축 부호 (가장 흔한 오류)'),
  tbl([
    ['상황', 'Y 축 부호 (정답)', '잘못된 경우 증상'],
    ['뒷발 push toward home (drive)', 'FP1_Y > 0 (양수)', 'Drive AP 음수 → swap 또는 FP1 회전 의심'],
    ['앞발 resist forward (block)', 'FP2_Y < 0 (음수)', 'Lead AP 양수 → 마운드 / FP 방향 점검'],
  ], [0.40, 0.25, 0.35]),
  p('', {spacing:{after:80}}),
  note('AMTI Net Force Console 에서 Y 축 polarity 점검. 잘못된 경우 V3D Pipeline 으로 부호 반전 (FP1_Y *= -1) 가능하나, 측정 자체를 올바르게 하는 것이 우선.', COLOR.warn),

  h2('§5.4 Pitching_Shoulder_Angle_X (Scap Load) — 부호 caveat'),
  p([
    {text:'Driveline 표준 Scap Load = '},
    {text:'LEAD shoulder X axis at FC', bold:true},
    {text:' (lead = glove side). 그러나 일반 V3D markerless 출력은 PITCHING_Shoulder_Angle_X 만 제공. 두 부호가 반대.'}
  ]),
  bullet('처리 옵션 A — V3D 에서 LEAD_Shoulder_Angle_X 별도 추출 후 사용. 컬럼명 그대로 export.', 0, COLOR.good),
  bullet('처리 옵션 B — Pitching_Shoulder_Angle_X 만 export. process_pitching_session.py 가 v5.40 부터 부호 자동 반전 (×-1).', 0, COLOR.accent),
  note('Theia c3d 의 기본 출력은 Pitching_Shoulder_Angle 만 — 옵션 B 가 디폴트. v5.40 부터 자동 처리.', COLOR.accent),

  // §6 V3D Export 절차
  h1('§6. V3D Export 절차 (Step-by-step)'),

  h2('§6.1 Pipeline 실행'),
  num('Static calibration trial 처리 → Set as Reference'),
  num('투구 trial 들에 Filter 적용 (Butterworth low-pass 12 Hz, 4th order, bidirectional)'),
  num('§4 의 Footstrike + Release event 추가'),
  num('Compute Model Based Item — Whole_Body_Center_of_Mass'),
  num('Compute Joint Power — 모든 관절 (Hip/Knee/Shoulder/Elbow × L/R)'),
  num('Custom Calc — Pelvis_Mechanical_Energy_X, Trunk_Mechanical_Energy_X, R_Humerus_ME_X (½ × Inertia × Ang_Vel²)'),
  num('All segments 의 Angle / Ang_Vel 자동 산출됨'),

  h2('§6.2 Export Settings'),
  tbl([
    ['설정', '값'],
    ['Format', 'C3D Text (.c3d.txt)'],
    ['Components', 'X, Y, Z 모두 포함 (default)'],
    ['Frames', 'All frames (entire trial)'],
    ['Sampling', '300 Hz (motion frame rate, AMTI 자동 다운샘플)'],
    ['Encoding', 'UTF-8 (한글 컬럼명 사용 안 함, ASCII 만)'],
    ['Decimal separator', '.'],
    ['File naming', '{선수영문이름}_{YYYY-MM-DD}_{trial번호}.c3d.txt'],
    ['Decimal precision', '6 자리 (default)'],
  ], [0.30, 0.70]),
  p('', {spacing:{after:80}}),

  h2('§6.3 Export 후 파일 구조 검증 (5초)'),
  p('Export 한 .c3d.txt 를 텍스트 에디터로 열어 다음 확인:'),
  bullet('첫 6 행이 §2 표대로 (path → 변수명 → LINK_MODEL_BASED → ORIGINAL → 컴포넌트 → 데이터)'),
  bullet('변수명 행에 §3 의 핵심 컬럼들이 모두 포함됨'),
  bullet('컴포넌트 행에 X/Y/Z 가 정확히 정렬'),
  bullet('데이터 행에 FP1, FP2 의 Z 축이 throw 동안 100~250 N 범위로 변동'),
  bullet('Footstrike, Release event 컬럼이 첫 frame 에 0 이 아닌 값 (event time 초 단위)'),

  // §7 업로드 직전 5분 체크리스트
  h1('§7. 업로드 직전 5분 체크리스트'),
  p('대시보드 업로드 전 다음 7가지를 확인:'),

  num('☐ 좌표계 — Pelvis_Angle_X, Y, Z 가 정지 자세에서 모두 0° 근처 (±5°)'),
  num('☐ Force plate 부호 — FP1_Y peak > 0 (drive push), FP2_Y peak < 0 (lead block)'),
  num('☐ Force plate 매핑 — FP1 = 뒷발 (RHP=오른발), FP2 = 앞발 (RHP=왼발)'),
  num('☐ Trunk_Angle_Z trial 중 +120° peak (windup) → −20° (BR 직후) 변화 (lab frame)'),
  num('☐ Pitching_Shoulder_Angle_Z layback peak ≈ 170°~190°'),
  num('☐ Footstrike event 의 frame 이 trial 시작 frame (1) 아닌 곳'),
  num('☐ Release event 의 frame 이 Footstrike event 보다 뒤'),

  h2('§7.1 trial 자동 거부 기준 (대시보드 v5.40)'),
  tbl([
    ['거부 기준', '의미'],
    ['Pelvis_Angle_Z range > 250°', '회전 over (측정 오류)'],
    ['Pitching_Shoulder_Angle_Z (Layback) max > 230°', '측정 오류'],
    ['FP1_Z, FP2_Z peak < 50 %BW', 'ground contact 미감지'],
    ['Pitching_Hand peak ω > 20000 °/s', '측정 오류 (보통 5000~6000)'],
    ['Footstrike event frame = 1 또는 마지막', 'event 자동 검출 실패 (v5.34 fallback 으로 일부 복원)'],
  ], [0.45, 0.55]),
  p('', {spacing:{after:80}}),

  // §8 업로드 + 검증
  h1('§8. 대시보드 업로드 + 결과 검증'),

  h2('§8.1 업로드 절차'),
  num('https://kkl0511.github.io/Dashboard_Pitching_Team 접속'),
  num('Tab "1. 측정 결과 종합" 의 "Theia c3d Import" 버튼 클릭'),
  num('파일 dialog 에서 모든 .c3d.txt 파일 선택 (다중 선택 가능)'),
  num('대시보드가 자동으로 parse_theia_trial → synthesize_player_summary → 5 모델 라디아·시퀀스·GRF·에너지 손실 Top 3 산출'),
  num('완료 메시지: "{선수명} {trial 수} trial 처리 완료" 표시'),
  num('Tab "2. 선수별 1차 리포트" 로 이동 → 해당 선수 선택'),

  h2('§8.2 업로드 후 검증 (모든 변인 산출 여부)'),
  p('§3-1 메카닉 5 모델 라디아 + 변인 표에서 다음 — 표시 확인:'),
  bullet('모든 5 모델 점수 표시됨 (— 가 아닌 숫자)', 0, COLOR.good),
  bullet('20개 변인 중 18~20개가 값으로 표시 (Driveline 1~2 변인은 markerless 한계)', 0, COLOR.good),

  p([{text:'§3-2 시간축 분석:', bold:true}], {spacing:{before:120, after:60}}),
  bullet('Peak ω 표 (Pelvis / Trunk / Humerus) 모두 값', 0, COLOR.good),
  bullet('Lag 표 (PT, TA) 정상 범위 (0~80 / 40~130 ms)', 0, COLOR.good),

  p([{text:'§3-3 분절간 ETE:', bold:true}], {spacing:{before:120, after:60}}),
  bullet('4 transition 모두 점수 (lag + speed gain)', 0, COLOR.good),
  bullet('마네킹 SVG 의 에너지 흐름이 lab Z 색깔로 표시', 0, COLOR.good),

  p([{text:'§3-4 GRF:', bold:true}], {spacing:{before:120, after:60}}),
  bullet('Drive AP peak / impulse / Z peak — 모두 양수', 0, COLOR.good),
  bullet('Lead AP peak (braking) / impulse / Z peak — 모두 양수 (절댓값)', 0, COLOR.good),
  bullet('LHEI 종합 점수 표시', 0, COLOR.good),

  // §9 자주 발생하는 누락
  h1('§9. 자주 발생하는 컬럼 누락 → 영향 → 해결'),

  tbl([
    ['누락된 컬럼', '대시보드 영향', '해결'],
    ['COM_displacement_Y', 'CoG_Decel = —, Max CoG Velo = —, 체중이동 모델 점수 0', 'V3D Whole_Body_CoM 파이프라인 활성화'],
    ['Pelvis_Mechanical_Energy_X 등 ME', '§3-3 분절 KE 표 비어있음, 전달율 계산 불가', 'Custom Calc 추가: ME = 0.5 × Inertia × Ang_Vel²'],
    ['*_Power_Scalar_X (8개)', '§3-3 관절 파워 표 비어있음', 'V3D Compute Joint Power 추가'],
    ['Trunk_wrt_Pelvis_Angle_Z', 'X-factor = —, Posture 모델 일부 변인 누락', 'Trunk_wrt_Pelvis_Angle 세그먼트 정의 추가'],
    ['Pitching_Hand_Ang_Vel_X', '시퀀스 차트 팔 곡선 누락, ETE forearm→hand 점수 = —', 'Pitching_Hand 세그먼트 정의 추가'],
    ['R_Forearm_Ang_Vel_Z', 'ETE humerus→forearm 점수 = —', 'R_Forearm 세그먼트 정의 추가'],
    ['Lead_Knee_Angle_X', 'Block 모델 lead_knee_change = —, Lead Knee Extension = —', 'Lead_Knee_Angle 정의 추가 (x axis = flex/ext)'],
    ['STRIDE_LENGTH_X', 'Stride Length = —', 'V3D Custom Calc: stride = |Lead_Foot_Y − Drive_Foot_Y| at FC'],
    ['Footstrike, Release event', 'event-free fallback 작동, 일부 변인 부정확', 'Pipeline 에 Add Event 단계 추가'],
  ], [0.28, 0.40, 0.32]),
  p('', {spacing:{after:80}}),

  // §10 NEW — Rapsodo 동시 측정 + 자동 매칭 프로토콜
  h1('§10. Rapsodo 동시 측정 + 자동 매칭 프로토콜'),
  p([{text:'본 절은 ', bold:true},
     {text:'Theia c3d + Rapsodo CSV 를 동시에 수집해 측정 직후 운영자 작업 0초로 자동 매칭', bold:true, color:COLOR.bad},
     {text:'하기 위한 표준 프로토콜. Rapsodo 누락이 발생해도 갭 분석 알고리즘이 자동 보정. (출처: docs/Theia_데이터입력_지침.md v3.1)'}
  ]),

  h2('§10.1 핵심 규칙 — 매 throw 20초 간격'),
  p([{text:'선수에게 측정 전 안내 (구두):', bold:true}]),
  code('"매 투구 후 20초씩 쉬어 주세요"'),
  code('  throw → 20초 → 다음 throw → 20초 → ...'),
  code('  무효 trial 후 재측정도 20초 간격 유지'),
  code('  자세 조정으로 30초 넘기지 말 것'),
  note('이 규칙으로 Rapsodo 누락을 갭 분석으로 자동 감지 가능 (운영자 작업 시간 0).', COLOR.accent),

  h2('§10.2 측정 환경 설정'),

  h3('Rapsodo 위치 + 동기화'),
  bullet('Rapsodo 2.0 위치 — 홈플레이트에서 투수 방향으로 5~6 m 지점, 투구 방향과 정렬'),
  bullet('Rapsodo 멤버십 — 1 계정에 모든 throws 누적 (선수당 분리 X). 20명 × 12 throws = 약 240개 누적'),
  bullet('타임스탬프 동기화 — 가능한 모든 장비를 같은 NTP 서버 사용 권장 (Theia·AMTI·Rapsodo·노트북). Rapsodo Date 와 c3d 파일 modified time 매칭에 사용'),
  bullet('Trigger sync — Theia + AMTI 는 외부 trigger 또는 V3D sync 사용. Rapsodo 는 동기화 trigger 없으므로 timestamp 매칭에 의존'),

  h3('운영자 1명, 작업 분담'),
  bullet('측정 자체 — 선수 호출 + 측정 시작·정지 (Theia + AMTI 자동 trigger 시 1 click)'),
  bullet('Rapsodo — 별도 trigger 불요 (자동 detect)'),
  bullet('선수 교체 — 2 분 이상 휴식 (스크립트가 timestamp 갭으로 자동 분할)'),

  h2('§10.3 폴더 구조 + 파일 명명 규칙'),

  h3('표준 폴더 구조'),
  code('2026-MM-DD_차수측정/'),
  code('├── 00_meta/'),
  code('│   ├── roster.csv                          ← 선수 명단 master key'),
  code('│   └── measurement_log.csv                 ← 선수 경계 기록 (Rapsodo 누적용)'),
  code('├── 01_theia/'),
  code('│   ├── P01_정예준/                         ← 선수당 1 폴더 (P{번호}_{한글이름})'),
  code('│   │   ├── Fastball RH Markerless 1.c3d'),
  code('│   │   ├── Fastball RH Markerless 1.c3d.txt   ← V3D ASCII export'),
  code('│   │   ├── Fastball RH Markerless 2.c3d'),
  code('│   │   ├── ... (12 trial)'),
  code('│   ├── P02_김강대/'),
  code('│   └── ...'),
  code('├── 02_grf/                                 ← (선택) FP raw csv 별도 export 시'),
  code('├── 03_rapsodo/'),
  code('│   └── all_rapsodo.csv                     ← Rapsodo 단일 누적 export'),
  code('└── 04_dashboard_import/                    ← 자동 생성됨'),
  code('    ├── theia_batch.json'),
  code('    ├── rapsodo_master.csv'),
  code('    └── validation.txt                      ← 자동 진단 리포트'),

  h3('파일 명명 규칙'),
  tbl([
    ['파일', '형식', '예시', '주의'],
    ['선수 폴더', 'P{번호 두자리}_{한글이름}', 'P01_정예준', 'P1_ ❌ / -이름 ❌'],
    ['c3d (V3D 출력 그대로)', 'Fastball {RH/LH} Markerless {trial}.c3d', 'Fastball RH Markerless 1.c3d', '이름 변경 ❌'],
    ['c3d.txt', '동일 base + .c3d.txt', 'Fastball RH Markerless 1.c3d.txt', '두 파일 모두 보존'],
    ['Rapsodo', 'Rapsodo 자체 export 그대로', 'all_rapsodo.csv', '손대지 마세요'],
    ['measurement_log', 'measurement_log.csv', '00_meta/measurement_log.csv', '선수당 1 줄'],
  ], [0.20, 0.30, 0.30, 0.20], true),
  p('', {spacing:{after:80}}),

  h2('§10.4 measurement_log.csv 작성 (선수당 5초)'),
  p('선수가 끝날 때마다 마지막 pitch_no 한 번 보고 한 줄 추가:'),
  code('athlete_external_id,athlete_name,first_throw_no,last_throw_no,note'),
  code('P01,정예준,1,12,'),
  code('P02,김강대,13,22,'),
  code('P03,박명균,23,33,'),
  code('...'),

  h3('작성 흐름'),
  num('첫 선수: first=1, last=12 (총 12개)'),
  num('Rapsodo 화면에서 마지막 pitch_no 확인'),
  num('measurement_log.csv 에 한 줄 추가 (5초)'),
  num('2분 휴식 (다음 선수 준비)'),
  num('다음 선수: first=13 (자동 누적)'),
  note('무효 throw 가 있어도 그 번호 그대로 포함 — 스크립트가 c3d 와 비교해 자동 제외.', COLOR.accent),

  h2('§10.5 자동 매칭 — 갭 분석 (20초 프로토콜 기반)'),
  p('처리 스크립트가 Rapsodo throw 간 timestamp 갭을 분석해 자동 분류:'),

  tbl([
    ['갭 시간', '분류', '자동 처리'],
    [{text:'< 30초', bold:true, color:COLOR.good}, '정상 throw', '그대로 c3d trial 과 1:1 매칭 → 풀 분석'],
    [{text:'30~50초', bold:true, color:COLOR.warn}, 'Rapsodo 1개 누락', '갭 자동 인식 → c3d trial 메카닉만 분석 (구속 N/A)'],
    [{text:'50~90초', bold:true, color:COLOR.bad}, '모호 (수작업 검토)', 'validation.txt 에 표시, 운영자가 1-click 결정'],
    [{text:'> 90초', bold:true, color:COLOR.muted}, '큰 휴식 / 선수 경계', 'measurement_log.csv 또는 운영자 판단'],
  ], [0.16, 0.24, 0.60]),
  p('', {spacing:{after:80}}),

  h3('4 가지 케이스 자동 처리'),
  tbl([
    ['케이스', 'c3d', 'Rapsodo', '자동 판단'],
    ['A. 정상 (대부분)', '1~12', '1~12, 모두 ~20초 간격', '1:1 매칭 → 풀 분석'],
    ['B. c3d 누락 (자세불량 재측정)', '1, 2, 3, _, 5~12', '1~12', 'c3d 누락 trial 의 Rapsodo throw 자동 제외'],
    ['C. Rapsodo 누락 (트리거 실패)', '1~12', 'throw 7→8 갭 45초', '갭 30~50초 자동 인식 → c3d trial 8 메카닉만 분석'],
    ['D. 돌발 상황 (큰 갭)', '1~12', 'throw 5→6 갭 70초', 'validation.txt 에 ⚠ 표시 → 운영자 검토'],
  ], [0.30, 0.18, 0.28, 0.24], true),
  p('', {spacing:{after:80}}),

  h2('§10.6 validation.txt 자동 진단 리포트'),
  p('처리 후 자동 생성되는 리포트 예시:'),
  code('═══════════════════════════════════════════════'),
  code('  2026-05-15 1차 측정 자동 매칭 결과'),
  code('═══════════════════════════════════════════════'),
  code(''),
  code('✅ P01 정예준 — 12 trial 정상 (c3d=12, rap=12)'),
  code('✅ P02 김강대 — 11 trial 정상'),
  code(''),
  code('⚠ P03 박명균 — c3d 누락'),
  code('   c3d:  1,2,3, _ ,5,6,7,8,9,10,11,12  (n=11)'),
  code('   rap:  1,2,3,4,5,6,7,8,9,10,11,12   (n=12)'),
  code('   → trial 4 자세불량 추정 (Rapsodo throw 4 자동 제외)'),
  code(''),
  code('⚠ P04 이영하 — Rapsodo 누락'),
  code('   c3d:  1,2,3,4,5,6,7,8,9,10,11,12  (n=12)'),
  code('   rap:  1,2,3, _ ,5,6,7,8,9,10,11,12  (n=11)'),
  code('   → trial 4 메카닉만 분석 (구속·회전 데이터 없음)'),
  code(''),
  code('🔧 P05 김민수 — 폴더명 ↔ 파일명 불일치'),
  code('   폴더: P05_김민수 (roster: R)'),
  code('   파일명: Fastball *LH* Markerless ...'),
  code('   → 다른 선수 파일이 섞였는지 확인 필요'),
  code(''),
  code('────────────────────────────────────────────'),
  code('정상: 18명 · 부분 누락: 2명 · 에러: 1명 · 빈 폴더: 0명'),
  code('────────────────────────────────────────────'),
  note('빨간 🔧 만 0 이면 다음 단계 (대시보드 인입) 진행.', COLOR.good),

  h2('§10.7 운영 흐름 한 페이지 요약'),

  h3('측정 직전 (5분)'),
  num('roster.csv 작성 — P01~P20 명단 (athlete_external_id, athlete_name, handedness, height_cm, weight_kg)'),
  num('Rapsodo 위치 + 동기화 (홈→투수 5-6m, NTP)'),
  num('Theia + AMTI 캘리브레이션 (§3 참고)'),
  num('Rapsodo 멤버십 계정 로그인, 새 session 시작'),

  h3('측정 중 (선수당 ~5분)'),
  num('선수 P01 시작 → 12 trial 측정 (각 throw 20초 간격)'),
  num('운영자: 마지막 throw 후 Rapsodo 화면에서 last pitch_no 확인'),
  num('measurement_log.csv 에 한 줄 추가 (5초)'),
  num('2 분 휴식 → 다음 선수 (P02) 시작'),
  num('계속 진행 (Rapsodo throw_no 누적, c3d 는 새 폴더 P02_ 에 1~12)'),

  h3('측정 후 (자동 처리)'),
  num('01_theia/ 의 모든 c3d.txt → V3D 처리 (§6 참고)'),
  num('03_rapsodo/all_rapsodo.csv 그대로 두기'),
  num('process_pitching_session.py 실행 → measurement_log.csv 와 갭 분석으로 자동 매칭'),
  num('validation.txt 검토 — 🔧 빨간 항목만 운영자 확인'),
  num('04_dashboard_import/ 결과 → 대시보드 업로드 (theia_batch.json + rapsodo_master.csv)'),

  h2('§10.8 자주 묻는 질문 (FAQ)'),

  p([{text:'Q1. trial 4번이 무효라 다시 측정했어요. 어떻게 표시하나요?', bold:true}]),
  p([{text:'A. ', bold:true},{text:'아무것도 안 해도 됩니다. V3D export 그대로 두세요 (4번이 빠진 채로). 스크립트가 자동 감지.'}]),

  p([{text:'Q2. Rapsodo 가 4번째 throw 를 못 잡았어요.', bold:true}]),
  p([{text:'A. ', bold:true},{text:'아무것도 안 해도 됩니다. Rapsodo CSV 그대로 두세요. 갭 분석 (30~50초) 으로 자동 감지 → c3d trial 4 는 메카닉만 분석 (구속 데이터 N/A 표시).'}]),

  p([{text:'Q3. 두 시스템이 매칭이 어긋날까 걱정돼요.', bold:true}]),
  p([{text:'A. ', bold:true},{text:'걱정 마세요. 스크립트가 c3d trial 번호 + Rapsodo throw 번호 + measurement_log.csv 의 first/last 로 정확히 매칭. 운영자는 동일한 throw 순서로 trial 번호 부여만 일관되게 유지하면 자동.'}]),

  p([{text:'Q4. trial_index.csv 같은 매핑 파일을 안 만들어도 되나요?', bold:true}]),
  p([{text:'A. ', bold:true},{text:'네. 매핑은 자동. 이상한 케이스 (c3d 12개 vs Rapsodo 8개 — 차이 4개 이상) 는 validation.txt 가 빨갛게 표시 → 그때만 운영자 확인.'}]),

  p([{text:'Q5. 좌투수도 같은 형식인가요?', bold:true}]),
  p([{text:'A. ', bold:true},{text:'네. 파일명이 Fastball LH Markerless N.c3d 로 자동. 스크립트가 LH/RH ↔ roster handedness 자동 검증.'}]),

  p([{text:'Q6. Curveball / Slider 도 측정하면?', bold:true}]),
  p([{text:'A. ', bold:true},{text:'같은 폴더에 함께 넣으세요. 구질별로 자동 분리됩니다.'}]),

  p([{text:'Q7. Rapsodo CSV 에서 무효 throw 를 직접 삭제해도 되나요?', bold:true}]),
  p([{text:'A. ', bold:true},{text:'삭제하지 마세요. 스크립트가 c3d 와 비교해 자동 처리. Rapsodo 원본은 그대로.'}]),

  // §11 부록 (이전 §10)
  h1('§11. 부록'),

  h2('§11.1 c3d.txt 컬럼 → 대시보드 record JSON 매핑 (전체)'),
  tbl([
    ['c3d.txt 컬럼', '대시보드 record 필드 (record JSON path)'],
    ['TIME_0, TIME_X, TIME', '내부 timing (frame rate 자동 산출)'],
    ['FP1_X / FP1_Y / FP1_Z', 'grf.drive_propulsive_peak_pct_bw, drive_propulsive_impulse_pct_bw_s, rear_force_pct'],
    ['FP2_X / FP2_Y / FP2_Z', 'grf.lead_braking_peak_pct_bw, lead_braking_impulse_pct_bw_s, lead_force_pct'],
    ['Pelvis_Ang_Vel_Z', 'sequence.pelvis_dps'],
    ['Thorax_Ang_Vel_Z', 'sequence.trunk_dps'],
    ['Pitching_Humerus_Ang_Vel_Z', 'sequence.arm_dps'],
    ['R_Forearm_Ang_Vel_Z', 'energy.transfer.peak_forearm_v'],
    ['Pitching_Hand_Ang_Vel_X', 'sequence.peak_hand_v'],
    ['Trunk_Angle_X (at FC)', 'faults.trunk_tilt_at_fc_deg (그대로)'],
    ['Trunk_Angle_Y (at MER)', 'faults.trunk_lat_tilt_deg'],
    ['Trunk_Angle_Z (at FC)', 'faults.torso_rot_fp_deg (90 − value 변환 자동)'],
    ['Trunk_Angle_Z (at BR)', 'faults.torso_rot_br_deg (90 − value)'],
    ['Trunk_Angle_Z (peak before FC)', 'faults.torso_counter_rot_deg (90 − max_value)'],
    ['Trunk_wrt_Pelvis_Angle_Z (max)', 'faults.x_factor_deg'],
    ['Pitching_Shoulder_Angle_Z (max)', 'faults.shoulder_er_max_deg (Layback)'],
    ['Pitching_Shoulder_Angle_Y (at FC)', 'faults.shoulder_abd_fp_deg'],
    ['Pitching_Shoulder_Angle_X (at FC)', 'faults.scap_load_fp_deg (자동 ×-1)'],
    ['Pitching_Shoulder_Ang_Vel_Z', 'sequence.peak_shoulder_v'],
    ['Pitching_Elbow_Angle_X (at FC)', 'faults.elbow_flex_fp_deg'],
    ['Pitching_Elbow_Ang_Vel_X', 'sequence.elbow_dps, peak_elbow_v'],
    ['Lead_Knee_Angle_X (BR − FC)', 'faults.lead_knee_change'],
    ['COM_displacement_Y (시계열)', 'cog.max_velo, cog.decel'],
    ['Pelvis_Mechanical_Energy_X', 'energy.segments.pelvis_me_peak'],
    ['Trunk_Mechanical_Energy_X', 'energy.segments.trunk_me_peak'],
    ['R_Humerus_ME_X', 'energy.segments.humerus_me_peak'],
    ['R/L_Shoulder_Power_Scalar_X', 'energy.power.r_shoulder, l_shoulder'],
    ['R/L_Elbow_Power_Scalar_X', 'energy.power.r_elbow, l_elbow'],
    ['R/L_Hip_Power_Scalar_X', 'energy.power.r_hip, l_hip'],
    ['R/L_Knee_Power_Scalar_X', 'energy.power.r_knee, l_knee'],
    ['STRIDE_LENGTH_X', 'faults.stride_length_m'],
    ['Footstrike event', '내부 fc_event frame index'],
    ['Release event', '내부 br_event frame index'],
  ], [0.40, 0.60], true),
  p('', {spacing:{after:120}}),

  h2('§11.2 V3D Custom Calc 예시 코드 (mechanical energy)'),
  code('// V3D Pipeline > Compute Custom Calculation'),
  code('// Pelvis Mechanical Energy = 0.5 * I_z * ω_z² (J 단위)'),
  code('// Inertia (De Leva 1996 anthropometric):'),
  code('// I_pelvis_z = mass × radius_gyration² × height_factor'),
  code('// 일반적으로 pelvis: 0.0142 × body_mass × height² (kg·m²)'),
  code(''),
  code('Compute_Variable_Constant /SIGNAL_TYPES=METRIC /SIGNAL_NAMES=Pelvis_Inertia_Z'),
  code('  /SIGNAL_FOLDER=PROCESSED /CONSTANT=0.0142 /UNITS=kg·m^2'),
  code('  /MULTIPLY_BY_BODY_MASS=YES /MULTIPLY_BY_HEIGHT_SQUARED=YES'),
  code(''),
  code('Compute_Custom_Variable /OUTPUT_NAME=Pelvis_Mechanical_Energy_X'),
  code('  /FORMULA=0.5 * Pelvis_Inertia_Z * (Pelvis_Ang_Vel_Z * 0.01745329)^2'),
  code('  /UNITS=J'),
  p('', {spacing:{after:120}}),

  h2('§11.3 학술 reference'),
  bullet('Driveline Pitching Assessment — Mechanical Composite Scores+'),
  bullet('Aguinaldo & Escamilla 2007/2019 — proximal-to-distal sequencing'),
  bullet('Naito & Fujii 2008 — kinetic chain energy transfer'),
  bullet('De Leva 1996 — anthropometric segment inertia parameters'),
  bullet('Visual3D Documentation — Compute Joint Power, Whole Body CoM, Custom Pipeline'),

  // 마무리
  p([{text:'문의: ', bold:true},{text:'국민대 스포츠과학과 / kklee@kookmin.ac.kr'}], {spacing:{before:200, after:60}}),
  p([{text:'대시보드: https://kkl0511.github.io/Dashboard_Pitching_Team', size:SZ.small, color:COLOR.accent}], {spacing:{after:60}}),
  p([{text:'본 매뉴얼은 v5.40 알고리즘 기준. process_pitching_session.py 가 인식하는 컬럼명·단위·event 표준이 그대로 export 되어야 함.', size:SZ.small, italic:true, color:COLOR.muted}]),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: SZ.body } } },
    paragraphStyles: [
      {id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
       run:{size:SZ.h1, bold:true, color:COLOR.primary, font:FONT},
       paragraph:{spacing:{before:280, after:140}, outlineLevel:0,
                  border:{bottom:{style:BorderStyle.SINGLE, size:8, color:COLOR.primary, space:4}}}},
      {id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
       run:{size:SZ.h2, bold:true, color:COLOR.accent, font:FONT},
       paragraph:{spacing:{before:200, after:100}, outlineLevel:1}},
      {id:'Heading3', name:'Heading 3', basedOn:'Normal', next:'Normal', quickFormat:true,
       run:{size:SZ.h3, bold:true, color:'333F4D', font:FONT},
       paragraph:{spacing:{before:140, after:70}, outlineLevel:2}},
    ]
  },
  numbering: {
    config: [
      {reference:'bullets', levels:[
        {level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT,
         style:{paragraph:{indent:{left:480, hanging:240}}}},
      ]},
      {reference:'numbers', levels:[
        {level:0, format:LevelFormat.DECIMAL, text:'%1.', alignment:AlignmentType.LEFT,
         style:{paragraph:{indent:{left:480, hanging:280}}}},
      ]}
    ]
  },
  sections: [{
    properties: {
      page: {
        size: {width: 11906, height: 16838},
        margin: {top: 1080, right: 1080, bottom: 1080, left: 1080}
      }
    },
    headers: {
      default: new Header({children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({text:'V3D c3d.txt 직접 업로드 매뉴얼 v1.0 — 후작업 0건', size:14, color:COLOR.muted, font:FONT})]
      })]})
    },
    footers: {
      default: new Footer({children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({text:'Page ', size:14, color:COLOR.muted, font:FONT}),
          new TextRun({children:[PageNumber.CURRENT], size:14, color:COLOR.muted, font:FONT}),
          new TextRun({text:' / ', size:14, color:COLOR.muted, font:FONT}),
          new TextRun({children:[PageNumber.TOTAL_PAGES], size:14, color:COLOR.muted, font:FONT}),
        ]
      })]})
    },
    children: content
  }]
});

const outPath = process.argv[2] || 'V3D_Export_Manual_상동고_v1.0.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${outPath} (${(buf.length/1024).toFixed(1)} KB)`);
});
