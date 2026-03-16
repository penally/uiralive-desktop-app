/**
 * Browser fingerprint collector.
 *
 * Collects signals that require executing real browser JS APIs:
 *   • Canvas 2D — pixel rendering differs per OS / GPU / font stack
 *   • WebGL — unmasked renderer string (headless reports Mesa/SwiftShader)
 *   • OfflineAudioContext — oscillator output floats are system-specific
 *   • Font detection — canvas text measurement across 23 reference fonts
 *   • performance.now() fractional entropy
 *
 * A pure-requests script (Python, curl, etc.) can't produce valid values for
 * any of these — especially audio and WebGL renderer.
 */

export interface BrowserFingerprint {
  canvasHash: string;
  webglRenderer: string;
  webglVendor: string;
  audioHash: string;     // OfflineAudioContext oscillator output, stringified float
  fontCount: number;     // number of installed fonts detected from test set
  timingNonce: string;   // performance.now() fractional bits, base36 encoded
  languages: string;
  platform: string;
  timezone: string;
  screenRes: string;
  colorDepth: number;
  cookiesEnabled: boolean;
  touchPoints: number;
  webdriver: boolean;
  pixelRatio: number;
  hardwareConcurrency: number;
  // New bot-detection fields
  automationFlags: string;   // comma-separated list of detected automation markers
  outerSize: string;         // window.outerWidth x window.outerHeight (0x0 = headless)
  hasSpeechSynthesis: boolean;
  gpuWorkerMatch: boolean;   // main-thread WebGL renderer === worker OffscreenCanvas renderer
  workerUaMatch: boolean;    // navigator.userAgent same inside a Worker as on main thread
  /**
   * SHA-256(canvas_with_nonce.toDataURL() + ":" + nonce) where the server nonce is
   * drawn on the canvas before hashing.  Changes every registration because the
   * server nonce changes every request — a static precomputed value is never valid.
   */
  canvasNonceHash: string;
}

export type FingerprintResult = BrowserFingerprint & { hash: string; challengeToken: string };

// ─── Canvas fingerprint ────────────────────────────────────────────────────

function canvasFingerprint(): string {
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 300; cvs.height = 70;
    const ctx = cvs.getContext('2d');
    if (!ctx) return 'empty';

    // Layer 1: gradient fill — color blending differs per GPU/OS
    const g = ctx.createLinearGradient(0, 0, 300, 70);
    g.addColorStop(0, '#e06b6b');
    g.addColorStop(0.5, '#6bb5e0');
    g.addColorStop(1, '#6be090');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 300, 70);

    // Layer 2: anti-aliased text in multiple fonts — subpixel rendering varies by OS
    ctx.textBaseline = 'top';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText('UiraLive\ud83d\ude80 \u2022 security_check', 4, 4);

    ctx.font = '13px "Times New Roman", serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('\u03a9mega \u2022 verify_2026 \u2022 \u00e9t\u00e9', 4, 24);

    // Layer 3: geometric shapes — compositing differs
    ctx.beginPath();
    ctx.arc(268, 35, 22, 0, Math.PI * 1.7);
    ctx.fillStyle = 'rgba(106,43,230,0.55)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, 58); ctx.lineTo(50, 44); ctx.lineTo(90, 58);
    ctx.fillStyle = 'rgba(255,229,102,0.7)';
    ctx.fill();

    // Layer 4: shadow text — shadow rendering differs
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.font = '11px Verdana, sans-serif';
    ctx.fillStyle = '#ffe566';
    ctx.fillText(`cores:${navigator.hardwareConcurrency || 4} depth:${screen.colorDepth}`, 4, 54);
    ctx.shadowBlur = 0;

    // djb2 hash over the entire data URL
    const data = cvs.toDataURL('image/png');
    let h = 5381;
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h) ^ data.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
  } catch {
    return 'empty';
  }
}

// ─── WebGL fingerprint ─────────────────────────────────────────────────────

