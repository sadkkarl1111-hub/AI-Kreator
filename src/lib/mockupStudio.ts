import { fitImageRect } from './localDesignExport';

type Vertex = [number, number, number];
type Point = { x: number; y: number };
type Quad = [Vertex, Vertex, Vertex, Vertex];
type Face = { vertices: Vertex[]; color: string; fabric?: boolean; artwork?: { quad: Quad; from?: number; to?: number; drape?: boolean } };
type Model = { faces: Face[]; title: string; artRatio: number; print?: boolean; seams?: Vertex[][] };
export type StudioFit = 'contain' | 'cover' | 'stretch';

export const STUDIO_VIEWS = [
  { id: 'right', label: 'Prawy skos', yaw: -32, pitch: 15 },
  { id: 'front', label: 'Na wprost', yaw: 0, pitch: 7 },
  { id: 'left', label: 'Lewy skos', yaw: 32, pitch: 15 },
  { id: 'above', label: 'Z góry', yaw: -23, pitch: 43 },
  { id: 'flat', label: 'Na leżąco', yaw: -22, pitch: 56 },
] as const;
export type StudioView = typeof STUDIO_VIEWS[number]['id'];
export type StudioBackground = 'light' | 'warm' | 'dark';
export const STUDIO_BACKGROUNDS: Record<StudioBackground, string> = {
  light: 'Jasne studio', warm: 'Ciepłe studio', dark: 'Ciemne studio',
};

function rect(x: number, y: number, w: number, h: number, z: number): Quad {
  return [[x - w / 2, y + h, z], [x + w / 2, y + h, z], [x + w / 2, y, z], [x - w / 2, y, z]];
}

function addBox(faces: Face[], x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  const f = rect(x, y, w, h, z + d / 2);
  const b = rect(x, y, w, h, z - d / 2);
  faces.push(
    { vertices: f, color },
    { vertices: [...b].reverse(), color },
    { vertices: [b[0], b[1], f[1], f[0]], color },
    { vertices: [f[3], f[2], b[2], b[3]], color },
    { vertices: [f[1], b[1], b[2], f[2]], color },
    { vertices: [b[0], f[0], f[3], b[3]], color },
  );
}

function addPanel(faces: Face[], w: number, h: number, y: number, z: number, color: string, radius = 0, artwork = false, x = 0) {
  const quad = rect(x, y, w, h, z);
  const vertices = radius ? [
    [x + w / 2 - radius, y + h - radius, 90, 0],
    [x + w / 2 - radius, y + radius, 0, -90],
    [x - w / 2 + radius, y + radius, -90, -180],
    [x - w / 2 + radius, y + h - radius, -180, -270],
  ].flatMap(([cx, cy, start, end]) => Array.from({ length: 5 }, (_, index): Vertex => {
    const angle = (start + (end - start) * index / 4) * Math.PI / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z];
  })) : quad;
  faces.push({ vertices, color, artwork: artwork ? { quad } : undefined });
  return vertices;
}

function device(w: number, h: number, title: string): Model {
  const faces: Face[] = [];
  const front = addPanel(faces, w, h, 0, .074, '#303538', .13);
  const back = front.map(([x, y]): Vertex => [x, y, -.074]);
  faces.push({ vertices: [...back].reverse(), color: '#62686d' });
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    faces.push({ vertices: [front[j], front[i], back[i], back[j]], color: '#969b9e' });
  }
  addPanel(faces, w - .105, h - .105, .053, .08, '#141820', .09, true);
  if (w < 1.55) addPanel(faces, .26, .067, h - .17, .085, '#161a20', .029);
  return { faces, title, artRatio: (w - .105) / (h - .105) };
}

