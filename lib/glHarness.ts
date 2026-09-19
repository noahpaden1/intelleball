/**
 * Shared single-quad WebGL harness (design spec §2.1).
 *
 * Every v3 shader surface (ChipScanHero, NeuralNoiseCanvas, CyberGridCanvas)
 * is a fullscreen-triangle fragment shader; this module owns the parts that
 * are easy to get subtly wrong — context creation with fallback, precision
 * probing, compile/link diagnostics, uniform-location caching, the
 * premultiply-immune texture path, adaptive-DPR governance, and context
 * loss/restore — so each surface component is reduced to "write a fragment
 * shader, feed uniforms, draw".
 *
 * SSR-safe by construction: no browser API is touched at module scope;
 * everything happens inside createGLSurface (callers invoke it from effects).
 */

/* ═══════════════════════════════════════════════════════════════════════
   Tuning constants
═══════════════════════════════════════════════════════════════════════ */

// Adaptive-DPR ladder (spec §2.1): step DOWN only, never back up — a surface
// that oscillated between resolutions would be worse than one that settled.
const DPR_LADDER = [2, 1.5, 1.25, 1] as const;

/** Frames per rolling mean window fed by noteFrame(). */
const FRAME_WINDOW = 120;

/**
 * The DPR governor is refresh-relative, NOT an absolute budget: rAF deltas
 * are vsync-aligned (~16.7 ms on a healthy 60 Hz display even with an idle
 * GPU), so an absolute threshold below the vsync interval would demote every
 * surface unconditionally. Instead the rolling minimum delta of each window
 * approximates the display's refresh interval, and the ladder steps down
 * only when the window mean exceeds that minimum by this headroom factor —
 * i.e. when the surface is actually missing vsyncs under load.
 */
const FRAME_HEADROOM = 1.4;

/** Absolute floor (ms) below which a window mean never triggers a step-down. */
const FRAME_BUDGET_FLOOR_MS = 12;

/**
 * Per-frame delta clamp (ms): a single tab-switch / GC hitch of hundreds of
 * ms must not poison a whole window's mean. Clamped here in the harness so
 * every caller is covered regardless of what it feeds noteFrame().
 */
const FRAME_DT_CLAMP_MS = 64;

/** Hard limit on ladder step-downs per surface lifetime. */
const MAX_STEP_DOWNS = 2;

// One fullscreen triangle: 3 verts covering clip space with overshoot, so a
// single drawArrays(TRIANGLES, 0, 3) rasterizes every pixel with no diagonal
// seam (the classic 2-triangle quad shades the shared edge twice).
const TRIANGLE_VERTS = new Float32Array([-1, -1, 3, -1, -1, 3]);

// Built-in vertex shader: passes clip-space through and derives vUv in 0..1
// (values outside 0..1 on the overshoot region are clipped away).
const VERTEX_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const isDev = process.env.NODE_ENV !== "production";

/**
 * Locked palette, normalized from theme.config.mjs — keep in sync BY HAND
 * (documented there too). Prepend to fragment sources that want the site
 * accents; kept as one exported string so every shader shares identical
 * constants and a palette change is a single edit.
 */
export const GLSL_PALETTE = `
const vec3 AZURE  = vec3(0.161, 0.592, 1.000); // #2997ff
const vec3 VIOLET = vec3(0.749, 0.353, 0.949); // #bf5af2
const vec3 ROSE   = vec3(1.000, 0.216, 0.373); // #ff375f
const vec3 INK    = vec3(0.961, 0.961, 0.969); // #f5f5f7
`;

/* ═══════════════════════════════════════════════════════════════════════
   Public API
═══════════════════════════════════════════════════════════════════════ */

/** Options for {@link createGLSurface}. */
export interface GLSurfaceOptions {
  /** Fragment shader source (GLSL ES 1.0 subset — runs on webgl1 and webgl2). */
  frag: string;
  /** Hard DPR cap (default 2). */
  maxDpr?: number;
  /** Enable the adaptive-DPR step-down governor (default true). */
  adaptiveDpr?: boolean;
  /** Render-buffer scale vs CSS px (default 1). */
  internalScale?: number;
  /** Request an alpha drawing buffer (default false — opaque, faster composite). */
  alpha?: boolean;
  /** Called after a context restore; re-upload textures + re-set uniforms here. */
  onContextRestored?: () => void;
}

