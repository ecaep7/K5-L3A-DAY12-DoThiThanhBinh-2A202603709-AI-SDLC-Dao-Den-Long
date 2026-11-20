// Chỉ VẼ trạng thái của sim. Không có luật game ở đây.
import * as THREE from 'three';
import { TUNING, WORLD } from '../src/sim/index.js';

const WARM = 0xffb347;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export function createRenderer(canvasParent) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  canvasParent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120c22);
  scene.fog = new THREE.FogExp2(0x1d1236, 0.014);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);

  const hemi = new THREE.HemisphereLight(0x8a7ac8, 0x2a1a48, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xaab0ff, 0.7);
  moon.position.set(-20, 40, -10);
  scene.add(moon);

  // đảo + biển mây
  const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 64), mat(0x54456f));
  island.position.y = -1.5;
  scene.add(island);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(200, 48), mat(0x2a2150, { emissive: 0x100a24 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -6;
  scene.add(sea);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 4) * 1.6, 12, 8), mat(0x4b3f7c, { emissive: 0x150e2c }));
    puff.position.set(Math.cos(a) * (46 + (i % 3) * 5), -4.5, Math.sin(a) * (46 + (i % 3) * 5));
    puff.scale.y = 0.45;
    scene.add(puff);
  }

  // đèn lồng lớn
  const lanternViews = new Map();
  function makeLantern() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), mat(0x6b4a2b));
    pole.position.y = 1.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), mat(0x55402e, { emissive: 0x000000 }));
    lamp.position.y = 3.7;
    lamp.scale.y = 1.2;
    const light = new THREE.PointLight(WARM, 0, 32, 1.4);
    light.position.y = 3.7;
    const pool = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.25, TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.04;
    pool.visible = false;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    glow.visible = false;
    g.add(pole, lamp, light, pool, glow);
    scene.add(g);
    return { g, lamp, light, pool, glow };
  }

  // người chơi: Mây đội nón lá, xách đèn lồng nhỏ
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.95, 16), mat(0xf4efe6));
  body.position.y = 0.48;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xffe3c4));
  head.position.y = 1.15;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 20), mat(0xd9b36c));
  hat.position.y = 1.55;
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(0xff9d2e, { emissive: 0xff8a1f, emissiveIntensity: 1.4 }));
  lantern.position.set(0.55, 0.85, 0.15);
  const lanternLight = new THREE.PointLight(WARM, 12, 14, 1.6);
  lanternLight.position.copy(lantern.position);
  player.add(body, head, hat, lantern, lanternLight);
  scene.add(player);
  let facing = 0;

  // đom đóm, Bóng Mực
  const moteGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  const moteViews = new Map();
  const shadeViews = new Map();
  function makeShade() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), mat(0x1c0b30, { emissive: 0x3a1266, emissiveIntensity: 0.9 }));
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xf5e9ff });
    for (const s of [-0.28, 0.28]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeM);
      e.position.set(s, 0.15, 0.7);
      g.add(e);
    }
    g.add(m);
    scene.add(g);
    return { g, m };
  }

  const pulses = []; // vòng sáng khi tỏa sáng
  function addPulse(pos) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos[0], 0.1, pos[2]);
    scene.add(ring);
    pulses.push({ ring, age: 0 });
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let t = 0;
  return {
    domElement: renderer.domElement,
    onEvents(events, world) {
      for (const e of events) if (e.name === 'pulse') addPulse(world.player.pos);
    },
    sync(world, dt, camYawDeg, camOverride = null) {
      t += dt;
      const p = world.player;

      // đèn lớn + ánh sáng của đảo tăng dần theo số đèn đã thắp
      const litCount = world.lanterns.filter((l) => l.lit).length;
      hemi.intensity = 0.6 + 0.16 * litCount;
      scene.fog.color.setRGB(0.11 + 0.04 * litCount, 0.07 + 0.025 * litCount, 0.21);
      for (const l of world.lanterns) {
        let v = lanternViews.get(l.id);
        if (!v) { v = makeLantern(); lanternViews.set(l.id, v); }
        v.g.position.set(l.pos[0], l.pos[1], l.pos[2]);
        const k = l.lit ? 1 : l.deposited / TUNING.lantern_cost; // đèn đang nạp sáng mờ dần
        v.lamp.material.emissive.setHex(WARM);
        v.lamp.material.emissiveIntensity = l.lit ? 1.6 + 0.2 * Math.sin(t * 3 + l.pos[0]) : 0.9 * k;
        v.light.intensity = l.lit ? 110 : 0;
        v.pool.visible = v.glow.visible = l.lit;
      }

      // người chơi
      player.position.set(p.pos[0], p.pos[1], p.pos[2]);
      const mv = world.lastMove;
      if (mv && (mv[0] || mv[1])) {
        const th = (camYawDeg * Math.PI) / 180;
        const wx = mv[0] * Math.cos(th) + mv[1] * Math.sin(th);
        const wz = -mv[0] * Math.sin(th) + mv[1] * Math.cos(th);
        facing = Math.atan2(wx, wz);
      }
      player.rotation.y = facing;
      player.visible = !(p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0);
      lantern.position.y = 0.85 + 0.05 * Math.sin(t * 5);

      // đom đóm
      const seen = new Set();
      for (const m of world.motes) {
        seen.add(m.id);
        let mesh = moteViews.get(m.id);
        if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteViews.set(m.id, mesh); }
        mesh.position.set(m.pos[0], 0.9 + 0.25 * Math.sin(t * 2.2 + m.pos[0]), m.pos[2]);
      }
      for (const [id, mesh] of moteViews) if (!seen.has(id)) { scene.remove(mesh); moteViews.delete(id); }

      // Bóng Mực
      const seenS = new Set();
      for (const s of world.shades) {
        seenS.add(s.id);
        let v = shadeViews.get(s.id);
        if (!v) { v = makeShade(); shadeViews.set(s.id, v); }
        const stunned = s.state === 'stunned';
        v.g.position.set(s.pos[0], s.pos[1] + 0.1 * Math.sin(t * 4 + s.pos[0]), s.pos[2]);
        v.g.rotation.y = Math.atan2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
        v.g.scale.setScalar(stunned ? 0.7 : 1);
        v.m.material.color.setHex(stunned ? 0x6a6f9a : 0x1c0b30);
        v.m.material.emissive.setHex(stunned ? 0x333a66 : 0x3a1266);
      }
      for (const [id, v] of shadeViews) if (!seenS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

      // vòng tỏa sáng
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pu = pulses[i];
        pu.age += dt;
        const k = pu.age / 0.5;
        pu.ring.scale.setScalar(1 + k * (TUNING.pulse_radius - 1));
        pu.ring.material.opacity = 0.9 * (1 - k);
        if (k >= 1) { scene.remove(pu.ring); pulses.splice(i, 1); }
      }

      // camera theo sau; hướng nhìn = (sinθ, cosθ) khớp quy ước move của contract
      const th = (camYawDeg * Math.PI) / 180;
      const target = new THREE.Vector3(p.pos[0], 1.0, p.pos[2]);
      if (camOverride) { // cảnh benchmark: camera do bench.js điều khiển
        camera.position.set(...camOverride.pos);
        camera.lookAt(...camOverride.look);
      } else {
        camera.position.set(target.x - Math.sin(th) * 13, 9 + p.pos[1] * 0.3, target.z - Math.cos(th) * 13);
        camera.lookAt(target);
      }
      renderer.render(scene, camera);
    },
  };
}
