// The guided lessons (M3), as data. Texts are in English and German; A3-2 runs every
// lesson headless, A3-4 checks the learner tasks, A3-6 the visibility of what each step shows.

import type { Machine } from "../sim/machine";
import { registerValue } from "../sim/operations";
import type { Lesson, Task } from "./player";

const settingNumber = (m: Machine) => m.settings.reduce((a, s, i) => a + s * 10 ** i, 0);
const allLevel = (m: Machine) => m.pending.every((p) => p === 0);

const setInput = (n: number, wrong: number): Task => ({
  check: (m) => settingNumber(m) === n,
  solve: (m) => m.setNumber(n),
  wrong: (m) => m.setNumber(wrong),
  controls: ["input"],
});

const shiftTo = (o: number, wrong: number): Task => ({
  check: (m) => m.offset === o,
  solve: (m) => m.setOffset(o),
  wrong: (m) => m.setOffset(wrong),
  controls: ["shift"],
});

// ---------------------------------------------------------------------------------------------
const drum: Lesson = {
  id: "drum",
  title: { en: "1 · How one digit is added", de: "1 · Wie eine Ziffer addiert wird" },
  summary: {
    en: "The stepped drum: Leibniz's invention, used in calculators for 300 years.",
    de: "Die Staffelwalze: Leibniz' Erfindung, 300 Jahre lang in Rechenmaschinen verwendet.",
  },
  steps: [
    {
      do: [{ reset: {} }],
      view: "overview",
      casing: true,
      text: {
        en: "This is Gottfried Wilhelm Leibniz's calculating machine, finished around 1700. It was the first machine that could add, subtract, multiply and divide.",
        de: "Das ist die Rechenmaschine von Gottfried Wilhelm Leibniz, fertig um 1700. Sie war die erste Maschine, die addieren, subtrahieren, multiplizieren und dividieren konnte.",
      },
    },
    {
      explode: 1,
      text: {
        en: "Taken apart: at the back the fixed result register (pars immobilis), at the front the carriage that can slide sideways (pars mobilis), with the large Magna Rota on its front.",
        de: "Auseinandergenommen: hinten das feste Resultatwerk (pars immobilis), vorn der seitlich verschiebbare Schlitten (pars mobilis) mit der großen Magna Rota.",
      },
      callouts: [
        { node: "pi.sum_wheel.10", text: { en: "Result register", de: "Resultatwerk" } },
        { node: "pm.drum.5", text: { en: "Carriage", de: "Schlitten" } },
        { node: "pm.magna_rota", text: { en: "Magna Rota", de: "Magna Rota" } },
      ],
    },
    {
      explode: 0,
      view: "register",
      highlight: ["pi.window"],
      text: {
        en: "The result appears in these 16 windows, one digit each. The units are on the right.",
        de: "Das Ergebnis erscheint in diesen 16 Fenstern, je eine Ziffer. Die Einer stehen rechts.",
      },
    },
    {
      view: "knobs",
      highlight: ["pm.setting_dial.*"],
      text: {
        en: "Numbers are set with the 8 knobs on the carriage, units on the right. Set 3 on the units knob.",
        de: "Zahlen werden mit den 8 Knöpfen auf dem Schlitten eingestellt, die Einer rechts. Stelle am Einerknopf 3 ein.",
      },
      task: setInput(3, 30),
    },
    {
      casing: false,
      cutaway: true,
      view: "drum",
      focus: true,
      highlight: ["pm.drum.0", "pi.sum_wheel.0", "pm.setting_rack.0"],
      callouts: [
        { node: "pm.drum.0", text: { en: "Stepped drum", de: "Staffelwalze" } },
        { node: "pi.sum_wheel.0", text: { en: "Result wheel", de: "Zählrad" } },
      ],
      text: {
        en: "Inside: under each knob lies a stepped drum with 9 ribs of different lengths. The knob slid the drum so that exactly 3 ribs reach the small gear of the result wheel.",
        de: "Innen: Unter jedem Knopf liegt eine Staffelwalze mit 9 verschieden langen Rippen. Der Knopf hat die Walze so verschoben, dass genau 3 Rippen das kleine Zahnrad des Zählrads erreichen.",
      },
    },
    {
      do: [{ theta: 200 }],
      highlight: ["pm.drum.0", "pi.sum_wheel.0"],
      text: {
        en: "Turning the crank turns every drum once. Each rib that passes the gear turns the result wheel one step.",
        de: "Eine Kurbeldrehung dreht jede Walze einmal. Jede Rippe, die am Zahnrad vorbeikommt, dreht das Zählrad um einen Schritt.",
      },
      expect: (m) => m.theta === 200,
    },
    {
      do: [{ theta: 360 }],
      highlight: ["pi.sum_wheel.0"],
      text: {
        en: "One full turn: 3 ribs passed, so the wheel moved 3 steps. The window shows 3.",
        de: "Eine volle Umdrehung: 3 Rippen kamen vorbei, das Rad drehte sich 3 Schritte weiter. Im Fenster steht 3.",
      },
      expect: (m) => m.shownDigits()[0] === 3 && m.turns === 1,
    },
    {
      focus: false,
      highlight: ["pm.drum.0", "pi.sum_wheel.0"],
      text: {
        en: "Your turn: set 5 and turn the crank forward once. What will the window show?",
        de: "Du bist dran: Stelle 5 ein und drehe die Kurbel einmal vorwärts. Was zeigt das Fenster?",
      },
      task: {
        check: (m) => m.turns === 2 && m.shownNumber() === 8,
        solve: (m) => {
          m.setNumber(5);
          m.turn(1);
        },
        wrong: (m) => {
          m.setNumber(5);
          m.turn(-1);
        },
        controls: ["input", "add", "sub"],
      },
    },
    {
      view: "register",
      casing: true,
      cutaway: false,
      text: {
        en: "3 + 5 = 8. The drum adds the set digit with every turn, and all 8 drums do this at the same time.",
        de: "3 + 5 = 8. Die Walze addiert mit jeder Umdrehung die eingestellte Ziffer, und alle 8 Walzen tun das gleichzeitig.",
      },
    },
  ],
  finalCheck: (m) => m.shownNumber() === 8 && m.turns === 2,
};

