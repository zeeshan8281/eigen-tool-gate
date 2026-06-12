#!/usr/bin/env python3
"""
Generate docs/architecture.excalidraw — the Verified Tool Gating architecture diagram.

Usage:  python3 scripts/gen-architecture.py
Output: docs/architecture.excalidraw  (drag into excalidraw.com to view/edit)

Builds rectangles with centered bound text, bound arrows, and a dashed TEE
boundary, colour-coded to the site's allow-green / deny-red identity.
"""
import json
import os
import random
import string

els = []


def rid(n=16):
    return "".join(random.choices(string.ascii_letters + string.digits + "_-", k=n))


def nonce():
    return random.randint(1, 2**31)


def rect(id, x, y, w, h, stroke="#1e1e1e", bg="transparent", dashed=False, fill="solid", radius=True):
    els.append({
        "id": id, "type": "rectangle", "x": x, "y": y, "width": w, "height": h, "angle": 0,
        "strokeColor": stroke, "backgroundColor": bg, "fillStyle": fill, "strokeWidth": 2,
        "strokeStyle": "dashed" if dashed else "solid", "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": {"type": 3} if radius else None,
        "seed": nonce(), "version": 50, "versionNonce": nonce(), "isDeleted": False,
        "boundElements": [], "updated": 1, "link": None, "locked": False,
    })


def label(cid, x, y, w, text, size=16, color="#1e1e1e", align="center"):
    lines = text.split("\n")
    h = int(len(lines) * size * 1.25)
    tid = rid()
    els.append({
        "id": tid, "type": "text", "x": x, "y": y, "width": w, "height": h, "angle": 0,
        "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": None, "seed": nonce(), "version": 50, "versionNonce": nonce(),
        "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False,
        "fontSize": size, "fontFamily": 1, "text": text, "textAlign": align, "verticalAlign": "middle",
        "baseline": int(size * 0.9), "containerId": cid, "originalText": text, "lineHeight": 1.25,
    })
    if cid:
        for e in els:
            if e["id"] == cid:
                e["boundElements"].append({"id": tid, "type": "text"})


def freetext(x, y, text, size=16, color="#1e1e1e", align="left", w=None):
    lines = text.split("\n")
    h = int(len(lines) * size * 1.25)
    w = w or int(max(len(l) for l in lines) * size * 0.6)
    els.append({
        "id": rid(), "type": "text", "x": x, "y": y, "width": w, "height": h, "angle": 0,
        "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
        "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None,
        "roundness": None, "seed": nonce(), "version": 50, "versionNonce": nonce(), "isDeleted": False,
        "boundElements": [], "updated": 1, "link": None, "locked": False, "fontSize": size, "fontFamily": 1,
        "text": text, "textAlign": align, "verticalAlign": "top", "baseline": int(size * 0.9),
        "containerId": None, "originalText": text, "lineHeight": 1.25,
    })


def arrow(x1, y1, x2, y2, start=None, end=None, color="#1e1e1e", dashed=False):
    aid = rid()
    els.append({
        "id": aid, "type": "arrow", "x": x1, "y": y1, "width": abs(x2 - x1), "height": abs(y2 - y1), "angle": 0,
        "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
        "strokeStyle": "dashed" if dashed else "solid", "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": {"type": 2}, "seed": nonce(), "version": 50, "versionNonce": nonce(),
        "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False,
        "points": [[0, 0], [x2 - x1, y2 - y1]], "lastCommittedPoint": None,
        "startBinding": {"elementId": start, "focus": 0, "gap": 6} if start else None,
        "endBinding": {"elementId": end, "focus": 0, "gap": 6} if end else None,
        "startArrowhead": None, "endArrowhead": "arrow",
    })
    for tgt in (start, end):
        if tgt:
            for e in els:
                if e["id"] == tgt:
                    e["boundElements"].append({"id": aid, "type": "arrow"})
    return aid


# ---- TEE boundary ----
TEE = rid()
rect(TEE, 40, 120, 1120, 640, stroke="#6741d9", bg="#faf5ff", dashed=True)
freetext(60, 135, "EigenCompute TEE  ·  Intel TDX  (attested enclave)", 18, "#6741d9")
freetext(60, 165, "secp256k1 signing key sealed to /data — never leaves the enclave", 13, "#9c36b5")

