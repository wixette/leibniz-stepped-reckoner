"""Collision sweep for the M2 full machine, replaying poses exported by the web simulation.

  pnpm poses:m2          -> blender/out/m2-poses.json
  Blender --background --factory-startup --python check_m2_clearance.py -- [--poses PATH] [--every N]

Every pair of parts that can move relative to each other is tested for mesh intersection
(BVH overlap with a 0.05 mm margin) at every pose (lib/sweep.py). Prints one line per
failing pair, then M2_CLEARANCE_OK or M2_CLEARANCE_FAIL.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_m2  # noqa: E402
from lib import params, sweep  # noqa: E402

POSES = os.path.join(params.MACHINE_DIR, "blender", "out", "m2-poses.json")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = argv[argv.index("--poses") + 1] if "--poses" in argv else POSES
    every = int(argv[argv.index("--every") + 1]) if "--every" in argv else 1
    with open(path, encoding="utf-8") as f:
        poses = json.load(f)["poses"][::every]
    build_m2.build(params.load())
    return sweep.run(poses, "M2")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
