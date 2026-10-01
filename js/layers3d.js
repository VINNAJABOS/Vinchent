// Latar "lapisan pelat biru" untuk semua halaman (model: blender/build_layers.py).
// Kanvas fixed di belakang konten. Pelat merenggang ke arah kamera saat halaman
// di-scroll dan sedikit miring mengikuti kursor, jadi kedalaman 3D-nya terasa.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "asset/3d/layers.glb";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Warna harus sama dengan FILL/RIM di blender/build_layers.py (luar -> dalam).
const FILL = ["#07083a", "#0a0f6e", "#0c1aa0", "#1030d8", "#1f4bff", "#3d6bff", "#7d9cff", "#c4d2ff"];
const RIM = ["#2f4dff", "#3659ff", "#3f69ff", "#4a7bff", "#5a93ff", "#6fb0ff", "#8fd0ff", "#b8ecff"];

// Isi pelat: warna dasar + cahaya lembut di dekat tepi (seperti referensi),
// dihitung dengan SDF persegi bersudut bulat di ruang UV pelat.
const plateVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const plateFragment = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uRim;
  uniform vec2 uSize;
  uniform float uRadius;
  varying vec2 vUv;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRoundBox(p, uSize * 0.5, uRadius); // < 0 di dalam
    float edgeGlow = exp(d * 1.6);                 // 1 di tepi, meluruh ke dalam
    vec3 col = mix(uFill, uRim, edgeGlow * 0.55);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function init() {
  const canvas = document.createElement("canvas");
  canvas.className = "layers-bg";
  canvas.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  } catch {
    document.documentElement.classList.add("no-webgl"); // CSS memakai layers-bg.jpg
    return;
  }
  document.body.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05040f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, 34);

  const stage = new THREE.Group(); // parallax kursor
  scene.add(stage);

  // glTF dari Blender (Z-up) diekspor Y-up: pelat jadi mendatar. root memutar balik
  // supaya pelat menghadap kamera; kedalaman Blender (Z) = sumbu y lokal anak-anaknya.
  const root = new THREE.Group();
  stage.add(root);
  let layers = null;
  let anchor = null;
  const plates = []; // { index, parts: Object3D[] }

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      layers = gltf.scene.getObjectByName("Layers") || gltf.scene;
      anchor = gltf.scene.getObjectByName("Anchor") || layers;
      gltf.scene.rotation.x = Math.PI / 2;

      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = /^(Plate|Rim|Halo)_(\d+)/.exec(o.name);
        if (!m) return;
        const [, kind, idxStr] = m;
        const i = Number(idxStr);
        if (kind === "Plate") {
          const ex = o.userData || {};
          o.material = new THREE.ShaderMaterial({
            vertexShader: plateVertex,
            fragmentShader: plateFragment,
            uniforms: {
              uFill: { value: new THREE.Color(FILL[i]) },
              uRim: { value: new THREE.Color(RIM[i]) },
              uSize: { value: new THREE.Vector2(ex.plate_w || 30, ex.plate_h || 40) },
              uRadius: { value: ex.plate_r || 1.6 },
            },
          });
        } else {
          o.material = new THREE.MeshBasicMaterial({
            color: RIM[i],
            transparent: kind === "Halo",
            opacity: kind === "Halo" ? 0.22 : 1,
            blending: kind === "Halo" ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: kind !== "Halo",
          });
        }
        (plates[i] ||= { index: i, parts: [] }).parts.push(o);
      });
      plates.forEach((p) => p.parts.forEach((o) => (o.userData.baseDepth = o.position.y)));
      root.add(gltf.scene);
      layout();
      canvas.classList.add("is-ready");
      setTimeout(() => {
        canvas.style.transition = "opacity 0.2s linear";
        fadedIn = true;
        dimForScroll();
      }, 900);
    },
    undefined,
    (err) => {
      console.error("Gagal memuat latar 3D:", err);
      canvas.remove();
      document.documentElement.classList.add("no-webgl");
    }
  );

  // Tempatkan sudut pelat terluar di ~57% lebar & ~20% tinggi layar, sehingga
  // tumpukan memenuhi kanan-bawah dan sisi kiri tetap gelap untuk teks.
  // Di layar sempit (HP) sudutnya digeser ke kanan agar teks tidak tertutup pelat terang.
  function layout() {
    if (!layers) return;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const narrow = camera.aspect < 0.9;
    const fx = narrow ? 0.62 : 0.57;
    const fy = narrow ? 0.34 : 0.2;
    const target = new THREE.Vector3(-halfW + fx * 2 * halfW, halfH - fy * 2 * halfH, 0);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const a = root.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()));
    root.position.set(target.x - a.x, target.y - a.y, -a.z);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout();
    if (reducedMotion) render();
  }
  window.addEventListener("resize", resize);
  resize();

  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  let spread = 0;
  // Setelah hero, latar diredupkan supaya teks di bagian bawah tetap terbaca.
  // Langsung dari posisi scroll (bukan per frame) agar pasti sesuai.
  let fadedIn = false;
  function dimForScroll() {
    if (!fadedIn) return;
    const t = Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
    canvas.style.opacity = (1 - t * 0.62).toFixed(3);
  }
  window.addEventListener("scroll", dimForScroll, { passive: true });
  const clock = new THREE.Clock();

  function render() {
    renderer.render(scene, camera);
  }

  function frame() {
    const t = clock.getElapsedTime();
    // 0 di atas halaman -> 1 setelah satu layar di-scroll
    const scrollT = Math.min(window.scrollY / window.innerHeight, 1.5);
    spread += (scrollT - spread) * 0.08;

    plates.forEach((p) => {
      // Pelat dalam maju lebih jauh ke kamera saat di-scroll (tumpukan merenggang)
      const lift = spread * p.index * 0.9 + Math.sin(t * 0.6 + p.index * 0.7) * 0.05;
      p.parts.forEach((o) => (o.position.y = o.userData.baseDepth + lift));
    });

    stage.rotation.y += (pointer.x * 0.08 - spread * 0.12 - stage.rotation.y) * 0.04;
    stage.rotation.x += (pointer.y * 0.05 + spread * 0.06 - stage.rotation.x) * 0.04;
    render();
  }

  if (reducedMotion) {
    // Tanpa animasi: gambar sekali setelah model termuat
    const wait = setInterval(() => {
      if (!layers) return;
      clearInterval(wait);
      render();
    }, 100);
    return;
  }
  renderer.setAnimationLoop(() => {
    if (!document.hidden) frame();
  });
}

init();