// ---------------------------------------------------------------------------------------------
const carry: Lesson = {
  id: "carry",
  title: { en: "2 · 9999 + 1: the carry", de: "2 · 9999 + 1: der Zehnerübertrag" },
  summary: {
    en: "What happens when a wheel passes from 9 to 0, and how the carry runs through four digits.",
    de: "Was passiert, wenn ein Rad von 9 auf 0 springt, und wie der Übertrag durch vier Stellen läuft.",
  },
  steps: [
    {
      do: [{ reset: { result: 9999 } }],
      view: "register",
      casing: true,
      highlight: ["pi.window"],
      text: {
        en: "The register shows 9999. What happens when we add 1?",
        de: "Im Resultatwerk steht 9999. Was passiert, wenn wir 1 addieren?",
      },
    },
    {
      view: "knobs",
      highlight: ["pm.setting_dial.0"],
      text: { en: "Set 1 on the knobs.", de: "Stelle 1 an den Knöpfen ein." },
      task: setInput(1, 10),
    },
    {
      casing: false,
      view: "carry",
      highlight: ["pi.carry_store.0", "pi.carry_store.1", "pi.carry_store.2", "pi.carry_store.3"],
      callouts: [{ node: "pi.carry_store.0", text: { en: "Pentagon of the units", de: "Fünfeck der Einer" } }],
      text: {
        en: "Behind each result wheel sits a carry store with a pentagon. A level pentagon means: nothing to carry.",
        de: "Hinter jedem Zählrad sitzt ein Übertragsspeicher mit einem Fünfeck. Liegt das Fünfeck gerade, gibt es nichts zu übertragen.",
      },
    },
    {
      do: [{ theta: 285 }],
      highlight: ["pi.sum_wheel.0", "pi.carry_store.0"],
      text: {
        en: "The ribs added 1 to the units: 9 → 0. On its way past 9, the wheel's single tooth turned the carry store a little: the pentagon tilts. The carry is stored, not yet passed on.",
        de: "Die Rippen haben zu den Einern 1 addiert: 9 → 0. Beim Sprung über die 9 hat der einzelne Zahn des Rads den Übertragsspeicher etwas gedreht: Das Fünfeck kippt. Der Übertrag ist gespeichert, aber noch nicht weitergegeben.",
      },
      expect: (m) => m.carryStates()[0] === "stored" && m.shownDigits()[0] === 0,
    },
    {
      do: [{ theta: 360 }],
      highlight: ["pm.zweihorn_add.0", "pm.zweihorn_add.1", "pm.zweihorn_add.2", "pm.zweihorn_add.3"],
      callouts: [{ node: "pm.zweihorn_add.0", text: { en: "Carry lever (Zweihorn)", de: "Zweihorn" } }],
      text: {
        en: "In the last part of the turn a carry lever (Zweihorn) passes each store, units first, and passes a stored carry on: the next wheel turns one step. That wheel goes 9 → 0 as well and stores its own carry just before its lever arrives. 9999 + 1 = 10000 in one turn.",
        de: "Im letzten Teil der Umdrehung kommt an jedem Speicher ein Übertragshebel (Zweihorn) vorbei, die Einer zuerst, und gibt einen gespeicherten Übertrag weiter: Das nächste Rad dreht sich einen Schritt. Auch dieses springt von 9 auf 0 und speichert seinen Übertrag, kurz bevor sein Hebel kommt. 9999 + 1 = 10000 in einer Umdrehung.",
      },
      expect: (m) => m.shownNumber() === 10000 && allLevel(m),
    },
    {
      view: "register",
      casing: true,
      text: {
        en: "Leibniz's idea: first add all digits at once, then pass the carries on, one after another. Electronic adders face the same problem today: a carry can run through every digit.",
        de: "Leibniz' Idee: erst alle Ziffern gleichzeitig addieren, dann die Überträge nacheinander weitergeben. Elektronische Addierer haben heute dasselbe Problem: Ein Übertrag kann durch alle Stellen laufen.",
      },
    },
    {
      do: [{ reset: { mode: "historical", result: 9999, input: 1 } }, { turn: 1 }],
      casing: false,
      view: "carry",
      highlight: ["pi.carry_store.1"],
      text: {
        en: "Historians read the original in two ways. In one reading, a carry made while carries are being passed on waits for the next turn: 9999 + 1 first shows 9900, and the tens pentagon stays tilted.",
        de: "Das Original wird auf zwei Arten gedeutet. In einer Deutung wartet ein Übertrag, der beim Weitergeben entsteht, auf die nächste Umdrehung: 9999 + 1 zeigt zuerst 9900, das Fünfeck der Zehner bleibt gekippt.",
      },
      expect: (m) => m.shownNumber() === 9900 && m.pending[1] === 1,
    },
    {
      do: [{ input: 0 }, { turn: 1 }],
      view: "register",
      casing: true,
      text: {
        en: "A second turn with 0 on the knobs finishes it: 10000. This simulator's page “The full machine” can switch between both readings.",
        de: "Eine zweite Umdrehung mit 0 an den Knöpfen erledigt den Rest: 10000. Die englische Seite „The full machine“ dieses Simulators kann zwischen beiden Deutungen umschalten.",
      },
      expect: (m) => m.shownNumber() === 10000 && allLevel(m),
    },
  ],
  finalCheck: (m) => m.shownNumber() === 10000 && allLevel(m),
};

