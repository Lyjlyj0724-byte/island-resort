import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceHour,
  DAY_CYCLE_SECONDS,
  resortAtmosphere,
  resortClock,
  sampleAtmosphere,
  stepResortAtmosphere,
  wrapHour,
} from '../src/resort/dayCycle';

test('The miniature day is cyclic, finite, and continuous through midnight and every palette boundary', () => {
  for (let h = -24; h <= 48; h += 0.125) {
    const a = sampleAtmosphere(h);
    for (const key of ['night', 'lamps', 'dusk', 'stars'] as const) assert.ok(a[key] >= 0 && a[key] <= 1);
    assert.ok(Math.abs(a.sunDirection.length() - 1) < 1e-10);
    assert.ok(a.sunIntensity > 0);
    assert.ok(Number.isFinite(a.waterMid.r));
  }
  for (const h of [0, 4.8, 6.1, 7.8, 11.5, 14, 16.6, 18.15, 19.1, 20.3, 24]) {
    const a = sampleAtmosphere(h - 0.0001),
      b = sampleAtmosphere(h + 0.0001);
    assert.ok(Math.abs(a.lamps - b.lamps) < 0.001);
    assert.ok(Math.abs(a.zenith.r - b.zenith.r) < 0.001);
    assert.ok(a.sunDirection.distanceTo(b.sunDirection) < 0.001);
  }
  assert.equal(wrapHour(NaN), 14);
});

test('Day, sunset and night differ in light direction, warm windows and water brightness', () => {
  const day = sampleAtmosphere(14),
    sunset = sampleAtmosphere(18.15),
    night = sampleAtmosphere(22);
  assert.equal(day.lamps, 0);
  assert.ok(sunset.lamps > 0.3 && sunset.lamps < 0.8);
  assert.equal(night.lamps, 1);
  assert.ok(sunset.sunDirection.y < day.sunDirection.y * 0.3);
  assert.ok(night.sunIntensity < day.sunIntensity * 0.3);
  assert.ok(night.hemiIntensity > 0.5);
  assert.ok(night.waterMid.g < day.waterMid.g * 0.25);
  assert.ok(night.stars > 0.9);
});

test('Automatic time pauses and resumes without a hidden-tab time jump', () => {
  let hour = 14;
  for (let i = 0; i < DAY_CYCLE_SECONDS * 10; i++) hour = advanceHour(hour, 0.1, true);
  assert.ok(Math.abs(hour - 14) < 1e-7);
  assert.equal(advanceHour(17, 7200, false), 17);
  assert.ok(advanceHour(17, 7200, true) - 17 < 0.006);
});

test('Manual night eases into view, then automatic mode continues from that hour', () => {
  resortClock.hour = 14;
  const before = resortAtmosphere.night;
  stepResortAtmosphere('night', 1 / 60, false);
  assert.ok(resortAtmosphere.night > before && resortAtmosphere.night < 0.1);
  for (let i = 0; i < 600; i++) stepResortAtmosphere('night', 1 / 60, false);
  assert.ok(resortAtmosphere.night > 0.999);
  stepResortAtmosphere('auto', 0.1, true);
  assert.ok(resortClock.hour > 22 && resortClock.hour < 22.01);
  const frozen = resortClock.hour;
  stepResortAtmosphere('auto', 0.1, true, true);
  assert.equal(resortClock.hour, frozen);
});
