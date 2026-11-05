// FILE: SHAPE LAB drawing (three.js). Draws the turning shapes with the note name on every corner and the chord name above each shape.
// The music rules are in shapeMusic.ts. This file only shows them.
import { AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, Group, Line, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Raycaster, Scene, Sprite, SpriteMaterial, SphereGeometry, Vector2, WebGLRenderer } from 'three';
import { noteLabel } from './shapeMusic';

/** What the scene needs to know about one shape, every frame. */
export type LayerShow = { chord: number[]; name: string; roman: string; selected: boolean; muted: boolean };

type View = {
  group: Group; shape: Group; spheres: Mesh[]; labels: Sprite[]; poly: LineLoop; spokes: LineSegments; arm: Line; title: Sprite;
  flash: number[]; armFlash: number; armTo: number; sig: string; titleSig: string;
};

export class ShapeScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(42, 1, 0.1, 50);
  private root = new Group();                          // everything that the mouse can turn
  views: View[] = [];
  private ray = new Raycaster();
  private geo = new SphereGeometry(1, 24, 16);
  private texCache = new Map<string, CanvasTexture>();
  yaw = 0.35; pitch = 0.45; spin = 0;
  hue = 0.25;                                          // base colour (changes with the musical key)

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0.5, 4.5); this.camera.lookAt(0, 0.05, 0);
    this.scene.add(new AmbientLight(0xffffff, 0.9));
    const sun = new DirectionalLight(0xffffff, 1.6); sun.position.set(2, 3, 4); this.scene.add(sun);
    const warm = new PointLight(0xffd9a0, 6, 14); warm.position.set(-2, -1, 3); this.scene.add(warm);
    this.scene.add(this.root); this.applyView();
  }

  resize(w: number, h: number): void {
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
  }
  private applyView(): void { this.root.rotation.set(this.pitch - 0.45, this.yaw - 0.35, 0); this.root.updateMatrixWorld(true); }
  rotateBy(dx: number, dy: number): void { this.yaw += dx * 0.008; this.pitch = Math.max(-0.3, Math.min(1.3, this.pitch + dy * 0.008)); this.applyView(); }

  /** A sprite with text. The pictures are cached, so the same text is drawn only once. */
  private text(s: string, color: string, size: number): CanvasTexture {
    const key = `${s}|${color}|${size}`; const hit = this.texCache.get(key); if (hit) return hit;
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
    g.font = `700 ${size}px "Space Grotesk", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(10,10,30,.75)'; g.strokeText(s, 128, 64); g.fillStyle = color; g.fillText(s, 128, 64);
    const t = new CanvasTexture(c); this.texCache.set(key, t); return t;
  }

  private makeView(i: number, sides: number): View {
    const group = new Group(); const shape = new Group(); group.add(shape);
    const h = (this.hue + i * 0.28) % 1;
    const spheres: Mesh[] = [], labels: Sprite[] = [];
    for (let k = 0; k < sides; k++) {
      const m = new Mesh(this.geo, new MeshStandardMaterial({ roughness: 0.3, metalness: 0.1, color: new Color().setHSL(h, 0.7, 0.55) }));
      shape.add(m); spheres.push(m);
      const sp = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false })); sp.scale.set(0.8, 0.4, 1); shape.add(sp); labels.push(sp);
    }
    const lineMat = new LineBasicMaterial({ color: new Color().setHSL(h, 0.6, 0.7), transparent: true, opacity: 0.9 });
    const poly = new LineLoop(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(sides * 3), 3)), lineMat);
    const spokes = new LineSegments(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(sides * 6), 3)), new LineBasicMaterial({ color: new Color().setHSL(h, 0.4, 0.7), transparent: true, opacity: 0.25 }));
    const arm = new Line(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(6), 3)), new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    shape.add(poly, spokes, arm);
    const title = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false })); title.scale.set(1.3, 0.65, 1); group.add(title);
    this.root.add(group);
    return { group, shape, spheres, labels, poly, spokes, arm, title, flash: new Array(sides).fill(0), armFlash: 0, armTo: 0, sig: '', titleSig: '' };
  }
  private killView(v: View): void {
    this.root.remove(v.group);
    v.spheres.forEach(m => (m.material as MeshStandardMaterial).dispose()); v.labels.forEach(s => s.material.dispose()); v.title.material.dispose();
    [v.poly, v.spokes, v.arm].forEach(l => { l.geometry.dispose(); (l.material as LineBasicMaterial).dispose(); });
  }

  /** The corner(s) that just played: they flash, and the arm points at the last one. */
  flash(layer: number, vertices: number[]): void {
    const v = this.views[layer]; if (!v) return;
    vertices.forEach(k => { if (k < v.flash.length) v.flash[k] = 1; });
    if (vertices.length) { v.armTo = vertices[vertices.length - 1]; v.armFlash = 1; }
  }

  /** Draw one frame. pulse (0..1) is the kick drum. */
  draw(show: LayerShow[], pulse: number, dt: number): void {
    // add or remove shapes so there is one view per shape (and the right number of corners)
    while (this.views.length > show.length) this.killView(this.views.pop()!);
    show.forEach((s, i) => {
      const v = this.views[i];
      if (!v || v.spheres.length !== s.chord.length) { if (v) this.killView(v); this.views[i] = this.makeView(i, s.chord.length); }
    });
    this.spin += dt * 0.35;
    const n = show.length; const scale = n === 1 ? 1 : n === 2 ? 0.82 : 0.68;
    show.forEach((s, i) => {
      const v = this.views[i]; const sides = s.chord.length;
      const h = (this.hue + i * 0.28) % 1;
      v.group.position.set((i - (n - 1) / 2) * 2.15 * scale * 1.1, -0.15, 0); v.group.scale.setScalar(scale);
      v.shape.rotation.y = this.spin * (i % 2 ? -1 : 1);
      const lo = Math.min(...s.chord), hi = Math.max(...s.chord), mid = (lo + hi) / 2;
      const sig = s.chord.join(',') + '|' + sides;
      const pos = new Float32Array(sides * 3), sp = new Float32Array(sides * 6);
      s.chord.forEach((m, k) => {
        const a = (k / sides) * Math.PI * 2, R = 0.95, y = (m - mid) * 0.07;
        const x = Math.sin(a) * R, z = Math.cos(a) * R;
        pos.set([x, y, z], k * 3); sp.set([0, 0, 0, x, y, z], k * 6);
        const f = v.flash[k]; v.flash[k] = Math.max(0, f - dt * 3.2);
        const sphere = v.spheres[k]; sphere.position.set(x, y, z);
        sphere.scale.setScalar(0.11 * (1 + 0.25 * pulse + 0.9 * f));
        const mat = sphere.material as MeshStandardMaterial; mat.color.setHSL(h, 0.7, 0.5 + 0.2 * f); mat.emissive.setHSL(h, 0.9, 0.5); mat.emissiveIntensity = (s.muted ? 0.02 : 0.15) + 0.9 * f;
        const lab = v.labels[k]; lab.position.set(x * 1.28, y + 0.2, z * 1.28);
        if (v.sig !== sig) (lab.material as SpriteMaterial).map = this.text(noteLabel(m), '#ffffff', 64);
        (lab.material as SpriteMaterial).opacity = s.muted ? 0.4 : 1; (lab.material as SpriteMaterial).needsUpdate = true;
      });
      v.poly.geometry.setAttribute('position', new BufferAttribute(pos, 3)); v.spokes.geometry.setAttribute('position', new BufferAttribute(sp, 3));
      (v.poly.material as LineBasicMaterial).opacity = s.muted ? 0.25 : 0.55 + 0.45 * (s.selected ? 1 : 0.6);
      (v.poly.material as LineBasicMaterial).color.setHSL(h, 0.6, s.selected ? 0.78 : 0.62);
      // the arm: from the middle to the corner that played last
      const k = Math.min(v.armTo, sides - 1); v.armFlash = Math.max(0, v.armFlash - dt * 2.2);
      v.arm.geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]), 3));
      (v.arm.material as LineBasicMaterial).opacity = v.armFlash * 0.9;
      v.sig = sig;
      // the chord name above the shape
      const tsig = s.name + '|' + s.roman + '|' + (s.muted ? 1 : 0);
      if (v.titleSig !== tsig) { (v.title.material as SpriteMaterial).map = this.text(s.name, s.muted ? '#8a90a8' : '#d6f24a', 78); (v.title.material as SpriteMaterial).needsUpdate = true; v.titleSig = tsig; }
      v.title.position.set(0, 1.25, 0);
    });
    this.renderer.render(this.scene, this.camera);
  }

  /** The corner under the mouse (nx, ny go from -1 to 1): which shape and which corner. */
  pick(nx: number, ny: number): { layer: number; vertex: number } | null {
    this.ray.setFromCamera(new Vector2(nx, ny), this.camera);
    const all: Mesh[] = this.views.flatMap(v => v.spheres);
    const hit = this.ray.intersectObjects(all, false)[0]; if (!hit) return null;
    for (let i = 0; i < this.views.length; i++) { const k = this.views[i].spheres.indexOf(hit.object as Mesh); if (k >= 0) return { layer: i, vertex: k }; }
    return null;
  }
  dispose(): void {
    this.views.forEach(v => this.killView(v)); this.views = [];
    this.texCache.forEach(t => t.dispose()); this.texCache.clear(); this.geo.dispose(); this.renderer.dispose();
  }
}