// ---------------------------------------------------------------------------------------------
const multiply: Lesson = {
  id: "multiply",
  title: { en: "3 · 1709 × 365", de: "3 · 1709 × 365" },
  summary: {
    en: "Multiplying digit by digit, with the carriage shift and the Magna Rota's pin.",
    de: "Stellenweise multiplizieren, mit Schlittenverschiebung und dem Stift der Magna Rota.",
  },
  steps: [
    {
      do: [{ reset: {} }],
      view: "knobs",
      casing: true,
      highlight: ["pm.setting_dial.*"],
      text: {
        en: "Multiplying is adding again and again, with a trick for each digit of the multiplier. Set 1709 on the knobs.",
        de: "Multiplizieren ist wiederholtes Addieren, mit einem Kniff für jede Stelle des Multiplikators. Stelle 1709 an den Knöpfen ein.",
      },
      task: setInput(1709, 1790),
    },
    {
      view: "front",
      highlight: ["pm.magna_rota", "pm.magna_pin", "pm.magna_plate"],
      callouts: [{ node: "pm.magna_plate", text: { en: "Stop", de: "Anschlag" } }],
      text: {
        en: "The large wheel at the front is the Magna Rota. A pin in hole 5 makes the crank stop after 5 turns. Put the pin in hole 5.",
        de: "Das große Rad vorn ist die Magna Rota. Ein Stift im Loch 5 lässt die Kurbel nach 5 Umdrehungen anhalten. Setze den Stift in Loch 5.",
      },
      task: { check: (m) => m.pin === 5 && m.offset === 0, solve: (m) => m.setPin(5), wrong: (m) => m.setPin(6), controls: ["pin"] },
    },
    {
      highlight: ["pm.magna_rota", "pm.main_crank"],
      text: {
        en: "Turn the crank until it stops. The machine adds 1709 five times.",
        de: "Drehe die Kurbel bis zum Anschlag. Die Maschine addiert 1709 fünfmal.",
      },
      task: {
        check: (m) => m.pin === 5 && m.offset === 0 && m.blocked,
        solve: (m) => m.runToStop(),
        wrong: (m) => m.turn(1),
        controls: ["toStop", "add"],
      },
    },
    {
      view: "register",
      highlight: ["pi.window"],
      text: { en: "1709 × 5 = 8545.", de: "1709 × 5 = 8545." },
      expect: (m) => m.shownNumber() === 8545,
    },
    {
      view: "overview",
      highlight: ["pm.carriage"],
      text: {
        en: "Next digit of 365: the tens, 6. Shift the carriage one place to the left; every turn now adds 17090.",
        de: "Nächste Stelle von 365: die Zehner, 6. Schiebe den Schlitten eine Stelle nach links; jede Umdrehung addiert jetzt 17090.",
      },
      task: shiftTo(1, 2),
    },
    {
      view: "front",
      highlight: ["pm.magna_rota", "pm.magna_pin"],
      text: {
        en: "Put the pin in hole 6 and turn until the crank stops.",
        de: "Setze den Stift in Loch 6 und drehe bis zum Anschlag.",
      },
      task: {
        check: (m) => m.offset === 1 && m.pin === 6 && m.blocked,
        solve: (m) => {
          m.setPin(6);
          m.runToStop();
        },
        wrong: (m) => {
          m.setPin(5);
          m.runToStop();
        },
        controls: ["pin", "toStop", "add"],
      },
    },
    {
      text: {
        en: "Last digit, the hundreds: shift once more, put the pin in hole 3 and turn until it stops.",
        de: "Letzte Stelle, die Hunderter: noch eine Stelle schieben, Stift in Loch 3, bis zum Anschlag drehen.",
      },
      task: {
        check: (m) => m.offset === 2 && m.pin === 3 && m.blocked,
        solve: (m) => {
          m.setOffset(2);
          m.setPin(3);
          m.runToStop();
        },
        wrong: (m) => {
          m.setOffset(2);
          m.setPin(3);
          m.turn(1);
        },
        controls: ["shift", "pin", "toStop", "add"],
      },
    },
    {
      view: "register",
      highlight: ["pi.window"],
      text: {
        en: "1709 × 365 = 623785: 5 + 6 + 3 = 14 turns instead of 365 additions.",
        de: "1709 × 365 = 623785: 5 + 6 + 3 = 14 Umdrehungen statt 365 Additionen.",
      },
      expect: (m) => m.shownNumber() === 623785,
    },
  ],
  finalCheck: (m) => registerValue(m) === 623785,
};

