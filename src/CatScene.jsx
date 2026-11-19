import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const initialYaw = 0.25;
const initialPitch = 0;
const sphere = new THREE.SphereGeometry(1, 32, 24);

function clay(color, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function addMesh(parent, geometry, material, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function blob(parent, material, position, scale) {
  return addMesh(parent, sphere, material, position, scale);
}

function stroke(parent, material, points, radius, steps = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return addMesh(parent, new THREE.TubeGeometry(curve, steps, radius, 8, false), material, [0, 0, 0]);
}

function earGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.29, 0);
  shape.quadraticCurveTo(-0.28, 0.24, -0.08, 0.64);
  shape.quadraticCurveTo(0, 0.82, 0.075, 0.66);
  shape.quadraticCurveTo(0.18, 0.35, 0.27, 0.035);
  shape.quadraticCurveTo(0.03, -0.13, -0.29, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.13, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.065, bevelSegments: 5, curveSegments: 16,
  });
  geometry.translate(0, 0, -0.11);
  return geometry;
}

const catEar = earGeometry();

function buildCat(parent, white) {
  const cat = new THREE.Group();
  parent.add(cat);
  const fur = clay(white ? '#fff2e2' : '#cfac92');
  const points = clay(white ? '#fff6e8' : '#654c48');
  const mask = clay(white ? '#fff9ed' : '#78605a');
  const cheek = clay(white ? '#fffaef' : '#93756a');
  const inner = clay(white ? '#dea5ab' : '#ac767c');
  const nose = clay(white ? '#d98899' : '#45313f');
  const eyeDark = clay('#30252f', 0.27);
  const iris = clay(white ? '#a8bb78' : '#86c4ed', 0.27);
  const gleam = new THREE.MeshBasicMaterial({ color: '#fff9fb' });

  blob(cat, fur, [0, 0.49, -0.25], [0.84, 0.50, 0.93]);
  blob(cat, fur, [0, 0.61, 0.25], [0.65, 0.57, 0.62]);
  stroke(cat, points, [[0.6, 0.32, -0.68], [0.86, 0.27, -0.6], [0.93, 0.23, -0.13], [0.67, 0.2, 0.36], [0.52, 0.19, 0.5]], 0.127);
  blob(cat, points, [0.52, 0.19, 0.5], [0.128, 0.128, 0.128]);

  for (const side of [-1, 1]) {
    blob(cat, points, [side * 0.30, 0.17, 0.66], [0.28, 0.17, 0.38]);
    for (const offset of [-0.07, 0.074]) {
      blob(cat, mask, [side * 0.29 + offset, 0.177, 1.015], [0.021, 0.051, 0.013]);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.43);
  cat.add(head);
  blob(head, fur, [0, 0, 0], [0.69, 0.59, 0.55]);
  blob(head, mask, [0, -0.058, 0.32], [0.55, 0.455, 0.31]);

  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.448, 0.32, -0.03);
    ear.rotation.z = -side * 0.25;
    ear.rotation.y = side * 0.12;
    head.add(ear);
    addMesh(ear, catEar, points, [0, 0, 0]);
    addMesh(ear, catEar, inner, [0, 0.09, 0.102], [0.56, 0.66, 0.36]);
    blob(head, cheek, [side * 0.205, -0.241, 0.504], [0.252, 0.176, 0.164]);
    if (white) {
      const tuft = blob(head, points, [side * 0.51, -0.15, 0.14], [0.255, 0.201, 0.31]);
      tuft.rotation.z = side * 0.23;
      blob(head, fur, [side * 0.436, -0.27, 0.21], [0.27, 0.17, 0.26]);
    }

    const eye = new THREE.Group();
    eye.position.set(side * 0.254, 0.027, 0.515);
    eye.rotation.y = side * 0.29;
    head.add(eye);
    blob(eye, eyeDark, [0, 0, 0], [0.155, 0.177, 0.078]);
    blob(eye, iris, [0, 0, 0.062], [0.118, 0.138, 0.041]);
    blob(eye, eyeDark, [0, 0, 0.094], [0.062, 0.11, 0.029]);
    blob(eye, gleam, [-0.034, 0.054, 0.115], [0.036, 0.041, 0.015]);
    blob(eye, gleam, [0.038, -0.045, 0.116], [0.013, 0.016, 0.008]);

    for (const row of [0, 1]) {
      for (const column of [0, 1]) {
        blob(head, nose, [side * (0.225 + column * 0.061), -0.218 - row * 0.047, 0.651 - column * 0.02], [0.013, 0.013, 0.008]);
      }
    }
    stroke(head, nose, [[0, -0.267, 0.634], [side * 0.061, -0.327, 0.622], [side * 0.128, -0.315, 0.64]], 0.012, 12);
  }
  blob(head, nose, [0, -0.207, 0.641], [0.103, 0.065, 0.046]);
  return cat;
}