/** A live single-quad WebGL surface returned by {@link createGLSurface}. */
export interface GLSurface {
  /** The underlying context (webgl2 when available, else webgl). */
  readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
  /** Set a float uniform: 1f/2f/3f/4f chosen by arity. Locations are cached. */
  setUniform(name: string, ...v: number[]): void;
  /**
   * Upload RGBA pixel data to the sampler uniform `name` on texture `unit`.
   * Accepts ONLY `Uint8Array` — there is deliberately no TexImageSource /
   * canvas overload, so the premultiplied-alpha-immune upload path
   * (texImage2D with an ArrayBufferView) cannot be bypassed (spec §2.1).
   */
  uploadTexture(unit: number, name: string, pixels: Uint8Array, w: number, h: number): void;
  /** Re-read clientWidth/Height, apply dpr×internalScale, set viewport + uResolution. */
  resize(): void;
  /** Bind program + fullscreen triangle and draw one frame. */
  draw(): void;
  /** Feed the adaptive-DPR governor one frame delta (ms). */
  noteFrame(dtMs: number): void;
  /** True while the WebGL context is lost (callers stop their RAF on this). */
  isContextLost(): boolean;
  /** Delete all GL objects, remove listeners, and release the context. */
  dispose(): void;
}

/**
 * Create a fullscreen-triangle shader surface on `canvas`.
 *
 * Tries `webgl2` then falls back to `webgl`; probes fragment-shader `highp`
 * support and prepends the right precision header; returns `null` when a
 * context cannot be created or the shader fails to compile/link (callers
 * show their 2D/CSS fallback). Compile/link logs surface via console.error
 * in development only.
 */
