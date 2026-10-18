"""Write sample poses from lib/kinematics.py for the TypeScript cross-check test.

Plain Python (no Blender needed):  python3 export_kinematics_fixture.py
Output: web/src/sim/__fixtures__/kinematics.json
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib import kinematics, params  # noqa: E402

OUT = os.path.join(params.MACHINE_DIR, "web", "src", "sim", "__fixtures__", "kinematics.json")


def main():
    k = kinematics.Kin(params.load())
    samples = []
    for s in (0, 1, 4, 9):
        for d in (0, 5, 9):
            for theta in (0, 60, 85.3, 150, 200.5, 258.75, 270, 281.25, 286, 300, 360,
                          -40, -90, -120.7, -200, -283, -330, -360):
                v = k.wheel_value(d, s, theta)
                samples.append({
                    "setting": s, "digit_start": d, "theta": theta,
                    "v": v,
                    "wheel_angle": k.sum_wheel_angle(v),
                    "store_angle": k.store_angle_full(0, v, theta, True),
                    "store_angle_not_executed": k.store_angle_full(0, v, theta, False),
                    "drum_front_y": k.drum_front_y(s),
                    "dial_angle": k.dial_angle(s),
                })
    push = [{"v": 9 + i / 40, "push": k.push(9 + i / 40)} for i in range(41)]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"generated_by": "blender/scripts/export_kinematics_fixture.py",
                   "samples": samples, "push": push}, f, indent=1)
    print(f"wrote {len(samples)} samples to {OUT}")


if __name__ == "__main__":
    main()
