#!/usr/bin/env node
/**
 * 연구원 매뉴얼 — Theia 마커리스 + AMTI 지면반력 + Visual3D 분석
 * Driveline 변인을 축변환/부호반전 없이 직접 산출하기 위한 좌표계 설정 + 캘리브레이션 + v3d 산출 절차
 */
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, PageOrientation,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');
const fs = require('fs');
const path = require('path');

// ─── 스타일 ───
const COLOR = {
  primary: '1F3864', accent: '2E75B6', muted: '656D76',
  good: '1A7F37', warn: 'BC4C00', bad: 'CF222E',
  panel: 'F6F8FA', line: 'D0D7DE'
};
const FONT = 'Malgun Gothic';

// 작은 폰트 — body 9pt (= size 18 in half-points), heading 11~13pt
const SZ = { body:18, small:16, h1:26, h2:22, h3:20, h4:18 };

// 공통 helper
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
function h4(text){ return p(text, {props:{heading: HeadingLevel.HEADING_4}}); }

function bullet(text, level=0, color){
  return new Paragraph({
    numbering: {reference: 'bullets', level},
    spacing: {after: 60},
    children: [new TextRun({
      text, color, size: SZ.body, font: FONT
    })]
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

// 표 helper
const border = {style: BorderStyle.SINGLE, size: 1, color: COLOR.line};
const borders = {top:border, bottom:border, left:border, right:border};
function cell(text, opts={}){
  const txt = Array.isArray(text) ? text : [{text}];
  return new TableCell({
    borders,
    width: {size: opts.w, type: WidthType.DXA},
    shading: opts.bg ? {fill: opts.bg, type: ShadingType.CLEAR} : undefined,
    margins: {top: 60, bottom: 60, left: 100, right: 100},
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: txt.map(r => new TextRun({
        text: r.text, bold: r.bold, color: r.color,
        size: opts.head ? SZ.small : SZ.small, font: FONT
      }))
    })]
  });
}
function tbl(rows, cols){
  const totalW = 9000;   // A4 1440-1440 = ~9000
  const colW = cols.map(c => Math.round(totalW * c));
  return new Table({
    width: {size: totalW, type: WidthType.DXA},
    columnWidths: colW,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => typeof c === 'string'
        ? cell(c, {w: colW[j], head: i===0, bg: i===0 ? COLOR.panel : undefined})
        : cell(c.text || c, {w: colW[j], head: i===0, bg: i===0 ? COLOR.panel : c.bg, align: c.align}))
    }))
  });
}

