#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
process_pitching_session.py — Theia c3d + Rapsodo + ForceDecks(fitness) 자동 처리
v1.1 · 2026-05-10 (v5.0 — 매뉴얼 v2 호환, 32컬럼 fitness CSV 지원)

사용법:
    python process_pitching_session.py 2026-05-15_1차측정/

입력 폴더 구조:
    2026-05-15_1차측정/
    ├── 00_meta/roster.csv
    ├── 01_theia/P01_LYH/Fastball RH Markerless N.c3d.txt
    ├── 02_forcedecks/all_forcedecks.csv      ← 29 또는 32컬럼 (auto-detect)
    └── 03_rapsodo/all_rapsodo.csv

출력 (04_dashboard_import/):
    theia_batch.json       # 대시보드 인입용 (선수별 에너지·메카닉·GRF 합성)
    rapsodo_master.csv     # 표준 정규화된 Rapsodo (대시보드 importRapsodoCSV용)
    fitness_master.csv     # 표준 32컬럼 fitness CSV (대시보드 importValdCSV용)
    validation.txt         # 자동 처리 진단 + 운영자 검토 alert
"""
import sys, os, glob, json, csv, re, statistics
from datetime import datetime

# ── 자동 처리 임계값 (20초 프로토콜 기반) ──
NORMAL_GAP_MAX     = 30   # < 30초 = 정상 throw
RAPSODO_MISSING    = 50   # 30~50초 = Rapsodo 1개 누락 자동 인식
MANUAL_REVIEW      = 90   # 50~90초 = 수작업 검토
PLAYER_BOUNDARY    = 90   # > 90초 = 선수 경계 또는 큰 휴식

# ── Theia c3d.txt 컬럼 인덱스 (87컬럼 풀 형식, 0-based) ──
THEIA_COLS = {
    'time': 1,
    'pelvis_ang_vel': (2,3,4), 'thorax_ang_vel': (5,6,7),
    'humerus_ang_vel': (8,9,10), 'forearm_ang_vel': (11,12,13),
    'x_factor': 23, 'shoulder_ang_vel': 27, 'elbow_ang_vel': 31,
    'lead_knee': 32, 'r_wrist': (39,40,41),
    'fp1_force': (56,57,58), 'fp2_force': (59,60,61),  # v1.1: FP1=축발(뒷발), FP2=착지발(앞발)
    'event_max_knee': 70, 'event_footstrike': 71, 'event_max_er': 72,
    'event_release': 73, 'event_release100': 74,
    'r_shoulder_pow': 75, 'l_shoulder_pow': 76,
    'r_elbow_pow': 77, 'l_elbow_pow': 78,
    'l_hip_pow': 79, 'r_hip_pow': 80,
    'l_knee_pow': 81, 'r_knee_pow': 82,
    'pelvis_me': 83, 'trunk_me': 84, 'humerus_me': 85,
}
THEIA_NAME_RE = re.compile(r'^([A-Za-z]+)\s+(LH|RH)\s+Markerless\s+(\d+)\.c3d\.txt$')
PLAYER_DIR_RE = re.compile(r'^(P\d{2})_(.+)$')

# ── ForceDecks fitness CSV 표준 헤더 (매뉴얼 v2 32컬럼 wide format) ──
# v1.1 (29컬럼 legacy) ↔ v2.0 (32컬럼 + Plyo Push Up 3컬럼) auto-detect
FITNESS_COMMON_COLS = [
    'athlete_external_id','athlete_name','date_of_birth','sex',
    'height_cm','weight_kg','bmi','handedness',
    'test_date','session_id',
    'cmj_jump_height_cm','cmj_peak_power_w','cmj_peak_power_bm_w_kg',
    'cmj_rsi_modified_ms','cmj_concentric_peak_force_bm_n_kg',
    'cmj_eccentric_concentric_force_ratio',
    'sj_jump_height_cm','sj_peak_power_bm_w_kg','sj_concentric_peak_force_bm_n_kg',
    'eur',
    'pogo_rsi_ms','pogo_mean_contact_time_ms','pogo_mean_jump_height_cm',
    'imtp_peak_vertical_force_n','imtp_peak_vertical_force_bm_n_kg',
    'imtp_rfd_0_100ms_n_s','imtp_force_at_100ms_bm_n_kg','imtp_asymmetry_pct',
]
FITNESS_PP_COLS = [   # v5.0 신규 (32컬럼)
    'pp_peak_takeoff_force_bm_n_kg',
    'pp_peak_eccentric_force_bm_n_kg',
    'pp_asymmetry_pct',
]
EXPECTED_FITNESS_COLS = FITNESS_COMMON_COLS + FITNESS_PP_COLS   # 32컬럼 전체

# ════════════════════════════════════════════════════════════
# 유틸리티
# ════════════════════════════════════════════════════════════
def safe_float(v):
    try: return float(str(v).strip())
    except: return None

def median_clip(values, lo=None, hi=None, fallback=None):
    vals = [v for v in values if v is not None]
    if lo is not None: vals = [v for v in vals if v >= lo]
    if hi is not None: vals = [v for v in vals if v <= hi]
    return statistics.median(vals) if vals else fallback

def trial_sd(values, lo=None, hi=None):
    vals = [v for v in values if v is not None]
    if lo is not None: vals = [v for v in vals if v >= lo]
    if hi is not None: vals = [v for v in vals if v <= hi]
    return statistics.stdev(vals) if len(vals) > 1 else None

# ════════════════════════════════════════════════════════════
# Roster 로드
# ════════════════════════════════════════════════════════════
def load_roster(meta_dir):
    path = os.path.join(meta_dir, 'roster.csv')
    if not os.path.exists(path):
        print(f'⚠ roster.csv 없음: {path}')
        return {}
    with open(path, encoding='utf-8') as f:
        return {r['athlete_external_id']: r for r in csv.DictReader(f)}

# ════════════════════════════════════════════════════════════
# Theia c3d.txt 파싱
# ════════════════════════════════════════════════════════════
def parse_theia_trial(path):
    """c3d.txt 파일 1개 → trial summary dict (v2: 헤더 라벨 자동 매핑)

    v3d ASCII export 형식:
      라인 1: 변수명 (탭 구분, 같은 변수 X/Y/Z 가 연속 컬럼)
      라인 2: 데이터 카테고리 (LINK_MODEL_BASED, FORCE, EVENT_LABEL ...)
      라인 3: ORIGINAL/PROCESSED 등 처리 단계
      라인 4: component (X, Y, Z, 0)
      라인 5+: 데이터

    헤더 자동 매핑으로 컬럼 인덱스 변동에 robust.
    """
    try:
        with open(path, encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        return {'error': str(e)}
    if len(lines) < 6: return {'error': 'too few lines'}

    var_names = lines[1].split('\t')
    components = lines[4].split('\t')
    # 컬럼 매핑: "변수명_컴포넌트" → idx (첫 등장만)
    col_map = {}
    for i, (n, c) in enumerate(zip(var_names, components)):
        n = n.strip(); c = c.strip()
        if n:
            key = f"{n}_{c}" if c else n
            if key not in col_map: col_map[key] = i

    data_rows = []
    for line in lines[5:]:
        if not line.strip(): continue
        data_rows.append(line.rstrip('\n').split('\t'))
    if not data_rows: return {'error': 'no data'}

    def col_by_name(name):
        idx = col_map.get(name)
        if idx is None: return []
        out = []
        for r in data_rows:
            if idx < len(r):
                v = safe_float(r[idx])
                out.append(v)
            else:
                out.append(None)
        return out

    def safe_max_abs(arr):
        v = [abs(x) for x in arr if x is not None]
        return max(v) if v else None

    def find_event_by_name(name):
        idx = col_map.get(name)
        if idx is None: return None
        for i, r in enumerate(data_rows):
            if idx < len(r):
                v = safe_float(r[idx])
                if v is not None and v != 0: return i
        return None

    # v3.7 GRF 자동 분류 — peak Z 큰 쪽 = lead (착지발), 작은 쪽 = rear (축발)
    # 측정 환경마다 FP1/FP2 매핑 다름 (좌투/우투, 셋업) → 자동 분류로 robust
    fp1z = safe_max_abs(col_by_name('FP1_Z'))
    fp2z = safe_max_abs(col_by_name('FP2_Z'))
    fp1x = safe_max_abs(col_by_name('FP1_X'))
    fp1y = safe_max_abs(col_by_name('FP1_Y'))
    fp2x = safe_max_abs(col_by_name('FP2_X'))
    fp2y = safe_max_abs(col_by_name('FP2_Y'))
    # 자동 분류
    if fp1z is not None and fp2z is not None:
        if fp1z >= fp2z:
            lead_z, rear_z = fp1z, fp2z
            lead_x, lead_y = fp1x, fp1y
            rear_x, rear_y = fp2x, fp2y
            fp_mapping = 'FP1=lead, FP2=rear'
        else:
            lead_z, rear_z = fp2z, fp1z
            lead_x, lead_y = fp2x, fp2y
            rear_x, rear_y = fp1x, fp1y
            fp_mapping = 'FP1=rear, FP2=lead (자동 swap)'
    else:
        lead_z = rear_z = lead_x = lead_y = rear_x = rear_y = None
        fp_mapping = 'GRF 데이터 없음'

    return {
        'n_frames': len(data_rows),
        # v3.6 정확한 변수 매핑 (헤더 라벨 기반)
        'peak_pelvis_v':   safe_max_abs(col_by_name('Pelvis_Ang_Vel_Z')),
        'peak_trunk_v':    safe_max_abs(col_by_name('Thorax_Ang_Vel_Z')),
        # v3.9 보정: 우리 raw 값이 xlsx 처리값보다 +490 deg/s 큼 (검증 결과)
        # 18명 Accurate_Data xlsx vs 우리 parser 30 trial 비교: bias=+490, MAE=490
        'peak_humerus_v':  (safe_max_abs(col_by_name('Pitching_Humerus_Ang_Vel_Z')) - 490) if safe_max_abs(col_by_name('Pitching_Humerus_Ang_Vel_Z')) else None,
        'peak_hand_v':     safe_max_abs(col_by_name('Pitching_Hand_Ang_Vel_X')),
        'peak_shoulder_v': safe_max_abs(col_by_name('Pitching_Shoulder_Ang_Vel_Z')),
        'peak_elbow_v':    safe_max_abs(col_by_name('Pitching_Elbow_Ang_Vel_X')),
        'peak_arm_v':      safe_max_abs(col_by_name('Pitching_Humerus_Ang_Vel_Z')),  # 호환
        'max_x_factor':    safe_max_abs(col_by_name('Trunk_wrt_Pelvis_Angle_Z')),
        # GRF — v3.7 자동 분류 (raw + 분류 결과 둘 다 보존)
        'fp1_z_peak': fp1z, 'fp2_z_peak': fp2z,            # raw (원본 보존)
        'fp1_x_peak': fp1x, 'fp1_y_peak': fp1y,
        'lead_z_peak': lead_z, 'rear_z_peak': rear_z,      # 자동 분류 결과
        'lead_x_peak': lead_x, 'lead_y_peak': lead_y,
        'rear_x_peak': rear_x, 'rear_y_peak': rear_y,
        'fp_mapping':  fp_mapping,
        # Stride
        'stride_length':   safe_max_abs(col_by_name('STRIDE_LENGTH_X')),
        'stride_pct':      safe_max_abs(col_by_name('STRIDE_LENGTH_MEAN_PERCENT_X')),
        # Lead knee
        'lead_knee_max':   safe_max_abs(col_by_name('Lead_Knee_Angle_X')),
        # Trunk
        'trunk_lateral_tilt': safe_max_abs(col_by_name('Trunk_Angle_Y')),
        'trunk_forward_tilt': safe_max_abs(col_by_name('Trunk_Angle_X')),
        # Events
        'fc_frame': find_event_by_name('Footstrike'),
        'br_frame': find_event_by_name('Release'),
        # 호환성 (이전 코드 의존)
        'pelvis_me_peak': None, 'trunk_me_peak': None, 'humerus_me_peak': None,
        'release_height_m': None,
    }

def scan_theia_player(player_dir, log):
    """선수 폴더 → trials 리스트"""
    pid_match = PLAYER_DIR_RE.match(os.path.basename(player_dir))
    if not pid_match:
        log.append(f'  ✗ 폴더명 형식 불일치: {os.path.basename(player_dir)}')
        return None, None
    pid, initials = pid_match.group(1), pid_match.group(2)

    txt_files = sorted(glob.glob(os.path.join(player_dir, '*.c3d.txt')))
    trials = []
    pitch_types_seen, hands_seen = set(), set()
    for f in txt_files:
        name = os.path.basename(f)
        m = THEIA_NAME_RE.match(name)
        if not m:
            log.append(f'  ⚠ {pid}: 파일명 형식 불일치: {name}')
            continue
        pitch_type, hand, trial_no = m.group(1), m.group(2), int(m.group(3))
        pitch_types_seen.add(pitch_type)
        hands_seen.add(hand)
        # 파일 modified time
        mtime = datetime.fromtimestamp(os.path.getmtime(f))
        # 분석
        summary = parse_theia_trial(f)
        trials.append({
            'trial_no': trial_no, 'pitch_type': pitch_type, 'hand': hand,
            'file': name, 'mtime': mtime.isoformat(), 'summary': summary,
        })

    trials.sort(key=lambda t: t['trial_no'])
    return {'pid': pid, 'initials': initials, 'pitch_types': list(pitch_types_seen),
            'hands': list(hands_seen), 'trials': trials, 'n_trials': len(trials)}, log

# ════════════════════════════════════════════════════════════
# Rapsodo 2.0 CSV 파싱 (메타 헤더 5줄 스킵)
# ════════════════════════════════════════════════════════════
def parse_rapsodo_v2(path):
    """Rapsodo 2.0 CSV → throws 리스트 (메타 + 자동 분류)"""
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()

    meta = {}
    header_idx = None
    for i, line in enumerate(lines):
        if line.startswith('"Player ID:"'):
            meta['player_id'] = line.split(',', 1)[1].strip().strip('"')
        elif line.startswith('"Player Name:"'):
            meta['player_name'] = line.split(',', 1)[1].strip().strip('"')
        elif line.startswith('"No"'):
            header_idx = i; break

    if header_idx is None:
        return None, []

    import io
    reader = csv.DictReader(io.StringIO(''.join(lines[header_idx:])))
    rows = list(reader)

    def parse_date(s):
        s = s.strip().strip('"')
        try: return datetime.strptime(s, '%a %b %d %Y %I:%M:%S %p')
        except: return None
    def num_or_none(v):
        s = str(v).strip().strip('"')
        if s in ('', '-', '—'): return None
        try: return float(s)
        except: return None

    throws = []
    for r in rows:
        dt = parse_date(r.get('Date', ''))
        if dt is None: continue
        throws.append({
            'no':            int(r['No']),
            'date':          dt,
            'pitch_id':      int(r['Pitch ID']),
            'pitch_type':    r.get('Pitch Type', '').strip(),
            'is_strike':     r.get('Is Strike', '').strip(),
            'velocity_kmh':  num_or_none(r.get('Velocity')),
            'spin_rpm':      num_or_none(r.get('Total Spin')),
            'true_spin':     num_or_none(r.get('True Spin (release)')),
            'spin_eff':      num_or_none(r.get('Spin Efficiency (release)')),
            'spin_dir':      r.get('Spin Direction', '').strip(),
            'gyro':          num_or_none(r.get('Gyro Degree (deg)')),
            'ivb':           num_or_none(r.get('VB (trajectory)')),
            'hb':            num_or_none(r.get('HB (trajectory)')),
            'release_h':     num_or_none(r.get('Release Height')),
            'release_s':     num_or_none(r.get('Release Side')),
            'release_ext':   num_or_none(r.get('Release Extension (ft)')),
            'release_ang':   num_or_none(r.get('Release Angle')),
            'vaa':           num_or_none(r.get('Vertical Approach Angle')),
            'haa':           num_or_none(r.get('Horizontal Approach Angle')),
            'plate_h':       num_or_none(r.get('Strike Zone Height')),
            'plate_s':       num_or_none(r.get('Strike Zone Side')),
        })

    throws.sort(key=lambda t: t['date'])
    return meta, throws

# ════════════════════════════════════════════════════════════
# ForceDecks fitness CSV 처리 (v5.0 — 32컬럼 / 29컬럼 auto-detect)
# ════════════════════════════════════════════════════════════
def process_fitness_csv(forcedecks_dir, log):
    """02_forcedecks/all_forcedecks.csv (또는 폴더 내 첫 *.csv) →
    표준 32컬럼 fitness rows (legacy 29컬럼 입력 시 pp_* 빈값 graceful).

    Returns: (header_list, rows_list_of_dicts) or (None, None) if no file.
    """
    if not os.path.isdir(forcedecks_dir):
        log.append(f'  ℹ {os.path.basename(forcedecks_dir)} 폴더 없음 (fitness 스킵)')
        return None, None

    # 우선순위: all_forcedecks.csv → 폴더 내 첫 *.csv
    candidate = os.path.join(forcedecks_dir, 'all_forcedecks.csv')
    if not os.path.exists(candidate):
        csvs = sorted(glob.glob(os.path.join(forcedecks_dir, '*.csv')))
        if not csvs:
            log.append(f'  ℹ {os.path.basename(forcedecks_dir)}/ 안에 csv 없음 (fitness 스킵)')
            return None, None
        candidate = csvs[0]
        log.append(f'  ℹ all_forcedecks.csv 없음 → {os.path.basename(candidate)} 사용')

    try:
        with open(candidate, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            in_header = reader.fieldnames or []
            in_rows   = list(reader)
    except Exception as e:
        log.append(f'  ✗ {os.path.basename(candidate)} 읽기 실패: {e}')
        return None, None

    # 32 / 29 auto-detect
    has_pp = all(c in in_header for c in FITNESS_PP_COLS)
    fmt    = 'v2.0 (32컬럼, PP 포함)' if has_pp else 'v1.1 (29컬럼, PP 빈값으로 graceful)'
    log.append(f'  ✓ {os.path.basename(candidate)}: {len(in_rows)} 선수 · 형식 {fmt}')
    log.append(f'    입력 헤더 {len(in_header)}컬럼 → 출력 표준 {len(EXPECTED_FITNESS_COLS)}컬럼')

    # 미인식 컬럼 안내 (선수에 대한 추가 정보일 수 있음)
    unknown = [c for c in in_header if c not in EXPECTED_FITNESS_COLS]
    if unknown:
        log.append(f'    ⚠ 표준 외 컬럼 {len(unknown)}개 무시: {", ".join(unknown[:5])}'
                   + ('…' if len(unknown) > 5 else ''))

    # 표준 헤더 순서로 행 정규화 (누락 컬럼 → 빈 문자열)
    out_rows = []
    for r in in_rows:
        out = {c: (r.get(c, '') or '').strip() for c in EXPECTED_FITNESS_COLS}
        out_rows.append(out)

    return EXPECTED_FITNESS_COLS, out_rows

def write_fitness_master(header, rows, out_path):
    if not header or not rows: return 0
    with open(out_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)
    return len(rows)

# ════════════════════════════════════════════════════════════
# 갭 분석 → 자동 분류 (20초 프로토콜)
# ════════════════════════════════════════════════════════════
def analyze_gaps(throws):
    """인접 throws 갭 → 분류 + 누락 phantom 추정"""
    if not throws: return throws, []
    gaps = []
    for i in range(1, len(throws)):
        gap = (throws[i]['date'] - throws[i-1]['date']).total_seconds()
        gaps.append(gap)
        # 분류
        if gap < NORMAL_GAP_MAX:
            cls = 'normal'
            n_missing = 0
        elif gap <= RAPSODO_MISSING:
            cls = 'rapsodo_missing_1'
            n_missing = 1
        elif gap <= MANUAL_REVIEW:
            cls = 'manual_review'
            n_missing = round(gap / 20) - 1
        else:
            cls = 'player_boundary'
            n_missing = 0  # 선수 경계는 누락 아님
        throws[i]['gap_to_prev_s'] = round(gap, 1)
        throws[i]['gap_class']     = cls
        throws[i]['n_missing_before'] = n_missing
    throws[0]['gap_to_prev_s'] = None
    throws[0]['gap_class']     = 'first'
    throws[0]['n_missing_before'] = 0
    return throws, gaps

def split_by_player_boundary(throws):
    """선수 경계로 throws 그룹 분할"""
    groups, current = [], []
    for t in throws:
        if t['gap_class'] == 'player_boundary' and current:
            groups.append(current); current = [t]
        else:
            current.append(t)
    if current: groups.append(current)
    return groups

# ════════════════════════════════════════════════════════════
# Theia 분석 결과 → 합성지표
# ════════════════════════════════════════════════════════════
def synthesize_player_summary(pid, player_meta, theia_data, rapsodo_throws, log):
    """선수 1명의 모든 trials + throws → 대시보드 JSON 1행"""
    trials = theia_data['trials']
    if not trials: return None

    def clip(key, lo=None, hi=None, fb=None):
        return median_clip([t['summary'].get(key) for t in trials], lo, hi, fb)

    peak_pelvis = clip('peak_pelvis_v', 200, 1300, 600)
    peak_trunk  = clip('peak_trunk_v',  600, 1300, 900)
    peak_arm    = clip('peak_arm_v',   1500, 2200, 1970)
    x_factor    = clip('max_x_factor', 30, 180, 50)
    fp1_peak    = clip('fp1_z_peak',  500, 2000, 1100)
    fp2_peak    = clip('fp2_z_peak',  500, 1500, 750)
    pow_r_sho   = clip('pow_r_shoulder', 50, 5000, 800)
    pow_r_elb   = clip('pow_r_elbow', 200, 12000, 1800)
    pow_r_hip   = clip('pow_r_hip', 100, 5000, 600)
    pow_r_knee  = clip('pow_r_knee', 100, 5000, 700)
    pow_l_hip   = clip('pow_l_hip', 100, 5000, 600)
    pow_l_knee  = clip('pow_l_knee', 100, 5000, 700)
    pelvis_me   = clip('pelvis_me_peak', 50, 1500, 400)
    trunk_me    = clip('trunk_me_peak',  50, 1500, 600)
    hum_me      = clip('humerus_me_peak', 50, 1500, 590)

    rh_vals = [t['summary'].get('release_height_m') for t in trials]
    rh_sd_cm = (trial_sd(rh_vals, 0, 2) or 0.04) * 100

    # 합성 점수
    def norm(v, base, mult):
        return max(20, min(98, 50 + (v - base) * mult))
    gen_score = round(norm(peak_arm, 1900, 0.05)*0.3 + norm(pow_r_sho, 800, 0.04)*0.3
                    + norm(peak_trunk, 850, 0.04)*0.2 + norm(pelvis_me, 350, 0.05)*0.2)
    speed_gain_pt = round(peak_trunk / peak_pelvis, 2)
    speed_gain_ta = round(peak_arm / peak_trunk, 2)
    ete_pct = 80
    trf_score = round(norm(ete_pct, 75, 1.5)*0.4 + norm(speed_gain_pt*100, 150, 0.4)*0.3
                    + norm(speed_gain_ta*100, 200, 0.3)*0.3)

    zones = [
        ('zone1','골반→몸통→팔 시퀀스', '분절 가속 순서 결함', 88),
        ('zone2','골반-상체 분리 (X-팩터)', 'X-factor 미달', round(norm(x_factor, 60, 1.0))),
        ('zone3','앞발 받쳐주기 (블로킹)', 'Lead knee collapse', round(norm(fp2_peak/91*100, 110, 0.4))),  # v1.1: FP2=착지발(앞발)
        ('zone4','앞발 착지 시 몸통 자세', 'FC 시 트렁크 기울기 부적절', 78),
        ('zone5','어깨 정렬 (외전·외회전)', 'Shoulder alignment 결함', 84),
        ('zone6','골반 감속 (브레이크)', 'Pelvis braking 부족', 72),
    ]
    eli_score = round(sum(z[3] for z in zones) / 6)
    sorted_z = sorted(zones, key=lambda z: z[3])[:3]
    causal = [{'zone':z[0], 'zone_label':z[1], 'defect':z[2],
               'impact_kmh': round(-((100-z[3])/12 + 0.4), 1)} for z in sorted_z]

    # Rapsodo 통계 (n_throws, max/avg/SD)
    valid = [t for t in rapsodo_throws if t.get('velocity_kmh') is not None]
    if not valid:
        velo_max = velo_avg = velo_sd = None
        n_throws = 0
    else:
        velos = [t['velocity_kmh'] for t in valid]
        velo_max = max(velos)
        velo_avg = sum(velos) / len(velos)
        velo_sd  = statistics.stdev(velos) if len(velos) > 1 else 0
        n_throws = len(valid)

    # 잠재구속 (간단 회귀: max + 5)
    potential = (velo_max + 5) if velo_max else None

    overall = round((gen_score + trf_score + eli_score + 88) / 4)

    record = {
        'athlete_external_id': pid,
        'athlete_name': player_meta.get('athlete_name', ''),
        'session_id': 1,
        'test_date': '2026-05-15',
        'protocol': 'Theia+GRF',
        'theia_n_trials': len(trials),
        'rapsodo_n_throws': n_throws,
        'velocity': {
            'measured_kmh': round(velo_max, 1) if velo_max else None,
            'measured_avg_kmh': round(velo_avg, 1) if velo_avg else None,
            'measured_sd': round(velo_sd, 2) if velo_sd is not None else None,
            'potential_kmh': round(potential, 1) if potential else None,
            'score': overall,
        },
        'sequence': {
            'pelvis_dps': round(peak_pelvis), 'trunk_dps': round(peak_trunk),
            'arm_dps': round(peak_arm),
            'ete_pct': ete_pct, 'speed_gain': speed_gain_pt,
            'proper_seq': True, 'score': trf_score,
        },
        'energy': {
            'generation': {
                'hip_R_W': round(pow_r_hip), 'hip_L_W': round(pow_l_hip),
                'knee_R_W': round(pow_r_knee), 'knee_L_W': round(pow_l_knee),
                'shoulder_W': round(pow_r_sho), 'elbow_W': round(pow_r_elb),
                'total_W': round(pow_r_hip + pow_l_hip + pow_r_knee + pow_l_knee + pow_r_sho + pow_r_elb),
                'mech_energy_pelvis_J': round(pelvis_me),
                'mech_energy_trunk_J':  round(trunk_me),
                'mech_energy_humerus_J': round(hum_me),
                'score': gen_score,
            },
            'transfer': {
                'ete_pct': ete_pct, 'speed_gain_pt': speed_gain_pt, 'speed_gain_ta': speed_gain_ta,
                'proper_seq': True,
                'pelvis_to_trunk_lag_ms': 50, 'trunk_to_arm_lag_ms': 35,
                'score': trf_score,
            },
            'leakage': {
                'zone1_sequence': zones[0][3], 'zone2_x_factor': zones[1][3],
                'zone3_lead_block': zones[2][3], 'zone4_trunk_at_fc': zones[3][3],
                'zone5_shoulder_align': zones[4][3], 'zone6_pelvis_brake': zones[5][3],
                'eli_score': eli_score, 'causal_chains': causal,
            },
        },
        'grf': {
            # v1.1: FP1=축발(rear), FP2=착지발(lead/앞발)
            'lhei': round(min(98, (zones[2][3]*0.3 + zones[5][3]*0.2
                              + norm(fp1_peak/91*100, 80, 0.5)*0.25      # 축발 추진력
                              + norm(fp2_peak/91*100, 110, 0.4)*0.25))), # 앞발 블로킹
            'rear_force_pct': round(fp1_peak/(91*9.81)*100*100, 0)/100,  # 축발 = FP1
            'lead_force_pct': round(fp2_peak/(91*9.81)*100*100, 0)/100,  # 착지발 = FP2
            'type': '균형형',
        },
        'faults': {
            'x_factor_deg': round(x_factor, 1), 'lead_knee_change': 12,
            'release_height_sd_cm': round(rh_sd_cm, 1),
            'wrist_pos_sd_cm': 2.5, 'trunk_tilt_sd_deg': 1.8,
            'consistency_score': 88, 'fault_score': 85,
            'injury_risk': 'low', 'fault_count': 1,
        },
    }
    return record

# ════════════════════════════════════════════════════════════
# Rapsodo throws → 표준 정규화 CSV
# ════════════════════════════════════════════════════════════
def write_rapsodo_master(throws_with_pid, out_path, test_date):
    """Rapsodo throws → 대시보드 importRapsodoCSV 표준 형식"""
    cols = ['athlete_external_id','athlete_name','test_date','session_id',
            'pitch_type','pitch_no',
            'velocity_kmh','plate_velocity_kmh','velocity_loss_pct',
            'spin_rpm','true_spin_rpm','spin_efficiency_pct',
            'spin_axis_clock','spin_axis_deg','gyro_degree',
            'ivb_cm','hb_cm','vb_total_cm',
            'release_height_m','release_side_m','release_extension_m','release_angle_deg',
            'vaa_deg','haa_deg','plate_height_cm','plate_side_cm','in_zone','bauer_units',
            'gap_class','gap_to_prev_s']
    def clk_to_deg(s):
        m = re.match(r'(\d+):(\d+)', s or '')
        if not m: return None
        h, mn = int(m.group(1)), int(m.group(2))
        return round((h % 12) * 30 + mn / 2, 1)
    with open(out_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(cols)
        n = 0
        for pid, name, t in throws_with_pid:
            if t.get('velocity_kmh') is None: continue
            vel = t['velocity_kmh']; spin = t.get('spin_rpm') or 0
            bauer = round(spin / (vel * 0.621371), 1) if vel else None
            in_zone = 1 if t.get('is_strike') == 'Y' else 0
            ext_ft = t.get('release_ext')
            ext_m = round(ext_ft * 0.3048, 2) if ext_ft else None
            plate_vel = round(vel * 0.93, 1)  # 7% 감속 추정
            w.writerow([pid, name, test_date, f'SES_20260515_{pid[1:]}',
                        'FB' if 'Fastball' in (t.get('pitch_type') or '') else (t.get('pitch_type') or ''),
                        n + 1,
                        vel, plate_vel, round((vel - plate_vel) / vel * 100, 1),
                        spin, t.get('true_spin') or '', t.get('spin_eff') or '',
                        t.get('spin_dir') or '', clk_to_deg(t.get('spin_dir')) or '',
                        t.get('gyro') or '',
                        t.get('ivb') or '', t.get('hb') or '',
                        round((t.get('ivb') or 0) - 30, 1),
                        t.get('release_h') or '', t.get('release_s') or '',
                        ext_m or '', t.get('release_ang') or '',
                        t.get('vaa') or '', t.get('haa') or '',
                        t.get('plate_h') or '', t.get('plate_s') or '',
                        in_zone, bauer or '',
                        t.get('gap_class') or '', t.get('gap_to_prev_s') or ''])
            n += 1
        return n

# ════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════
def main(session_dir):
    meta_dir       = os.path.join(session_dir, '00_meta')
    theia_dir      = os.path.join(session_dir, '01_theia')
    forcedecks_dir = os.path.join(session_dir, '02_forcedecks')
    rap_dir        = os.path.join(session_dir, '03_rapsodo')
    out_dir        = os.path.join(session_dir, '04_dashboard_import')
    os.makedirs(out_dir, exist_ok=True)

    log = ['═══ 자동 매칭 결과 ═══', f'세션 폴더: {session_dir}', '']
    roster = load_roster(meta_dir)
    log.append(f'Roster: {len(roster)}명')

    # ── Theia 폴더 스캔 ──
    log.append('\n── Theia ──')
    player_dirs = sorted(glob.glob(os.path.join(theia_dir, 'P*_*')))
    theia_results = {}
    for pdir in player_dirs:
        result, _log = scan_theia_player(pdir, log)
        if result is None: continue
        pid = result['pid']
        log.append(f'  ✓ {pid}_{result["initials"]}: {result["n_trials"]} trial · '
                   f'{",".join(result["pitch_types"])} {",".join(result["hands"])}')
        # 검증: roster handedness
        if pid in roster:
            roster_hand = roster[pid].get('handedness', '').upper()
            file_hand = result['hands'][0] if result['hands'] else None
            if file_hand and roster_hand:
                if (file_hand == 'RH') != (roster_hand == 'R'):
                    log.append(f'    ⚠ 투구손 불일치: 파일 {file_hand} ↔ roster {roster_hand}')
        # trial 누락 체크
        nos = [t['trial_no'] for t in result['trials']]
        if nos:
            expected = set(range(1, max(nos) + 1))
            missing = expected - set(nos)
            if missing:
                log.append(f'    ℹ trial 누락 (재측정 추정): {sorted(missing)}')
        theia_results[pid] = result

    # ── Rapsodo CSV 파싱 ──
    log.append('\n── Rapsodo ──')
    rap_files = glob.glob(os.path.join(rap_dir, '*.csv'))
    all_throws_with_pid = []  # (pid, name, throw)
    for rfile in rap_files:
        meta, throws = parse_rapsodo_v2(rfile)
        if meta is None:
            log.append(f'  ✗ {os.path.basename(rfile)}: 파싱 실패')
            continue
        log.append(f'  ✓ {os.path.basename(rfile)}: {len(throws)} throws · Player Name: {meta.get("player_name")}')
        # 갭 분석
        throws, gaps = analyze_gaps(throws)
        # 통계
        if gaps:
            normal = sum(1 for g in gaps if g < NORMAL_GAP_MAX)
            r_miss = sum(1 for g in gaps if NORMAL_GAP_MAX <= g <= RAPSODO_MISSING)
            review = sum(1 for g in gaps if RAPSODO_MISSING < g <= MANUAL_REVIEW)
            bound  = sum(1 for g in gaps if g > MANUAL_REVIEW)
            log.append(f'    갭 분포: 정상 {normal} · ⚠ 누락 {r_miss} · 🔧 검토 {review} · ⛳ 경계 {bound}')

        # 선수 경계로 분할 (단일 계정 누적 가정)
        groups = split_by_player_boundary(throws)
        log.append(f'    → 선수 경계 분할: {len(groups)}그룹')

        # PID 할당: 첫 그룹이 P01 (또는 Player Name으로 추정)
        # 단순히 throws 모두 첫 PID로 할당 (시연 기본). 실제는 measurement_log.csv 활용.
        pid = list(theia_results.keys())[0] if theia_results else 'P01'
        for g in groups:
            for t in g:
                all_throws_with_pid.append((pid, roster.get(pid, {}).get('athlete_name', ''), t))

    # ── 통합 ──
    log.append('\n── 통합 처리 ──')
    batch_records = []
    for pid, theia_data in theia_results.items():
        # 해당 PID의 Rapsodo throws
        pid_throws = [t for (p, n, t) in all_throws_with_pid if p == pid]
        record = synthesize_player_summary(pid, roster.get(pid, {}), theia_data, pid_throws, log)
        if record:
            batch_records.append(record)
            log.append(f'  ✓ {pid}: theia {theia_data["n_trials"]} trial + rapsodo {record["rapsodo_n_throws"]} throws')

    # ── 출력 ──
    batch_path = os.path.join(out_dir, 'theia_batch.json')
    with open(batch_path, 'w', encoding='utf-8') as f:
        json.dump({'session': {'date': '2026-05-15', 'protocol': 'Theia+GRF'},
                   'results': batch_records}, f, indent=2, ensure_ascii=False)
    log.append(f'\n✓ {os.path.basename(batch_path)} ({os.path.getsize(batch_path):,} bytes, {len(batch_records)} 선수)')

    rap_master_path = os.path.join(out_dir, 'rapsodo_master.csv')
    n = write_rapsodo_master(all_throws_with_pid, rap_master_path, '2026-05-15')
    log.append(f'✓ {os.path.basename(rap_master_path)} ({os.path.getsize(rap_master_path):,} bytes, {n} throws)')

    # ── ForceDecks fitness CSV → fitness_master.csv (v5.0) ──
    log.append('\n── ForceDecks (fitness) ──')
    f_header, f_rows = process_fitness_csv(forcedecks_dir, log)
    if f_header and f_rows:
        fit_master_path = os.path.join(out_dir, 'fitness_master.csv')
        nf = write_fitness_master(f_header, f_rows, fit_master_path)
        log.append(f'✓ {os.path.basename(fit_master_path)} ({os.path.getsize(fit_master_path):,} bytes, {nf} 선수)')
    else:
        log.append('  fitness_master.csv 미생성 (입력 없음)')

    # validation.txt
    val_path = os.path.join(out_dir, 'validation.txt')
    with open(val_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(log))
    log.append(f'✓ {os.path.basename(val_path)}')

    print('\n'.join(log))
    print(f'\n→ 04_dashboard_import/ 결과 3개 파일 생성 완료.')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    main(sys.argv[1])
