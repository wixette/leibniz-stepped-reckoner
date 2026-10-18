"""Collision sweep for the M1 slice, replaying poses exported by the web simulation.

  (in web/)  pnpm poses:m1          -> ../blender/out/m1-poses.json
  Blender --background --factory-startup --python check_m1_clearance.py -- [--poses PATH] [--every N]

Every pair of parts that can move relative to each other is tested for mesh intersection
(BVH overlap with a 0.05 mm margin) at every pose (lib/sweep.py; until M2 this was a
hand-written pair list, which missed neighbouring-digit pairs). Prints one line per
failing pair, then M1_CLEARANCE_OK or M1_CLEARANCE_FAIL.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_m1_slice  # noqa: E402
from lib import params, sweep  # noqa: E402

POSES = os.path.join(params.MACHINE_DIR, "blender", "out", "m1-poses.json")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = argv[argv.index("--poses") + 1] if "--poses" in argv else POSES
    every = int(argv[argv.index("--every") + 1]) if "--every" in argv else 1
    with open(path, encoding="utf-8") as f:
        poses = json.load(f)["poses"][::every]

    build_m1_slice.build(params.load())
    sweep.run(poses, "M1")


if __name__ == "__main__":
    main()
