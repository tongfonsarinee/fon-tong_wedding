// Sound: a music box playing Pachelbel's Canon in D (public domain, synthesized live — no file)
// or the file in ECARD_CONFIG.music, synthesized sound effects, haptics, and the floating vinyl toggle.
// Browsers only allow sound after a tap, so intro.js calls EcardAudio.start() from the wax-seal tap.
(function () {
  'use strict';

  var MUSIC_VOLUME = 0.17;
  var FILE_VOLUME = 0.55;
  var SFX_VOLUME = 0.45;
  var REVERB_MIX = 0.3;
  var CHORD_SECONDS = 1.25;      // one chord of the Canon's ground bass
  var LOOKAHEAD_SECONDS = 0.6;   // how far ahead notes are scheduled
  var SCHEDULER_MS = 150;
  var MUTE_KEY = 'ecard-muted';

  // Canon in D: D A Bm F#m G D G A (MIDI note numbers)
  var CHORDS = [[74, 78, 81, 86], [69, 73, 76, 81], [71, 74, 78, 83], [66, 69, 73, 78],
                [67, 71, 74, 79], [62, 66, 69, 74], [67, 71, 74, 79], [69, 73, 76, 81]];
  var BASS = [62, 57, 59, 54, 55, 50, 55, 57];
  var MELODY_A = [90, 88, 86, 85, 83, 81, 83, 85]; // F# E D C# B A B C#
  var MELODY_B = [86, 85, 83, 81, 79, 78, 79, 76]; // D C# B A G F# G E
  var SPARKLE = [0, 2, 1, 3, 2, 3, 1, 2];

  var config = window.ECARD_CONFIG || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var button = document.getElementById('music');

  var ctx = null;
  var musicBus, sfxBus, reverbSend, noiseBuffer;
  var fileAudio = null;
  var started = false;
  var schedulerTimer = null;
  var nextChordTime = 0;
  var chordIndex = 0;
  var muted = readMuted();

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }
  function saveMuted() {
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function midiToHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* ----- Audio graph ----- */
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buffer = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function gainNode(value, destination) {
    var g = ctx.createGain();
    g.gain.value = value;
    if (destination) g.connect(destination);
    return g;
  }

  function ensureContext() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    var compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    var master = gainNode(1, compressor);
    var reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(2.6, 2.4);
    reverb.connect(gainNode(1, master));
    reverbSend = gainNode(REVERB_MIX, reverb);
    musicBus = gainNode(MUSIC_VOLUME, master);
    sfxBus = gainNode(SFX_VOLUME, master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var noise = noiseBuffer.getChannelData(0);
    for (var i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /* ----- Music box ----- */
  // one tine: a sine with a faint metallic partial, sharp attack, long ring
  function tine(midi, time, velocity) {
    var freq = midiToHz(midi);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(velocity, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
    env.connect(musicBus);
    env.connect(reverbSend);
    var body = ctx.createOscillator();
    body.frequency.value = freq;
    body.connect(env);
    var shimmer = ctx.createOscillator();
    shimmer.frequency.value = freq * 4.02;
    shimmer.connect(gainNode(0.07, env));
    body.start(time); shimmer.start(time);
    body.stop(time + 2); shimmer.stop(time + 2);
  }

  // 4 variations of 8 chords: arpeggio → + melody A → + melody B → sparkling arpeggio
  function playChord(step, time) {
    var variation = Math.floor(step / CHORDS.length) % 4;
    var i = step % CHORDS.length;
    var chord = CHORDS[i];
    tine(BASS[i], time, 0.32);
    if (variation === 3) {
      SPARKLE.forEach(function (n, k) { tine(chord[n] + 12, time + k * CHORD_SECONDS / 8, 0.16); });
      return;
    }
    chord.forEach(function (n, k) { tine(n, time + k * CHORD_SECONDS / 4, 0.2); });
    if (variation === 1) tine(MELODY_A[i], time, 0.34);
    if (variation === 2) tine(MELODY_B[i], time, 0.34);
  }

  function scheduler() {
    while (nextChordTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      playChord(chordIndex, nextChordTime);
      nextChordTime += CHORD_SECONDS;
      chordIndex += 1;
    }
  }

  function startMusicBox() {
    if (schedulerTimer) return;
    nextChordTime = ctx.currentTime + 0.15;
    scheduler();
    schedulerTimer = setInterval(scheduler, SCHEDULER_MS);
  }

  function startMusic() {
    if (config.music) {
      if (!fileAudio) {
        fileAudio = new Audio(config.music);
        fileAudio.loop = true;
        fileAudio.volume = FILE_VOLUME;
        fileAudio.addEventListener('error', function () { fileAudio = null; config.music = ''; startMusicBox(); });
      }
      var playing = fileAudio.play();
      if (playing && playing.catch) playing.catch(function () { /* blocked: the toggle can retry */ });
      return;
    }
    startMusicBox();
  }

  /* ----- Sound effects ----- */
  function noise(time, seconds, filterType, freq, q, level) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(level, time + Math.min(0.02, seconds / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    src.connect(filter); filter.connect(env); env.connect(sfxBus);
    src.start(time, Math.random()); src.stop(time + seconds + 0.05);
    return filter;
  }

  function sweep(time, seconds, from, to, level) {
    var filter = noise(time, seconds, 'bandpass', from, 1.2, level);
    filter.frequency.setValueAtTime(from, time);
    filter.frequency.exponentialRampToValueAtTime(to, time + seconds);
  }

  function tone(time, from, to, seconds, level, type) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + seconds);
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(level, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    osc.connect(env); env.connect(sfxBus);
    osc.start(time); osc.stop(time + seconds + 0.05);
  }

  // inharmonic partials = small bell
  function bell(freq, time, level) {
    [[1, 1, 2.2], [2.76, 0.4, 1.4], [5.4, 0.2, 0.8]].forEach(function (p) {
      var osc = ctx.createOscillator();
      osc.frequency.value = freq * p[0];
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(level * p[1], time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + p[2]);
      osc.connect(env); env.connect(sfxBus); env.connect(reverbSend);
      osc.start(time); osc.stop(time + p[2] + 0.05);
    });
  }

  var EFFECTS = {
    crack: function (t) { noise(t, 0.16, 'bandpass', 1900, 0.8, 0.9); tone(t, 150, 55, 0.2, 0.7); },
    rustle: function (t) { noise(t, 0.5, 'lowpass', 2600, 0.5, 0.3); noise(t + 0.18, 0.4, 'bandpass', 3800, 0.6, 0.18); },
    chime: function (t) { bell(1318.5, t, 0.4); bell(1975.5, t + 0.12, 0.3); bell(2637, t + 0.24, 0.24); },
    sparkle: function (t) { [2093, 2637, 3136, 4186].forEach(function (f, i) { bell(f, t + i * 0.07, 0.16); }); },
    swish: function (t) { sweep(t, 0.3, 600, 3200, 0.5); },
    whoosh: function (t) { sweep(t, 1.1, 260, 1400, 0.45); bell(1760, t + 0.4, 0.2); },
    shutter: function (t) { noise(t, 0.035, 'highpass', 2200, 0.7, 0.9); noise(t + 0.07, 0.05, 'highpass', 1500, 0.7, 0.6); },
    pop: function (t) { tone(t, 680, 1250, 0.1, 0.35); },
    beep: function (t) { tone(t, 1046, 1046, 0.12, 0.25, 'triangle'); }
  };

  function sfx(name) {
    if (!ctx || muted || ctx.state !== 'running' || !EFFECTS[name]) return;
    EFFECTS[name](ctx.currentTime + 0.01);
  }

  function buzz(pattern) {
    if (reduceMotion || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  }

  /* ----- Mute toggle (vinyl button) ----- */
  function render() {
    if (!button) return;
    button.hidden = false;
    button.classList.toggle('is-playing', !muted);
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? 'เปิดเพลง' : 'ปิดเพลง');
  }

  function setMuted(next) {
    muted = next;
    saveMuted();
    if (ctx) {
      if (muted) ctx.suspend(); else ctx.resume();
    }
    if (fileAudio) {
      if (muted) fileAudio.pause(); else fileAudio.play().catch(function () {});
    }
    if (!muted && started) startMusic();
    render();
  }

  // must run inside a tap handler
  function start() {
    if (started) return;
    started = true;
    if (!ensureContext()) { render(); return; }
    if (muted) {
      ctx.suspend();
    } else {
      ctx.resume();
      startMusic();
    }
    render();
  }

  if (button) {
    button.addEventListener('click', function () {
      if (!started) { muted = false; start(); return; }
      setMuted(!muted);
    });
  }

  // pause everything while the guest is in another app/tab
  document.addEventListener('visibilitychange', function () {
    if (!ctx || muted) return;
    if (document.hidden) {
      ctx.suspend();
      if (fileAudio) fileAudio.pause();
    } else {
      ctx.resume();
      if (fileAudio) fileAudio.play().catch(function () {});
    }
  });

  window.EcardAudio = { start: start, sfx: sfx, buzz: buzz };
})();
