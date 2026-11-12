const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/simulator/physics.js');
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

test('presets retain solar altitudes from the original model at 30°N', () => {
  const golden = {
    mercury: [60.022641286961175, 59.97735871303837],
    venus: [62.53765834233274, 57.46233374772865],
    earth: [37.18412107600238, 82.7348543780035],
    mars: [36.24083159456107, 83.52111131344314],
    jupiter: [62.653995192154554, 57.345959820003415],
    saturn: [33.61562757615955, 86.25777971783488],
    uranus: [62.86090185917175, 56.93438407995433],
    neptune: [59.525409747572, 60.474157257979755],
  };
  for (const preset of P.presets) {
    close(P.position({...preset, lat: 30}, 0).alt, golden[preset.id][0]);
    close(P.position({...preset, lat: 30}, 0.5).alt, golden[preset.id][1]);
  }
});

test('circular, untilted orbit produces a stationary noon Sun', () => {
  for (const lat of [-89, -30, 0, 30, 89]) {
    const points = P.curve({eps: 0, ecc: 0, peri: 0, lat});
    points.forEach(point => { close(point.alt, 90 - Math.abs(lat)); close(point.eot, 0); });
    close(P.statistics(points).alt, 0);
  }
});

test('the entire control domain stays finite, including retrograde and polar cases', () => {
  for (const eps of [0, 23.44, 90, 97.77, 177.36, 180]) {
    for (const ecc of [0, 0.0167, 0.9]) {
      for (const lat of [-89, 0, 89]) {
        P.curve({eps, ecc, peri: 283, lat}, lat, 240).forEach(point => {
          assert.ok(Object.values(point).every(Number.isFinite));
          assert.ok(point.alt >= -90 && point.alt <= 90);
          assert.ok(point.az >= 0 && point.az <= 360);
          assert.ok(point.distance > 0);
        });
      }
    }
  }
});

test('time wraps continuously and orbital distance obeys Kepler geometry', () => {
  for (const preset of P.presets) {
    const params = {...preset, lat: 30};
    const first = P.position(params, 0), last = P.position(params, 1);
    close(first.alt, last.alt); close(first.az, last.az); close(first.eot, last.eot);
    close(first.distance, 1-preset.ecc); close(P.position(params, 0.5).distance, 1+preset.ecc);
    for (const phase of [0.1, 0.3, 0.7, 0.9]) {
      const point = P.position(params, phase);
      close(point.E-preset.ecc*Math.sin(point.E), phase*P.TAU);
      close(Math.hypot(point.orbitX, point.orbitY), point.distance);
    }
  }
});

test('retrograde zero-tilt equivalent keeps the mean solar direction reversed', () => {
  P.curve({eps: 180, ecc: 0, peri: 74, lat: 30}).forEach(point => close(point.eot, 0));
});

test('azimuth unwrap and latitude labels preserve coordinate meaning', () => {
  assert.deepEqual(P.unwrap([358,359,0,1,2]),[358,359,360,361,362]);
  assert.deepEqual(P.unwrap([2,1,0,359,358]),[2,1,0,-1,-2]);
  assert.equal(P.latitudeLabel(89),'89°N');
  assert.equal(P.latitudeLabel(-30),'30°S');
  assert.equal(P.latitudeLabel(0),'0°');
});