function computer(laptop: boolean): Model {
  const faces: Face[] = [];
  const w = laptop ? 2.65 : 2.78;
  const y = laptop ? .30 : .68;
  const z = laptop ? -.65 : 0;
  const h = 1.73;
  addBox(faces, 0, y, z, w, h, .13, '#858d97');
  addPanel(faces, w - .045, h - .043, y + .021, z + .067, '#252b34', .07);
  addPanel(faces, w - .17, h - .19, y + .10, z + .072, '#151e29', .038, true);
  if (laptop) {
    addBox(faces, 0, 0, .18, w, .12, 1.88, '#a6acb4');
    const keys: Vertex[] = [[-1.03, .125, -.58], [1.03, .125, -.58], [1.03, .125, .26], [-1.03, .125, .26]];
    faces.push({ vertices: keys, color: '#41464e' });
    for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) {
      const x = -1 + col * .169, z = -.55 + row * .202;
      faces.push({ vertices: [[x, .129, z], [x + .135, .129, z], [x + .135, .129, z + .155], [x, .129, z + .155]], color: '#6b7078' });
    }
    faces.push({ vertices: [[-.46, .126, .38], [.46, .126, .38], [.46, .126, .93], [-.46, .126, .93]], color: '#828a94' });
  } else {
    addBox(faces, 0, .08, -.15, .39, .85, .14, '#969da5');
    addBox(faces, 0, 0, -.12, 1.13, .08, .81, '#9ea4ab');
  }
  return { faces, title: laptop ? 'Laptop' : 'Monitor', artRatio: (w - .17) / (h - .19) };
}

function framedPoster(): Model {
  const faces: Face[] = [];
  addBox(faces, 0, 0, 0, 1.84, 2.50, .15, '#655748');
  addPanel(faces, 1.70, 2.36, .07, .079, '#eee6d9');
  addPanel(faces, 1.48, 2.10, .20, .082, '#f7f2e8', 0, true);
  return { faces, title: 'Plakat', artRatio: 1.48 / 2.10 };
}

function packaging(w: number, h: number, depth: number, title: string, book = false): Model {
  const faces: Face[] = [];
  addBox(faces, 0, 0, 0, w, h, depth, book ? '#535451' : '#dcd7cb');
  if (book) {
    addBox(faces, .027, .038, -.011, w - .045, h - .075, depth + .003, '#d8d1bf');
    for (let i = 0; i < 5; i++) {
      const z = depth * (.10 + i * .12);
      addBox(faces, .029, .043, z - depth / 2, w - .044, h - .084, .009, '#bcb5a5');
    }
    addBox(faces, 0, 0, depth / 2 + .014, w, h, .048, '#e6e0d4');
  }
  addPanel(faces, w - (book ? .036 : .012), h - .024, .012, depth / 2 + (book ? .04 : .003), '#f4f0e8', 0, true);
  return { faces, title, artRatio: w / h };
}

function giftBox(): Model {
  const faces: Face[] = [];
  const color = '#d1ae8c';
  addBox(faces, 0, 0, 0, 2.12, .10, 1.38, color);
  addBox(faces, 0, .09, .64, 2.12, .52, .10, color);
  addBox(faces, 0, .09, -.64, 2.12, .52, .10, color);
  for (const x of [-1.01, 1.01]) addBox(faces, x, .09, 0, .10, .52, 1.18, color);
  const lid: Quad = [[-1.06, 1.91, -1.16], [1.06, 1.91, -1.16], [1.06, .61, -.66], [-1.06, .61, -.66]];
  faces.push({ vertices: lid, color: '#dfc2a2', artwork: { quad: lid } }, { vertices: [...lid].reverse(), color });
  return { faces, title: 'Pudełko prezentowe', artRatio: 2.12 / 1.4 };
}

