/**
 * Pure calculation functions — no DOM, no speech. Portable to Dart/Flutter.
 *
 * All functions return a Result object: { lines: string[], total: number }
 * `lines` are display-ready strings; `total` is the numeric answer.
 */

export function calcTip(bill, tipPct) {
  const tip = bill * (tipPct / 100);
  const total = bill + tip;
  return {
    lines: [
      `Bill: ${fmt(bill)}`,
      `Tip (${tipPct}%): ${fmt(tip)}`,
      `Total: ${fmt(total)}`,
    ],
    total,
  };
}

export function calcSplit(bill, people, tipPct = 0) {
  const tip = bill * (tipPct / 100);
  const total = bill + tip;
  const perPerson = total / people;
  const lines = [`Bill: ${fmt(bill)}`];
  if (tipPct > 0) lines.push(`Tip (${tipPct}%): ${fmt(tip)}`);
  lines.push(`Total: ${fmt(total)}`, `Each of ${people}: ${fmt(perPerson)}`);
  return { lines, total: perPerson };
}

export function calcTax(subtotal, taxPct) {
  const tax = subtotal * (taxPct / 100);
  const total = subtotal + tax;
  return {
    lines: [
      `Subtotal: ${fmt(subtotal)}`,
      `Tax (${taxPct}%): ${fmt(tax)}`,
      `Total: ${fmt(total)}`,
    ],
    total,
  };
}

export function calcTipSplitTax(bill, tipPct, people, taxPct) {
  const tax = bill * (taxPct / 100);
  const afterTax = bill + tax;
  const tip = afterTax * (tipPct / 100);
  const total = afterTax + tip;
  const perPerson = total / people;
  return {
    lines: [
      `Bill: ${fmt(bill)}`,
      `Tax (${taxPct}%): ${fmt(tax)}`,
      `After tax: ${fmt(afterTax)}`,
      `Tip (${tipPct}%): ${fmt(tip)}`,
      `Total: ${fmt(total)}`,
      `Each of ${people}: ${fmt(perPerson)}`,
    ],
    total: perPerson,
  };
}

export function calcPercent(value, pct) {
  const result = value * (pct / 100);
  return {
    lines: [`${pct}% of ${fmt(value)} = ${fmt(result)}`],
    total: result,
  };
}

export function evalArithmetic(expr) {
  // Safe eval: only digits, operators, parens, decimals, spaces
  if (!/^[\d\s+\-*/().%]+$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return {
      lines: [`${expr} = ${fmtNum(result)}`],
      total: result,
    };
  } catch {
    return null;
  }
}

function fmt(n) {
  return '$' + n.toFixed(2);
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}
