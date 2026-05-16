/**
 * Thin wrapper around Web Speech API.
 * Emits events via callback so the core logic stays testable without a browser.
 */

export class SpeechRecognizer {
  constructor({ onResult, onError, onStateChange }) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStateChange = onStateChange;
    this._recognition = null;
    this._listening = false;
  }

  get supported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  start() {
    if (!this.supported) {
      this.onError?.('Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (this._listening) return;

    const Rec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => {
      this._listening = true;
      this.onStateChange?.('listening');
    };

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      this.onResult?.(transcript);
    };

    rec.onerror = (e) => {
      this._listening = false;
      this.onStateChange?.('idle');
      if (e.error !== 'no-speech') this.onError?.(e.error);
    };

    rec.onend = () => {
      this._listening = false;
      this.onStateChange?.('idle');
    };

    this._recognition = rec;
    rec.start();
  }

  stop() {
    this._recognition?.stop();
    this._listening = false;
    this.onStateChange?.('idle');
  }

  get listening() {
    return this._listening;
  }
}

export class Speaker {
  constructor() {
    this._muted = true; // muted by default per spec
  }

  get muted() { return this._muted; }
  set muted(v) { this._muted = v; }

  say(text) {
    if (this._muted) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }
}