function revolved(profile: [number, number][], color: string, artworkRows: number[], faces: Face[]) {
  const segments = 40;
  const ring = (radius: number, y: number, index: number): Vertex => {
    const angle = index / segments * Math.PI * 2 - Math.PI;
    return [radius * Math.sin(angle), y, radius * Math.cos(angle)];
  };
  const start = Math.round(segments * .29);
  const end = segments - start;
  for (let row = 0; row < profile.length - 1; row++) {
    const [r1, y1] = profile[row];
    const [r2, y2] = profile[row + 1];
    for (let index = 0; index < segments; index++) {
      const quad: Quad = [ring(r2, y2, index), ring(r2, y2, index + 1), ring(r1, y1, index + 1), ring(r1, y1, index)];
      const artwork = artworkRows.includes(row) && index >= start && index < end
        ? { quad, from: (index - start) / (end - start), to: (index + 1 - start) / (end - start) }
        : undefined;
      faces.push({ vertices: quad, color, artwork });
    }
  }
}

function bottle(): Model {
  const faces: Face[] = [];
  revolved([[.37, 0], [.44, .07], [.46, .23], [.46, 1.46], [.43, 1.61], [.34, 1.83], [.24, 2.01], [.20, 2.1]], '#eeeae1', [2], faces);
  revolved([[.215, 2.07], [.236, 2.10], [.236, 2.31], [.206, 2.35], [0, 2.35]], '#c5c7c4', [], faces);
  return { faces, title: 'Butelka', artRatio: 1 };
}

function cup(): Model {
  const faces: Face[] = [];
  const color = '#edece7';
  const top = .57;
  revolved([[.40, 0], [.45, .06], [top, 1.5], [top + .035, 1.52], [top + .035, 1.57], [top - .02, 1.58], [top - .045, 1.53], [.40, .24], [0, .23]], color, [1], faces);
  {
    const pieces = 18;
    const ring = (index: number, radius: number): Vertex => {
      const angle = index / pieces * Math.PI * 2;
      return [.63 + Math.cos(angle) * radius, .83 + Math.sin(angle) * radius * 1.2, -.03];
    };
    for (let i = 0; i < pieces; i++) {
      const quad: Quad = [ring(i + 1, .35), ring(i, .35), ring(i, .225), ring(i + 1, .225)];
      faces.push({ vertices: quad, color }, { vertices: [...quad].reverse(), color });
    }
  }
  return { faces, title: 'Kubek', artRatio: 1.12 };
}

function garment(hoodie: boolean): Model {
  const faces: Face[] = [];
  const color = '#e7e5df';
  const outline: Vertex[] = [[-.38, 2.16, .12], [-.74, 2.09, .07], [-1.04, 1.85, -.02], [-1.29, hoodie ? .43 : 1.29, -.10], [-.92, hoodie ? .33 : 1.15, -.05], [-.73, 1.53, .06], [-.69, .16, .13], [-.57, 0, .18], [.57, 0, .18], [.69, .16, .13], [.73, 1.53, .06], [.92, hoodie ? .33 : 1.15, -.05], [1.29, hoodie ? .43 : 1.29, -.10], [1.04, 1.85, -.02], [.74, 2.09, .07], [.38, 2.16, .12], [.23, 1.98, .18], [0, 1.91, .21], [-.23, 1.98, .18]];
  const soften = (edge: Vertex[]) => edge.flatMap((point, index) => {
    const next = edge[(index + 1) % edge.length];
    return [lerp(point, next, .18), lerp(point, next, .82)];
  });
  const front = soften(soften([...outline].reverse()));
  const back = front.map(([x, y, z]): Vertex => [x, y, z - .075]);
  const print = rect(0, .61, 1.05, 1.06, .27);
  faces.push({ vertices: front, color, fabric: true }, { vertices: [...back].reverse(), color: '#c5c3bd', fabric: true });
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    faces.push({ vertices: [front[j], front[i], back[i], back[j]], color: '#c8c5be' });
  }
  faces.push({ vertices: print, color, artwork: { quad: print, drape: true }, fabric: true });
  const seams: Vertex[][] = [
    [[-.36, 2.135, .16], [-.28, 2.029, .20], [-.14, 1.951, .23], [0, 1.928, .24], [.14, 1.951, .23], [.28, 2.029, .20], [.36, 2.135, .16]],
    [[-.57, .079, .22], [-.32, .057, .25], [0, .048, .26], [.32, .057, .25], [.57, .079, .22]],
  ];
  if (hoodie) {
    const hood: Vertex[] = [[-.51, 2.02, .11], [-.45, 2.43, -.05], [-.29, 2.62, -.12], [0, 2.70, -.14], [.29, 2.62, -.12], [.45, 2.43, -.05], [.51, 2.02, .11], [0, 1.92, .23]];
    faces.push({ vertices: soften(soften(hood)), color: '#d7d3c9', fabric: true });
    addPanel(faces, .58, .24, 2.17, .03, '#a8a39a', .10);
    for (const x of [-.145, .145]) addPanel(faces, .022, .41, 1.70, .31, '#f0ebe0', .009, false, x);
    addPanel(faces, .74, .23, .19, .22, '#d9d5cc', .06);
  } else {
    faces.push({ vertices: [[-.34, 2.13, .02], [-.16, 2.11, -.02], [.16, 2.11, -.02], [.34, 2.13, .02], [.22, 1.96, .08], [0, 1.92, .09], [-.22, 1.96, .08]], color: '#aaa79e' });
    seams.push([[-1.20, 1.33, -.07], [-1.09, 1.24, -.03], [-.96, 1.19, -.015]], [[1.20, 1.33, -.07], [1.09, 1.24, -.03], [.96, 1.19, -.015]]);
  }
  return { faces, title: hoodie ? 'Bluza z kapturem' : 'Koszulka', artRatio: 1, print: true, seams };
}

