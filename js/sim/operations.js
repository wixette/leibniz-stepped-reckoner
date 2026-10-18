// Operator procedures on the Machine (what a person at the machine does), shared by
// the pages' scripted examples and the acceptance tests.

/** @import { Machine } from "./machine.js" */

/**
 * Value held by the register, counting stored carries and overflow (the operator's check).
 * @param {Machine} m
 * @returns {number}
 */
export function registerValue(m) {
  let v = m.shownNumber();
  m.pending.forEach((p, k) => (v += p * 10 ** (k + 1)));
  return v + m.carryOut * 10 ** m.registerDigits;
}

/**
 * Multiply what is in the register by the dials, digit by digit with the Magna Rota pin.
 * @param {Machine} m
 * @param {number} multiplier
 * @returns {void}
 */
export function multiply(m, multiplier) {
  const digits = String(multiplier).split("").reverse().map(Number);
  digits.forEach((d, o) => {
    m.setOffset(o);
    m.setPin(d);
    if (m.runToStop() !== d) throw new Error(`multiply: the crank refused a turn at offset ${o} (${JSON.stringify(m.startBlock(1))})`);
  });
  m.setOffset(0);
  m.setPin(null);
}

/**
 * Long division by repeated subtraction; returns quotient digits (most significant first).
 * @param {Machine} m
 * @param {number} divisor
 * @returns {number[]}
 */
export function divide(m, divisor) {
  m.setNumber(divisor);
  /** @type {number[]} */
  const q = [];
  let o = 0;
  while (o < m.maxOffset && divisor * 10 ** (o + 1) <= registerValue(m)) o++;
  for (; o >= 0; o--) {
    m.setOffset(o);
    m.setPin(null); // the ring counts the turns
    for (;;) {
      if (!m.turn(-1)) throw new Error(`divide: the crank refused a turn at offset ${o} (${JSON.stringify(m.startBlock(-1))})`);
      if (registerValue(m) < 0) {
        m.turn(1); // overdraft: add the divisor back once
        break;
      }
    }
    q.push(Math.abs(m.ringTurns)); // read the quotient digit on the ring
  }
  m.setOffset(0);
  return q;
}