function buildDiorama() {
  const group = new THREE.Group();
  const platform = clay('#ad8eea');
  const highlight = clay('#ded0ff');
  const rim = clay('#8866bf');
  addMesh(group, new THREE.CylinderGeometry(2.4, 2.32, 0.24, 96), platform, [0, -0.14, 0]);
  addMesh(group, new THREE.CylinderGeometry(2.42, 2.39, 0.064, 96), highlight, [0, -0.044, 0]);
  addMesh(group, new THREE.CylinderGeometry(2.33, 2.24, 0.083, 96), rim, [0, -0.277, 0]);

  const white = buildCat(group, true);
  white.position.set(-0.85, 0, -0.04);
  white.rotation.y = 0.11;
  white.scale.setScalar(0.98);
  const gray = buildCat(group, false);
  gray.position.set(0.83, 0, 0.01);
  gray.rotation.y = -0.15;
  gray.scale.setScalar(0.87);

  const yarn = new THREE.Group();
  yarn.position.set(1.20, 0.213, 1.41);
  group.add(yarn);
  const strand = clay('#f1bdde', 0.8);
  blob(yarn, clay('#bf79b4', 0.9), [0, 0, 0], [0.223, 0.223, 0.223]);
  for (const angle of [0, 0.85, 2.01, 2.89]) {
    const band = new THREE.Group();
    band.rotation.set(angle * 0.37, angle, angle * 0.65);
    yarn.add(band);
    for (const offset of [-0.066, -0.027, 0.013, 0.052]) {
      const geometry = new THREE.TorusGeometry(Math.sqrt(0.223 ** 2 - offset ** 2), 0.015, 6, 36);
      addMesh(band, geometry, strand, [0, 0, offset]);
    }
  }
  stroke(group, strand, [[1.32, 0.038, 1.51], [1.61, 0.027, 1.47], [1.63, 0.027, 1.25], [1.46, 0.027, 1.28], [1.53, 0.027, 1.46]], 0.015);
  const moss = clay('#d7ee8e');
  blob(group, moss, [-1.47, 0.085, 1.22], [0.086, 0.095, 0.086]);
  blob(group, moss, [-1.66, 0.055, 1.39], [0.055, 0.059, 0.055]);
  return group;
}

function groundShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 13, 64, 64, 62);
  gradient.addColorStop(0, '#43226c59');
  gradient.addColorStop(0.6, '#66448d36');
  gradient.addColorStop(1, '#66448d00');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export default function CatScene({ spinning, reset, onAvailability }) {
  const canvasRef = useRef(null);
  const controls = useRef({ spinning, reset });
  const [failed, setFailed] = useState(false);
  const requestRender = useRef(null);
  useEffect(() => {
    controls.current = { spinning, reset };
    requestRender.current?.();
  }, [spinning, reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      onAvailability(false);
      return;
    }

    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const reflection = pmrem.fromScene(environment, 0.04);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.73;
    environment.dispose();
    pmrem.dispose();

    const model = buildDiorama();
    scene.add(model);
    const shadow = groundShadow();
    const shadowMesh = addMesh(scene, new THREE.PlaneGeometry(6.6, 5.6), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }), [0, -0.328, 0]);
    shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(new THREE.HemisphereLight('#fff4ff', '#b18bd3', 1.03));
    const key = new THREE.DirectionalLight('#fff2ec', 2.16);
    key.position.set(-3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#ece1ff', 1.47);
    rim.position.set(3, 4, -5);
    scene.add(rim);

    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 40);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    let yaw = initialYaw;
    let pitch = initialPitch;
    let frame = 0;
    let lastReset = controls.current.reset;
    let lastTime = 0;
    let lastYaw;
    let lastPitch;
    let resizeNeeded = true;
    let drag;
    let inView = true;

    function render() {
      if (resizeNeeded) {
        const { clientWidth: width, clientHeight: height } = canvas;
        const aspect = width / Math.max(1, height);
        const halfWidth = Math.max(2.65, aspect * 1.77);
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfWidth / aspect;
        camera.bottom = -halfWidth / aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        resizeNeeded = false;
      }
      model.rotation.y = yaw;
      camera.position.set(3.05, 2.75 + pitch, 6.9);
      camera.lookAt(0, 0.63, 0);
      renderer.render(scene, camera);
      lastYaw = yaw;
      lastPitch = pitch;
    }

    function schedule() {
      if (inView && !frame) frame = requestAnimationFrame(animate);
    }

    function animate(time) {
      frame = 0;
      const elapsed = Math.min((time - lastTime) / 1000, 0.06);
      lastTime = time;
      if (!inView) return;
      if (lastReset !== controls.current.reset) {
        yaw = initialYaw;
        pitch = initialPitch;
        lastReset = controls.current.reset;
      }
      if (controls.current.spinning && !drag) yaw += elapsed * 0.58;
      if (resizeNeeded || lastYaw !== yaw || lastPitch !== pitch) render();
      if (controls.current.spinning) schedule();
      else lastTime = 0;
    }

    function down(event) {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    }

    function move(event) {
      if (!drag || drag.id !== event.pointerId) return;
      yaw += (event.clientX - drag.x) * 0.012;
      pitch = THREE.MathUtils.clamp(pitch + (event.clientY - drag.y) * 0.015, -1.15, 2.15);
      drag.x = event.clientX;
      drag.y = event.clientY;
      schedule();
    }

    function up(event) {
      if (drag?.id === event.pointerId) drag = undefined;
    }

    function keydown(event) {
      switch (event.key) {
        case 'ArrowLeft': yaw -= 0.2; break;
        case 'ArrowRight': yaw += 0.2; break;
        case 'ArrowUp': pitch = Math.min(2.15, pitch + 0.24); break;
        case 'ArrowDown': pitch = Math.max(-1.15, pitch - 0.24); break;
        default: return;
      }
      event.preventDefault();
      schedule();
    }

    function contextLost(event) {
      event.preventDefault();
      setFailed(true);
      onAvailability(false);
    }

    const handlers = {
      pointerdown: down, pointermove: move, pointerup: up, pointercancel: up,
      lostpointercapture: up, keydown, webglcontextlost: contextLost,
    };
    Object.entries(handlers).forEach(([event, handler]) => canvas.addEventListener(event, handler));
    const resizeObserver = new ResizeObserver(() => { resizeNeeded = true; schedule(); });
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; schedule(); });
    intersection.observe(canvas);
    render();
    requestRender.current = schedule;
    schedule();
    onAvailability(true);

    return () => {
      requestRender.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      Object.entries(handlers).forEach(([event, handler]) => canvas.removeEventListener(event, handler));
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry && object.geometry !== sphere && object.geometry !== catEar) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      shadow.dispose();
      reflection.dispose();
      renderer.dispose();
    };
  }, [onAvailability]);

  if (failed) return <img className="studio-poster" src="/photos/basket.jpg" alt="Два кота свернулись вместе в серой лежанке" />;
  return <canvas className="studio-model" ref={canvasRef} tabIndex={0} aria-label="Два кота в 3D. Используйте клавиши со стрелками, чтобы повернуть фигурки." />;
}


