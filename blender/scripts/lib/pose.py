"""Pose the M0 slice objects from a machine state (shared by previews and checks)."""

import math

from .bl import MM


def apply(objs, kin, setting, digit_start, theta, pending=0, executes=True):
    """setting s (0..9, may be fractional while dialling), result digit at turn start,
    crank angle theta (deg, +add / -subtract), carries stored before this turn, and
    whether a carry stored in this turn is executed in the carry window."""
    s = setting
    objs["shaft"].rotation_euler = (0.0, math.radians(theta), 0.0)
    y = kin.drum_front_y(s) * MM
    objs["drum"].location.y = y
    objs["rack"].location.y = y
    objs["dial"].rotation_euler = (0.0, 0.0, math.radians(kin.dial_angle(s)))
    v = kin.wheel_value(digit_start, round(s), theta)
    objs["wheel"].rotation_euler = (0.0, math.radians(kin.sum_wheel_angle(v)), 0.0)
    store = kin.store_angle_full(pending, v, theta, executes)
    objs["store"].rotation_euler = (0.0, math.radians(store), 0.0)
    return v
