'use strict';

// Compatible with the existing castaway-isle local-storage namespace.
function createBeachAudio(store, settings) {
  const volumes = {music: .6, ambient: .55, effects: .65};
  const groups = {
    music: ['day', 'night', 'hut', 'jungle-day', 'jungle-night'],
    ambient: ['waves', 'fire', 'cricket'],
    effects: ['sand', 'grass', 'wet', 'wake', 'chop', 'vine', 'pickup', 'pickup-hard', 'cast', 'bite'],
  };
  const sounds = {};
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) sounds[name] = {group};
  }
  const tracks = {day: 0, night: 0, hut: 0, waves: 0, fire: 0, 'jungle-day': 0, 'jungle-night': 0};
  const steps = {
    sand: {level: .16, clips: 3},
    grass: {level: .13, clips: 3},
    wet: {level: .10, clips: 3},
  };
  const sliderGain = value => value ** 2;
  let ctx, buses, assets, nextCricket = 0;

  for (const input of settings.querySelectorAll('[data-sound]')) {
    const key = input.dataset.sound;
    const saved = store.get('audio-' + key);
    if (saved !== null && /^\d{1,3}$/.test(saved)) volumes[key] = Math.min(100, Number(saved)) / 100;
    input.value = Math.round(volumes[key] * 100);
    const output = input.nextElementSibling;
    const label = () => { output.value = input.value + '%'; };
    label();
    input.addEventListener('input', () => {
      volumes[key] = Number(input.value) / 100;
      store.set('audio-' + key, input.value);
      if (ctx) buses[key].gain.setTargetAtTime(sliderGain(volumes[key]), ctx.currentTime, .08);
      label();
    });
  }

  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!ctx) {
        ctx = new Audio();
        assets = fetch('./audio/files.json')
          .then(response => response.ok ? response.json() : {})
          .catch(() => ({}));
        buses = Object.fromEntries(Object.keys(groups).map(key => {
          const bus = ctx.createGain();
          bus.gain.value = sliderGain(volumes[key]);
          bus.connect(ctx.destination);
          return [key, bus];
        }));
      }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    } catch {
      // Play remains available if sound is unavailable on this device.
    }
  }

  const buffers = new Map();
  function load(name) {
    if (!buffers.has(name)) {
      buffers.set(name, assets
        .then(files => {
          const file = name==='hut'?'hut.mp3':files?.[name];
          if (typeof file !== 'string' || !/^[a-z0-9-]+\.(ogg|mp3|m4a|wav)$/.test(file)) return null;
          return fetch('./audio/' + file).then(response => response.ok ? response.arrayBuffer() : null);
        })
        .then(bytes => bytes ? ctx.decodeAudioData(bytes) : null)
        .catch(() => null));
    }
    return buffers.get(name);
  }

  function oneShot(name, level, file = name) {
    if (!ctx || ctx.state !== 'running' || document.hidden) return;
    const group = sounds[name].group;
    if (volumes[group] === 0) return;
    const requestedAt = performance.now();
    load(file).then(buffer => {
      if (!buffer || document.hidden || ctx.state !== 'running' || performance.now() - requestedAt > 180) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = level;
      source.connect(gain).connect(buses[group]);
      source.start();
    });
  }

  let previousStep = -1;
  function step(zone) {
    const name = zone === 0 || zone === 7 ? 'grass' : zone === 1 ? 'sand' : 'wet';
    const {level, clips} = steps[name];
    const pick = (previousStep + 1 + Math.floor(Math.random() * (clips - 1))) % clips;
    previousStep = pick;
    oneShot(name, level, name + '-' + (pick + 1));
  }

  const loopStates = {};
  function mix(name, level) {
    const state = loopStates[name] ??= {level: 0};
    state.level = level;
    if (state.gain && state.applied !== level) {
      state.applied = level;
      state.gain.gain.setTargetAtTime(level, ctx.currentTime, .42);
      return;
    }
    if (!level || state.loading) return;
    state.loading = true;
    load(name).then(buffer => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(state.level, ctx.currentTime, .42);
      source.connect(gain).connect(buses[sounds[name].group]);
      source.start();
      state.applied = state.level;
      state.gain = gain;
    });
  }

  let warmed = false;
  function scene(active, night, zone, fire, indoors, menuOpen, jungle = false) {
    if (!ctx) return;
    if (active && ctx.state === 'running') {
      if (!warmed) {
        warmed = true;
        load('cricket');
        nextCricket = ctx.currentTime + 18;
        for (const key of ['wake', 'chop', 'vine', 'pickup', 'pickup-hard', 'cast', 'bite']) load(key);
        for (const [key, {clips}] of Object.entries(steps)) {
          for (let i = 1; i <= clips; i++) load(key + '-' + i);
        }
      }
      const scale = menuOpen ? .65 : indoors ? .48 : 1;
      tracks.day = night || indoors || jungle ? 0 : .56 * scale;
      tracks.night = night && !indoors && !jungle ? .46 * scale : 0;
      tracks['jungle-day'] = jungle && !night && !indoors ? .5 * scale : 0;
      tracks['jungle-night'] = jungle && night && !indoors ? .44 * scale : 0;
      tracks.hut = indoors ? (menuOpen ? .29 : .44) : 0;
      tracks.waves = jungle ? 0 : (night ? .27 : .48) * (zone === 0 ? .55 : 1) * scale;
      tracks.fire = Math.max(0, fire) * .42 * scale;
      if (night && (zone === 0 || jungle) && !indoors && !menuOpen && ctx.currentTime >= nextCricket) {
        nextCricket = ctx.currentTime + 22 + Math.random() * 24;
        oneShot('cricket', .21);
      }
    } else {
      for (const key of Object.keys(tracks)) tracks[key] = 0;
      nextCricket = ctx.currentTime + 15;
    }
    for (const [name, level] of Object.entries(tracks)) mix(name, level);
  }

  const effectLevels = {wake: .38, chop: .64, vine: .47, pickup: .28, 'pickup-hard': .27, cast: .43, bite: .58};
  return {unlock, scene, step, effect: name => oneShot(name, effectLevels[name])};
}