// ---------------------------------------------------------------------------------------------
const divide: Lesson = {
  id: "divide",
  title: { en: "4 · 623785 ÷ 1709", de: "4 · 623785 ÷ 1709" },
  summary: {
    en: "Dividing by subtracting until it goes below zero, digit by digit.",
    de: "Dividieren durch Subtrahieren, bis es unter null geht, Stelle für Stelle.",
  },
  steps: [
    {
      do: [{ reset: { result: 623785 } }],
      view: "register",
      casing: true,
      highlight: ["pi.window"],
      text: {
        en: "Dividing is subtracting again and again. The register holds 623785, the number to divide.",
        de: "Dividieren ist wiederholtes Subtrahieren. Im Resultatwerk steht 623785, die Zahl, die geteilt wird.",
      },
    },
    {
      view: "knobs",
      highlight: ["pm.setting_dial.*"],
      text: { en: "Set the divisor, 1709, on the knobs.", de: "Stelle den Teiler 1709 an den Knöpfen ein." },
      task: setInput(1709, 1790),
    },
    {
      view: "overview",
      highlight: ["pm.carriage"],
      text: {
        en: "Start at the highest place where 1709 fits: shift the carriage two places left, so each turn subtracts 170900.",
        de: "Beginne an der höchsten Stelle, an der 1709 hineinpasst: Schiebe den Schlitten zwei Stellen nach links, dann zieht jede Umdrehung 170900 ab.",
      },
      task: shiftTo(2, 1),
    },
    {
      do: [{ pin: null }, { turn: -1, times: 3 }],
      view: "front",
      highlight: ["pm.magna_rota"],
      text: {
        en: "Turning backwards subtracts. After three turns the Magna Rota has turned back three holes: its red numbers count the subtractions.",
        de: "Rückwärts drehen subtrahiert. Nach drei Umdrehungen ist die Magna Rota drei Löcher zurückgegangen: Ihre roten Zahlen zählen die Subtraktionen.",
      },
      expect: (m) => m.ringTurns === -3 && registerValue(m) === 111085,
    },
    {
      do: [{ turn: -1 }],
      view: "register",
      highlight: ["pi.window"],
      text: {
        en: "A fourth subtraction is one too many: the register goes below zero, and its top digits turn to 9.",
        de: "Eine vierte Subtraktion ist eine zu viel: Das Ergebnis wird negativ, die oberen Ziffern springen auf 9.",
      },
      expect: (m) => registerValue(m) < 0,
    },
    {
      do: [{ turn: 1 }],
      view: "front",
      highlight: ["pm.magna_rota"],
      text: {
        en: "Add it back once. The first digit of the quotient is the red number at the stop: 3.",
        de: "Einmal zurückaddieren. Die erste Ziffer des Ergebnisses ist die rote Zahl am Anschlag: 3.",
      },
      expect: (m) => m.ringTurns === -3 && registerValue(m) === 111085,
    },
    {
      view: "overview",
      highlight: ["pm.carriage"],
      text: { en: "Next place: shift the carriage one place to the right.", de: "Nächste Stelle: Schiebe den Schlitten eine Stelle nach rechts." },
      task: shiftTo(1, 0),
    },
    {
      do: [{ pin: null }, { divideDigit: true }],
      view: "front",
      highlight: ["pm.magna_rota"],
      text: {
        en: "Subtract until it goes below zero, add back once: the red number shows 6.",
        de: "Subtrahieren, bis es unter null geht, einmal zurückaddieren: Die rote Zahl zeigt 6.",
      },
      expect: (m) => m.ringTurns === -6 && registerValue(m) === 8545,
    },
    {
      view: "overview",
      highlight: ["pm.carriage"],
      text: { en: "Shift the carriage back to the units.", de: "Schiebe den Schlitten zurück zu den Einern." },
      task: shiftTo(0, 1),
    },
    {
      do: [{ pin: null }, { divideDigit: true }],
      view: "front",
      highlight: ["pm.magna_rota"],
      text: { en: "Once more: 5, and nothing is left over.", de: "Noch einmal: 5, und es bleibt nichts übrig." },
      expect: (m) => m.ringTurns === -5 && registerValue(m) === 0,
    },
    {
      view: "register",
      highlight: ["pi.window"],
      text: {
        en: "623785 ÷ 1709 = 365, remainder 0. The quotient was read digit by digit from the Magna Rota: 3, 6, 5.",
        de: "623785 ÷ 1709 = 365, Rest 0. Das Ergebnis wurde Stelle für Stelle an der Magna Rota abgelesen: 3, 6, 5.",
      },
    },
  ],
  finalCheck: (m) => registerValue(m) === 0 && m.offset === 0,
};

export const LESSONS: Lesson[] = [drum, carry, multiply, divide];