// ─── 콘텐츠 ───
const content = [
  // 표지
  p([{text:'상동고 투구 리포트 데이터 측정·분석 매뉴얼', bold:true, size:38, color:COLOR.primary}], {align: AlignmentType.CENTER, spacing:{after:200}}),
  p([{text:'Theia 마커리스 + AMTI 지면반력 + Visual3D 통합 처리', size:22, color:COLOR.muted}], {align: AlignmentType.CENTER, spacing:{after:100}}),
  p([{text:'v1.0 · 국민대 스포츠과학과 · 2026-05', size:18, color:COLOR.muted}], {align: AlignmentType.CENTER, spacing:{after:300}}),
  p([{text:'본 매뉴얼의 목적 — Driveline Pitching Assessment 의 변인 정의 (3루=0°, 홈=90° 등) 와 정확히 일치하도록 측정·산출하기 위한 ', size:SZ.body},
     {text:'전체 워크플로우', bold:true, size:SZ.body},
     {text:'를 정리. 글로벌 좌표계·지면반력기 채널 매핑·V3D 변인 산출 모두 ', size:SZ.body},
     {text:'후작업 (축변환·부호반전 등) 없이', bold:true, color:COLOR.bad, size:SZ.body},
     {text:' 그대로 대시보드에 입력 가능하도록 설계.', size:SZ.body}
  ], {spacing:{after:300}}),
  new Paragraph({children:[new PageBreak()]}),

  // §1 개요
  h1('§1. 개요'),
  p([
    {text:'측정 시스템', bold:true},{text:': '},
    {text:'Theia 3D 마커리스 모션캡쳐 (8~10 카메라, 300 Hz)'},{text:' + '},
    {text:'AMTI Force Plate 2장 (1200 Hz raw, motion 동기 후 300 Hz로 다운샘플)'}
  ]),
  p([
    {text:'분석 도구', bold:true},{text:': '},
    {text:'Visual3D (CMotion) — c3d 파일에서 Driveline 5 모델 변인, 분절간 ETE, GRF 수평/임펄스/타이밍, NewtForce 8 변인 산출.'}
  ]),
  p([
    {text:'산출 결과 입력', bold:true},{text:': '},
    {text:'대시보드 (https://kkl0511.github.io/Dashboard_Pitching_Team) — c3d.txt 파일을 직접 import 시 자동으로 5 모델 라디아·시퀀스·GRF·에너지 손실 Top 3 등 그려짐.'}
  ]),
  note('※ 본 매뉴얼은 절차 누락 시 후작업 부담이 큰 영역 (좌표계, FP 채널, 변인 정의) 을 중점으로 정리. 익숙해지면 새 측정마다 §2 + §3 만 점검하면 됨.', COLOR.accent),

  // §2 측정 환경 설정
  h1('§2. 측정 환경 설정 (가장 중요)'),

  h2('§2.1 글로벌 좌표계 (Lab Frame)  — Driveline 변인 정의와 일치하기 위한 핵심'),
  p([
    {text:'Driveline 변인 정의 (예: Torso Rotation at FP, Counter Rot 등) 는 '},
    {text:'lab frame 의 축 방향', bold:true},
    {text:'에 의해 결정됨. 측정 전 Theia + Visual3D + Force Plate 가 모두 같은 lab frame 을 공유하도록 설정해야 후작업 (축 회전, 부호 flip) 이 필요 없음.'}
  ]),

  h3('필수 축 방향 (우투수 기준)'),
  tbl([
    ['축', '방향', '의미', 'Driveline 정합성'],
    ['Y+ (전방)', '마운드 → 홈플레이트', '투구 진행 방향 (forward)', '필수'],
    ['X+ (우측)', '마운드 → 3루 (우투수의 우측)', '투수의 우측 방향', '필수'],
    ['Z+ (상방)', '지면 → 위', '수직 위', '필수'],
  ], [0.10, 0.32, 0.30, 0.18]),
  p('', {spacing:{after:80}}),

  note('⚠ 좌투수 측정 시 — X 축은 1루 방향으로 반전. Visual3D 의 별도 LHP pipeline 을 사용하거나 측정 시 X 축을 1루 방향으로 캘리브레이션 (lab frame 일관성 확보).', COLOR.warn),

  h3('이 좌표계가 만들어내는 Driveline 정합 결과'),
  tbl([
    ['Driveline 변인', '본 좌표계에서 자동 산출되는 값', 'Elite 기준'],
    ['Torso Rotation at FP (closed)', '0° 근처 (3루 정면 자세 = X 축 방향)', '≈ 2°'],
    ['Torso Rotation at BR (open)', '+90° 근처 (홈 정면 자세 = Y 축 방향)', '≈ 111°'],
    ['Peak Torso Counter Rot (windup)', '음수 (windup 시 trunk 가 X 축 더 회전)', '≈ −38°'],
    ['Torso Forward Tilt at FP', '+ 앞으로 숙임 / − 뒤로 기울어짐', '≈ +4°'],
  ], [0.30, 0.50, 0.20]),
  p('', {spacing:{after:80}}),

  h3('Visual3D 측정 시 lab frame 설정 방법'),
  num('Force plate 정렬 — FP1, FP2 의 long axis 가 마운드~홈 line 과 평행하도록 배치. AMTI 시그널 양 (+) Y 가 홈 방향과 일치하도록 채널 매핑 (§2.4 참고).'),
  num('Theia 캘리브레이션 — Cal frame 의 X·Y·Z 축이 위 정의대로 정렬되도록 calibration object 위치 설정. 캘리브레이션 마커가 Y 축은 홈 방향으로, X 축은 3루 방향으로 향하도록 배치.'),
  num('Visual3D 의 Workspace > Coordinate System 에서 World coordinate 의 axes 가 위 정의와 일치하는지 확인. 다르면 Tags > Targets > Set As Reference 사용해 회전 정합.'),
  num('동기화 trial — pitcher 가 마운드 위에 직립 자세로 1초간 정지. 이 trial 의 Pelvis Y 축이 홈 방향, X 축이 3루 방향, Z 축이 위가 되는지 V3D 에서 점검.'),

  h2('§2.2 마운드 위치 + 거리'),
  bullet('마운드 정상 (rubber 의 가운데) 와 홈플레이트 가운데 거리: 18.44 m (60 ft 6 in)'),
  bullet('상동고 / 고1: 16.46 m (54 ft) 사용 가능 — 측정 시 일관 적용. 고교 레벨에 맞춤.'),
  bullet('마운드 높이: 25.4 cm (10 in) — KBO·NCAA 표준.'),
  bullet('Force plate 표면 = 마운드 표면. 두 FP 가 마운드 위에 평행 배치.'),

  h2('§2.3 카메라 배치 (Theia 8~10 cam)'),
  p([{text:'카메라는 마운드 + 홈플레이트 사이 영역을 360° 둘러싸도록 배치. 권장 위치:'}]),
  bullet('상측 (높이 2.5~3 m) — 4 카메라 (전방, 우측, 좌측, 후방)'),
  bullet('하측 (높이 1.0~1.5 m) — 4 카메라 (45° interval)'),
  bullet('각 카메라 시야가 pitcher 의 windup → 릴리스 → follow-through 전 구간 포함'),
  bullet('카메라 occlusion 최소화 — 다른 사람·장비가 카메라 시야 가리지 않게'),
  bullet('각 카메라가 calibration object 의 모든 control point 를 보도록 위치 검증'),

  h2('§2.4 지면반력기 — FP1 = 뒷발, FP2 = 앞발  (가장 중요!)'),
  note('이 매핑은 후작업으로 swap 하기 어려움. 측정 전 반드시 케이블·V3D 채널 매핑을 점검.', COLOR.bad),

  h3('FP1·FP2 정의'),
  tbl([
    ['FP', '발', '의미', 'AMTI 케이블 채널'],
    ['FP1', '뒷발 (drive leg)', '우투수 = 우측 발, 좌투수 = 좌측 발. 마운드 위에서 push-off 하는 발.', 'AMTI 채널 1 (FP1_X, FP1_Y, FP1_Z, FP1_MX, FP1_MY, FP1_MZ)'],
    ['FP2', '앞발 (lead leg)', '우투수 = 좌측 발, 좌투수 = 우측 발. landing & block 하는 발.', 'AMTI 채널 2 (FP2_X, FP2_Y, FP2_Z, …)'],
  ], [0.08, 0.18, 0.50, 0.24]),
  p('', {spacing:{after:80}}),

  h3('FP 위치 배치'),
  bullet('FP1 (뒷발) — 마운드 rubber 가까이 (pitcher 가 push-off 시작점). FP1 의 long axis 가 Y 축 (홈 방향) 과 평행.'),
  bullet('FP2 (앞발) — FP1 보다 홈 쪽으로 약 1.5~2 m (선수 stride length 에 맞춤). FP1 과 평행.'),
  bullet('FP1, FP2 모두 마운드 표면과 같은 높이 (25.4 cm 위치, force plate 표면이 마운드 표면과 flush).'),

  h3('AMTI 부호 convention (lab frame Y+ 가 홈 방향일 때)'),
  tbl([
    ['축', '의미', '뒷발 (FP1, drive)', '앞발 (FP2, lead)'],
    ['Z+ (수직)', '체중 → 지면 반력 위', '+ (체중 지지)', '+ (체중 지지)'],
    ['Y+ (홈 방향)', '드라이브 → 양수, 블록 → 음수', '+ (push toward home, propulsive)', '− (resist forward, braking)'],
    ['X+ (3루 방향)', 'lateral force', '미세 (drive 시 좌측 회전)', '미세 (lead block 시)'],
  ], [0.15, 0.30, 0.30, 0.25]),
  p('', {spacing:{after:80}}),

  note('대시보드의 v5.34 event-free GRF detection 알고리즘은 위 부호 convention 을 가정. AMTI 케이블이 회전·반전되어 부호가 다르면 모든 GRF 변인이 거꾸로 산출됨.', COLOR.bad),

  h2('§2.5 동기화 (Synchronization)'),
  bullet('Theia (300 Hz) + AMTI (1200 Hz) 가 외부 trigger 또는 Visual3D 자체 sync 사용해 동기화.'),
  bullet('AMTI signal → motion capture 30 Hz / 60 Hz / 300 Hz 로 다운샘플 (Visual3D pipeline 에서 자동).'),
  bullet('각 trial 시작·끝에 동기 신호 (사진의 깜빡임, claps 등) 를 잡아 후처리에 활용.'),

  // §3 캘리브레이션
  h1('§3. 캘리브레이션 (측정 직전 매번)'),

  h2('§3.1 Force Plate Zero (Tare)'),
  num('아무것도 위에 없는 상태에서 AMTI Net Force Console 에서 Tare 또는 Zero 버튼 클릭. 모든 채널 초기화.'),
  num('5초 정도 기다린 후 Visual3D Acquisition pipeline 으로 1 trial 정적 측정 (FP 위에 0 kg) → Z 축 reading 이 ±5 N 이내인지 확인.'),
  num('체중 조정 (BW) 측정 — pitcher 정지 자세로 5초 측정 → Z 축 평균 reading = pitcher 의 BW (× g 환산). 후속 분석에서 %BW 산출에 사용.'),

  h2('§3.2 Theia Calibration'),
  num('Theia Calibration Wand 를 lab 의 origin (마운드 가운데) 에 배치. Y 축 = 홈 방향, X 축 = 3루 방향 정렬.'),
  num('각 카메라가 wand 의 control point 4개를 모두 인식하도록 카메라 노출·렌즈 설정 점검.'),
  num('Theia Calibration → Static + Dynamic Pose 캡쳐 (각 ~10초). RMSE < 1 mm 인지 확인.'),

  h2('§3.3 Visual3D Coordinate System 검증'),
  num('Static trial 1개를 V3D 로 import → Workspace > Coordinate System 에서 World 가 위 정의와 일치하는지 확인.'),
  num('Pelvis 의 직립 자세에서 Pelvis_Angle_X, Y, Z 가 모두 0° 근처 (±5°) 인지 확인. 큰 오프셋이 있으면 캘리브레이션 wand 위치 재확인.'),

  // §4 측정 절차
  h1('§4. 측정 절차'),
  h2('§4.1 사전 준비'),
  bullet('피험자 정보 — 신장, 체중, 연령, 우투/좌투, dominant arm 기록.'),
  bullet('Marker 부착 — Theia 는 marker 불요. 그러나 anatomical landmark calibration 을 위해 일부 reflective marker 부착 권장 (RIA, RAS, LIA, LAS, MED, LAT 등).'),
  bullet('Warm-up — 피험자가 정상 routine 으로 몸 푼 후 측정 시작.'),

  h2('§4.2 trial 측정'),
  num('정적 calibration trial 1개 (마운드 직립 자세, 5초)'),
  num('실제 투구 trial 10개 — 패스트볼만, 최대 노력 (max effort), pitcher 가 자연스러운 mechanic 으로 던지기'),
  num('각 trial 사이 30초 휴식 (피로 효과 최소화)'),
  num('각 trial 의 ball speed (Rapsodo 또는 radar gun) 동시 기록 → 측정 결과와 매칭'),

  h2('§4.3 trial 검증'),
  bullet('각 trial 후 V3D 로 quick-check — Pelvis, Trunk, Pitching arm 의 angle 데이터가 reasonable 범위에 있는지'),
  bullet('GRF 의 FP1 (뒷발) Z 축 peak 가 100~150 %BW, FP2 (앞발) Z 축 peak 가 200~240 %BW 범위에 있는지'),
  bullet('이상치 trial (jumping off mound, 정적 자세 다름 등) 은 즉석 제외 후 재측정'),

  // §5 Theia 처리
  h1('§5. Theia 마커리스 처리'),
  h2('§5.1 데이터 추출'),
  num('Theia 소프트웨어에서 trial 별로 pose estimation 수행 → 각 trial 의 .c3d 파일 export'),
  num('Pose 추출 후 각 keypoint 의 confidence score 점검 — confidence < 0.7 인 frame 이 많으면 (10% 초과) 해당 trial 제외 또는 카메라 occlusion 점검'),
  num('c3d 파일 export 시 — Theia 의 모든 segment angle (Pelvis_Angle, Trunk_Angle, Pitching_Shoulder_Angle, Pitching_Elbow_Angle, Trunk_wrt_Pelvis_Angle, Lead_Knee_Angle, Pitching_Hand_Ang_Vel, etc.) 포함되도록 설정'),

  h2('§5.2 c3d 검증'),
  bullet('c3d 파일을 V3D 또는 c3d viewer (Mokka 등) 로 열어 segment 가 제대로 정의되었는지'),
  bullet('Trunk_Angle_X (전후 굴곡), Trunk_Angle_Y (좌우 굴곡), Trunk_Angle_Z (수평면 회전) 이 모두 존재하는지'),
  bullet('Pitching_Shoulder_Angle_Z (shoulder rotation, layback) 데이터가 throw 동안 외회전 (양수) 으로 변화하는지'),

  // §6 Visual3D 처리
  h1('§6. Visual3D 처리 — Driveline 변인 산출'),

  h2('§6.1 Pipeline 구성'),
  num('새 V3D Workspace 만들기 → Static + 투구 trial 10개 import (.c3d)'),
  num('Pipeline 1: Static calibration → Set as Reference'),
  num('Pipeline 2: 각 trial 에 대해 Filter (Butterworth low-pass 12 Hz, 4th order) 적용'),
  num('Pipeline 3: Event detection (FC, MER, BR — §6.2 참고)'),
  num('Pipeline 4: Driveline 변인 산출 (§6.3)'),
  num('Pipeline 5: 분절간 ETE — timing 기반 (§6.4)'),
  num('Pipeline 6: 분절 역학적 에너지 + 관절 파워 — kinetic 기반 (§6.5)'),
  num('Pipeline 7: GRF 변인 산출 (§6.6)'),
  num('Pipeline 8: Export to .c3d.txt + .csv (§6.7)'),

  h2('§6.2 Events 자동 검출'),
  tbl([
    ['Event', '약자', '검출 방법', '대시보드 사용'],
    ['Foot Contact', 'FC', 'FP2 (앞발) Z 축 reading > 50 N (체중의 ~10%) 처음 frame', '필수'],
    ['Maximum External Rotation', 'MER', 'Pitching_Shoulder_Angle_Z 가 max 인 frame', '필수'],
    ['Ball Release', 'BR', 'Pitching_Hand 가 가장 빠르게 가속 후 감속 시작 frame', '필수'],
    ['Foot Strike', 'FS', '= FC (alias)', '대시보드 alias'],
    ['Release', 'REL', '= BR (alias)', '대시보드 alias'],
  ], [0.30, 0.10, 0.42, 0.18]),
  p('', {spacing:{after:80}}),

  note('대시보드 v5.34 부터 Footstrike/Release event 가 잘못 마킹되어도 (Visual3D auto-detect 실패 시) FP1_Z 활성 block 으로 event-free 검출. 그러나 가능한 경우 정확히 마킹 권장.', COLOR.accent),

  h2('§6.3 Driveline 5 모델 변인 산출 (V3D Custom Calc)'),

  h3('Arm Action (팔동작) 6 변인'),
  tbl([
    ['변인', '정의', 'V3D 산출식', '단위'],
    ['Layback (어깨 최대 외회전)', 'Pitching shoulder Z axis 회전 max', 'MAX(Pitching_Shoulder_Angle_Z)', 'deg'],
    ['Elbow Extension Velo', 'Pitching elbow extension peak ang velocity', 'MAX(d/dt(Pitching_Elbow_Angle_X))', 'deg/s'],
    ['Shoulder Abduction at FP', '어깨 외전 (frontal plane) at FC', 'Pitching_Shoulder_Angle_Y at FC', 'deg'],
    ['Scap Load at FP', 'Lead shoulder X axis at FC. ', 'LEAD_Shoulder_Angle_X at FC', 'deg'],
    ['Shoulder Rotation Velo', 'Pitching shoulder peak rotation ang velocity', 'MAX(d/dt(Pitching_Shoulder_Angle_Z))', 'deg/s'],
    ['Elbow Flexion at FP', 'Pitching elbow flexion at FC', 'Pitching_Elbow_Angle_X at FC', 'deg'],
  ], [0.27, 0.30, 0.30, 0.13]),
  p('', {spacing:{after:80}}),
  note('※ Scap Load 정의 — Driveline 표준은 LEAD shoulder X axis (lead = glove side). PITCHING shoulder X 사용 시 부호 반대 → 반드시 LEAD shoulder 추출. 한국 markerless 에서 LEAD shoulder X 컬럼이 없으면 PITCHING_Shoulder_Angle_X * (-1) 사용.', COLOR.bad),

  h3('Posture (자세) 6 변인'),
  tbl([
    ['변인', '정의', 'V3D 산출식', '단위'],
    ['Peak Hip-Shoulder Sep at FP (X-factor)', '골반-몸통 상대 회전 max', 'MAX(Trunk_wrt_Pelvis_Angle_Z)', 'deg'],
    ['Peak Torso Counter Rot', '수평면 절대 trunk Z. windup 단계 max (3루쪽 깊은 회전)', 'MAX(Trunk_Angle_Z) before FC. 부호 음수 (windup load)', 'deg'],
    ['Torso Forward Tilt at FP', '시상면 trunk X (전후). + 앞 / − 뒤', 'Trunk_Angle_X at FC', 'deg'],
    ['Torso Rotation at FP', '수평면 trunk Z at FC. 3루 정면 = 0°, 홈 = 90°', 'Trunk_Angle_Z at FC (lab frame)', 'deg'],
    ['Torso Side Bend at MER', '관상면 trunk Y at MER', 'Trunk_Angle_Y at MER', 'deg'],
    ['Torso Rotation at BR', '수평면 trunk Z at BR. 3루 = 0°, 홈 = 90°', 'Trunk_Angle_Z at BR', 'deg'],
  ], [0.32, 0.32, 0.26, 0.10]),
  p('', {spacing:{after:80}}),
  note('Counter Rot 부호 caveat — Driveline Elite ≈ −38° (windup 시 trunk 가 X+ 축 (3루) 방향으로 깊게 회전). 본 좌표계에서 자동 산출. 추가 부호 반전 불요.', COLOR.accent),

  h3('Rotation (회전 속도) 2 변인'),
  tbl([
    ['변인', '정의', 'V3D 산출식', '단위'],
    ['Torso Rotation Velo', 'Trunk Z 축 peak angular velocity', 'MAX(d/dt(Trunk_Angle_Z))', 'deg/s'],
    ['Pelvis Rotation Velo', 'Pelvis Z 축 peak angular velocity', 'MAX(d/dt(Pelvis_Angle_Z))', 'deg/s'],
  ], [0.27, 0.30, 0.30, 0.13]),
  p('', {spacing:{after:80}}),

  h3('Block (앞다리 제동) 4 변인'),
  tbl([
    ['변인', '정의', 'V3D 산출식', '단위'],
    ['Lead Knee Extension', 'FC→BR 무릎 신전 변화량', 'Lead_Knee_Angle_X(BR) − Lead_Knee_Angle_X(FC). + 양수 = 신전, − 무너짐', 'deg'],
    ['Stride Length', 'Drive 발 → Lead 발 horizontal distance', '|Lead_Foot_Y − Drive_Foot_Y| at FC. cm 단위', 'cm'],
    ['CoG Decel AE (Above Expected)', 'CoG_Decel 의 회귀 잔차 (구속 대비)', '실제 CoG_Decel − (0.0073×ball_speed_kmh + 0.269)', 'm/s'],
    ['Peak Lead Knee Ext Velo', 'Lead knee extension peak angular velocity', 'MAX(d/dt(Lead_Knee_Angle_X))', 'deg/s'],
  ], [0.27, 0.30, 0.30, 0.13]),
  p('', {spacing:{after:80}}),

  h3('CoG (체중이동) 2 변인'),
  tbl([
    ['변인', '정의', 'V3D 산출식', '단위'],
    ['CoG Decel', 'whole-body CoG forward velocity max - velocity at BR', 'MAX(CoG_velocity_Y) − CoG_velocity_Y at BR', 'm/s'],
    ['Max CoG Velo', 'whole-body CoG forward velocity peak', 'MAX(CoG_velocity_Y)', 'm/s'],
  ], [0.27, 0.30, 0.30, 0.13]),
  p('', {spacing:{after:80}}),

  h2('§6.4 에너지 흐름 변인 — 분절간 ETE (proximal-to-distal)'),
  p([{text:'5 분절 peak 시각의 lag (ms 단위) — 골반 → 몸통 → 위팔 → 아래팔 → 손'}]),

  tbl([
    ['Transition', '정의', 'V3D 산출식', 'Elite 범위'],
    ['Pelvis → Trunk', 'Trunk peak ω time − Pelvis peak ω time', 't(MAX(d/dt(Trunk_Angle_Z))) − t(MAX(d/dt(Pelvis_Angle_Z)))', '5–25 ms'],
    ['Trunk → Humerus', 'Humerus peak ω time − Trunk peak ω time', 't(MAX(d/dt(Pitching_Humerus_Angle))) − t(MAX(d/dt(Trunk_Angle_Z)))', '50–110 ms'],
    ['Humerus → Forearm', 'Forearm peak ω time − Humerus peak ω time', 't(MAX(d/dt(R_Forearm_Angle))) − t(MAX(d/dt(Pitching_Humerus)))', '10–25 ms'],
    ['Forearm → Hand', 'Hand peak ω time − Forearm peak ω time', 't(MAX(d/dt(Pitching_Hand_Angle))) − t(MAX(d/dt(R_Forearm)))', '5–15 ms'],
  ], [0.20, 0.30, 0.40, 0.10]),
  p('', {spacing:{after:80}}),

  p([{text:'Speed Gain', bold:true},{text:' = 다음 분절 peak ω / 현재 분절 peak ω. 정상 범위:'}]),
  bullet('Pelvis → Trunk: 1.3–1.7×'),
  bullet('Trunk → Humerus: 4.0–6.0×'),
  bullet('Humerus → Forearm: 1.1–1.4×'),
  bullet('Forearm → Hand: 1.0–1.3×'),

  h2('§6.5 GRF 변인 (Force Plate FP1=뒷발, FP2=앞발)'),

  h3('수평 + 임펄스 + 타이밍'),
  tbl([
    ['변인', '발', 'V3D 산출식', 'Elite (%BW)'],
    ['Drive AP Peak (propulsive)', 'FP1', 'MAX(FP1_Y) / BW × 100. push toward home (+ Y)', '55–80'],
    ['Drive AP Impulse', 'FP1', '∫FP1_Y dt over active block / BW × 100', '18–28 %BW·s'],
    ['Drive Z Peak (vertical)', 'FP1', 'MAX(FP1_Z) / BW × 100', '135–165'],
    ['Lead AP Peak (braking)', 'FP2', 'MAX(|FP2_Y|) / BW × 100. resist forward (− Y)', '100–145'],
    ['Lead AP Impulse', 'FP2', '∫|FP2_Y| dt over braking phase / BW × 100', '18–28 %BW·s'],
    ['Lead Z Peak (vertical)', 'FP2', 'MAX(FP2_Z) / BW × 100', '195–240'],
  ], [0.24, 0.08, 0.50, 0.18]),
  p('', {spacing:{after:80}}),

  h3('NewtForce 8 변인 (Florida Baseball Armory 표준)'),
  tbl([
    ['변인', '정의'],
    ['Time of Transfer', 'FP1 Z peak → FP2 Z peak 시간 (ms). 운동량 전달 효율'],
    ['Back Z peak', 'FP1 (뒷발) Z 축 peak (%BW)'],
    ['Lead Z peak', 'FP2 (앞발) Z 축 peak (%BW)'],
    ['Turning Point Z', 'FP1 Z 가 감소하기 시작할 때의 값 (%BW)'],
    ['Lead Negative Y (clawback)', 'FP2 Y 축 음수 peak after BR (%BW)'],
    ['Drive Y peak', 'FP1 Y 축 peak forward (%BW)'],
    ['Lead Y peak (braking)', 'FP2 Y 축 negative peak braking (%BW)'],
    ['Lead block duration', 'FC → BR 시간 동안 FP2 Z 활성 (ms)'],
  ], [0.30, 0.70]),
  p('', {spacing:{after:80}}),

  h2('§6.6 Export — c3d.txt + JSON'),
  num('V3D File > Export > C3D Text 선택. 모든 segment angle, ang vel, GRF (FP1·FP2 X/Y/Z), CoG, events, peak frames 포함하여 export.'),
  num('Export 파일명 규칙: {선수명}_{날짜}_{trial번호}.c3d.txt (예: LYH_2026-05-15_1.c3d.txt)'),
  num('파일을 대시보드의 Theia Import 창에 drag-drop. 자동으로 5 모델 라디아 + 시퀀스 + GRF + 에너지 손실 Top 3 그려짐.'),

  // §7 데이터 검증
  h1('§7. 데이터 검증 (Trial 단위 + Player 단위)'),

  h2('§7.1 Trial 단위 — 자동 거부 기준'),
  bullet('Pelvis_Angle_Z range > 250° → 회전 over-rotation 의심, trial 제외'),
  bullet('Pitching_Shoulder_Angle_Z (Layback) max > 230° → 측정 오류, trial 제외'),
  bullet('FP1, FP2 Z peak < 50 %BW → ground contact 미감지, trial 제외'),
  bullet('Pitching_Hand peak ω > 20000 °/s → 측정 오류 (보통 5000~6000), trial 제외'),
  bullet('Footstrike 또는 Release event 가 trial 시작 frame (frame 1) 에 있음 → 자동 검출 실패, trial 제외 (대시보드 v5.34 event-free fallback 으로 일부 복원 가능)'),

  h2('§7.2 Player 단위 — 9~10 trial 합성 후 점검'),
  bullet('합성 (median) 값이 KR cohort 분포 (n=59) 의 ±3σ 이내'),
  bullet('Driveline 5 모델 점수가 모두 50~150 범위 (밖이면 알고리즘 오류)'),
  bullet('Mechanical Ceiling 산출 = 측정 구속 + 14~20 km/h 이내 (그 이상이면 일부 변인이 elite 대비 너무 부족 — 점검 필요)'),

  // §8 자주 발생하는 오류
  h1('§8. 자주 발생하는 오류 + 체크리스트'),

  tbl([
    ['오류', '원인', '해결'],
    ['Counter Rot 양수 출력 (Elite −38° 인데 +40° 등)', 'lab frame X 축 방향 반대 (1루 방향으로 설정됨)', '캘리브레이션 wand 재설정. X 축 = 3루 방향'],
    ['Torso Rotation at FP 가 90° 가까이 (Elite 2°)', 'lab frame Y 축이 3루 방향 (홈이어야 함)', 'Y 축 = 홈 방향으로 재캘리브레이션'],
    ['Drive AP 음수 큰 값', 'FP1 Y 축 부호 반전 (홈 → 마운드 방향)', 'AMTI 채널 매핑 점검'],
    ['Scap Load 부호 반대 (Elite +51° vs 본인 −41°)', 'PITCHING shoulder X 사용 (LEAD 사용해야)', 'V3D 에서 LEAD_Shoulder_Angle_X 추출. 또는 부호 × −1'],
    ['CoG_Decel = 0 또는 미산출', 'whole-body CoG 계산 안 함', 'V3D Whole_Body_CoM 모델 활성화. CoM_velocity_Y 시계열 산출'],
    ['Lead AP GRF 미산출', 'Footstrike event 잘못 (trial 1번 frame)', 'event-free fallback (FP1_Z 활성 block 검출) — 대시보드 v5.34 자동 처리'],
    ['트라이얼 6, 10 만 outlier', 'Visual3D auto event detection 실패', '나머지 8 trial 만 합성. 또는 manual event 마킹'],
  ], [0.30, 0.30, 0.40]),
  p('', {spacing:{after:80}}),

  h2('§8.1 측정 직전 체크리스트 (5분 점검)'),
  num('☐ Force plate Tare (5초 정적 측정 후 Z = 0 ± 5 N)'),
  num('☐ Theia 카메라 calibration RMSE < 1 mm'),
  num('☐ Lab frame X (3루), Y (홈), Z (위) 정렬'),
  num('☐ FP1 = 뒷발, FP2 = 앞발 매핑 확인 (테스트 발 올림 → 채널 점검)'),
  num('☐ Theia + AMTI 동기화 (외부 trigger or V3D sync)'),
  num('☐ Pitcher 정보 (신장/체중/우투좌투) 입력'),
  num('☐ 정적 1 trial + 투구 10 trial 측정 + Rapsodo 동시 기록'),

  // §9 부록
  h1('§9. 부록 — 변인 매핑 표 (대시보드 입력 형식)'),

  h2('§9.1 c3d.txt → 대시보드 record JSON 매핑'),
  tbl([
    ['c3d.txt 컬럼명', '대시보드 record 필드', '설명'],
    ['Trunk_Angle_X', 'faults.trunk_tilt_at_fc_deg', 'Forward tilt at FP'],
    ['Trunk_Angle_Z (at FC)', 'faults.torso_rot_fp_deg (90 − value)', 'Trunk rotation at FP. 90 − lab_z 변환 적용 (대시보드 자동)'],
    ['Trunk_Angle_Z (at BR)', 'faults.torso_rot_br_deg (90 − value)', 'Trunk rotation at BR'],
    ['Trunk_Angle_Z (peak before FC)', 'faults.torso_counter_rot_deg', 'Counter Rot peak'],
    ['Pitching_Shoulder_Angle_Z (max)', 'faults.shoulder_er_max_deg', 'Layback'],
    ['Pitching_Shoulder_Angle_Y (at FC)', 'faults.shoulder_abd_fp_deg', 'Shoulder abduction at FP'],
    ['LEAD_Shoulder_Angle_X (at FC)', 'faults.scap_load_fp_deg', 'Scap load (LEAD shoulder)'],
    ['Trunk_wrt_Pelvis_Angle_Z (max)', 'faults.x_factor_deg', 'Hip-shoulder separation peak'],
    ['Lead_Knee_Angle_X (BR − FC)', 'faults.lead_knee_change', 'Lead knee extension change'],
    ['Pelvis_Angle_Z (peak ω)', 'sequence.pelvis_dps', 'Pelvis rotation velocity'],
    ['Trunk_Angle_Z (peak ω)', 'sequence.trunk_dps', 'Trunk rotation velocity'],
    ['Pitching_Humerus_Ang_Vel (peak)', 'sequence.arm_dps', 'Humerus peak ω'],
    ['Whole_Body_CoM_Velocity_Y (max)', 'cog.max_velo', 'Max CoG velocity'],
    ['Whole_Body_CoM_Velocity_Y (max−BR)', 'cog.decel', 'CoG deceleration'],
    ['FP1_Y (peak forward)', 'grf.drive_propulsive_peak_pct_bw', 'Drive AP peak'],
    ['FP1_Y (impulse)', 'grf.drive_propulsive_impulse_pct_bw_s', 'Drive AP impulse'],
    ['FP2_Y (peak backward)', 'grf.lead_braking_peak_pct_bw', 'Lead AP peak'],
    ['FP1_Z (peak)', 'grf.rear_force_pct', 'Drive Z peak'],
    ['FP2_Z (peak)', 'grf.lead_force_pct', 'Lead Z peak'],
  ], [0.36, 0.32, 0.32]),
  p('', {spacing:{after:120}}),

  h2('§9.2 학술 reference'),
  bullet('Driveline Pitching Assessment — Mechanical Composite Scores+ (5 모델 standard)'),
  bullet('Aguinaldo & Escamilla 2007/2019 — proximal-to-distal sequencing'),
  bullet('Naito & Fujii 2008 — kinetic chain energy transfer'),
  bullet('Howenstein et al 2020 — pitching biomechanics open biomechanics'),
  bullet('MacWilliams et al 1998 — lead leg block mechanics'),
  bullet('Kageyama et al 2014 — drive leg propulsion'),
  bullet('Werner et al 2008 — shoulder + lead leg in baseball pitching'),
  bullet('Florida Baseball Armory NewtForce 8 변인 (Vanderbilt, TCU, Twins 사용)'),

  // 마무리
  p([{text:'문의: ', bold:true},{text:'국민대 스포츠과학과 / kklee@kookmin.ac.kr'}], {spacing:{before:200, after:60}}),
  p([{text:'대시보드: https://kkl0511.github.io/Dashboard_Pitching_Team', size:SZ.small, color:COLOR.accent}], {spacing:{after:60}}),
  p([{text:'본 매뉴얼은 v5.40 알고리즘 기준. 후속 업데이트는 GitHub HANDOFF 문서 참조.', size:SZ.small, italic:true, color:COLOR.muted}]),
];

// Document
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
      {id:'Heading4', name:'Heading 4', basedOn:'Normal', next:'Normal', quickFormat:true,
       run:{size:SZ.h4, bold:true, color:'424A53', font:FONT},
       paragraph:{spacing:{before:100, after:50}, outlineLevel:3}},
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
        size: {width: 11906, height: 16838},  // A4
        margin: {top: 1080, right: 1080, bottom: 1080, left: 1080}  // 0.75 inch
      }
    },
    headers: {
      default: new Header({children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({text:'상동고 투구 리포트 매뉴얼 v1.0 — 측정·분석 워크플로우', size:14, color:COLOR.muted, font:FONT})]
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

const outPath = process.argv[2] || 'V3D_Manual_상동고_v1.0.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${outPath} (${(buf.length/1024).toFixed(1)} KB)`);
});