function webglInfo(): { renderer: string; vendor: string } {
  try {
    const cvs = document.createElement('canvas');
    const gl = (cvs.getContext('webgl') || cvs.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { renderer: 'none', vendor: 'none' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      return {
        renderer: (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || 'unknown',
        vendor:   (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   as string) || 'unknown',
      };
    }
    return {
      renderer: (gl.getParameter(gl.RENDERER) as string) || 'unknown',
      vendor:   (gl.getParameter(gl.VENDOR)   as string) || 'unknown',
    };
  } catch {
    return { renderer: 'error', vendor: 'error' };
  }
}

// ─── Audio fingerprint ─────────────────────────────────────────────────────

async function audioFingerprint(): Promise<string> {
  try {
    type OfflineAudioCtxConstructor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
    const Ctor: OfflineAudioCtxConstructor =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: OfflineAudioCtxConstructor }).webkitOfflineAudioContext!;
    if (!Ctor) return '0';

    const ctx = new Ctor(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 10000;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -50;
    comp.knee.value = 40;
    comp.ratio.value = 12;
    comp.attack.value = 0;
    comp.release.value = 0.25;

    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);

    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);

    // Sum a characteristic slice — unique per browser engine version / OS audio stack
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
    return sum.toFixed(10).replace('.', '').replace(/^0+/, '') || '1';
  } catch {
    return '0';
  }
}

// ─── Font detection ────────────────────────────────────────────────────────

const TEST_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Calibri',
  'Cambria', 'Consolas', 'Segoe UI', 'Tahoma', 'Palatino Linotype',
  'Book Antiqua', 'Garamond', 'Franklin Gothic Medium', 'Gill Sans MT',
  'Century Gothic', 'Lucida Console', 'Lucida Grande', 'Helvetica Neue',
];

