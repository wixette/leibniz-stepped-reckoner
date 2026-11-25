"""Crank-angle kinematics of one digit (no bpy). Mirrors js/sim/kinematics.js.

theta: crank angle in degrees within one operation, 0..360 for addition and
0..-360 for subtraction (drums turn 1:1 with the crank).
v: continuous value of the result wheel (digit + fraction of a step).
"""

import json
import math
import os


def params_dir():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "params")


class Kin:
    def __init__(self, p):
        self.rib_pitch = p.v("pars_mobilis.drum.rib_pitch")
        self.rib_start = p.v("timing.rest_free_arc_before_ribs")
        self.step = p.v("geometry.drum.rib_length_step")
        self.L = p.v("geometry.drum.length")
        self.y_gear = p.v("geometry.receiving_gear.y")
        self.sum_step = p.v("pars_immobilis.sum_wheel_step")
        self.store_step = p.v("pars_immobilis.einzahn_store_rotation")
        # The Einzahn's push is solved once from the parts' outlines (lib/carry_solve.py) and
        # written to params/carry-tables.json, which the JavaScript twin reads too.
        with open(os.path.join(params_dir(), "carry-tables.json"), encoding="utf-8") as f:
            t = json.load(f)["push"]
        self._push_v0, self._push_step, self._push_table = t["v0"], t["step"], t["store"]
        self.carry_window_start = p.v("timing.carry_window")[0]
        self.per_carry = p.v("timing.per_carry_angle")
        self.store_pitch = p.v("pars_immobilis.fuenfhorn_pitch")
        self.dial_step = 360.0 / p.v("pars_mobilis.setting_dial.divisions")
        self.pinion_y = p.v("geometry.setting.pinion_y")
        self.rack_pitch = math.pi * p.v("geometry.setting.pinion_module")

    # --- input side -------------------------------------------------------
    def drum_front_y(self, s):
        """Drum front face position (along +Y) for setting s (may be fractional)."""
        return self.y_gear - self.L + (9.5 - s) * self.step

    def rib_window_index(self, k, theta):
        """Window (0..8) in which rib k (1..9) passes the receiving gear.

        Turning forward (addition) the ribs arrive in order 1..9; turning backward
        (subtraction) they arrive 9..1. Setting s engages ribs k >= 10 - s, so the
        engaged ribs fill the LAST s windows when adding and the FIRST s when subtracting."""
        return (k - 1) if theta >= 0 else (9 - k)

    def rib_progress(self, s, theta):
        """Number of steps (continuous, 0..s) the drum has given the wheel so far."""
        t = abs(theta)
        total = 0.0
        for k in range(10 - int(round(s)), 10):
            t0 = self.rib_start + self.rib_window_index(k, theta) * self.rib_pitch
            total += min(1.0, max(0.0, (t - t0) / self.rib_pitch))
        return total

    # --- result wheel and carry store -----------------------------------------
    def wheel_value(self, digit_start, s, theta):
        u = self.rib_progress(s, theta)
        return digit_start + u if theta >= 0 else digit_start - u

    def sum_wheel_angle(self, v):
        """Rotation about Blender +Y (deg). Negative: the gear counter-rotates the drum."""
        return -self.sum_step * v

    def push(self, v):
        """Carry-store deflection (deg, 0..18) caused by the Einzahn for v in [9, 10]."""
        x = (min(max(v, 9.0), 10.0) - self._push_v0) / self._push_step
        i = min(int(x), len(self._push_table) - 2)
        f = x - i
        return self._push_table[i] * (1 - f) + self._push_table[i + 1] * f

    def store_angle(self, pending_start, v):
        """Rotation of the carry store about Blender +Y (deg).

        pending_start: carries already stored at the start of this turn (-1, 0, +1).
        v: current wheel value in this turn; a turn always starts with v in [0, 9],
        so a carry can only occur for v in [9, 10] (9 -> 0) and a borrow only for
        v in [-1, 0] (0 -> 9). The borrow is the mirror image of the carry pass.
        """
        base = self.store_step * pending_start
        if v > 9.0:
            return base + self.push(min(v, 10.0))
        if v < 0.0:
            return base - self.push(min(9.0 - v, 10.0))
        return base

    def completion(self, theta, digit_index=0):
        """Fraction (0..1) of the carry execution for digit_index in this turn's carry window.

        Digit j's Zweihorn acts in [start + j*per_carry, start + (j+1)*per_carry] of |theta|."""
        t0 = self.carry_window_start + digit_index * self.per_carry
        return min(1.0, max(0.0, (abs(theta) - t0) / self.per_carry))

    def store_angle_full(self, pending_start, v, theta, executes):
        """Store rotation including the execution of a carry stored in this turn.

        executes: True when this digit's stored carry/borrow is executed in this turn's
        carry window (ripple mode, or a primary carry in simultaneous mode)."""
        a = self.store_angle(pending_start, v)
        if not executes:
            return a
        sign = 1.0 if a > 0 else -1.0 if a < 0 else 0.0
        rest = self.store_pitch - self.store_step  # 54 deg from 'stored' to the next horn
        return a + sign * rest * self.completion(theta)

    # --- setting dial -----------------------------------------------------
    def dial_angle(self, s):
        """Rotation of the setting knob/pinion about Blender +Z (deg): one division per digit."""
        return self.dial_step * s

    def rack_centres(self, margin=1.5):
        """Rack tooth centres (y, measured from the drum's front face) that stay in mesh with the
        pinion over settings 0..9, with `margin` pitches to spare at each end.

        At setting 0 a pinion tooth points at the rack, so a gap of the rack faces the pinion."""
        p = self.rack_pitch
        at0 = self.pinion_y - self.drum_front_y(0)                # the pinion, seen from the drum front at 0
        lo = at0 - margin * p
        hi = self.pinion_y - self.drum_front_y(9) + margin * p   # ... and at 9
        first = lo + ((at0 + p / 2.0 - lo) % p)                   # centres half a pitch off the pinion at 0
        out = []
        c = first
        while c <= hi:
            out.append(c)
            c += p
        return out
