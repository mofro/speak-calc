import { parse } from './parser.js';
import { calcTip, calcSplit, calcTax, calcTipSplitTax, calcPercent, evalArithmetic } from './calculator.js';
import { SpeechRecognizer, Speaker } from './speech.js';

const $ = id => document.getElementById(id);

// ── Debug logger ─────────────────────────────────────────────────────────────

const dbg = (() => {
  const lines = [];
  return (msg) => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    lines.unshift(`${t}  ${msg}`);
    if (lines.length > 8) lines.pop();
    const el = $('debug-strip');
    if (el) el.textContent = lines.join('\n');
    console.log('[speak-calc]', msg);
  };
})();

const recognizer = new SpeechRecognizer({ onResult, onError, onStateChange });
const speaker = new Speaker();

// ── State ────────────────────────────────────────────────────────────────────

let history = [];

// ── DOM events ───────────────────────────────────────────────────────────────

$('mic-btn').addEventListener('click', () => {
  dbg(`mic clicked — listening=${recognizer.listening} supported=${recognizer.supported}`);
  if (recognizer.listening) {
    recognizer.stop();
  } else {
    recognizer.start();
  }
});

$('mute-btn').addEventListener('click', () => {
  speaker.muted = !speaker.muted;
  updateMuteBtn();
});

$('tax-input').addEventListener('change', () => {
  const val = parseFloat($('tax-input').value);
  $('tax-display').textContent = isNaN(val) ? '' : `Tax rate: ${val}%`;
});

$('text-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = $('text-input').value.trim();
    if (val) { processUtterance(val); $('text-input').value = ''; }
  }
});

$('clear-btn').addEventListener('click', () => {
  history = [];
  renderHistory();
  $('result-primary').textContent = '';
  $('result-lines').innerHTML = '';
});

// ── Speech callbacks ─────────────────────────────────────────────────────────

function onResult(transcript) {
  dbg(`result: "${transcript}"`);
  $('transcript').textContent = `"${transcript}"`;
  processUtterance(transcript);
}

function onError(msg) {
  dbg(`error: ${msg}`);
  showError(speechErrorHint(msg));
}

function onStateChange(state) {
  dbg(`state → ${state}`);
  const btn = $('mic-btn');
  if (state === 'listening') {
    btn.classList.add('listening');
    btn.setAttribute('aria-label', 'Stop listening');
    $('transcript').textContent = 'Listening…';
  } else {
    btn.classList.remove('listening');
    btn.setAttribute('aria-label', 'Start listening');
  }
}

function speechErrorHint(code) {
  const hints = {
    'not-allowed':   'Microphone access denied. Check browser site permissions and reload.',
    'service-not-allowed': 'Speech service blocked. Try Chrome on localhost.',
    'no-speech':     'No speech detected. Try speaking louder or closer to the mic.',
    'network':       'Network error — speech recognition requires an internet connection.',
    'audio-capture': 'No microphone found. Check your system audio settings.',
    'aborted':       'Listening was cancelled.',
  };
  return hints[code] ?? `Speech error: ${code}`;
}

// ── Core processing ──────────────────────────────────────────────────────────

function processUtterance(text) {
  const taxPctOverride = parseFloat($('tax-input').value) || null;
  const intent = parse(text);

  if (!intent) {
    showError(`Didn't understand: "${text}"`);
    return;
  }

  // Inject manual tax rate if user set one and intent is tip/split without tax
  if (taxPctOverride && intent.intent === 'tip' && !intent.params.taxPct) {
    intent.intent = 'tip_split_tax';
    intent.params.people = 1;
    intent.params.taxPct = taxPctOverride;
  }
  if (taxPctOverride && intent.intent === 'split' && !intent.params.taxPct) {
    intent.intent = 'tip_split_tax';
    intent.params.taxPct = taxPctOverride;
  }

  const result = evaluate(intent);
  if (!result) { showError('Could not calculate.'); return; }

  displayResult(result);
  pushHistory({ text, result });
  speaker.say(result.lines[result.lines.length - 1]);
}

function evaluate({ intent, params }) {
  switch (intent) {
    case 'tip':         return calcTip(params.bill, params.tipPct);
    case 'split':       return calcSplit(params.bill, params.people, params.tipPct);
    case 'tax':         return calcTax(params.subtotal, params.taxPct);
    case 'tip_split_tax': return calcTipSplitTax(params.bill, params.tipPct, params.people, params.taxPct);
    case 'percent':     return calcPercent(params.value, params.pct);
    case 'arithmetic':  return evalArithmetic(params.expr);
    default:            return null;
  }
}

// ── Display ──────────────────────────────────────────────────────────────────

function displayResult(result) {
  const primary = result.lines[result.lines.length - 1];
  $('result-primary').textContent = primary;
  $('result-lines').innerHTML = result.lines
    .slice(0, -1)
    .map(l => `<li>${l}</li>`)
    .join('');
  $('error-msg').textContent = '';
}

function showError(msg) {
  $('error-msg').textContent = msg;
  $('result-primary').textContent = '';
  $('result-lines').innerHTML = '';
}

function pushHistory(entry) {
  history.unshift(entry);
  if (history.length > 20) history.pop();
  renderHistory();
}

function renderHistory() {
  const el = $('history-list');
  if (!history.length) { el.innerHTML = '<li class="empty">No history yet</li>'; return; }
  el.innerHTML = history.map(h => `
    <li>
      <span class="hist-query">${escHtml(h.text)}</span>
      <span class="hist-answer">${escHtml(h.result.lines[h.result.lines.length - 1])}</span>
    </li>`).join('');
}

function updateMuteBtn() {
  const btn = $('mute-btn');
  btn.textContent = speaker.muted ? '🔇' : '🔊';
  btn.setAttribute('aria-label', speaker.muted ? 'Unmute' : 'Mute');
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ─────────────────────────────────────────────────────────────────────

if (!recognizer.supported) {
  $('mic-btn').disabled = true;
  $('mic-btn').title = 'Speech not supported — use text input below';
  dbg('SpeechRecognition API: NOT detected');
} else {
  dbg('SpeechRecognition API: detected ✓');
}
renderHistory();
updateMuteBtn();