export function createGLSurface(
  canvas: HTMLCanvasElement,
  opts: GLSurfaceOptions
): GLSurface | null {
  const {
    frag,
    maxDpr = 2,
    adaptiveDpr = true,
    internalScale = 1,
    alpha = false,
    onContextRestored,
  } = opts;

  // Low-power + no ancillary buffers: these are decorative background quads,
  // not scenes — the discrete-GPU / MSAA / depth costs buy nothing here.
  const attrs: WebGLContextAttributes = {
    alpha,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  };

  const gl =
    (canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null) ??
    (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);
  if (!gl) return null;

  // A canvas whose context is already lost returns the SAME lost context
  // from getContext(), and lost-context GL calls "succeed" with inert
  // objects (compile/link status reads are skipped while lost) — building
  // here would hand the caller a non-null but permanently dead surface,
  // silently defeating every consumer's null-fallback path. Refuse instead.
  if (gl.isContextLost()) return null;

  // Precision probe: prefer highp in fragment shaders where the hardware has
  // it (older mobile GPUs report precision 0 → fall back to mediump).
  const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precisionHeader = `precision ${highp && highp.precision > 0 ? "highp" : "mediump"} float;\n`;

  /* ── Per-surface state ─────────────────────────────────────────────── */

  let program: WebGLProgram | null = null;
  let vertShader: WebGLShader | null = null;
  let fragShader: WebGLShader | null = null;
  let buffer: WebGLBuffer | null = null;

  // Uniform locations, cached on first use. `null` is cached too, so a
  // uniform the compiler optimized away costs one lookup, ever.
  const uniformCache = new Map<string, WebGLUniformLocation | null>();

  // Texture records survive context loss (handles do not): (unit, w, h) are
  // retained so restore-time callers only re-supply pixels (spec §2.1).
  interface TexRecord {
    unit: number;
    w: number;
    h: number;
    texture: WebGLTexture | null;
  }
  const textures = new Map<string, TexRecord>();

  let lost = false;
  let disposed = false;

  // Adaptive-DPR governor state.
  let dprCap = Number.POSITIVE_INFINITY;
  let stepDowns = 0;
  let frameSum = 0;
  let frameCount = 0;
  let frameMin = Number.POSITIVE_INFINITY; // vsync-interval proxy per window

  /* ── Program build (shared by init and context restore) ────────────── */

  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      if (isDev) console.error("glHarness: shader compile failed —", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const buildProgram = (): boolean => {
    // Every early-out below deletes whatever was created before it — a
    // partial failure (e.g. a driver rejecting only the fragment shader)
    // must not strand live GL objects on a context we may keep using
    // (buildProgram also runs on the retained context after a restore).
    const vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, precisionHeader + frag);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return false;
    }

    const prog = gl.createProgram();
    if (!prog) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
      if (isDev) console.error("glHarness: program link failed —", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }

    const buf = gl.createBuffer();
    if (!buf) {
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_VERTS, gl.STATIC_DRAW);

    gl.useProgram(prog);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    program = prog;
    vertShader = vs;
    fragShader = fs;
    buffer = buf;
    return true;
  };

  if (!buildProgram()) {
    // Failed init abandons this context — release it eagerly rather than
    // leaving a live orphaned context counting against the browser's
    // per-page context limit for the canvas's lifetime.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  /* ── Internals ─────────────────────────────────────────────────────── */

  const getLoc = (name: string): WebGLUniformLocation | null => {
    let loc = uniformCache.get(name);
    if (loc === undefined) {
      loc = program ? gl.getUniformLocation(program, name) : null;
      uniformCache.set(name, loc);
    }
    return loc;
  };

  const usable = () => !disposed && !lost && program !== null;

  const effectiveDpr = () =>
    Math.min(window.devicePixelRatio || 1, maxDpr, dprCap);

  /* ── Context loss / restore ────────────────────────────────────────── */

  const onLost = (e: Event) => {
    // preventDefault signals we intend to restore; callers stop their RAF
    // via isContextLost() and resume when onContextRestored fires.
    e.preventDefault();
    lost = true;
  };

  const onRestored = () => {
    if (disposed) return;
    // All old GL handles are invalid now: rebuild program + buffer, drop the
    // stale uniform cache, null texture handles (metadata is kept so callers
    // only re-supply pixels via uploadTexture).
    uniformCache.clear();
    for (const rec of textures.values()) rec.texture = null;
    if (!buildProgram()) return; // restored but unusable → stays "lost"
    lost = false;
    surface.resize();
    onContextRestored?.();
  };

  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  /* ── Surface ───────────────────────────────────────────────────────── */

  const surface: GLSurface = {
    gl,

    setUniform(name, ...v) {
      if (!usable()) return;
      gl.useProgram(program);
      const loc = getLoc(name);
      if (loc === null) return;
      if (v.length === 1) gl.uniform1f(loc, v[0]);
      else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      else if (isDev) {
        console.error(`glHarness: setUniform("${name}") expects 1–4 floats, got ${v.length}`);
      }
    },

    uploadTexture(unit, name, pixels, w, h) {
      if (!usable()) return;
      if (isDev && pixels.length !== w * h * 4) {
        console.error(
          `glHarness: uploadTexture("${name}") pixel count ${pixels.length} !== ${w}×${h}×4`
        );
      }
      let rec = textures.get(name);
      if (!rec) {
        rec = { unit, w, h, texture: null };
        textures.set(name, rec);
      }
      rec.unit = unit;
      rec.w = w;
      rec.h = h;

      gl.activeTexture(gl.TEXTURE0 + unit);
      if (!rec.texture) rec.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, rec.texture);
      // The premultiply-immune path: ArrayBufferView upload with both pixel
      // transfers forced off — data channels arrive exactly as authored.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.useProgram(program);
      const loc = getLoc(name);
      if (loc !== null) gl.uniform1i(loc, unit);
    },

    resize() {
      if (!usable()) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return; // display:none / pre-layout — keep old buffer
      const scale = effectiveDpr() * internalScale;
      const bw = Math.max(1, Math.round(w * scale));
      const bh = Math.max(1, Math.round(h * scale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      surface.setUniform("uResolution", bw, bh);
    },

    draw() {
      if (!usable()) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    noteFrame(dtMs) {
      if (!adaptiveDpr || disposed || stepDowns >= MAX_STEP_DOWNS) return;
      const dt = Math.min(Math.max(dtMs, 0), FRAME_DT_CLAMP_MS);
      frameSum += dt;
      frameCount++;
      if (dt < frameMin) frameMin = dt;
      if (frameCount < FRAME_WINDOW) return;
      const mean = frameSum / frameCount;
      // Budget = the display's observed refresh interval (window minimum)
      // plus headroom — never below the absolute floor. Only sustained
      // missed vsyncs step the ladder down; a healthy 60 Hz surface
      // (mean ≈ min ≈ 16.7 ms) never demotes.
      const budget = Math.max(frameMin * FRAME_HEADROOM, FRAME_BUDGET_FLOOR_MS);
      frameSum = 0;
      frameCount = 0;
      frameMin = Number.POSITIVE_INFINITY;
      if (mean <= budget) return;
      // One rung down per full window; the epsilon skips rungs that would
      // round to the current resolution (e.g. cap 1.75 → next real rung 1.5).
      const next = DPR_LADDER.find((v) => v < effectiveDpr() - 1e-3);
      if (next === undefined) return;
      dprCap = next;
      stepDowns++;
      surface.resize();
    },

    isContextLost() {
      return lost || gl.isContextLost();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      for (const rec of textures.values()) {
        if (rec.texture) gl.deleteTexture(rec.texture);
      }
      textures.clear();
      uniformCache.clear();
      if (buffer) gl.deleteBuffer(buffer);
      if (vertShader) gl.deleteShader(vertShader);
      if (fragShader) gl.deleteShader(fragShader);
      if (program) gl.deleteProgram(program);
      buffer = null;
      vertShader = null;
      fragShader = null;
      program = null;
      // Deliberately NO loseContext() here: getContext() on the same canvas
      // returns the same context object, and an extension-lost context stays
      // lost forever (nothing calls restoreContext()) — so eagerly losing it
      // would permanently poison any later createGLSurface() on this canvas
      // (e.g. an effect re-run on a prefers-reduced-motion toggle or Fast
      // Refresh). All GL objects are deleted above; the context itself is
      // reclaimed when the canvas leaves the DOM.
    },
  };

  return surface;
}
