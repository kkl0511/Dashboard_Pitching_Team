#!/usr/bin/env python3
"""
Trunk_Angle X/Y/Z 좌표계 검증 — 실제 c3d.txt 데이터에서 throw 단계별 값 출력
새 정의:
  - Torso Counter Rot: 수평면에서 몸통 절대 회전 (NOT relative to pelvis). + 오른쪽(3루) / − 왼쪽(홈)
  - Torso Forward Tilt at FP: 수직선 기준. + 앞 / − 뒤
  - Torso Rotation at FP: 3루 정면=0°, 홈=90°. + 열림 / − 닫힘
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_pitching_session import parse_theia_trial

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
P01_DIR = os.path.join(ROOT, 'sample_data/2026-05-15_1차측정/01_theia/P01_LYH')

# c3d.txt 직접 읽기 (parse_theia_trial은 aggregated만 반환)
import os

def read_c3d(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    var_names = lines[1].split('\t')
    components = lines[4].split('\t')
    col_map = {}
    for i, (n, c) in enumerate(zip(var_names, components)):
        n = n.strip(); c = c.strip()
        if n:
            key = f"{n}_{c}" if c else n
            if key not in col_map:
                col_map[key] = i
    rows = []
    for line in lines[5:]:
        if not line.strip(): continue
        rows.append(line.rstrip('\n').split('\t'))
    return col_map, rows

def safe_float(s):
    try:
        v = float(s)
        if v != v: return None  # NaN
        return v
    except:
        return None

def get_col(col_map, rows, name):
    idx = col_map.get(name)
    if idx is None: return []
    return [safe_float(r[idx]) if idx < len(r) else None for r in rows]

# 첫 trial 로드
files = sorted(os.listdir(P01_DIR))
trial = os.path.join(P01_DIR, [f for f in files if f.endswith('.c3d.txt')][0])
print(f"Trial: {os.path.basename(trial)}")

col_map, rows = read_c3d(trial)

# Trunk_Angle 3축 + Pelvis_Angle Z + Trunk_wrt_Pelvis_Angle_Z
tx = get_col(col_map, rows, 'Trunk_Angle_X')
ty = get_col(col_map, rows, 'Trunk_Angle_Y')
tz = get_col(col_map, rows, 'Trunk_Angle_Z')
pz = get_col(col_map, rows, 'Pelvis_Angle_Z')
twpz = get_col(col_map, rows, 'Trunk_wrt_Pelvis_Angle_Z')

n = len(tx)
print(f"\n총 frame: {n} (300 Hz → {n/300:.2f}s)")

# 전체 범위
def stats(arr, lbl):
    vals = [v for v in arr if v is not None]
    if not vals:
        print(f"  {lbl}: 데이터 없음")
        return
    print(f"  {lbl}: min={min(vals):+7.1f}  max={max(vals):+7.1f}  range={max(vals)-min(vals):.1f}")

print("\n[전체 trial 통계]")
stats(tx, 'Trunk_Angle_X (전후 굴곡, + 앞/− 뒤?)')
stats(ty, 'Trunk_Angle_Y (좌우 굴곡)')
stats(tz, 'Trunk_Angle_Z (수평면 회전, lab frame)')
stats(pz, 'Pelvis_Angle_Z (골반 수평면 회전)')
stats(twpz, 'Trunk_wrt_Pelvis_Z (상대 회전 = X-factor 추정)')

# 시간별 sample (10 분위)
print("\n[시간별 trunk 회전 trace — 10% 단위]")
print(f"{'phase':>6} | {'Trunk_X':>8} {'Trunk_Y':>8} {'Trunk_Z':>8} {'Pelvis_Z':>9} {'TwP_Z':>7}")
for pct in range(0, 101, 10):
    i = int(n * pct / 100)
    if i >= n: i = n - 1
    def fmt(arr):
        v = arr[i] if i < len(arr) else None
        return f"{v:+8.1f}" if v is not None else "    none"
    print(f"  {pct:3d}% | {fmt(tx)} {fmt(ty)} {fmt(tz)} {fmt(pz)} {fmt(twpz)}")

# Peak 회전 위치 + 시점
print("\n[Trunk_Z (lab frame) 분석]")
tz_valid = [(i, v) for i, v in enumerate(tz) if v is not None]
if tz_valid:
    max_tz_i, max_tz = max(tz_valid, key=lambda x: x[1])
    min_tz_i, min_tz = min(tz_valid, key=lambda x: x[1])
    print(f"  MAX = {max_tz:+.1f}° at frame {max_tz_i} ({max_tz_i/n*100:.0f}%)")
    print(f"  MIN = {min_tz:+.1f}° at frame {min_tz_i} ({min_tz_i/n*100:.0f}%)")
    print(f"  → Counter rotation peak (windup 단계, 가장 닫힘) 추정 = ", end="")
    # windup 단계는 trial 초반~중반에 위치
    early = [(i, v) for i, v in tz_valid if i < n*0.6]
    if early:
        ei, ev = max(early, key=lambda x: x[1])
        print(f"frame {ei} ({ei/n*100:.0f}%) → lab Z = {ev:+.1f}°")

print("\n[Trunk_wrt_Pelvis_Angle_Z (상대) 분석]")
twpz_valid = [(i, v) for i, v in enumerate(twpz) if v is not None]
if twpz_valid:
    min_twp_i, min_twp = min(twpz_valid, key=lambda x: x[1])
    print(f"  MIN (가장 분리, X-factor peak) = {min_twp:+.1f}° at frame {min_twp_i} ({min_twp_i/n*100:.0f}%)")

print("\n[Trunk_Angle_X (전후 굴곡) 분석]")
tx_valid = [(i, v) for i, v in enumerate(tx) if v is not None]
if tx_valid:
    max_tx_i, max_tx = max(tx_valid, key=lambda x: x[1])
    min_tx_i, min_tx = min(tx_valid, key=lambda x: x[1])
    print(f"  MAX = {max_tx:+.1f}° at frame {max_tx_i} ({max_tx_i/n*100:.0f}%)")
    print(f"  MIN = {min_tx:+.1f}° at frame {min_tx_i} ({min_tx_i/n*100:.0f}%)")
    # release 시점 직전후 = 가장 forward tilt 일 듯
    late = [(i, v) for i, v in tx_valid if i > n*0.6]
    if late:
        li, lv = max(late, key=lambda x: x[1])
        print(f"  Release 직전후 (60%+) MAX = {lv:+.1f}° at frame {li} ({li/n*100:.0f}%)")
