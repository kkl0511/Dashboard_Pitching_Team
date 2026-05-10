#!/usr/bin/env python3
"""
v5.41: TestPlayer 10 trial 전체 재계산 (trial 6, 10 빈 GRF event 처리 수정 후)
- v5.40 대비 변경: USE_TRIALS = 1~10 (이전 [1,2,3,4,5,7,8,9])
- v5.41 process_pitching_session.py event-free fallback hierarchy 활용:
  1) Visual3D event 정상 → 사용
  2) humerus peak 기준 (BR 근사 = humerus_peak, FC = BR - 200ms)
  3) FP1_Z block (motion_peak + min_peak 0.5BW 검증)
- faults / sequence / grf 변인 모두 median 합성
- 출력: theia_TEST_10trial_single.json
"""
import os, sys, json, statistics, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_pitching_session import parse_theia_trial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIAL_DIR = os.path.join(ROOT, 'sample_data/2026-05-15_1차측정/01_theia/P01_LYH')
OUT_9    = os.path.join(ROOT, 'sample_data/theia_TEST_9trial_single.json')
OUT_10   = os.path.join(ROOT, 'sample_data/theia_TEST_10trial_single.json')

USE_TRIALS = list(range(1, 11))   # 1~10 모두 (v5.41 — trial 6, 10 처리 수정됨)

# 기존 record 골격 (v5.40 9 trial) 로드
with open(OUT_9, 'r', encoding='utf-8') as f:
    rec = copy.deepcopy(json.load(f))

# 모든 trial 처리
results = []
for n in USE_TRIALS:
    fn = f'Fastball RH Markerless {n}.c3d.txt'
    path = os.path.join(TRIAL_DIR, fn)
    if not os.path.exists(path):
        print(f"  ✗ {fn} 없음"); continue
    r = parse_theia_trial(path)
    if 'error' in r:
        print(f"  ✗ trial {n}: {r['error']}"); continue
    results.append((n, r))
    print(f"  ✓ trial {n}: pelvis_v={r.get('peak_pelvis_v')} "
          f"hum_v={r.get('peak_humerus_v')} "
          f"lead_brake_n={r.get('lead_braking_peak_n')}")

print(f"\n총 {len(results)}/{len(USE_TRIALS)} trial 처리 완료")

def med(key, lo=-1e9, hi=1e9):
    vals = [r[1].get(key) for r in results
            if r[1].get(key) is not None and lo <= r[1][key] <= hi]
    return round(statistics.median(vals), 1) if vals else None

# 변인 매핑 — record key ← parse_theia_trial key
MAP_FAULTS = {
    'torso_counter_rot_deg':  ('torso_counter_rot', -90, 90),
    'trunk_tilt_at_fc_deg':   ('torso_fwd_tilt_at_fp', -50, 50),
    'torso_rot_fp_deg':       ('torso_rot_at_fp', -180, 180),
    'torso_rot_br_deg':       ('torso_rot_at_br', -180, 180),
    'trunk_lat_tilt_deg':     ('torso_side_bend_at_mer', -50, 50),
    'shoulder_er_max_deg':    ('layback_deg', -300, 300),
    'scap_load_fp_deg':       ('scap_load_at_fp', -180, 180),
    'elbow_flex_fp_deg':      ('elbow_flex_at_fp', 0, 180),
    'stride_length_m':        ('stride_length', 0, 200),
    'lead_knee_ext_velo':     ('lead_knee_extension_velo', 0, 5000),
    'shoulder_abd_fp_deg':    ('shoulder_abd_at_fp', 0, 180),
}
MAP_SEQ = {
    'pelvis_dps':       ('peak_pelvis_v', 0, 5000),
    'trunk_dps':        ('peak_trunk_v', 0, 5000),
    'arm_dps':          ('peak_arm_v', 0, 10000),
    'peak_elbow_v':     ('peak_elbow_v', 0, 10000),
    'peak_shoulder_v':  ('peak_shoulder_v', 0, 10000),
}
MAP_GRF = {
    'lead_braking_peak_n':           ('lead_braking_peak_n', 0, 5000),
    'lead_braking_peak_pct_bw':      ('lead_braking_peak_pct_bw', 0, 500),
    'lead_braking_impulse_n_s':      ('lead_braking_impulse_n_s', 0, 2000),
    'drive_propulsive_peak_n':       ('drive_propulsive_peak_n', 0, 3000),
    'drive_propulsive_peak_pct_bw':  ('drive_propulsive_peak_pct_bw', 0, 300),
    'newtforce_back_z_peak_n':       ('newtforce_back_z_peak_n', 0, 5000),
    'newtforce_lead_z_peak_n':       ('newtforce_lead_z_peak_n', 0, 5000),
    'newtforce_time_of_transfer_ms': ('newtforce_time_of_transfer_ms', 0, 5000),
    'horizontal_to_vertical_ratio':  ('horizontal_to_vertical_ratio', 0, 5),
    'lead_block_duration_ms':        ('lead_block_duration_ms', 0, 10000),
}

print("\n[v5.41 10 trial median 결과]")
for k, (src, lo, hi) in {**MAP_FAULTS, **MAP_SEQ, **MAP_GRF}.items():
    v = med(src, lo, hi)
    if v is not None:
        if k in MAP_FAULTS:    rec.setdefault('faults', {})[k] = v
        elif k in MAP_SEQ:     rec.setdefault('sequence', {})[k] = v
        elif k in MAP_GRF:     rec.setdefault('grf', {})[k] = v
    print(f"  {k:>32} = {v}")

rec['theia_n_trials'] = len(results)

with open(OUT_10, 'w', encoding='utf-8') as f:
    json.dump(rec, f, ensure_ascii=False, indent=2)
print(f"\n✓ {OUT_10} 갱신 완료 ({os.path.getsize(OUT_10)} bytes)")