# ---- nodes ----
AGENT = rid(); rect(AGENT, 90, 300, 180, 100, stroke="#1e1e1e", bg="#f1f3f5"); label(AGENT, 90, 330, 180, "AI Agent\n(Claude)", 18)
GATE = rid();  rect(GATE, 400, 290, 220, 130, stroke="#4263eb", bg="#edf2ff"); label(GATE, 400, 320, 220, "Policy Gate\nin-process interceptor\ndeny-by-default", 16, "#3b5bdb")
TOOLS = rid(); rect(TOOLS, 770, 250, 250, 100, stroke="#2f9e44", bg="#ebfbee"); label(TOOLS, 770, 275, 250, "Real Tools\nweb_search · files\ndb_query · http", 15, "#2b8a3e")
BLOCK = rid(); rect(BLOCK, 770, 430, 250, 84, stroke="#e03131", bg="#fff5f5"); label(BLOCK, 770, 448, 250, "BLOCKED\nPolicyViolationError", 15, "#c92a2a")
LOG = rid();   rect(LOG, 380, 500, 360, 130, stroke="#1971c2", bg="#e7f5ff"); label(LOG, 380, 525, 360, "Append-only, hash-chained\nDecision Log · PostgreSQL\nsigned · prevHash · sequence #", 15, "#1864ab")
POL = rid();   rect(POL, 90, 470, 170, 70, stroke="#f08c00", bg="#fff9db"); label(POL, 90, 488, 170, "policy.yaml", 16, "#e67700")
ATT = rid();   rect(ATT, 90, 600, 210, 110, stroke="#f08c00", bg="#fff9db"); label(ATT, 90, 625, 210, "TDX Attestation\nmeasurement\n(code + policy hash)", 14, "#e67700")
SPAN = rid();  rect(SPAN, 770, 560, 250, 70, stroke="#7048e8", bg="#f3f0ff", dashed=True); label(SPAN, 770, 575, 250, "signed OTel span\neigen.policy.*  (Part 1)", 13, "#6741d9")

# ---- external verifier (outside TEE) ----
VER = rid(); rect(VER, 1230, 430, 250, 170, stroke="#1e1e1e", bg="#f8f9fa"); label(VER, 1230, 455, 250, "External Verifier\n(no trust in server)\n\n✓ attestation\n✓ every signature\n✓ hash chain", 15)

# ---- arrows ----
arrow(270, 350, 400, 352, AGENT, GATE)
freetext(290, 318, "tool call", 13, "#495057")
arrow(620, 330, 770, 300, GATE, TOOLS, color="#2f9e44")
freetext(645, 288, "ALLOW", 14, "#2f9e44")
arrow(620, 380, 770, 465, GATE, BLOCK, color="#e03131")
freetext(648, 408, "DENY", 14, "#e03131")
arrow(510, 420, 520, 500, GATE, LOG, color="#1971c2")
freetext(530, 448, "sign + append\nBEFORE acting", 12, "#1864ab")
arrow(175, 470, 180, 600, POL, ATT, color="#f08c00")
freetext(190, 520, "sha256\n(sealed)", 12, "#e67700")
arrow(620, 360, 770, 585, GATE, SPAN, color="#7048e8", dashed=True)
arrow(740, 560, 1230, 520, LOG, VER)
freetext(900, 505, "fetch decisions", 12, "#495057")
arrow(300, 650, 1230, 560, ATT, VER)
freetext(900, 628, "fetch attestation", 12, "#495057")

# ---- title ----
freetext(40, 60, "Verified Tool Gating — Architecture", 26, "#1e1e1e")
freetext(40, 98, "Part 4 · EigenCloud Agent Observability series", 14, "#868e96")

doc = {
    "type": "excalidraw", "version": 2,
    "source": "https://github.com/zeeshan8281/eigen-tool-gate",
    "elements": els,
    "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
    "files": {},
}

os.makedirs("docs", exist_ok=True)
with open("docs/architecture.excalidraw", "w") as f:
    f.write(json.dumps(doc, indent=2))
print(f"wrote docs/architecture.excalidraw with {len(els)} elements")
