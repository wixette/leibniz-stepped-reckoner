"""Crank-angle kinematics of one digit (no bpy). Mirrors web/src/sim/kinematics.ts.

theta: crank angle in degrees within one operation, 0..360 for addition and
0..-360 for subtraction (drums turn 1:1 with the crank).
v: continuous value of the result wheel (digit + fraction of a step).
"""

import math


class Kin:
    def __init__(self, p):
        self.rib_pitch = p.v("pars_mobilis.drum.rib_pitch")
        self.rib_start = p.v("timing.rest_free_arc_before_ribs")
        self.step = p.v("geometry.drum.rib_length_step")
        self.L = p.v("geometry.drum.length")
        self.y_gear = p.v("geometry.receiving_gear.y")
        self.sum_step = p.v("pars_immobilis.sum_wheel_step")
        self.store_step = p.v("pars_immobilis.einzahn_store_rotation")
        g = "geometry.result."
        self.re = p.v(g + "einzahn_radius")
        self.rpin = p.v(g + "einzahn_pin_radius")
        self.psi_e = p.v(g + "einzahn_angle")
        c = "geometry.carry_store."
        self.F = tuple(p.v(c + "offset_xz"))
        self.horn_len = p.v(c + "horn_length")
        self.hw = p.v(c + "horn_width")
        self.horns = p.v(c + "horns")
        self.h_rest = math.degrees(math.atan2(-self.F[1], -self.F[0]))
        self._push_table = self._build_push_table()
        self.carry_window_start = p.v("timing.carry_window")[0]
        self.per_carry = p.v("timing.per_carry_angle")
        self.store_pitch = p.v("pars_immobilis.fuenfhorn_pitch")

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

    # Carry push: the Einzahn pin (radius rpin, on radius re of the result shaft)
    # pushes a capsule-shaped horn (segment of horn_len from the store axis, radius
    # hw/2). The horn angle is the largest angle not intersecting the pin, swept
    # forward from v = 9; the result is tabulated once.
    TABLE_STEP = 0.0025

    def _clearance(self, h, v):
        a = math.radians(self.psi_e + self.sum_step * v)
        px, pz = self.re * math.cos(a), self.re * math.sin(a)
        best = 1e9
        for j in range(self.horns):
            ha = math.radians(h + 360.0 / self.horns * j)
            ax, az = self.F
            bx, bz = ax + self.horn_len * math.cos(ha), az + self.horn_len * math.sin(ha)
            vx, vz = bx - ax, bz - az
            t = max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)))
            best = min(best, math.hypot(px - (ax + t * vx), pz - (az + t * vz)))
        return best - (self.rpin + self.hw / 2.0)

    def _build_push_table(self):
        h = self.h_rest
        table = []
        n = int(round(1.0 / self.TABLE_STEP))
        for i in range(n + 1):
            v = 9.0 + i * self.TABLE_STEP
            if self._clearance(h, v) < 0:
                lo, hi = h - 60.0, h
                for _ in range(40):
                    mid = (lo + hi) / 2.0
                    if self._clearance(mid, v) >= 0:
                        lo = mid
                    else:
                        hi = mid
                h = lo
            table.append(min(self.store_step, self.h_rest - h))
        table[-1] = self.store_step  # the detent completes the store exactly
        return table

    def push(self, v):
        """Carry-store deflection (deg, 0..18) caused by the Einzahn for v in [9, 10]."""
        x = (min(max(v, 9.0), 10.0) - 9.0) / self.TABLE_STEP
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
        carry window (ripple mode, or a primary carry in historical mode)."""
        a = self.store_angle(pending_start, v)
        if not executes:
            return a
        sign = 1.0 if a > 0 else -1.0 if a < 0 else 0.0
        rest = self.store_pitch - self.store_step  # 54 deg from 'stored' to the next horn
        return a + sign * rest * self.completion(theta)

    # --- setting dial -----------------------------------------------------
    def dial_angle(self, s):
        """Rotation of the setting knob/pinion about Blender +Z (deg)."""
        return 36.0 * s
