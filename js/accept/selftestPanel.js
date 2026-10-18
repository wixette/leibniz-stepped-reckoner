// ?selftest support for experiment pages: shows acceptance results on screen and
// publishes them as window.__selftest for automated browser checks.

/** @import { CheckResult } from "./harness.js" */

/**
 * The results, as published on window.
 * @typedef {{ done: boolean; passed: number; failed: string[]; results: CheckResult[] }} Selftest
 */

export const selftestRequested = () => new URLSearchParams(location.search).has("selftest");

/**
 * @param {HTMLElement} host
 * @param {CheckResult[]} results
 * @param {number} ms
 * @returns {void}
 */
export function showSelftest(host, results, ms) {
  const failed = results.filter((r) => !r.passed);
  /** @type {Window & { __selftest?: Selftest }} */ (window).__selftest = { done: true, passed: results.length - failed.length, failed: failed.map((r) => r.id), results };

  const box = document.createElement("section");
  box.className = "selftest";
  box.setAttribute("aria-label", "Self-test results");
  const ok = failed.length === 0;
  box.innerHTML = `<h2>Self-test ${ok ? "passed" : "FAILED"} <small>(${results.length - failed.length}/${results.length}, ${Math.round(ms)} ms)</small></h2>`;
  const list = document.createElement("ul");
  for (const r of results) {
    const li = document.createElement("li");
    li.className = r.passed ? "pass" : "fail";
    li.title = r.detail;
    li.textContent = `${r.passed ? "✓" : "✗"} ${r.id} ${r.title}`;
    if (!r.passed) {
      const d = document.createElement("div");
      d.className = "detail";
      d.textContent = r.detail;
      li.appendChild(d);
    }
    list.appendChild(li);
  }
  box.appendChild(list);
  host.prepend(box);
}