function detectFonts(): number {
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 400; cvs.height = 24;
    const ctx = cvs.getContext('2d');
    if (!ctx) return 0;
    ctx.font = '16px monospace';
    const baseline = ctx.measureText('mmmmmmmmmmlli').width;
    let count = 0;
    for (const font of TEST_FONTS) {
      ctx.font = `16px "${font}", monospace`;
      if (ctx.measureText('mmmmmmmmmmlli').width !== baseline) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

// ─── Timing nonce ──────────────────────────────────────────────────────────

function timingNonce(): string {
  try {
    const t = performance.now();
    const rough  = Math.round(t);
    const frac   = Math.round((t % 1) * 1e9);
    return ((rough * 1337 + frac) >>> 0).toString(36);
  } catch {
    return '0';
  }
}

// ─── Automation / bot signal detection ────────────────────────────────────

function collectAutomationFlags(): string {
  const flags: string[] = [];
  try {
    const w = window as unknown as Record<string, unknown>;

    // Playwright runtime globals
    if ('__pwInitScripts' in window)                            flags.push('pw_init');
    if ('__playwright__binding__' in window)                   flags.push('pw_binding');
    if (w.__playwright !== undefined)                          flags.push('pw_global');

    // Puppeteer / Nightmare globals
    if (w.__nightmare !== undefined)                           flags.push('nightmare');
    if (w.__puppeteer_evaluation_script !== undefined)         flags.push('puppeteer');

    // Playwright leak vars (enabled by --runtime-enable-leak-vars)
    const rlv = w.runtimeEnableLeakVars as { stackLookupCount?: number } | undefined;
    if (rlv && typeof rlv.stackLookupCount === 'number' && rlv.stackLookupCount > 0)
      flags.push('rlv_stack');

    // Playwright exposed binding — toString contains a Playwright-specific message
    if (
      typeof w.exposedFn !== 'undefined' &&
      typeof w.exposedFn === 'function' &&
      String(w.exposedFn).includes('exposeBindingHandle')
    ) flags.push('pw_exposed_fn');

    // Chrome with loadTimes but no csi → Puppeteer-injected chrome stub
    if (
      typeof w.chrome === 'object' && w.chrome !== null &&
      typeof (w.chrome as Record<string, unknown>).loadTimes === 'function' &&
      typeof (w.chrome as Record<string, unknown>).csi !== 'function'
    ) flags.push('chrome_stub');

    // window.open / HTMLElement.click native-code tampering
    try {
      if (typeof window.open === 'function' && !window.open.toString().includes('native code'))
        flags.push('open_tampered');
      if (typeof HTMLElement !== 'undefined' &&
          typeof HTMLElement.prototype.click === 'function' &&
          !HTMLElement.prototype.click.toString().includes('native code'))
        flags.push('click_tampered');
    } catch { /* swallow */ }

    // Chrome UA without userAgentData (only Chromium-based browsers expose it)
    const ua = navigator.userAgent.toLowerCase();
    const uad = (navigator as unknown as Record<string, unknown>).userAgentData;
    if (ua.includes('chrome') && !ua.includes('edg') && !uad)         flags.push('chrome_no_uad');
    // Firefox should NOT expose userAgentData
    if (ua.includes('firefox') && uad)                                 flags.push('ff_has_uad');

    // OS/UA consistency: Win32 platform must have 'windows nt' in UA
    const plat = (navigator.platform || '').toLowerCase();
    if (plat === 'win32' && !ua.includes('windows nt'))                flags.push('win_ua_mismatch');

    // CDP detection: access Error.stack in a console.log triggers CDP stack collection
    let cdpDetected = false;
    try {
      const e = new Error();
      Object.defineProperty(e, 'stack', { get() { cdpDetected = true; return ''; } });
      // eslint-disable-next-line no-console
      void String(e);
    } catch { /* property definition may throw in strict sandboxes */ }
    if (cdpDetected) flags.push('cdp');

  } catch { /* never throw from fingerprint collection */ }
  return flags.join(',');
}

// ─── GPU renderer cross-check (main thread vs Worker OffscreenCanvas) ─────
// A spoofed WebGL renderer won't be consistent when checked from inside a Worker.

async function checkGpuWorkerMatch(mainRenderer: string): Promise<boolean> {
  try {
    if (typeof Worker === 'undefined' || typeof URL === 'undefined') return true; // can't check
    const blob = new Blob([
      `onmessage=()=>{` +
      `try{` +
      `const gl=new OffscreenCanvas(1,1).getContext('webgl');` +
      `const ext=gl&&gl.getExtension('WEBGL_debug_renderer_info');` +
      `const r=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):(gl?gl.getParameter(gl.RENDERER):'');` +
      `postMessage(r||'');` +
      `}catch(e){postMessage('');}` +
      `};`,
    ], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const workerRenderer = await new Promise<string>((resolve) => {
      const t = setTimeout(() => { worker.terminate(); resolve('timeout'); }, 2000);
      worker.onmessage = (e: MessageEvent) => { clearTimeout(t); resolve(String(e.data || '')); worker.terminate(); };
      worker.onerror   = ()              => { clearTimeout(t); resolve('error');   worker.terminate(); };
      worker.postMessage({});
    });
    URL.revokeObjectURL(url);
    // Empty or timeout means OffscreenCanvas WebGL unsupported — not suspicious by itself
    if (!workerRenderer || workerRenderer === 'timeout' || workerRenderer === 'error') return true;
    return mainRenderer.trim().toLowerCase() === workerRenderer.trim().toLowerCase();
  } catch {
    return true; // if Worker fails, don't penalise real browsers
  }
}

// ─── Worker UA consistency check ──────────────────────────────────────────
// navigator.userAgent inside a Worker should equal the main-thread value.

async function checkWorkerUaMatch(): Promise<boolean> {
  try {
    if (typeof Worker === 'undefined' || typeof URL === 'undefined') return true;
    const blob = new Blob(
      [`onmessage=()=>postMessage(navigator.userAgent);`],
      { type: 'text/javascript' },
    );
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const workerUa = await new Promise<string>((resolve) => {
      const t = setTimeout(() => { worker.terminate(); resolve('timeout'); }, 2000);
      worker.onmessage = (e: MessageEvent) => { clearTimeout(t); resolve(String(e.data || '')); worker.terminate(); };
      worker.onerror   = ()              => { clearTimeout(t); resolve('error');   worker.terminate(); };
      worker.postMessage({});
    });
    URL.revokeObjectURL(url);
    if (workerUa === 'timeout' || workerUa === 'error') return true;
    return workerUa === navigator.userAgent;
  } catch {
    return true;
  }
}

// ─── Challenge-nonce canvas hash ───────────────────────────────────────
//
// Draws the server-issued nonce on a fresh canvas (same ops as canvasFingerprint)
// then returns SHA-256(dataURL + ":" + nonce) via SubtleCrypto.
//
// Security property: the nonce is single-use and expires after 2 min.
// Therefore canvasNonceHash changes on every registration call and can
// NEVER be a precomputed static value — the bot must run this fresh each time.
// Even if a bot uses Pillow to fake the pixels, the static canvasHash (used
// for fpId) remains constant, so the device cap still fires after 2 accounts.

async function canvasNonceFingerprint(nonce: string): Promise<string> {
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 300; cvs.height = 70;
    const ctx = cvs.getContext('2d');
    if (!ctx) return 'empty';

    // Same draw ops as canvasFingerprint() so GPU/font rendering variance is preserved
    const g = ctx.createLinearGradient(0, 0, 300, 70);
    g.addColorStop(0, '#e06b6b');
    g.addColorStop(0.5, '#6bb5e0');
    g.addColorStop(1, '#6be090');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 300, 70);

    ctx.textBaseline = 'top';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText('UiraLive\u{1F680} \u2022 security_check', 4, 4);

    ctx.font = '13px "Times New Roman", serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('\u03a9mega \u2022 verify_2026 \u2022 \u00e9t\u00e9', 4, 24);

    ctx.beginPath();
    ctx.arc(268, 35, 22, 0, Math.PI * 1.7);
    ctx.fillStyle = 'rgba(106,43,230,0.55)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, 58); ctx.lineTo(50, 44); ctx.lineTo(90, 58);
    ctx.fillStyle = 'rgba(255,229,102,0.7)';
    ctx.fill();

    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.font = '11px Verdana, sans-serif';
    ctx.fillStyle = '#ffe566';
    ctx.fillText(`cores:${navigator.hardwareConcurrency || 4} depth:${screen.colorDepth}`, 4, 54);
    ctx.shadowBlur = 0;

    // Draw the server nonce visibly — this is what makes every hash unique
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = 'rgba(30,30,30,0.85)';
    ctx.fillText(nonce, 148, 28);

    const dataUrl = cvs.toDataURL('image/png');
    const combined = dataUrl + ':' + nonce;
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'empty';
  }
}

// ─── Hash over all fields ──────────────────────────────────────────────────

function hashFingerprint(fp: BrowserFingerprint): string {
  const str = JSON.stringify(fp);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Collect the full browser fingerprint.
 *
 * @param challengeToken  The signed token from GET /api/fp/challenge.
 * @param nonce           The plaintext nonce embedded in challengeToken.
 *                        Must be drawn on the challenge canvas before hashing.
 */
export async function collectBrowserFingerprint(
  challengeToken: string,
  nonce: string,
): Promise<FingerprintResult> {
  const webgl = webglInfo();
  const [audioHash, gpuWorkerMatch, workerUaMatch, canvasNonceHash] = await Promise.all([
    audioFingerprint(),
    checkGpuWorkerMatch(webgl.renderer),
    checkWorkerUaMatch(),
    canvasNonceFingerprint(nonce),
  ]);

  const fp: BrowserFingerprint = {
    canvasHash:          canvasFingerprint(),
    webglRenderer:       webgl.renderer,
    webglVendor:         webgl.vendor,
    audioHash,
    fontCount:           detectFonts(),
    timingNonce:         timingNonce(),
    languages:           (navigator.languages ?? []).join(','),
    platform:            navigator.platform || 'unknown',
    timezone:            Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenRes:           `${screen.width}x${screen.height}`,
    colorDepth:          screen.colorDepth,
    cookiesEnabled:      navigator.cookieEnabled,
    touchPoints:         navigator.maxTouchPoints ?? 0,
    webdriver:           !!(navigator as unknown as Record<string, unknown>).webdriver,
    pixelRatio:          Math.round((window.devicePixelRatio || 1) * 100),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    automationFlags:     collectAutomationFlags(),
    outerSize:           `${window.outerWidth}x${window.outerHeight}`,
    hasSpeechSynthesis:  typeof speechSynthesis !== 'undefined',
    gpuWorkerMatch,
    workerUaMatch,
    canvasNonceHash,
  };

  // challengeToken is passed through alongside the fp so /fp/register can verify it,
  // but it is NOT in the djb2 hash (it's a server-issued token, not a browser signal).
  return { ...fp, hash: hashFingerprint(fp), challengeToken };
}