const MODELS: Record<string, () => Model> = {
  iphone: () => device(1.24, 2.42, 'Telefon'),
  tablet: () => device(1.85, 2.45, 'Tablet'),
  macbook: () => computer(true),
  imac: () => computer(false),
  poster: framedPoster,
  book: () => packaging(1.66, 2.31, .32, 'Książka', true),
  softbox: () => packaging(1.52, 2.22, .44, 'Pudełko produktowe'),
  productbox: giftBox,
  bottle,
  mug: cup,
  businesscard: () => packaging(2.50, 1.44, .055, 'Wizytówka'),
  tshirt: () => garment(false),
  hoodie: () => garment(true),
};

export function hasStudioMockup(id: string) {
  return Object.hasOwn(MODELS, id);
}

export function studioViewsFor(id: string) {
  return STUDIO_VIEWS.filter(view => view.id !== 'flat' || (id !== 'productbox' && id !== 'macbook' && id !== 'imac'));
}

function projectCamera(yaw: number, pitch: number) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  return ([x, y, z]: Vertex): Vertex => {
    const depth = Math.sin(a) * x + Math.cos(a) * z;
    return [Math.cos(a) * x - Math.sin(a) * z, Math.cos(b) * y - Math.sin(b) * depth, Math.sin(b) * y + Math.cos(b) * depth];
  };
}

const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function trace(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}

function hull(points: Point[]) {
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const edge = (sequence: Point[]) => {
    const path: Point[] = [];
    for (const point of sequence) {
      while (path.length >= 2 && cross(path[path.length - 2], path[path.length - 1], point) <= 0) path.pop();
      path.push(point);
    }
    return path.slice(0, -1);
  };
  return [...edge(ordered), ...edge(ordered.reverse())];
}

function tint(hex: string, scale: number) {
  const color = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 255) * scale));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

function lighting([a, b, c]: Vertex[]) {
  const u = b.map((value, i) => value - a[i]);
  const v = c.map((value, i) => value - a[i]);
  const nx = u[2] * v[1] - u[1] * v[2], ny = u[0] * v[2] - u[2] * v[0], nz = u[1] * v[0] - u[0] * v[1];
  const magnitude = Math.hypot(nx, ny, nz) || 1;
  return .64 + .39 * Math.max(0, (-.42 * nx + .71 * ny + .56 * nz) / magnitude);
}

