"""Solve the carry's contacts once and write them for the simulator and the builder.

Plain Python (no Blender):  python3 -I blender/scripts/export_carry_tables.py   (pnpm carry)
Output: params/carry-tables.json, read by js/sim/kinematics*.js and lib/kinematics.py.
Rerun after any change to geometry.carry in params/machine.json (pnpm test checks the version).
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib import carry, carry_solve, params  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "params", "carry-tables.json")


def main():
    p = params.load()
    c = carry_solve.Carry(p)
    push_step, horn_step = 0.0025, 0.05
    push = c.push_table(push_step)
    start, horn = c.zweihorn_table(horn_step)
    out = {
        "generated_by": "blender/scripts/export_carry_tables.py",
        "params_version": p.raw.get("version", ""),
        "push": {"v0": 9.0, "step": push_step, "store": [round(x, 6) for x in push]},
        "zweihorn": {
            "step": horn_step,
            "contact_start_rel": round(start - 90.0, 6),
            "store": [round(x, 6) for x in horn],
        },
        "horn_tip_half_angle": round(carry.horn_tip_half_angle(p), 6),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=None, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {OUT}: push max contact {max(x for x in push[:-1]):.2f}, Zweihorn from {start - 90.0:.2f} deg, "
          f"releases at {horn[-1]:.2f} after {(len(horn) - 1) * horn_step:.2f} deg")


if __name__ == "__main__":
    main()
