#!/usr/bin/env python3
"""Driveline 참고문헌에서 CoG Decel AE 정의 검색"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from pypdf import PdfReader
except:
    from PyPDF2 import PdfReader

pdfs = [
    'docs/references/Driveline_PitchingAssessment_EN_sample.pdf',
    'docs/references/Driveline_PitchingAssessment_KR_sample.pdf',
]

for pdf_path in pdfs:
    full = os.path.join(ROOT, pdf_path)
    if not os.path.exists(full):
        print(f"!! 없음: {full}")
        continue
    print(f"\n=== {pdf_path} ===")
    r = PdfReader(full)
    print(f"  {len(r.pages)} pages")
    for pi, p in enumerate(r.pages):
        try:
            t = p.extract_text() or ""
        except:
            continue
        for line in t.split('\n'):
            line = line.strip()
            if not line: continue
            ll = line.lower()
            if 'cog' in ll or 'decel' in ll or ' ae ' in ll.lower() or ll.endswith('ae') or 'acceleration equivalent' in ll:
                print(f"  p{pi+1}: {line[:200]}")
