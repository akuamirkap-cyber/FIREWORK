/* Procedural WebAudio sound effects - no assets needed. */

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const LEVEL = 1.0; // master volume

class AudioFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private verb: GainNode | null = null; // reverb send bus (the rolling "gelegar" echo)
  private satCurve: Float32Array<ArrayBuffer> | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private hissVoices = 0;
  muted = false;

  /** must be called from a user gesture */
  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.002;
    comp.release.value = 0.22;

    // final soft limiter: transparent below 0.6, rounds off peaks instead of hard-clipping them
    const lim = ctx.createWaveShaper();
    const lc = new Float32Array(2048);
    for (let i = 0; i < lc.length; i++) {
      const x = (i / (lc.length - 1)) * 2 - 1;
      const a = Math.abs(x);
      lc[i] = a < 0.6 ? x : Math.sign(x) * (0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4));
    }
    lim.curve = lc;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : LEVEL;
    this.master.connect(comp);
    comp.connect(lim);
    lim.connect(ctx.destination);

    // reverb: a long dark tail, like a blast bouncing between buildings
    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(ctx, 2.6);
    this.verb = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    this.verb.connect(conv);
    conv.connect(wet);
    wet.connect(this.master);

    // saturation curve: turns low thumps into something with harmonics a phone speaker can actually play
    const sc = new Float32Array(1024);
    const norm = Math.tanh(3);
    for (let i = 0; i < sc.length; i++) {
      const x = (i / (sc.length - 1)) * 2 - 1;
      sc[i] = Math.tanh(x * 3) / norm;
    }
    this.satCurve = sc;

    const len = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : LEVEL, this.ctx.currentTime, 0.02);
    }
  }

  private ok() {
    return !!(this.ctx && this.master && this.noise) && !this.muted;
  }

  private noiseSrc(t: number, dur: number) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise!;
    s.loop = true;
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.05);
    return s;
  }

  private voiceEnd(node: AudioScheduledSourceNode) {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  /** procedural impulse response: a long, dark, decaying tail (blast echoing between buildings) */
  private makeImpulse(ctx: AudioContext, seconds: number) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        // the tail gets darker as it fades: bright at first, muffled at the end
        const a = 0.9 - 0.84 * Math.pow(k, 0.45);
        y += a * ((Math.random() * 2 - 1) - y);
        // fast fade-in avoids a click, then a long exponential decay
        const fade = Math.min(1, i / (sr * 0.004));
        d[i] = y * Math.exp(-4.4 * k) * fade;
      }
    }
    return buf;
  }

  /** a fresh distortion stage (cheap: shares one curve) */
  private saturator() {
    const s = this.ctx!.createWaveShaper();
    s.curve = this.satCurve;
    s.oversample = "2x";
    return s;
  }

  /**
   * A big firecracker: sharp CRACK -> punchy mid "BANG" body -> chesty "BOOM" thump
   * -> rolling echoes that bounce away ("dor-or-or-orrr"). Nothing here depends on
   * sub-bass: the thump is pushed through a saturator so phone speakers can play it.
   * size = blast radius in voxels, power = 0..1.6
   */
  boom(size: number, power: number, lvl = 1) {
    if (!this.ok() || this.voices > 30) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = this.master!;
    const verb = this.verb!;
    const lv = Math.min(1, Math.max(0, (lvl - 1) / 9)); // 0 = level 1 .. 1 = level 10
    const big = Math.min(1, size / 12); // 0 = cabe rawit .. 1 = nuke
    // higher level = louder, deeper, longer, with more echoes and a festive tail of crackles
    const amp =
      Math.min(1, 0.62 + big * 0.38) * (0.7 + 0.3 * Math.min(1, power / 0.8)) * (0.9 + 0.2 * lv);
    const dur = 0.42 + size * 0.07 + power * 0.28 + lv * 0.35; // length of the body

    // route a node to the dry bus plus some reverb send
    const send = (node: AudioNode, amt: number) => {
      node.connect(out);
      if (amt > 0) {
        const s = ctx.createGain();
        s.gain.value = amt;
        node.connect(s);
        s.connect(verb);
      }
    };

    // 1) CRACK: the instant, razor-sharp "PAK!" of the powder going off
    const c = this.noiseSrc(t, 0.14);
    const chp = ctx.createBiquadFilter();
    chp.type = "highpass";
    chp.frequency.value = 650 - big * 300;
    const cpk = ctx.createBiquadFilter();
    cpk.type = "peaking";
    cpk.frequency.value = 2900;
    cpk.gain.value = 9;
    cpk.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(1.5 * amp + 0.2, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06 + big * 0.06);
    c.connect(chp).connect(cpk).connect(cg);
    send(cg, 0.4);

    // 2) BANG body: mid-range noise that opens bright and collapses downward, driven hard
    const n = this.noiseSrc(t, dur);
    this.voiceEnd(n);
    const nlp = ctx.createBiquadFilter();
    nlp.type = "lowpass";
    nlp.Q.value = 1.1;
    nlp.frequency.setValueAtTime(5400 - big * 1800, t);
    nlp.frequency.exponentialRampToValueAtTime(230, t + dur * 0.8);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(1.05 * amp + 0.15, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.4 * amp + 0.05, t + 0.11);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(nlp).connect(this.saturator()).connect(ng);
    send(ng, 0.55);

    // 3) BOOM: a chesty sweep (190 -> 55 Hz) plus an octave above it so it speaks on small speakers
    const f0 = 200 - big * 75 - lv * 30;
    const f1 = 56 - big * 12 - lv * 8;
    const sweep = 0.17 + big * 0.2 + lv * 0.1;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(f0 * 2, t);
    o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + sweep * 0.85);
    const o2g = ctx.createGain();
    o2g.gain.value = 0.5;
    const sat = this.saturator();
    o.connect(sat);
    o2.connect(o2g).connect(sat);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.95 * amp + 0.2, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.05);
    sat.connect(og);
    send(og, 0.3);
    o.start(t);
    o2.start(t);
    o.stop(t + dur * 1.05 + 0.05);
    o2.stop(t + dur * 1.05 + 0.05);
    this.voiceEnd(o);

    // 4) ROLLING ECHOES: slaps bouncing off walls, each later, darker and softer - this is the "menggelegar"
    const echoes = (size > 6 ? 5 : size > 2.5 ? 4 : 3) + Math.round(lv * 3);
    for (let i = 0; i < echoes; i++) {
      const st = t + 0.095 + i * 0.105 + i * i * 0.03 + Math.random() * 0.02;
      const e = this.noiseSrc(st, 0.6);
      const elp = ctx.createBiquadFilter();
      elp.type = "lowpass";
      elp.frequency.setValueAtTime((2300 * (1 - big * 0.3)) / (1 + i * 0.65), st);
      elp.frequency.exponentialRampToValueAtTime(150, st + 0.42);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.0001, st);
      eg.gain.linearRampToValueAtTime((0.62 - i * 0.1) * (0.6 + 0.4 * amp), st + 0.012);
      eg.gain.exponentialRampToValueAtTime(0.001, st + 0.3 + big * 0.28);
      e.connect(elp).connect(eg);
      send(eg, 0.55);
    }

    // 5) the ground shakes: a low rumble that trails behind big blasts
    if (size > 4.5 || lv > 0.45) {
      const rl = dur * 1.5 + 0.5;
      const r = this.noiseSrc(t, rl);
      const rlp = ctx.createBiquadFilter();
      rlp.type = "lowpass";
      rlp.frequency.value = 190;
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.0001, t);
      rg.gain.linearRampToValueAtTime(0.6 * big + 0.15, t + 0.04);
      rg.gain.exponentialRampToValueAtTime(0.001, t + rl);
      r.connect(this.saturator()).connect(rlp).connect(rg);
      send(rg, 0.6);
    }

    // festive tail: the higher the level, the more crackles and twinkles trail the blast
    const pops = Math.round(lv * 9);
    for (let i = 0; i < pops; i++) {
      this.crack(0.75 + Math.random() * 0.8, 0.16 + Math.random() * (0.5 + lv * 0.6));
    }
    if (lv > 0.3) this.sparkle(t + 0.22, 2 + Math.round(lv * 7));
  }

  /** sharp little "tar!" of a string cracker / tiny blast: a snap plus a short dry pop */
  crack(pitch = 1, delay = 0) {
    if (!this.ok() || this.voices > 34) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const n = this.noiseSrc(t, 0.1);
    this.voiceEnd(n);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1100 * pitch;
    const pk = ctx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 3300 * pitch;
    pk.gain.value = 9;
    pk.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(pk).connect(g);
    g.connect(this.master!);
    const s = ctx.createGain();
    s.gain.value = 0.2;
    g.connect(s);
    s.connect(this.verb!);

    // the little "pok" body under the snap
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(300 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.055);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.55, t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(this.saturator()).connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.09);
  }

  coin(combo: number) {
    if (!this.ok() || this.voices > 30) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const semi = PENTA[Math.min(PENTA.length - 1, combo)];
    const f = 523.25 * Math.pow(2, semi / 12);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t);
    o.frequency.setValueAtTime(f * 1.5, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.25);
    this.voiceEnd(o);
  }

  tick() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.08);
  }

  hiss(dur: number) {
    if (!this.ok() || this.hissVoices > 3) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, dur);
    this.hissVoices++;
    n.onended = () => {
      this.hissVoices--;
    };
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.linearRampToValueAtTime(3600, t + dur);
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.setValueAtTime(0.05, t + Math.max(0.05, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(this.master!);
  }

  /** burning fuse: a hiss that climbs in pitch & volume with random pops, ends right at the bang */
  sizzle(dur: number) {
    if (!this.ok() || this.hissVoices > 4) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, dur);
    this.hissVoices++;
    n.onended = () => {
      this.hissVoices--;
    };
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(8200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g.gain.linearRampToValueAtTime(0.12, t + Math.max(0.1, dur * 0.92));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
    n.connect(bp).connect(g).connect(this.master!);

    // crackly pops that get denser toward the end
    const pops = Math.min(14, Math.round(dur * 7));
    for (let i = 0; i < pops; i++) {
      const u = Math.pow(Math.random(), 0.7);
      const st = t + u * dur * 0.95;
      const p = this.noiseSrc(st, 0.03);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2400 + Math.random() * 2500;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.setValueAtTime(0.14 + u * 0.14, st);
      pg.gain.exponentialRampToValueAtTime(0.001, st + 0.025);
      p.connect(hp).connect(pg).connect(this.master!);
    }
  }

  /** soft thud when a thrown cracker lands / bounces */
  thump(v = 0.6) {
    if (!this.ok() || this.voices > 30) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1 + v * 0.22, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.14);
    this.voiceEnd(o);
    const n = this.noiseSrc(t, 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.08 + v * 0.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(lp).connect(ng).connect(this.master!);
  }

  /** quick air swish for a thrown cracker */
  swish() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.28);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    n.connect(bp).connect(g).connect(this.master!);
  }

  /**
   * Spinning top: a spooling jet-turbine whine (high & clean, NO low rumble),
   * a raspy spark-grinder, and metallic pings. Pitch keeps climbing so it
   * resolves into the final blast.
   */
  spin(dur: number) {
    if (!this.ok() || this.voices > 26) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const end = t + dur;
    const tail = Math.max(0.35, dur - 0.32);

    // 1) turbine whine: two slightly detuned triangles + a bright octave
    const mk = (type: OscillatorType, mul: number, detune: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueAtTime(420 * mul, t);
      o.frequency.exponentialRampToValueAtTime(1250 * mul, t + 0.75); // spool-up
      o.frequency.linearRampToValueAtTime(1650 * mul, t + tail);
      o.frequency.exponentialRampToValueAtTime(2700 * mul, end); // climb into the bang
      o.start(t);
      o.stop(end + 0.05);
      return o;
    };
    const w1 = mk("triangle", 1, -7);
    const w2 = mk("triangle", 1, 8);
    const w3 = mk("sine", 2, 0);
    this.voiceEnd(w1);
    const wl = ctx.createBiquadFilter();
    wl.type = "lowpass";
    wl.frequency.value = 6500;
    wl.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.linearRampToValueAtTime(0.085, t + 0.35);
    wg.gain.setValueAtTime(0.085, tail);
    wg.gain.linearRampToValueAtTime(0.11, end - 0.02);
    wg.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    // fast rotation shimmer (26 Hz on a ~1 kHz carrier = "wirrr", not a flutter)
    const trem = ctx.createOscillator();
    trem.frequency.value = 26;
    const tg = ctx.createGain();
    tg.gain.value = 0.022;
    trem.connect(tg).connect(wg.gain);
    trem.start(t);
    trem.stop(end + 0.05);
    const oct = ctx.createGain();
    oct.gain.value = 0.35;
    w1.connect(wl);
    w2.connect(wl);
    w3.connect(oct).connect(wl);
    wl.connect(wg).connect(this.master!);

    // 2) spark-grinder: bright noise chopped at ~34 Hz like a metal wheel on stone
    const n = this.noiseSrc(t, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2800, t);
    hp.frequency.linearRampToValueAtTime(5200, end);
    const bp = ctx.createBiquadFilter();
    bp.type = "peaking";
    bp.frequency.value = 6200;
    bp.gain.value = 7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.06, t + 0.3);
    ng.gain.setValueAtTime(0.06, tail);
    ng.gain.linearRampToValueAtTime(0.0001, end);
    const chop = ctx.createOscillator();
    chop.type = "square";
    chop.frequency.value = 34;
    const cg = ctx.createGain();
    cg.gain.value = 0.026;
    chop.connect(cg).connect(ng.gain);
    chop.start(t);
    chop.stop(end + 0.05);
    n.connect(hp).connect(bp).connect(ng).connect(this.master!);

    // 3) launch whoosh as it starts to move
    const wn = this.noiseSrc(t, 0.6);
    const wb = ctx.createBiquadFilter();
    wb.type = "bandpass";
    wb.Q.value = 1.2;
    wb.frequency.setValueAtTime(500, t);
    wb.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
    const wgn = ctx.createGain();
    wgn.gain.setValueAtTime(0.0001, t);
    wgn.gain.linearRampToValueAtTime(0.2, t + 0.22);
    wgn.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    wn.connect(wb).connect(wgn).connect(this.master!);

    // 4) tiny metallic pings & spark crackles scattered through the run
    const pings = Math.round(dur * 4);
    for (let i = 0; i < pings; i++) {
      const st = t + 0.25 + Math.random() * (dur - 0.45);
      const o = ctx.createOscillator();
      o.type = "sine";
      const f = 2600 + Math.random() * 2400;
      o.frequency.setValueAtTime(f, st);
      o.frequency.exponentialRampToValueAtTime(f * 0.86, st + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.03, st + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.11);
      o.connect(g).connect(this.master!);
      o.start(st);
      o.stop(st + 0.13);
    }
    const crackles = Math.round(dur * 12);
    for (let i = 0; i < crackles; i++) {
      const st = t + 0.2 + Math.random() * (dur - 0.3);
      const p = this.noiseSrc(st, 0.03);
      const ph = ctx.createBiquadFilter();
      ph.type = "highpass";
      ph.frequency.value = 3500 + Math.random() * 3000;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.setValueAtTime(0.12, st);
      pg.gain.exponentialRampToValueAtTime(0.001, st + 0.025);
      p.connect(ph).connect(pg).connect(this.master!);
    }
  }

  /** fountain: roaring spark spray with crackle */
  fountain(dur: number) {
    if (!this.ok() || this.hissVoices > 4) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, dur);
    this.hissVoices++;
    n.onended = () => {
      this.hissVoices--;
    };
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.linearRampToValueAtTime(5200, t + 0.5);
    bp.frequency.linearRampToValueAtTime(3600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.18);
    g.gain.setValueAtTime(0.16, t + Math.max(0.2, dur - 0.5));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    // flutter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const lg = ctx.createGain();
    lg.gain.value = 0.05;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    n.connect(bp).connect(g).connect(this.master!);
    // low whoomph at ignition
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.3, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.35);
    this.voiceEnd(o);
    // crackle
    const pops = Math.round(dur * 9);
    for (let i = 0; i < pops; i++) {
      const st = t + 0.1 + Math.random() * (dur - 0.2);
      const p = this.noiseSrc(st, 0.04);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800 + Math.random() * 2500;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.setValueAtTime(0.18, st);
      pg.gain.exponentialRampToValueAtTime(0.001, st + 0.035);
      p.connect(hp).connect(pg).connect(this.master!);
    }
  }

  /** twinkling bell-like pings (firework glitter) */
  sparkle(t0: number, n: number) {
    if (!this.ok() || !this.verb) return;
    const ctx = this.ctx!;
    for (let i = 0; i < n; i++) {
      const st = t0 + i * 0.07 + Math.random() * 0.12;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 880 * Math.pow(2, PENTA[5 + Math.floor(Math.random() * 10)] / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.04, st + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      o.connect(g);
      g.connect(this.master!);
      const s = ctx.createGain();
      s.gain.value = 0.6;
      g.connect(s);
      s.connect(this.verb);
      o.start(st);
      o.stop(st + 0.32);
    }
  }

  /** party-popper "POK!" + paper rustle + glitter (louder & longer at higher levels) */
  confetti(lvl = 1) {
    if (!this.ok() || this.voices > 30 || !this.verb) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const lv = Math.min(1, Math.max(0, (lvl - 1) / 9));
    // snap
    const sn = this.noiseSrc(t, 0.08);
    this.voiceEnd(sn);
    const shp = ctx.createBiquadFilter();
    shp.type = "highpass";
    shp.frequency.value = 1800;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.9, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    sn.connect(shp).connect(sg).connect(this.master!);
    // pop body
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.5, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(this.saturator()).connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.14);
    // paper rustle: fluttering high noise
    const dur = 1.0 + lv * 0.9;
    const rn = this.noiseSrc(t + 0.03, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 5600;
    bp.Q.value = 0.6;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.1 + lv * 0.05, t + 0.06);
    rg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const fl = ctx.createOscillator();
    fl.frequency.value = 16 + Math.random() * 5;
    const fg = ctx.createGain();
    fg.gain.value = 0.035;
    fl.connect(fg).connect(rg.gain);
    fl.start(t);
    fl.stop(t + dur + 0.05);
    rn.connect(bp).connect(rg);
    rg.connect(this.master!);
    const rs = ctx.createGain();
    rs.gain.value = 0.4;
    rg.connect(rs);
    rs.connect(this.verb);
    this.sparkle(t + 0.04, 5 + Math.round(lv * 7));
  }

  /** frog hop: a cartoonish rubbery "boing" */
  boing(pitch = 1) {
    if (!this.ok() || this.voices > 30) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(170 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(560 * pitch, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(240 * pitch, t + 0.24);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(lp).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.28);
    this.voiceEnd(o);
  }

  /** the frog's last croak before it goes BOOM */
  ribbit() {
    if (!this.ok() || this.voices > 30) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const st = t + k * 0.13;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(130 - k * 6, st);
      o.frequency.exponentialRampToValueAtTime(78, st + 0.1);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 480;
      bp.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.28, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.11);
      o.connect(bp).connect(g).connect(this.master!);
      o.start(st);
      o.stop(st + 0.13);
    }
  }

  /** lightning strike: razor crack, falling zip, crackle, then rolling thunder */
  zap(big = 0.5) {
    if (!this.ok() || this.voices > 30 || !this.verb) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // crack
    const n = this.noiseSrc(t, 0.3);
    this.voiceEnd(n);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    const pk = ctx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 4200;
    pk.gain.value = 8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(1.2, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(hp).connect(pk).connect(cg);
    cg.connect(this.master!);
    const cs = ctx.createGain();
    cs.gain.value = 0.35;
    cg.connect(cs);
    cs.connect(this.verb);
    // falling zip
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(5200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.22);
    const zh = ctx.createBiquadFilter();
    zh.type = "highpass";
    zh.frequency.value = 500;
    const zg = ctx.createGain();
    zg.gain.setValueAtTime(0.3, t);
    zg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(zh).connect(zg).connect(this.master!);
    o.start(t);
    o.stop(t + 0.26);
    // crackle
    for (let i = 0; i < 7; i++) {
      const st = t + 0.02 + Math.random() * 0.28;
      const p = this.noiseSrc(st, 0.03);
      const ph = ctx.createBiquadFilter();
      ph.type = "highpass";
      ph.frequency.value = 2500;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.setValueAtTime(0.35, st);
      pg.gain.exponentialRampToValueAtTime(0.001, st + 0.025);
      p.connect(ph).connect(pg).connect(this.master!);
    }
    // rolling thunder
    const rl = 0.9 + big * 1.4;
    const r = this.noiseSrc(t + 0.06, rl);
    const rlp = ctx.createBiquadFilter();
    rlp.type = "lowpass";
    rlp.frequency.setValueAtTime(360, t + 0.06);
    rlp.frequency.exponentialRampToValueAtTime(110, t + rl);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.3 + 0.5 * big, t + 0.1);
    rg.gain.exponentialRampToValueAtTime(0.001, t + rl);
    r.connect(this.saturator()).connect(rlp).connect(rg);
    rg.connect(this.master!);
    const rs = ctx.createGain();
    rs.gain.value = 0.7;
    rg.connect(rs);
    rs.connect(this.verb);
  }

  /** storm cracker charging: a rising electric whine + crackles */
  charge(dur: number) {
    if (!this.ok() || this.voices > 28) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 26;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    o.connect(lp).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.1);
    this.voiceEnd(o);
    const pops = Math.round(dur * 16);
    for (let i = 0; i < pops; i++) {
      const st = t + Math.random() * dur * 0.95;
      const p = this.noiseSrc(st, 0.03);
      const ph = ctx.createBiquadFilter();
      ph.type = "highpass";
      ph.frequency.value = 4500;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.setValueAtTime(0.1 + (st - t) * 0.1, st);
      pg.gain.exponentialRampToValueAtTime(0.001, st + 0.025);
      p.connect(ph).connect(pg).connect(this.master!);
    }
  }

  /** black hole: a deep swirling suction that climbs, then falls silent just before the blast */
  vortex(dur: number) {
    if (!this.ok() || this.voices > 28) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, dur);
    this.voiceEnd(n);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2.6;
    bp.frequency.setValueAtTime(160, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + dur * 0.92);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.4;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(bp.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.45);
    g.gain.linearRampToValueAtTime(0.55, t + Math.max(0.5, dur - 0.12));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(this.saturator()).connect(g).connect(this.master!);
    // the pitch of the "pull" keeps climbing
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(64, t);
    o.frequency.exponentialRampToValueAtTime(560, t + dur * 0.95);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.3, t + 0.6);
    og.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(this.saturator()).connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
    // eerie high shimmer
    const sh = ctx.createOscillator();
    sh.type = "triangle";
    sh.frequency.setValueAtTime(1200, t);
    sh.frequency.exponentialRampToValueAtTime(3600, t + dur);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.03, t + dur * 0.8);
    sg.gain.linearRampToValueAtTime(0.0001, t + dur);
    sh.connect(sg).connect(this.master!);
    sh.start(t);
    sh.stop(t + dur + 0.05);
  }

  whistle(dur: number) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(2200, t + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.06);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  fanfare() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const notes = [0, 4, 7, 12, 16, 19, 24];
    notes.forEach((s, i) => {
      const o = ctx.createOscillator();
      o.type = "square";
      const f = 440 * Math.pow(2, s / 12);
      o.frequency.value = f;
      const g = ctx.createGain();
      const st = t + i * 0.075;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.07, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      o.connect(g).connect(this.master!);
      o.start(st);
      o.stop(st + 0.32);
    });
  }

  buy() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    [0, 7, 12].forEach((s, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 660 * Math.pow(2, s / 12);
      const g = ctx.createGain();
      const st = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.16, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
      o.connect(g).connect(this.master!);
      o.start(st);
      o.stop(st + 0.2);
    });
  }

  whoosh() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.7);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(bp).connect(g).connect(this.master!);
  }
}

export const sfx = new AudioFX();
