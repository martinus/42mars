// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// WebGL2 renderer for the core. One full-screen fragment shader draws every
// cell from two small data textures; a bloom pass makes fresh writes, running
// processes and death shockwaves glow.

import { LAYOUT_RING } from './layout.js';

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uA;
uniform sampler2D uB;
uniform int uTexW;
uniform int uN;
uniform int uLayout;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uOrigin;
uniform float uCell;
uniform int uCols;
uniform int uRows;
uniform vec2 uCenter;
uniform float uR0;
uniform float uRingW;
uniform int uRings;
uniform int uPerRing;
uniform float uTime;
uniform vec3 uPal[8];
uniform int uHover;
uniform vec4 uShock[24];
uniform int uShockN;
out vec4 outColor;

const float TAU = 6.28318530718;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = p / uRes;
  float stage = 1.0 - length((uv - vec2(0.5, 0.42)) * vec2(1.0, 1.25)) * 1.15;
  vec3 col = mix(vec3(0.008, 0.009, 0.016), vec3(0.030, 0.034, 0.060), clamp(stage, 0.0, 1.0));

  int addr = -1;
  vec2 lp = vec2(0.0);
  float cellPx = uCell;
  if (uLayout == 0) {
    vec2 q = (p - uOrigin) / uCell;
    if (q.x >= 0.0 && q.y >= 0.0 && q.x < float(uCols) && q.y < float(uRows)) {
      ivec2 c = ivec2(floor(q));
      addr = c.y * uCols + c.x;
      lp = fract(q) * 2.0 - 1.0;
    }
  } else {
    vec2 d = p - uCenter;
    float r = length(d);
    float rf = (r - uR0) / uRingW;
    if (rf >= 0.0 && rf < float(uRings)) {
      float ang = atan(d.x, -d.y);
      if (ang < 0.0) ang += TAU;
      float t = ang / TAU * float(uPerRing);
      addr = int(floor(rf)) * uPerRing + int(floor(t));
      lp = vec2(fract(t), fract(rf)) * 2.0 - 1.0;
      cellPx = uRingW;
    }
  }

  if (addr >= 0 && addr < uN) {
    ivec2 tc = ivec2(addr % uTexW, addr / uTexW);
    vec4 A = texelFetch(uA, tc, 0);
    vec4 B = texelFetch(uB, tc, 0);
    int owner = int(A.r * 255.0 + 0.5) - 1;
    int opc = int(A.g * 255.0 + 0.5) >> 3;
    float wh = A.b;
    float eh = A.a;
    float rh = B.r;
    int execBy = int(B.g * 255.0 + 0.5) - 1;
    int proc = int(B.b * 255.0 + 0.5);
    float aa = 2.2 / max(cellPx, 1.0);
    float sd = sdRoundBox(lp, vec2(0.80), 0.38);
    float fill = 1.0 - smoothstep(-aa, aa, sd);
    float rim = 1.0 - smoothstep(0.0, aa * 1.6, abs(sd + 0.10) - 0.07);

    if (owner < 0) {
      float dotm = 1.0 - smoothstep(0.16 - aa, 0.16 + aa, length(lp));
      col += vec3(0.07, 0.08, 0.12) * dotm;
    } else {
      vec3 wc = uPal[owner];
      if (opc == 12) {
        col = mix(col, wc * 0.16, fill);
        col += wc * 0.30 * rim;
      } else {
        col = mix(col, wc * 0.55, fill);
        col += wc * 0.25 * rim;
        if (opc == 11) col += wc * 0.6 * (1.0 - smoothstep(0.22 - aa, 0.22 + aa, length(lp)));
      }
      col += wc * wh * 1.25 * fill + vec3(1.0) * pow(wh, 5.0) * 0.6 * fill;
    }
    col += vec3(0.35, 0.65, 1.0) * rh * 0.45 * (1.0 - smoothstep(0.0, aa * 2.0, abs(sd)));
    if (execBy >= 0) {
      vec3 ec = mix(uPal[execBy], vec3(1.0), 0.45);
      float core = 1.0 - smoothstep(0.0, 0.85, length(lp));
      col += ec * eh * (0.25 * fill + core) * 1.3;
    }
    if (proc > 0) {
      vec3 pc = uPal[(proc & 127) - 1];
      float pulse = 0.7 + 0.3 * sin(uTime * 6.0 + float(addr) * 0.37);
      float d = length(lp);
      col += pc * (1.0 - smoothstep(0.25, 0.62, d)) * 1.4 * pulse;
      col += vec3(1.0) * (1.0 - smoothstep(0.0, 0.32, d)) * 0.9;
      if ((proc & 128) != 0) col += vec3(1.0) * (1.0 - smoothstep(0.0, aa * 2.5, abs(sd + 0.02)));
    }
    if (addr == uHover) col += vec3(0.95) * (1.0 - smoothstep(0.0, aa * 2.0, abs(sd)));
  }

  for (int i = 0; i < 24; i++) {
    if (i >= uShockN) break;
    vec4 s = uShock[i];
    bool big = s.w >= 8.0;
    float age = s.z;
    float rad = (0.01 + age) * min(uRes.x, uRes.y) * (big ? 0.75 : 0.06);
    float w = (big ? 4.0 + age * 30.0 : 1.5 + age * 4.0) * uDpr;
    float dist = length(p - s.xy);
    float ring = exp(-pow((dist - rad) / w, 2.0)) * (1.0 - age) * (1.0 - age);
    col += uPal[int(mod(s.w, 8.0))] * ring * (big ? 1.8 : 0.9);
  }
  outColor = vec4(col, 1.0);
}`;

const BRIGHT = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(0.35, 1.0, l);
  outColor = vec4(c * k, 1.0);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float uBloom;
uniform float uTime;
uniform vec2 uRes;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  c += texture(uBloom1, vUv).rgb * 0.9 * uBloom;
  c += texture(uBloom2, vUv).rgb * 1.2 * uBloom;
  c = 1.0 - exp(-c * 1.35);
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.55;
  c += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.012;
  outColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function program(gl, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link failed: ${gl.getProgramInfoLog(p)}`);
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

