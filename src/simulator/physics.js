/* Geometric solar-position model. Angles are degrees at the public boundary. */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const TAU = Math.PI * 2;
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  const presets = [
    { id: 'mercury', name: '수성', english: 'Mercury', eps: 0.03, ecc: 0.2056, peri: 49, color: '#a7a39a', description: '매우 작은 자전축 기울기와 큰 이심률. 적위 변화가 작아 태양의 연간 궤적이 가로로 길어집니다.' },
    { id: 'venus', name: '금성', english: 'Venus', eps: 177.36, ecc: 0.0068, peri: 74, color: '#d4b781', description: '역행 자전하는 행성. 177.36°의 기울기와 작은 이심률을 적용하면 작은 고리 모양의 궤적이 만들어집니다.' },
    { id: 'earth', name: '지구', english: 'Earth', eps: 23.44, ecc: 0.0167, peri: 283, color: '#6eabcb', description: '자전축 기울기와 타원 궤도의 효과가 겹치며, 두 고리의 크기가 다른 8자형 아날렘마가 나타납니다.' },
    { id: 'mars', name: '화성', english: 'Mars', eps: 25.19, ecc: 0.0934, peri: 251, color: '#cc8566', description: '지구와 비슷한 자전축 기울기, 더 큰 이심률. 한쪽 고리가 줄어든 눈물방울 모양의 궤적입니다.' },
    { id: 'jupiter', name: '목성', english: 'Jupiter', eps: 3.13, ecc: 0.0484, peri: 58, color: '#c7ad8b', description: '자전축 기울기가 작아 적위 변화가 작습니다. 타원 궤도의 영향이 상대적으로 크게 나타납니다.' },
    { id: 'saturn', name: '토성', english: 'Saturn', eps: 26.73, ecc: 0.0539, peri: 279, color: '#d5c498', description: '자전축 기울기와 이심률의 효과가 합쳐져, 한쪽 고리가 작아진 비대칭 궤적을 만듭니다.' },
    { id: 'uranus', name: '천왕성', english: 'Uranus', eps: 97.77, ecc: 0.0473, peri: 3, color: '#93c5c8', description: '자전축이 공전면에 가깝게 누워 있습니다. 태양 적위가 크게 변하며 관측 위도에 따라 궤적도 크게 달라집니다.' },
    { id: 'neptune', name: '해왕성', english: 'Neptune', eps: 28.32, ecc: 0.0086, peri: 359, color: '#6e88ce', description: '작은 이심률로 인해 자전축 기울기의 효과가 두드러지는, 비교적 대칭적인 8자형 궤적입니다.' },
  ];

  function keplerE(M, e) {
    let E = M;
    for (let i = 0; i < 60; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  // One sample at fixed local mean solar noon; phase is a fraction of an orbit.
  function position(params, phase, latitude = params.lat) {
    const eps = params.eps * RAD;
    const peri = params.peri * RAD;
    const phi = latitude * RAD;
    const M = TAU * (((phase % 1) + 1) % 1);
    const E = keplerE(M, params.ecc);
    const nu = 2 * Math.atan2(Math.sqrt(1 + params.ecc) * Math.sin(E / 2), Math.sqrt(1 - params.ecc) * Math.cos(E / 2));
    const lambda = nu + peri;
    const delta = Math.asin(clamp(Math.sin(eps) * Math.sin(lambda), -1, 1));
    const alpha = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    // Preserve the reverse mean-Sun direction for retrograde presets.
    const meanLon = (Math.cos(eps) >= 0 ? 1 : -1) * (M + peri);
    const eot = Math.atan2(Math.sin(meanLon - alpha), Math.cos(meanLon - alpha));
    const alt = Math.asin(clamp(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(eot), -1, 1));
    const cosAz = clamp((Math.sin(delta) - Math.sin(phi) * Math.sin(alt)) / (Math.cos(phi) * Math.cos(alt) + 1e-9), -1, 1);
    let az = Math.acos(cosAz);
    if (Math.sin(eot) > 0) az = TAU - az;
    return { phase, az: az / RAD, alt: alt / RAD, eot: eot / RAD, declination: delta / RAD,
      E, nu, distance: 1 - params.ecc * Math.cos(E),
      orbitX: Math.cos(E) - params.ecc, orbitY: Math.sqrt(1 - params.ecc ** 2) * Math.sin(E) };
  }

  function curve(params, latitude = params.lat, count = 720) {
    return Array.from({ length: count }, (_, i) => position(params, i / count, latitude));
  }

  function unwrap(values) {
    if (!values.length) return [];
    const result = [values[0]];
    let offset = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (diff > 180) offset -= 360;
      else if (diff < -180) offset += 360;
      result.push(values[i] + offset);
    }
    return result;
  }

  function statistics(points) {
    const range = values => Math.max(...values) - Math.min(...values);
    return { alt: range(points.map(p => p.alt)), az: range(unwrap(points.map(p => p.az))), eot: range(points.map(p => p.eot)) };
  }

  function latitudeLabel(value) {
    if (value === 0) return '0°';
    return `${Math.abs(value).toFixed(Number.isInteger(value) ? 0 : 1)}°${value > 0 ? 'N' : 'S'}`;
  }

  const api = { RAD, TAU, clamp, presets, keplerE, position, curve, unwrap, statistics, latitudeLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AnalemmaPhysics = api;
})(globalThis);