function createArtwork(model: Model, image: HTMLImageElement | null, fit: StudioFit) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(900 * Math.min(1, model.artRatio));
  canvas.height = Math.round(900 / Math.max(1, model.artRatio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width, height } = canvas;
  if (image) {
    const box = fit === 'stretch' ? { x: 0, y: 0, width, height } : fitImageRect(image.naturalWidth, image.naturalHeight, width, height, fit);
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    return canvas;
  }
  if (model.print) {
    ctx.fillStyle = '#37395c';
    ctx.beginPath();
    ctx.ellipse(width * .50, height * .30, width * .10, height * .10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 ${Math.round(width * .10)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(model.title, width * .50, height * .56, width * .72);
    return canvas;
  }
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const palette = model.title === 'Butelka' || model.title === 'Kubek'
    ? ['#e8f6ee', '#b2d9c9', '#367766']
    : model.title.startsWith('Pudełko') ? ['#fff8e8', '#ebc674', '#b27335'] : ['#eff1f7', '#b3b8d3', '#676d96'];
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(1, palette[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette[2];
  ctx.beginPath();
  ctx.ellipse(width * .78, height * .77, width * .48, height * .38, -.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#202433';
  ctx.font = `600 ${Math.round(width * .093)}px sans-serif`;
  ctx.fillText(model.title, width * .10, height * .27, width * .8);
  ctx.font = `500 ${Math.round(width * .038)}px sans-serif`;
  ctx.fillText('PODGLĄD PROJEKTU', width * .10, height * .35);
  return canvas;
}

function lerp(a: Vertex, b: Vertex, t: number): Vertex {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// A small triangle mesh follows perspective and curved labels without scaling the whole image as one flat rectangle.
function mapArtwork(ctx: CanvasRenderingContext2D, art: HTMLCanvasElement, quad: Quad, project: (vertex: Vertex) => Point, from = 0, to = 1, drape = false) {
  const columns = from === 0 && to === 1 ? 12 : 1;
  const rows = columns === 1 ? 4 : 12;
  const grid = Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: columns + 1 }, (_, col) => {
    const u = col / columns, v = row / rows;
    const vertex = lerp(lerp(quad[0], quad[1], u), lerp(quad[3], quad[2], u), v);
    if (drape) vertex[2] += (.06 * Math.sin(u * Math.PI) + .018 * Math.sin(u * Math.PI * 6 + v * 3)) * Math.sin(v * Math.PI);
    return project(vertex);
  }));
  const stepX = (to - from) * art.width / columns, stepY = art.height / rows;
  function triangle(origin: Point, alongX: Point, alongY: Point, sx: number, sy: number, sign: number) {
    const center = { x: (origin.x + alongX.x + alongY.x) / 3, y: (origin.y + alongX.y + alongY.y) / 3 };
    const clip = [origin, alongX, alongY].map(point => {
      const dx = point.x - center.x, dy = point.y - center.y;
      const scale = 1 + 2.4 / Math.max(1, Math.hypot(dx, dy));
      return { x: center.x + dx * scale, y: center.y + dy * scale };
    });
    const a = (alongX.x - origin.x) / (stepX * sign), b = (alongX.y - origin.y) / (stepX * sign);
    const c = (alongY.x - origin.x) / (stepY * sign), d = (alongY.y - origin.y) / (stepY * sign);
    ctx.save();
    trace(ctx, clip);
    ctx.clip();
    ctx.transform(a, b, c, d, origin.x - a * sx - c * sy, origin.y - b * sx - d * sy);
    ctx.drawImage(art, 0, 0);
    ctx.restore();
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const sx = from * art.width + col * stepX, sy = row * stepY;
    triangle(grid[row][col], grid[row][col + 1], grid[row + 1][col], sx, sy, 1);
    triangle(grid[row + 1][col + 1], grid[row + 1][col], grid[row][col + 1], sx + stepX, sy + stepY, -1);
  }
}

export function drawStudioMockup(canvas: HTMLCanvasElement, id: string, image: HTMLImageElement | null, fit: StudioFit, viewId: StudioView, background: StudioBackground) {
  const model = MODELS[id]();
  const view = studioViewsFor(id).find(option => option.id === viewId) ?? STUDIO_VIEWS[0];
  const vertices = model.faces.flatMap(face => face.vertices);
  const floor = view.id === 'flat' ? Math.min(...vertices.map(vertex => vertex[2])) : 0;
  const pose = ([x, y, z]: Vertex): Vertex => view.id === 'flat' ? [x, z - floor, -y + .95] : [x, y, z];
  const camera = projectCamera(view.yaw, view.pitch);
  const projected = (vertex: Vertex) => {
    const [x, y, z] = camera(vertex);
    const scale = 7 / (7 - z);
    return { x: x * scale, y: -y * scale };
  };
  const oriented = vertices.map(pose);
  const points = oriented.map(projected);
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  const size = 1080;
  const scale = size * .69 / Math.max(maxX - minX, maxY - minY);
  const screen = (vertex: Vertex) => {
    const point = projected(vertex);
    return { x: size * .47 + (point.x - (minX + maxX) / 2) * scale, y: size * .46 + (point.y - (minY + maxY) / 2) * scale };
  };
  const project = (vertex: Vertex) => screen(pose(vertex));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nie udało się przygotować sceny 3D.');

  const backdrop = ctx.createRadialGradient(size * .38, size * .34, size * .1, size * .55, size * .49, size * .78);
  const colors = background === 'dark' ? ['#404753', '#191d24'] : background === 'warm' ? ['#fffaf1', '#ded1bd'] : ['#ffffff', '#e2e5e9'];
  backdrop.addColorStop(0, colors[0]);
  backdrop.addColorStop(1, colors[1]);
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, size, size);

  const shadow = hull(oriented.map(([x, y, z]) => screen([x + y * .53, 0, z - y * .26])));
  ctx.save();
  ctx.filter = 'blur(17px)';
  ctx.fillStyle = 'rgba(24,26,30,0.25)';
  trace(ctx, shadow);
  ctx.fill();
  ctx.filter = 'blur(8px)';
  const contact = screen([0, 0, 0]);
  ctx.beginPath();
  ctx.ellipse(contact.x, contact.y, Math.max(18, (maxX - minX) * scale * .31), Math.max(7, scale * .05), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,21,22,0.30)';
  ctx.fill();
  ctx.restore();

  const art = createArtwork(model, image, fit);
  const faces = model.faces.map(face => {
    const points = face.vertices.map(project);
    const area = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    const depth = face.vertices.reduce((sum, vertex) => sum + camera(pose(vertex))[2], 0) / face.vertices.length;
    return { ...face, points, area, depth };
  }).filter(face => face.area > .03).sort((a, b) => a.depth - b.depth);

  for (const face of faces) {
    const light = face.fabric ? .93 : lighting(face.vertices.map(pose));
    trace(ctx, face.points);
    if (!(model.print && face.artwork)) {
      if (face.fabric) {
        const left = Math.min(...face.points.map(point => point.x));
        const right = Math.max(...face.points.map(point => point.x));
        const folds = ctx.createLinearGradient(left, 0, right, 0);
        for (const [position, brightness] of [[0, .85], [.16, .97], [.32, .88], [.47, 1.08], [.62, 1.02], [.77, .91], [.88, .97], [1, .77]]) {
          folds.addColorStop(position, tint(face.color, light * brightness));
        }
        ctx.fillStyle = folds;
      } else {
        ctx.fillStyle = tint(face.color, light);
      }
      ctx.fill();
    }
    if (!face.artwork) continue;
    ctx.save();
    ctx.clip();
    mapArtwork(ctx, art, face.artwork.quad, project, face.artwork.from, face.artwork.to, face.artwork.drape);
    if (!model.print) {
      ctx.globalAlpha = (1 - Math.min(1, light)) * .76;
      ctx.fillStyle = '#080b12';
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
  }
  for (const seam of model.seams ?? []) {
    const points = seam.map(project);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(82,72,56,.24)';
    ctx.stroke();
  }
}