export const TEX_W = 128;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    this.scene = program(gl, SCENE);
    this.bright = program(gl, BRIGHT);
    this.blur = program(gl, BLUR);
    this.composite = program(gl, COMPOSITE);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.texA = this.dataTexture();
    this.texB = this.dataTexture();
    this.targets = null;
    this.bloom = 1;
  }

  dataTexture() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  target(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    const h2 = [Math.max(1, w >> 1), Math.max(1, h >> 1)];
    const h4 = [Math.max(1, w >> 2), Math.max(1, h >> 2)];
    this.targets = {
      scene: this.target(w, h),
      a2: this.target(...h2),
      b2: this.target(...h2),
      a4: this.target(...h4),
      b4: this.target(...h4),
    };
  }

  upload(dataA, dataB, coreSize) {
    const gl = this.gl;
    const rows = Math.ceil(coreSize / TEX_W);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_W, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataA);
    gl.bindTexture(gl.TEXTURE_2D, this.texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_W, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataB);
  }

  pass(prog, target, textures, set) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    Object.entries(textures).forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.u[name], i);
    });
    if (set) set(prog.u);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // L: layout in device pixels. palette: array of [r,g,b] 0..1.
  // shocks: [{x, y, age (0..1), warrior, big}] in device pixels.
  render(L, { time, palette, hover, shocks, dpr }) {
    const gl = this.gl;
    const T = this.targets;
    const pal = new Float32Array(24);
    palette.slice(0, 8).forEach((c, i) => pal.set(c, i * 3));
    const sh = new Float32Array(24 * 4);
    const n = Math.min(24, shocks.length);
    for (let i = 0; i < n; i++) {
      const s = shocks[shocks.length - n + i];
      sh.set([s.x, s.y, s.age, s.warrior + (s.big ? 8 : 0)], i * 4);
    }
    this.pass(this.scene, T.scene, { uA: this.texA, uB: this.texB }, (u) => {
      gl.uniform1i(u.uTexW, TEX_W);
      gl.uniform1i(u.uN, L.coreSize);
      gl.uniform1i(u.uLayout, L.kind === LAYOUT_RING ? 1 : 0);
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform2f(u.uOrigin, L.ox || 0, L.oy || 0);
      gl.uniform1f(u.uCell, L.cell);
      gl.uniform1i(u.uCols, L.cols || 0);
      gl.uniform1i(u.uRows, L.rows || 0);
      gl.uniform2f(u.uCenter, L.cx || 0, L.cy || 0);
      gl.uniform1f(u.uR0, L.r0 || 0);
      gl.uniform1f(u.uRingW, L.ringW || 1);
      gl.uniform1i(u.uRings, L.rings || 0);
      gl.uniform1i(u.uPerRing, L.perRing || 1);
      gl.uniform1f(u.uTime, time);
      gl.uniform3fv(u.uPal, pal);
      gl.uniform1i(u.uHover, hover);
      gl.uniform4fv(u.uShock, sh);
      gl.uniform1i(u.uShockN, n);
    });
    this.pass(this.bright, T.a2, { uTex: T.scene.tex });
    this.pass(this.blur, T.b2, { uTex: T.a2.tex }, (u) => gl.uniform2f(u.uDir, 1 / T.a2.w, 0));
    this.pass(this.blur, T.a2, { uTex: T.b2.tex }, (u) => gl.uniform2f(u.uDir, 0, 1 / T.a2.h));
    this.pass(this.blur, T.a4, { uTex: T.a2.tex }, (u) => gl.uniform2f(u.uDir, 1.5 / T.a4.w, 0));
    this.pass(this.blur, T.b4, { uTex: T.a4.tex }, (u) => gl.uniform2f(u.uDir, 0, 1.5 / T.a4.h));
    this.pass(this.composite, null, { uScene: T.scene.tex, uBloom1: T.a2.tex, uBloom2: T.b4.tex }, (u) => {
      gl.uniform1f(u.uBloom, this.bloom);
      gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    });
  }
}
