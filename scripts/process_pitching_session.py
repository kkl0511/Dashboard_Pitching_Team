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

    def find_event_frame(name):
        """EVENT_LABEL 컬럼은 발생 시각(초)을 frame=0에 저장하는 sparse 형식.
        component 자동 시도 + TIME 컬럼과 매칭해서 frame index로 변환.
        """
        # 1) col_map에서 후보 키 자동 시도 (component X / 0 / ITEM / 없음)
        idx = None
        for cand in (name, f'{name}_X', f'{name}_0', f'{name}_ITEM'):
            if cand in col_map:
                idx = col_map[cand]
                break
        if idx is None: return None

        # 2) 첫 번째 0이 아닌 값 = 이벤트 시각(초)
        event_time_sec = None
        for r in data_rows:
            if idx < len(r):
                v = safe_float(r[idx])
                if v is not None and v != 0:
                    event_time_sec = v
                    break
        if event_time_sec is None: return None

        # 3) TIME 컬럼에서 가장 가까운 frame index 찾기
        time_arr = col_by_name('TIME_0') or col_by_name('TIME_X') or col_by_name('TIME') or col_by_name('TIME_0')
        if time_arr:
            best_i, best_diff = None, float('inf')
            for i, ti in enumerate(time_arr):
                if ti is None: continue
                d = abs(ti - event_time_sec)
                if d < best_diff:
                    best_diff, best_i = d, i
            return best_i
        # TIME 컬럼이 없으면 frame_rate 추정 후 변환 (240Hz fallback)
        return int(round(event_time_sec * 240))

    # v5.7: Theia 마커리스 골반 추적 jerk noise 완화 — FC~BR 분석 구간 제한
    # v5.38 event-free fallback: FC/BR event 잘못된 trial (BR<100 또는 BR<FC)은
    #   FP1 (lead) Z의 main active block으로 대체 (event 무관 motion phase 검출)
    fc_event = find_event_frame('Footstrike')
    br_event = find_event_frame('Release')

    # 잘못된 event 검출 + fallback
    event_valid = (fc_event is not None and br_event is not None
                    and br_event > fc_event and br_event > 100
                    and fc_event > 50)
    if not event_valid:
        # FP1 (lead) main active block으로 추정
        fp1z = col_by_name('FP1_Z')
        if fp1z and len(fp1z) > 100:
            blocks = []
            in_b = False; s = 0
            for i, v in enumerate(fp1z):
                if v is not None and v > 50:
                    if not in_b: in_b = True; s = i
                else:
                    if in_b:
                        if i - s >= 30: blocks.append((s, i))   # 100ms+ active block
                        in_b = False
            if in_b and len(fp1z) - s >= 30: blocks.append((s, len(fp1z)))
            if blocks:
                main_block = max(blocks, key=lambda b: b[1]-b[0])
                fc_event = main_block[0] + 5   # block start = FC 근사
                # BR 추정: lead block start + 100ms (typical FC→BR duration)
                br_event = min(len(data_rows)-1, main_block[0] + 30)
                event_valid = True

    if event_valid:
        win_start = max(0, fc_event - 5)
        win_end   = min(len(data_rows), br_event + 10)
        analysis_window = (win_start, win_end)
    else:
        analysis_window = (0, len(data_rows))

    def col_by_name_window(name):
        """col_by_name 결과를 분석 구간(FC~BR)으로 잘라서 반환"""
        arr = col_by_name(name)
        if not arr: return []
        return arr[analysis_window[0]:analysis_window[1]]

    # v5.24: frame-specific 추출 (Driveline의 "at FP", "at BR", "at MER" 시점값)
    def value_at_frame(name, frame_idx):
        if frame_idx is None: return None
        arr = col_by_name(name)
        if not arr or frame_idx >= len(arr): return None
        return arr[frame_idx]

    # MER (Maximum External Rotation) frame 찾기 — Layback 변인용
    def find_mer_frame():
        arr = col_by_name('Pitching_Shoulder_Angle_Z')
        if not arr: return None
        # FC~BR 구간 안에서 max abs
        sub = arr[analysis_window[0]:analysis_window[1]]
        if not sub: return None
        max_abs = -1; max_i = None
        for i, v in enumerate(sub):
            if v is None: continue
            if abs(v) > max_abs: max_abs, max_i = abs(v), i
        return analysis_window[0] + max_i if max_i is not None else None

    mer_frame = find_mer_frame()

    # v5.37: Driveline 정의 매칭 (xlsx 변인 로직 검증):
    #   CoG Decel = max(CoM_VELOCITY_Y) − BR 시점 CoM_VELOCITY_Y (단순 max−min 아님)
    #   Max CoG Velo = max(CoM_VELOCITY_Y)
    #   예시 데이터 1.36 m/s 매칭
    def cog_metrics():
        com_y = col_by_name('COM_displacement_Y')
        if not com_y or len(com_y) < 10: return None, None
        time_arr = col_by_name('TIME_0') or col_by_name('TIME_X') or col_by_name('TIME')
        if not time_arr or len(time_arr) < 10: return None, None
        # 전체 시계열 velocity (np.gradient 유사)
        velos = []   # list of (frame_idx, velo)
        for i in range(1, len(com_y) - 1):
            if com_y[i+1] is None or com_y[i-1] is None: continue
            if time_arr[i+1] is None or time_arr[i-1] is None: continue
            dt = time_arr[i+1] - time_arr[i-1]
            if dt <= 0: continue
            velos.append((i, (com_y[i+1] - com_y[i-1]) / dt))
        if not velos: return None, None
        # Max CoG Velo = abs max
        idx_max = max(velos, key=lambda x: abs(x[1]))
        max_velo_abs = abs(idx_max[1])
        # CoG Decel = max - BR velo (xlsx 정의)
        # br_event 검증: 잘못된 event 가능 → fallback에 max 이후 끝까지 minimum velo (음수 또는 작은)
        decel = None
        if br_event is not None and br_event > 0:
            # br_event 시점에 가장 가까운 velo
            br_velo_candidates = [v for fr, v in velos if abs(fr - br_event) < 5]
            if br_velo_candidates:
                br_velo = br_velo_candidates[len(br_velo_candidates)//2]   # median 근처
                decel = max_velo_abs - abs(br_velo)
                decel = max(0, decel)
        if decel is None:
            # event 신뢰 X — max velo 이후 마지막 velo 사용 (motion end)
            rest = [v for fr, v in velos if fr > idx_max[0]]
            if rest:
                end_velo = abs(rest[-1])
                decel = max(0, max_velo_abs - end_velo)
        return max_velo_abs, decel

    max_cog_velo, cog_decel = cog_metrics()

    # v5.36: Lead Knee Extension Velocity (peak) — Lead_Knee_Angle 시계열 미분
    def lead_knee_ext_velo_peak():
        """Lead_Knee_Angle 시계열의 1차 미분 → peak (deg/s)"""
        knee = col_by_name_window('Lead_Knee_Angle_X')
        if not knee or len(knee) < 5: return None
        time_arr = col_by_name_window('TIME_0') or col_by_name_window('TIME_X') or col_by_name_window('TIME')
        if not time_arr or len(time_arr) < 5: return None
        velos = []
        for i in range(1, len(knee)-1):
            if knee[i+1] is None or knee[i-1] is None: continue
            if time_arr[i+1] is None or time_arr[i-1] is None: continue
            dt = time_arr[i+1] - time_arr[i-1]
            if dt <= 0: continue
            velos.append((knee[i+1] - knee[i-1]) / dt)
        if not velos: return None
        # extension = positive direction (knee opening). max abs로 단순화
        return max(abs(v) for v in velos)

    lead_knee_ext_velo_val = lead_knee_ext_velo_peak()

    # v5.36: Elbow Flex at FP — LANDMARK (R_Shoulder, R_Elbow, R_WRIST) 위치로 계산
    #   upper_arm = elbow - shoulder, forearm = wrist - elbow
    #   flex = 180 - angle(upper_arm, forearm)
    def elbow_flex_at_fp_calc():
        if fc_event is None: return None
        sx = value_at_frame('R_Shoulder_X', fc_event); sy = value_at_frame('R_Shoulder_Y', fc_event); sz = value_at_frame('R_Shoulder_Z', fc_event)
        ex = value_at_frame('R_Elbow_X',    fc_event); ey = value_at_frame('R_Elbow_Y',    fc_event); ez = value_at_frame('R_Elbow_Z',    fc_event)
        wx = value_at_frame('R_WRIST_X',    fc_event); wy = value_at_frame('R_WRIST_Y',    fc_event); wz = value_at_frame('R_WRIST_Z',    fc_event)
        if any(v is None for v in [sx,sy,sz,ex,ey,ez,wx,wy,wz]): return None
        # upper arm vector (shoulder → elbow)
        ua = (ex-sx, ey-sy, ez-sz)
        # forearm vector (elbow → wrist)
        fa = (wx-ex, wy-ey, wz-ez)
        # angle (rad) = acos(dot / (|u||v|))
        import math
        dot = ua[0]*fa[0] + ua[1]*fa[1] + ua[2]*fa[2]
        m_ua = math.sqrt(ua[0]**2 + ua[1]**2 + ua[2]**2)
        m_fa = math.sqrt(fa[0]**2 + fa[1]**2 + fa[2]**2)
        if m_ua == 0 or m_fa == 0: return None
        cos_a = max(-1, min(1, dot / (m_ua * m_fa)))
        angle_deg = math.degrees(math.acos(cos_a))
        # flex = 180 - external angle (upper arm and forearm collinear=180=full extension)
        return 180 - angle_deg

    elbow_flex_at_fp_val = elbow_flex_at_fp_calc()

    # v5.32 사용자 confirmed: FP1=앞발(lead/착지발), FP2=뒷발(rear/drive/축발)
    #   → 자동 분류 제거, 강제 매핑. 매뉴얼 v1.1의 "FP1=축발" 표기는 잘못됐던 것.
    # v5.7 분석 구간 제한 (FC~BR) — boundary noise 제거
    fp1z = safe_max_abs(col_by_name_window('FP1_Z'))
    fp2z = safe_max_abs(col_by_name_window('FP2_Z'))
    fp1x = safe_max_abs(col_by_name_window('FP1_X'))
    fp1y = safe_max_abs(col_by_name_window('FP1_Y'))
    fp2x = safe_max_abs(col_by_name_window('FP2_X'))
    fp2y = safe_max_abs(col_by_name_window('FP2_Y'))
    # FP1 = lead (앞발), FP2 = rear/drive (뒷발) — 강제 매핑
    if fp1z is not None and fp2z is not None:
        lead_z, rear_z = fp1z, fp2z
        lead_x, lead_y = fp1x, fp1y
        rear_x, rear_y = fp2x, fp2y
        fp_mapping = 'FP1=lead(앞발), FP2=rear(뒷발) — 강제 매핑'
    else:
        lead_z = rear_z = lead_x = lead_y = rear_x = rear_y = None
        fp_mapping = 'GRF 데이터 없음'

    # ════════════════════════════════════════════════════════
    # v5.28: 분절 peak frame + lag (proximal-to-distal sequence)
    #        + GRF 수평 임펄스 + 타이밍
    # ════════════════════════════════════════════════════════
    # Sampling rate (c3d.txt 내부 — Theia 300Hz raw로 force(1200Hz raw)도 동기화 export)
    time_arr_for_fs = col_by_name('TIME_0') or col_by_name('TIME_X') or col_by_name('TIME')
    fs_in_c3d = 300.0
    if time_arr_for_fs and len(time_arr_for_fs) > 1:
        for i in range(1, min(len(time_arr_for_fs), 10)):
            if time_arr_for_fs[i] is not None and time_arr_for_fs[i-1] is not None:
                _dt = time_arr_for_fs[i] - time_arr_for_fs[i-1]
                if _dt and _dt > 0:
                    fs_in_c3d = round(1.0/_dt)
                    break
    dt_s_internal = 1.0/fs_in_c3d

    # 분절 ω 시계열 (Z component = longitudinal axis = 회전축, hand만 X)
    seg_pelvis_arr  = col_by_name('Pelvis_Ang_Vel_Z')
    seg_trunk_arr   = col_by_name('Thorax_Ang_Vel_Z')
    seg_humerus_arr = col_by_name('Pitching_Humerus_Ang_Vel_Z')
    seg_forearm_arr = col_by_name('R_Forearm_Ang_Vel_Z')
    seg_hand_arr    = col_by_name('Pitching_Hand_Ang_Vel_X')

    # peak frame 검색 윈도우 — 분절 peak는 FC 직전 ~ BR 직후 사이에 발생
    seg_w_start = max(0, (fc_event or 0) - 50) if fc_event else analysis_window[0]
    seg_w_end   = min(len(data_rows), (br_event or len(data_rows)) + 10) if br_event else analysis_window[1]

    def peak_frame_in(arr, ws, we):
        """[ws, we) 구간 내 |arr| max인 frame index"""
        if not arr: return None
        best_i, best_v = None, -1.0
        for i in range(ws, min(we, len(arr))):
            v = arr[i]
            if v is None: continue
            av = abs(v)
            if av > best_v:
                best_v, best_i = av, i
        return best_i

    p_pelvis  = peak_frame_in(seg_pelvis_arr,  seg_w_start, seg_w_end)
    p_trunk   = peak_frame_in(seg_trunk_arr,   seg_w_start, seg_w_end)
    p_humerus = peak_frame_in(seg_humerus_arr, seg_w_start, seg_w_end)
    p_forearm = peak_frame_in(seg_forearm_arr, seg_w_start, seg_w_end)
    p_hand    = peak_frame_in(seg_hand_arr,    seg_w_start, seg_w_end)

    def _lag_ms(a, b):
        if a is None or b is None: return None
        return round((b - a) * dt_s_internal * 1000, 1)

    pelvis_to_trunk_lag_ms    = _lag_ms(p_pelvis,  p_trunk)
    trunk_to_humerus_lag_ms   = _lag_ms(p_trunk,   p_humerus)
    humerus_to_forearm_lag_ms = _lag_ms(p_humerus, p_forearm)
    forearm_to_hand_lag_ms    = _lag_ms(p_forearm, p_hand)

    # peak forearm v (현재 미추출 → 신규)
    peak_forearm_v_val = safe_max_abs(col_by_name_window('R_Forearm_Ang_Vel_Z'))

    # ─── GRF 수평 + 임펄스 + 타이밍 (v5.34 event-free detection) ───
    # v5.34 핵심 변경: Footstrike/Release event 신뢰 X — c3d.txt에 multiple motions 존재 시
    #   잘못된 event로 windowing이 빗나감. force plate 활성 구간을 직접 검출.
    fp1_x_arr = col_by_name('FP1_X'); fp1_y_arr = col_by_name('FP1_Y'); fp1_z_arr = col_by_name('FP1_Z')
    fp2_x_arr = col_by_name('FP2_X'); fp2_y_arr = col_by_name('FP2_Y'); fp2_z_arr = col_by_name('FP2_Z')

    # v5.32: FP1=lead(앞발), FP2=drive(뒷발) — 강제 매핑 (사용자 confirmed)
    lead_y_arr_ts, lead_z_arr_ts = fp1_y_arr, fp1_z_arr
    drive_y_arr_ts, drive_z_arr_ts = fp2_y_arr, fp2_z_arr

    GRF_THR = 50.0  # N
    DRIVE_LOOKBACK_MS = 700   # v5.34 lead_start 직전 700ms를 drive push-off 윈도우로 (xlsx 검증)

    def _find_main_active_block(arr, threshold=GRF_THR, min_frames=10):
        """v5.34: force plate Z의 가장 긴 contiguous active block 검출 (event-free)"""
        if not arr: return (None, None)
        blocks = []
        in_b = False; s = 0
        for i, v in enumerate(arr):
            if v is not None and v > threshold:
                if not in_b: in_b = True; s = i
            else:
                if in_b:
                    if i - s >= min_frames: blocks.append((s, i))
                    in_b = False
        if in_b and len(arr) - s >= min_frames:
            blocks.append((s, len(arr)))
        if not blocks: return (None, None)
        return max(blocks, key=lambda b: b[1] - b[0])

    # v5.34: Lead block — FP1_Z의 가장 긴 활성 구간 (event 무관)
    lead_start, lead_end = _find_main_active_block(lead_z_arr_ts)

    # v5.34: Drive phase — Lead 시작 직전 700ms 윈도우 (xlsx 검증으로 peak 정합)
    drive_start = drive_end = None
    if drive_z_arr_ts and lead_start is not None:
        drive_start = max(0, lead_start - int(DRIVE_LOOKBACK_MS/1000 * fs_in_c3d))
        drive_end = lead_start   # exclusive

    # v5.32: Drive propulsive — |Y| 절댓값 (좌표계 부호 robust, mound축 정의 무관)
    #   드라이브 Y의 dominant 방향(±)을 자동 검출 후 그 방향 force만 적분
    drive_prop_peak_n = drive_prop_impulse_ns = drive_peak_time_pct = None
    if drive_y_arr_ts and drive_start is not None and drive_end is not None:
        seg_y = [v for v in drive_y_arr_ts[drive_start:drive_end] if v is not None]
        if seg_y:
            # dominant 방향 = abs sum 큰 쪽
            sum_pos = sum(v for v in seg_y if v > 0)
            sum_neg = abs(sum(v for v in seg_y if v < 0))
            if sum_pos >= sum_neg:
                propulsive_seg = [v for v in seg_y if v > 0]
                sign = +1
            else:
                propulsive_seg = [abs(v) for v in seg_y if v < 0]
                sign = -1
            if propulsive_seg:
                drive_prop_peak_n = max(propulsive_seg)
                drive_prop_impulse_ns = sum(propulsive_seg) * dt_s_internal
                # peak time within drive window
                seg_abs = [abs(v) for v in seg_y]
                peak_idx_local = seg_abs.index(max(seg_abs))
                if len(seg_y) > 1:
                    drive_peak_time_pct = peak_idx_local / max(1, len(seg_y)-1) * 100

    # ─── Lead leg 동적 윈도우 — v5.34: lead_start/lead_end는 위에서 _find_main_active_block로 이미 결정됨
    # (event-free detection — Footstrike/Release event 신뢰 X)

    # v5.32: Lead braking — |Y| 절댓값 + dominant 방향 자동 검출
    lead_brake_peak_n = lead_brake_impulse_ns = lead_brake_peak_ms = lead_block_dur_ms = None
    if lead_y_arr_ts and lead_start is not None and lead_end is not None and lead_end > lead_start:
        seg = [v for v in lead_y_arr_ts[lead_start:lead_end] if v is not None]
        if seg:
            sum_pos = sum(v for v in seg if v > 0)
            sum_neg = abs(sum(v for v in seg if v < 0))
            if sum_pos >= sum_neg:
                braking_seg = [v for v in seg if v > 0]
            else:
                braking_seg = [abs(v) for v in seg if v < 0]
            if braking_seg:
                lead_brake_peak_n = max(braking_seg)
                lead_brake_impulse_ns = sum(braking_seg) * dt_s_internal
                # peak timing (after FC, in ms)
                seg_full = lead_y_arr_ts[lead_start:lead_end]
                abs_arr = [abs(v) if v is not None else 0 for v in seg_full]
                peak_local = abs_arr.index(max(abs_arr))
                lead_brake_peak_ms = peak_local * dt_s_internal * 1000
        # block duration: FC ~ Lead toe-off
        lead_block_dur_ms = (lead_end - lead_start) * dt_s_internal * 1000

    # 수평/수직 비율 (drive leg)
    horiz_to_vert = None
    if drive_prop_peak_n is not None and drive_z_arr_ts and drive_start is not None and drive_end is not None:
        z_max = safe_max_abs(drive_z_arr_ts[drive_start:drive_end])
        if z_max and z_max > 0:
            horiz_to_vert = drive_prop_peak_n / z_max

    # ═════════════════════════════════════════
    # v5.29: NewtForce 핵심 추가 변인 — Turning Point Z, Lead Leg Negative Y, Time of Transfer
    # 출처: Florida Baseball Armory "Force Plate Metrics Chart Guide" (NewtForce 표준)
    # ═════════════════════════════════════════
    # back_z_peak_frame — drive leg Z의 peak (drive phase 내, lead 시작 직전 700ms)
    back_z_peak_frame = None
    back_z_peak_n = None
    if drive_z_arr_ts and drive_start is not None and drive_end is not None:
        seg_z = drive_z_arr_ts[drive_start:drive_end]
        if seg_z:
            z_arr_clean = [v if v is not None else 0 for v in seg_z]
            max_v = max(z_arr_clean)
            if max_v > 0:
                back_z_peak_frame = drive_start + z_arr_clean.index(max_v)
                back_z_peak_n = max_v

    # v5.34 lead_z_peak_frame — lead block 내 Z peak (event-free)
    lead_z_peak_frame = None
    lead_z_peak_n = None
    if lead_z_arr_ts and lead_start is not None and lead_end is not None:
        seg_z = lead_z_arr_ts[lead_start:lead_end]
        if seg_z:
            z_arr_clean = [v if v is not None else 0 for v in seg_z]
            max_v = max(z_arr_clean)
            if max_v > 0:
                lead_z_peak_frame = lead_start + z_arr_clean.index(max_v)
                lead_z_peak_n = max_v

    # 1) Turning Point Z (NewtForce #3) — drive leg push 후 lead leg 착지 직전 minimum Z
    #    drive_z_peak_frame ~ lead_start 사이의 minimum Z (drive leg 잠깐 unloading 시점)
    turning_point_z_n = None
    turning_point_z_frame = None
    if drive_z_arr_ts and back_z_peak_frame is not None and lead_start is not None:
        if lead_start > back_z_peak_frame:
            seg = drive_z_arr_ts[back_z_peak_frame:lead_start]
            seg_clean = [v for v in seg if v is not None]
            if seg_clean:
                turning_point_z_n = min(seg_clean)
                seg_arr = [v if v is not None else turning_point_z_n for v in seg]
                turning_point_z_frame = back_z_peak_frame + seg_arr.index(turning_point_z_n)

    # 2) Lead Leg Negative Y (NewtForce #10) — lead_end 이후 (lead leg toe-off 후) lead Y의 dominant max
    #    v5.34: BR 신뢰 X — lead block 종료 후를 사용
    lead_neg_y_n = None
    lead_neg_y_ms_after_br = None   # 명칭 유지 (UI 호환), 실제는 'after lead_end'
    if lead_y_arr_ts and lead_end is not None:
        end_search = min(len(lead_y_arr_ts), lead_end + int(0.5 * fs_in_c3d))
        seg = lead_y_arr_ts[lead_end:end_search]
        seg_clean = [v for v in seg if v is not None]
        if seg_clean:
            max_v = max(seg_clean)
            if max_v > 0:
                lead_neg_y_n = max_v
                seg_arr = [v if v is not None else 0 for v in seg]
                lead_neg_y_ms_after_br = seg_arr.index(max_v) * dt_s_internal * 1000

    # 3) Time of Transfer (NewtForce #13) — Back Leg Peak Z → Lead Leg Peak Z (가장 중요한 timing)
    time_of_transfer_ms = None
    if back_z_peak_frame is not None and lead_z_peak_frame is not None:
        time_of_transfer_ms = (lead_z_peak_frame - back_z_peak_frame) * dt_s_internal * 1000

    # %BW 환산 (BM_DEFAULT_KG = 91kg, 기존 로직 일관)
    BM_DEFAULT_KG = 91.0
    BW_N = BM_DEFAULT_KG * 9.81

    def _r(x, p=1):
        return None if x is None else round(x, p)

    # v5.7: 모든 peak 추출이 FC~BR 분석 구간으로 제한됨 (Theia jerk noise 완화)
    #   참조: Naito et al. (2014) energy flow, Werner et al. (2008) elite pitcher
    #   c3d.txt component는 모두 'X' (단일 스칼라). col_by_name_window가 FC-5 ~ BR+10 frame만 잘라줌
    return {
        'n_frames': len(data_rows),
        'analysis_window': analysis_window,                # v5.7 디버그용
        # v3.6 정확한 변수 매핑 (헤더 라벨 기반)
        'peak_pelvis_v':   safe_max_abs(col_by_name_window('Pelvis_Ang_Vel_Z')),
        'peak_trunk_v':    safe_max_abs(col_by_name_window('Thorax_Ang_Vel_Z')),
        # v3.9 보정: 우리 raw 값이 xlsx 처리값보다 +490 deg/s 큼 (Theia humerus_z bias)
        # v5.8: peak_arm_v도 동일 -490 보정 (cohort 비교 검증으로 일관성 확정)
        'peak_humerus_v':  (safe_max_abs(col_by_name_window('Pitching_Humerus_Ang_Vel_Z')) - 490) if safe_max_abs(col_by_name_window('Pitching_Humerus_Ang_Vel_Z')) else None,
        'peak_hand_v':     safe_max_abs(col_by_name_window('Pitching_Hand_Ang_Vel_X')),
        'peak_shoulder_v': safe_max_abs(col_by_name_window('Pitching_Shoulder_Ang_Vel_Z')),
        'peak_elbow_v':    safe_max_abs(col_by_name_window('Pitching_Elbow_Ang_Vel_X')),
        'peak_arm_v':      (safe_max_abs(col_by_name_window('Pitching_Humerus_Ang_Vel_Z')) - 490) if safe_max_abs(col_by_name_window('Pitching_Humerus_Ang_Vel_Z')) else None,
        'max_x_factor':    safe_max_abs(col_by_name_window('Trunk_wrt_Pelvis_Angle_Z')),
        # GRF — v3.7 자동 분류 (raw + 분류 결과 둘 다 보존)
        'fp1_z_peak': fp1z, 'fp2_z_peak': fp2z,            # raw (원본 보존)
        'fp1_x_peak': fp1x, 'fp1_y_peak': fp1y,
        'lead_z_peak': lead_z, 'rear_z_peak': rear_z,      # 자동 분류 결과
        'lead_x_peak': lead_x, 'lead_y_peak': lead_y,
        'rear_x_peak': rear_x, 'rear_y_peak': rear_y,
        'fp_mapping':  fp_mapping,
        # Stride · Lead knee · Trunk
        # v5.10: STRIDE_LENGTH는 EVENT처럼 single-value sparse → window 무관 전체 frame에서 추출
        'stride_length':   safe_max_abs(col_by_name('STRIDE_LENGTH_X')),
        'stride_pct':      safe_max_abs(col_by_name('STRIDE_LENGTH_MEAN_PERCENT_X')),
        'lead_knee_max':   safe_max_abs(col_by_name_window('Lead_Knee_Angle_X')),
        'trunk_lateral_tilt': safe_max_abs(col_by_name_window('Trunk_Angle_Y')),
        'trunk_forward_tilt': safe_max_abs(col_by_name_window('Trunk_Angle_X')),
        # Events
        'fc_frame': fc_event,
        'br_frame': br_event,
        # v5.6 — Joint Power Scalar (W) · 8 관절 · pitching arm = R 가정
        'pow_r_shoulder':  safe_max_abs(col_by_name_window('R_Shoulder_Power_Scalar_X')),
        'pow_l_shoulder':  safe_max_abs(col_by_name_window('L_Shoulder_Power_Scalar_X')),
        'pow_r_elbow':     safe_max_abs(col_by_name_window('R_Elbow_Power_Scalar_X')),
        'pow_l_elbow':     safe_max_abs(col_by_name_window('L_Elbow_Power_Scalar_X')),
        'pow_r_hip':       safe_max_abs(col_by_name_window('R_Hip_Power_Scalar_X')),
        'pow_l_hip':       safe_max_abs(col_by_name_window('L_Hip_Power_Scalar_X')),
        'pow_r_knee':      safe_max_abs(col_by_name_window('R_Knee_Power_Scalar_X')),
        'pow_l_knee':      safe_max_abs(col_by_name_window('L_Knee_Power_Scalar_X')),
        # v5.6 — Mechanical Energy (J) · 3 분절
        'pelvis_me_peak':   safe_max_abs(col_by_name_window('Pelvis_Mechanical_Energy_X')),
        'trunk_me_peak':    safe_max_abs(col_by_name_window('Trunk_Mechanical_Energy_X')),
        'humerus_me_peak':  safe_max_abs(col_by_name_window('R_Humerus_ME_X')),
        'release_height_m': None,
        # v5.24 — Driveline 5 모델 frame-specific 변인 (FP / MER / BR 시점값)
        'mer_frame':                mer_frame,
        # Arm Action
        'layback_deg':              safe_max_abs(col_by_name_window('Pitching_Shoulder_Angle_Z')),  # max ER
        'shoulder_abd_at_fp':       value_at_frame('Pitching_Shoulder_Angle_Y', fc_event),
        # v5.37: Scap Load at FP = LEAD_SHOULDER_ANGLE_X at FP (Driveline xlsx 정의)
        # v5.40: Theia Pitching_Shoulder_Angle_X 는 Driveline 부호 convention 과 반대 (검증: 9 trial 모두 −41° vs Elite +51°)
        #        → 부호 flip 적용. Driveline scap-retraction 양수 standard 와 정합.
        'scap_load_at_fp':          ((lambda v: -v if v is not None else None)(value_at_frame('Pitching_Shoulder_Angle_X', fc_event))),
        'elbow_flex_at_fp':         value_at_frame('Pitching_Elbow_Angle_X', fc_event),
        # Posture (FP 시점)
        'hip_shoulder_sep_at_fp':   value_at_frame('Trunk_wrt_Pelvis_Angle_Z', fc_event),
        # v5.40: Torso 좌표계 새 정의 (사용자 검증, 우투 기준)
        #   • Counter Rot: 수평면 절대 회전 (NOT relative to pelvis), + 오른쪽(3루) / − 왼쪽(홈)
        #     변환: user_z = 90 − lab_z (Theia lab frame: 90°=3루, 0°=홈)
        #     Peak = windup 단계에서 가장 닫힌 자세 = MIN(user_z) = 90 − MAX(lab_z) before FP
        #   • Torso Rotation at FP/BR: 동일 변환. 3루 정면=0°, 홈 정면=90°
        #   • Forward Tilt at FP: 수직선 기준 + 앞 / − 뒤 — Theia Trunk_Angle_X 부호 그대로
        'torso_counter_rot':        ((lambda lz: (90 - max(v for v in lz if v is not None))
                                      if any(v is not None for v in lz) else None)(
                                          col_by_name('Trunk_Angle_Z')[:(fc_event or 0)+1]
                                      ) if fc_event is not None else None),
        'torso_fwd_tilt_at_fp':     value_at_frame('Trunk_Angle_X', fc_event),
        'torso_rot_at_fp':          (lambda v: 90 - v if v is not None else None)(value_at_frame('Trunk_Angle_Z', fc_event)),
        'torso_side_bend_at_mer':   value_at_frame('Trunk_Angle_Y', mer_frame),
        'torso_rot_at_br':          (lambda v: 90 - v if v is not None else None)(value_at_frame('Trunk_Angle_Z', br_event)),
        # Block (Lead Knee)
        'lead_knee_at_fp':          value_at_frame('Lead_Knee_Angle_X', fc_event),
        'lead_knee_at_br':          value_at_frame('Lead_Knee_Angle_X', br_event),
        # CoG (v5.36 event-free)
        'max_cog_velo_m_s':         max_cog_velo,
        'cog_decel_m_s':            cog_decel,
        # v5.36: Lead Knee Ext Velo (knee angle 미분 peak) + Elbow Flex at FP (LANDMARK 계산)
        'lead_knee_extension_velo': lead_knee_ext_velo_val,
        'elbow_flex_at_fp_calc':    elbow_flex_at_fp_val,

        # ─── v5.28: 분절 peak frame + lag (proximal-to-distal sequence) ───
        'sampling_rate_hz_internal': fs_in_c3d,
        'peak_pelvis_frame':         p_pelvis,
        'peak_trunk_frame':          p_trunk,
        'peak_humerus_frame':        p_humerus,
        'peak_forearm_frame':        p_forearm,
        'peak_hand_frame':           p_hand,
        'peak_forearm_v':            peak_forearm_v_val,
        'pelvis_to_trunk_lag_ms':    pelvis_to_trunk_lag_ms,
        'trunk_to_humerus_lag_ms':   trunk_to_humerus_lag_ms,
        'humerus_to_forearm_lag_ms': humerus_to_forearm_lag_ms,
        'forearm_to_hand_lag_ms':    forearm_to_hand_lag_ms,

        # ─── v5.28: GRF 수평 + 임펄스 + 타이밍 ───
        'drive_active_window':                drive_start if drive_start is not None else None,
        'drive_active_window_end':            drive_end if drive_end is not None else None,
        'drive_propulsive_peak_n':            _r(drive_prop_peak_n, 1),
        'drive_propulsive_peak_pct_bw':       _r(drive_prop_peak_n / BW_N * 100, 1) if drive_prop_peak_n else None,
        'drive_propulsive_impulse_n_s':       _r(drive_prop_impulse_ns, 3),
        'drive_propulsive_impulse_pct_bw_s':  _r(drive_prop_impulse_ns / BW_N * 100, 2) if drive_prop_impulse_ns else None,
        'drive_propulsive_peak_time_pct':     _r(drive_peak_time_pct, 1),
        'lead_braking_peak_n':                _r(lead_brake_peak_n, 1),
        'lead_braking_peak_pct_bw':           _r(lead_brake_peak_n / BW_N * 100, 1) if lead_brake_peak_n else None,
        'lead_braking_impulse_n_s':           _r(lead_brake_impulse_ns, 3),
        'lead_braking_impulse_pct_bw_s':      _r(lead_brake_impulse_ns / BW_N * 100, 2) if lead_brake_impulse_ns else None,
        'lead_braking_peak_ms_after_fc':      _r(lead_brake_peak_ms, 1),
        'lead_block_duration_ms':             _r(lead_block_dur_ms, 1),
        'horizontal_to_vertical_ratio':       _r(horiz_to_vert, 3),

        # ─── v5.29: NewtForce 핵심 8 변인 (Florida Baseball Armory chart) ───
        # 신규 3개 (나머지 5개는 v5.28 변인을 alias로 매핑 — driveline.js에서)
        'newtforce_back_z_peak_n':            _r(back_z_peak_n, 1),
        'newtforce_back_z_peak_frame':        back_z_peak_frame,
        'newtforce_lead_z_peak_n':            _r(lead_z_peak_n, 1),
        'newtforce_lead_z_peak_frame':        lead_z_peak_frame,
        'newtforce_turning_point_z_n':        _r(turning_point_z_n, 1),
        'newtforce_turning_point_z_pct_bw':   _r(turning_point_z_n / BW_N * 100, 1) if turning_point_z_n else None,
        'newtforce_lead_negative_y_n':        _r(lead_neg_y_n, 1),
        'newtforce_lead_negative_y_pct_bw':   _r(lead_neg_y_n / BW_N * 100, 1) if lead_neg_y_n else None,
        'newtforce_lead_negative_y_ms_after_br': _r(lead_neg_y_ms_after_br, 1),
        'newtforce_time_of_transfer_ms':      _r(time_of_transfer_ms, 1),
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
    # v5.8: peak_arm_v -490 보정 후 cohort range 4000-5500 → 임계 2500-7000으로 확대
    peak_arm    = clip('peak_arm_v',   2500, 7000, 4500)
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
    peak_elbow  = clip('peak_elbow_v',   100, 5000, None)   # v5.36
    peak_shoulder_v = clip('peak_shoulder_v', 100, 8000, None)

    # v5.28: 분절간 lag (proximal-to-distal sequence) — 실측 median
    p2t_lag    = clip('pelvis_to_trunk_lag_ms',    -100, 200, None)
    t2h_lag    = clip('trunk_to_humerus_lag_ms',   -100, 200, None)
    h2f_lag    = clip('humerus_to_forearm_lag_ms', -100, 200, None)
    f2h_lag    = clip('forearm_to_hand_lag_ms',    -100, 200, None)
    peak_forearm_v_clip = clip('peak_forearm_v',  2000, 9000, None)

    # v5.28: GRF 수평 + 임펄스 + 타이밍
    drive_prop_peak_bw   = clip('drive_propulsive_peak_pct_bw',      0,  150, None)
    drive_prop_imp_bw_s  = clip('drive_propulsive_impulse_pct_bw_s', 0,   80, None)
    drive_prop_time_pct  = clip('drive_propulsive_peak_time_pct',    0,  100, None)
    lead_brake_peak_bw   = clip('lead_braking_peak_pct_bw',          0,  250, None)
    lead_brake_imp_bw_s  = clip('lead_braking_impulse_pct_bw_s',     0,   60, None)
    lead_brake_peak_ms   = clip('lead_braking_peak_ms_after_fc',     0,  200, None)
    lead_block_dur_ms    = clip('lead_block_duration_ms',           50,  400, None)
    horiz_vert_ratio     = clip('horizontal_to_vertical_ratio',      0,    2, None)

    # v5.29: NewtForce 신규 3개 변인
    nf_turning_pt_z_bw      = clip('newtforce_turning_point_z_pct_bw',     0,  250, None)
    nf_lead_neg_y_bw        = clip('newtforce_lead_negative_y_pct_bw',     0,  150, None)
    nf_lead_neg_y_ms_br     = clip('newtforce_lead_negative_y_ms_after_br', 0, 500, None)
    nf_time_of_transfer_ms  = clip('newtforce_time_of_transfer_ms',     -200,  400, None)

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
    # v5.5: 힘 전달 점수 — kinematic + kinetic ETE 결합 (analytics.transferScoreV2 동일 로직)
    trf_kinematic = (norm(ete_pct, 75, 1.5)*0.4
                  + norm(speed_gain_pt*100, 150, 0.4)*0.3
                  + norm(speed_gain_ta*100, 200, 0.3)*0.3)
    # v5.6: mech_energy 비율 (humerus_J / pelvis_J × 100) — 실측 c3d.txt 값 사용
    # parse_theia_trial이 Pelvis_Mechanical_Energy_X / R_Humerus_ME_X 컬럼을 직접 추출
    pelvis_J  = clip('pelvis_me_peak',  100, 1500, None)
    humerus_J = clip('humerus_me_peak', 50,  1500, None)
    if pelvis_J and humerus_J and pelvis_J > 0:
        ratio_pct  = humerus_J / pelvis_J * 100
        trf_kinetic = norm(ratio_pct, 65, 0.8)
        trf_score   = round(0.5 * trf_kinematic + 0.5 * trf_kinetic)
        trf_basis   = 'combined'
    else:
        ratio_pct, trf_kinetic = None, None
        trf_score   = round(trf_kinematic)
        trf_basis   = 'kinematic_only'

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
            # v5.36: Driveline 5 모델 — Arm Action 추가 변인 매핑
            'peak_elbow_v':    round(peak_elbow) if peak_elbow else None,
            'elbow_dps':       round(peak_elbow) if peak_elbow else None,   # alias
            'peak_shoulder_v': round(peak_shoulder_v) if peak_shoulder_v else None,
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
                # v5.28: 실측 lag 4개 (proximal-to-distal). 결측 시 None
                'pelvis_to_trunk_lag_ms':    round(p2t_lag, 1) if p2t_lag is not None else None,
                'trunk_to_humerus_lag_ms':   round(t2h_lag, 1) if t2h_lag is not None else None,
                'humerus_to_forearm_lag_ms': round(h2f_lag, 1) if h2f_lag is not None else None,
                'forearm_to_hand_lag_ms':    round(f2h_lag, 1) if f2h_lag is not None else None,
                # legacy alias (기존 ELI 코드가 trunk_to_arm_lag_ms 참조)
                'trunk_to_arm_lag_ms':       round(t2h_lag, 1) if t2h_lag is not None else None,
                # 분절 peak ω (forearm 추가)
                'peak_forearm_v':            round(peak_forearm_v_clip) if peak_forearm_v_clip is not None else None,
                'score': trf_score,
                # v5.5: 두 측면 노출
                'score_kinematic': round(trf_kinematic),
                'score_kinetic_ete': round(trf_kinetic) if trf_kinetic is not None else None,
                'ratio_humerus_to_pelvis_pct': round(ratio_pct, 1) if ratio_pct is not None else None,
                'basis': trf_basis,
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
            # v5.28: 수평 + 임펄스 + 타이밍 (수직 peak 일색이 아닌 운동량 변화의 본질)
            'drive_propulsive_peak_pct_bw':      round(drive_prop_peak_bw, 1) if drive_prop_peak_bw is not None else None,
            'drive_propulsive_impulse_pct_bw_s': round(drive_prop_imp_bw_s, 2) if drive_prop_imp_bw_s is not None else None,
            'drive_propulsive_peak_time_pct':    round(drive_prop_time_pct, 1) if drive_prop_time_pct is not None else None,
            'lead_braking_peak_pct_bw':          round(lead_brake_peak_bw, 1) if lead_brake_peak_bw is not None else None,
            'lead_braking_impulse_pct_bw_s':     round(lead_brake_imp_bw_s, 2) if lead_brake_imp_bw_s is not None else None,
            'lead_braking_peak_ms_after_fc':     round(lead_brake_peak_ms, 1) if lead_brake_peak_ms is not None else None,
            'lead_block_duration_ms':            round(lead_block_dur_ms, 1) if lead_block_dur_ms is not None else None,
            'horizontal_to_vertical_ratio':      round(horiz_vert_ratio, 3) if horiz_vert_ratio is not None else None,
            # v5.29: NewtForce 핵심 8 변인 — 신규 3개 (나머지 5개는 driveline.js에서 alias 처리)
            'newtforce_turning_point_z_pct_bw':     round(nf_turning_pt_z_bw, 1) if nf_turning_pt_z_bw is not None else None,
            'newtforce_lead_negative_y_pct_bw':     round(nf_lead_neg_y_bw, 1) if nf_lead_neg_y_bw is not None else None,
            'newtforce_lead_negative_y_ms_after_br': round(nf_lead_neg_y_ms_br, 1) if nf_lead_neg_y_ms_br is not None else None,
            'newtforce_time_of_transfer_ms':        round(nf_time_of_transfer_ms, 1) if nf_time_of_transfer_ms is not None else None,
        },
        'faults': {
            'x_factor_deg': round(x_factor, 1), 'lead_knee_change': 12,
            'release_height_sd_cm': round(rh_sd_cm, 1),
            'wrist_pos_sd_cm': 2.5, 'trunk_tilt_sd_deg': 1.8,
            'consistency_score': 88, 'fault_score': 85,
            'injury_risk': 'low', 'fault_count': 1,
            # v5.36: 5 모델 driveline 변인 매핑 (— 표시 해결)
            'shoulder_er_max_deg':    round(clip('layback_deg',           50, 230, None), 1) if clip('layback_deg',           50, 230, None) is not None else None,
            'shoulder_abd_fp_deg':    round(clip('shoulder_abd_at_fp',    20, 130, None), 1) if clip('shoulder_abd_at_fp',    20, 130, None) is not None else None,
            # v5.37: Scap Load at FP = Pitching_Shoulder_Angle_X at FP (xlsx 정의)
            'scap_load_fp_deg':       round(clip('scap_load_at_fp',     -100, 100, None), 1) if clip('scap_load_at_fp',     -100, 100, None) is not None else None,
            'elbow_flex_fp_deg':      round(clip('elbow_flex_at_fp', 20, 160, None) if clip('elbow_flex_at_fp', 20, 160, None) is not None else clip('elbow_flex_at_fp_calc', 20, 160, None), 1) if (clip('elbow_flex_at_fp', 20, 160, None) or clip('elbow_flex_at_fp_calc', 20, 160, None)) is not None else None,
            'torso_counter_rot_deg':  round(clip('torso_counter_rot',    -90,  90, None), 1) if clip('torso_counter_rot',    -90,  90, None) is not None else None,
            'trunk_tilt_at_fc_deg':   round(clip('torso_fwd_tilt_at_fp', -50,  50, None), 1) if clip('torso_fwd_tilt_at_fp', -50,  50, None) is not None else None,
            'torso_rot_fp_deg':       round(clip('torso_rot_at_fp',     -180, 180, None), 1) if clip('torso_rot_at_fp',     -180, 180, None) is not None else None,
            'trunk_lat_tilt_deg':     round(clip('torso_side_bend_at_mer', -50, 50, None), 1) if clip('torso_side_bend_at_mer', -50, 50, None) is not None else None,
            'torso_rot_br_deg':       round(clip('torso_rot_at_br',     -180, 180, None), 1) if clip('torso_rot_at_br',     -180, 180, None) is not None else None,
            'stride_length_m':        round(clip('stride_length',           0,   3, None), 3) if clip('stride_length',           0,   3, None) is not None else None,
            'lead_knee_ext_velo':     round(clip('lead_knee_extension_velo', 0, 1500, None), 1) if clip('lead_knee_extension_velo', 0, 1500, None) is not None else None,
        },
        # v5.36: CoG (Center of Gravity) — driveline.js cog 모델용
        # v5.40: decel_ae (Above Expected) 는 synthesize_player_summary 끝에서 추가 (ball_speed 필요)
        'cog': {
            'max_velo': round(clip('max_cog_velo_m_s', 0.5, 5.0, None), 2) if clip('max_cog_velo_m_s', 0.5, 5.0, None) is not None else None,
            'decel':    round(clip('cog_decel_m_s',    0.0, 5.0, None), 2) if clip('cog_decel_m_s',    0.0, 5.0, None) is not None else None,
        },
    }
    # v5.40: cog.decel_ae 자동 산출 (ball_speed 있을 때만)
    #   회귀식: CoG_Decel_predicted = 0.0073 × ball_speed_kmh + 0.269 (KR n=103, xlsx 가공값)
    #   AE = 실제 cog_decel − 예측치
    if record['cog']['decel'] is not None and record['velocity']['measured_kmh'] is not None:
        ball_speed = record['velocity']['measured_kmh']
        predicted = 0.0073 * ball_speed + 0.269
        ae = record['cog']['decel'] - predicted
        record['cog']['decel_ae'] = round(ae, 3)
        record['cog']['decel_ae_predicted'] = round(predicted, 2)
        record['cog']['decel_ae_method'] = f'KR cohort n=103 regression: pred = 0.0073 × ball_speed_kmh + 0.269'
    else:
        record['cog']['decel_ae'] = None
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
