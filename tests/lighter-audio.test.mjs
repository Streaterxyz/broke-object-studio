import test from 'node:test';
import assert from 'node:assert/strict';
import { createCueTracker, LighterAudio } from '../assets/lighter-audio.js';

const pose = (open, jet = 0, soft = 0, ready = true) => ({ open, jet, soft, ready });

test('forward cycle: opening, ignition, steady burn, soft transition, closing', () => {
  const tick = createCueTracker();
  assert.deepEqual(tick(pose(0)), []);
  assert.deepEqual(tick(pose(.91)), ['open']);
  assert.deepEqual(tick(pose(1, .1)), ['ignite']);
  for (let i = 0; i < 100; i++) assert.deepEqual(tick(pose(1, 1)), []);
  assert.deepEqual(tick(pose(1, .5, .5)), []);
  assert.deepEqual(tick(pose(.3, 0, .3)), []);
  assert.deepEqual(tick(pose(.03)), ['close']);
  assert.deepEqual(tick(pose(0)), []);
});

test('scroll jitter does not replay clicks; a real reverse cycle rearms them', () => {
  const tick = createCueTracker();
  tick(pose(0)); tick(pose(1)); tick(pose(1, 1));
  for (const x of [.05, .07, .04, .08]) assert.deepEqual(tick(pose(.92, x)), []);
  assert.deepEqual(tick(pose(0)), ['close']);
  assert.deepEqual(tick(pose(.93)), ['open']);
  assert.deepEqual(tick(pose(1, .1)), ['ignite']);
});

test('loading or restoring a mid-animation page never replays historical clicks', () => {
  const tick = createCueTracker();
  assert.deepEqual(tick(pose(1, 1, 0, false)), []);
  assert.deepEqual(tick(pose(1, 1)), []);
  assert.deepEqual(tick(pose(1, 1)), []);
  assert.deepEqual(tick(pose(0)), ['close']);
});

test('audio needs opt-in, loops while enabled, and stops on mute', async () => {
  const sources = [];
  class Context {
    currentTime = 0; state = 'running'; destination = {};
    async resume() {}
    async decodeAudioData() { return {}; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
    createBufferSource() {
      const s = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } };
      sources.push(s); return s;
    }
  }
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  globalThis.window = { AudioContext: Context, addEventListener() {} };
  globalThis.document = { hidden: false, addEventListener() {} };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  try {
    const button = { addEventListener() {}, setAttribute() {}, textContent: '' };
    const audio = new LighterAudio(button);
    audio.update(pose(0)); audio.update(pose(1, 1));
    assert.equal(sources.length, 0);
    await audio.toggle();
    audio.update(pose(1, 1));
    assert.equal(sources.length, 1, 'enabling midway starts only the burn bed');
    assert.equal(sources[0].loop, true);
    audio.update(pose(0));
    assert.equal(sources.length, 2, 'closing plays one shot');
    audio.mute();
    assert.ok(sources.every(s => s.stopped));
    assert.equal(button.textContent, 'Sound off');
  } finally {
    Object.assign(globalThis, previous);
  }
});
