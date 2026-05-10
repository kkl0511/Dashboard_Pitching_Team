#!/usr/bin/env python3
"""
v5.40: TestPlayer 9 trial (6, 10 제외) — 새 Torso 좌표계로 재계산.
- Counter Rot: 절대 lab Z (windup peak), user_z = 90 − lab_z (RHP)
- Torso Rotation at FP/BR: 동일 변환
- Forward Tilt at FP: Theia Trunk_Angle_X 그대로
"""
import os, sys, json, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_pitching_session import parse_theia_trial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIAL_DIR = os.path.join(ROOT, 'sample_data/2026-05-15_1차측정/01_theia/P01_LYH')
OUT_JSON = os.path.join(ROOT, 'sample_data/theia_TEST_9trial_single.json')

# 사용 trial: 1, 2, 3, 4, 5, 7, 8, 9 (6, 10 제외)
USE_TRIALS = [1, 2, 3, 4, 5, 7, 8, 9]

# 기존 JSON 읽어 기본 골격 보존
with open(OUT_JSON, 'r', encoding='utf-8') as f:
    rec = json.load(f)

results = []
for n in USE_TRIALS:
    fn = f'Fastball RH Markerless {n}.c3d.txt'
    path = os.path.join(TRIAL_DIR, fn)
    if not os.path.exists(path):
        print(f"  ✗ {fn} 없음")
        continue
    try:
        r = parse_theia_trial(path)
        if 'error' in r:
            print(f"  ✗ trial {n} parse error: {r['error']}")
            continue
        results.append((n, r))
        print(f"  ✓ trial {n}: counter={r.get('torso_counter_rot'):.1f if r.get('torso_counter_rot') else 'None'} "
              f"rot_FP={r.get('torso_rot_at_fp'):.1f if r.get('torso_rot_at_fp') else 'None'} "
              f"rot_BR={r.get('torso_rot_at_br'):.1f if r.get('torso_rot_at_br') else 'None'} "
              f"tilt_FP={r.get('torso_fwd_tilt_at_fp'):.1f if r.get('torso_fwd_tilt_at_fp') else 'None'}")
    except Exception as e:
        print(f"  ✗ trial {n} exception: {e}")

print(f"\n총 {len(results)}/{len(USE_TRIALS)} trial 처리 완료")

def med(key, lo=-1e9, hi=1e9):
    vals = [r[1].get(key) for r in results if r[1].get(key) is not None and lo <= r[1][key] <= hi]
    return round(statistics.median(vals), 1) if vals else None

# 새 Torso 좌표계 + 기타 메카닉 변인 median 합성
new_faults = {
    'torso_counter_rot_deg':  med('torso_counter_rot', -90, 90),
    'trunk_tilt_at_fc_deg':   med('torso_fwd_tilt_at_fp', -50, 50),
    'torso_rot_fp_deg':       med('torso_rot_at_fp', -180, 180),
    'torso_rot_br_deg':       med('torso_rot_at_br', -180, 180),
    'trunk_lat_tilt_deg':     med('torso_side_bend_at_mer', -50, 50),
}
print("\n[v5.40 새 좌표계 9 trial median 결과]")
for k, v in new_faults.items():
    print(f"  {k:>26} = {v}")

# 기존 record의 faults 부분 업데이트 (다른 변인은 보존)
for k, v in new_faults.items():
    if v is not None:
        rec.setdefault('faults', {})[k] = v

# velocity / sequence / cog는 그대로 두고 torso 변인만 갱신
with open(OUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(rec, f, ensure_ascii=False, indent=2)
print(f"\n✓ {OUT_JSON} 갱신 완료")
print(f"  파일 크기: {os.path.getsize(OUT_JSON)} bytes")
