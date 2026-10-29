export interface MockupTemplate {
  id: string;
  label: string;
  emoji: string;
  category: string;
  canvasW: number;
  canvasH: number;
  bgColor: string;
  imageArea: { x: number; y: number; w: number; h: number };
  // For perspective mockups: 4 corner points where image maps to
  perspective?: { tl: [number, number]; tr: [number, number]; br: [number, number]; bl: [number, number] };
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  drawOverlay?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

// Helper: draw gradient rectangle
function gradientRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string, vertical = true) {
  const g = vertical ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// Helper: draw shadow under shape
function drawShadow(ctx: CanvasRenderingContext2D, fn: () => void, blur = 30, color = 'rgba(0,0,0,0.3)', offsetY = 15) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  ctx.shadowOffsetX = 0;
  fn();
  ctx.restore();
}

export const MOCKUP_CATEGORIES = ['📱 Elektronika', '📦 Opakowania', '🎨 Print', '👕 Merch'];

export const MOCKUPS: MockupTemplate[] = [
  // =================== ELEKTRONIKA ===================
  {
    id: 'iphone', label: 'iPhone', emoji: '📱', category: '📱 Elektronika',
    canvasW: 500, canvasH: 960, bgColor: '#f0f2f5',
    imageArea: { x: 28, y: 62, w: 444, h: 836 },
    draw: (ctx, w, h) => {
      // Phone shadow
      drawShadow(ctx, () => {
        ctx.fillStyle = '#1c1c1e';
        ctx.beginPath();
        (ctx as any).roundRect(14, 14, 472, 932, 52);
        ctx.fill();
      }, 40, 'rgba(0,0,0,0.35)', 20);
      // Phone body
      const bodyG = ctx.createLinearGradient(0, 0, w, h);
      bodyG.addColorStop(0, '#2c2c2e');
      bodyG.addColorStop(1, '#1c1c1e');
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      (ctx as any).roundRect(14, 14, 472, 932, 52);
      ctx.fill();
      // Screen area (black)
      ctx.fillStyle = '#000';
      ctx.beginPath();
      (ctx as any).roundRect(28, 62, 444, 836, 4);
      ctx.fill();
      // Side buttons
      ctx.fillStyle = '#3a3a3c';
      ctx.fillRect(0, 200, 14, 40);
      ctx.fillRect(0, 280, 14, 70);
      ctx.fillRect(0, 360, 14, 70);
      ctx.fillRect(486, 300, 14, 80);
      // Edge highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(14, 14, 472, 932, 52);
      ctx.stroke();
    },
    drawOverlay: (ctx, w, h) => {
      // Dynamic Island
      ctx.fillStyle = '#000';
      ctx.beginPath();
      (ctx as any).roundRect(w / 2 - 62, 24, 124, 34, 17);
      ctx.fill();
      // Screen reflection
      const refl = ctx.createLinearGradient(0, 0, w, h);
      refl.addColorStop(0, 'rgba(255,255,255,0.06)');
      refl.addColorStop(0.5, 'rgba(255,255,255,0)');
      refl.addColorStop(1, 'rgba(255,255,255,0.03)');
      ctx.fillStyle = refl;
      ctx.fillRect(28, 62, 444, 836);
    },
  },
  {
    id: 'macbook', label: 'MacBook', emoji: '💻', category: '📱 Elektronika',
    canvasW: 1200, canvasH: 780, bgColor: '#e8eaed',
    imageArea: { x: 158, y: 42, w: 884, h: 553 },
    draw: (ctx, w, h) => {
      // Shadow
      drawShadow(ctx, () => {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        (ctx as any).roundRect(40, 700, w - 80, 30, 6);
        ctx.fill();
      }, 50, 'rgba(0,0,0,0.2)', 10);
      // Screen lid
      const lidG = ctx.createLinearGradient(0, 0, 0, 620);
      lidG.addColorStop(0, '#e1e1e1');
      lidG.addColorStop(1, '#c8c8c8');
      ctx.fillStyle = lidG;
      ctx.beginPath();
      (ctx as any).roundRect(120, 18, 960, 604, [16, 16, 0, 0]);
      ctx.fill();
      // Bezel
      ctx.fillStyle = '#1d1d1f';
      ctx.beginPath();
      (ctx as any).roundRect(130, 26, 940, 590, [12, 12, 0, 0]);
      ctx.fill();
      // Screen
      ctx.fillStyle = '#000';
      ctx.fillRect(158, 42, 884, 553);
      // Camera
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(w / 2, 34, 4, 0, Math.PI * 2);
      ctx.fill();
      // Hinge
      const hingeG = ctx.createLinearGradient(0, 616, 0, 640);
      hingeG.addColorStop(0, '#b0b0b0');
      hingeG.addColorStop(0.5, '#d8d8d8');
      hingeG.addColorStop(1, '#a0a0a0');
      ctx.fillStyle = hingeG;
      ctx.fillRect(100, 622, w - 200, 12);
      // Bottom base
      const baseG = ctx.createLinearGradient(0, 634, 0, 700);
      baseG.addColorStop(0, '#d4d4d4');
      baseG.addColorStop(1, '#bbb');
      ctx.fillStyle = baseG;
      ctx.beginPath();
      ctx.moveTo(60, 634);
      ctx.lineTo(w - 60, 634);
      ctx.lineTo(w - 40, 700);
      ctx.quadraticCurveTo(w - 40, 715, w - 55, 715);
      ctx.lineTo(55, 715);
      ctx.quadraticCurveTo(40, 715, 40, 700);
      ctx.closePath();
      ctx.fill();
      // Trackpad
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(w / 2 - 120, 655, 240, 50, 8);
      ctx.stroke();
      // Notch
      ctx.fillStyle = '#1d1d1f';
      ctx.beginPath();
      (ctx as any).roundRect(w / 2 - 80, 26, 160, 18, [0, 0, 8, 8]);
      ctx.fill();
    },
  },
  {
    id: 'imac', label: 'iMac', emoji: '🖥️', category: '📱 Elektronika',
    canvasW: 1100, canvasH: 900, bgColor: '#f0f2f5',
    imageArea: { x: 72, y: 38, w: 956, h: 540 },
    draw: (ctx, w, h) => {
      // Shadow
      drawShadow(ctx, () => {
        ctx.fillStyle = '#999';
        ctx.beginPath();
        (ctx as any).roundRect(300, 830, 500, 20, 10);
        ctx.fill();
      }, 40, 'rgba(0,0,0,0.15)', 15);
      // Monitor body
      const monG = ctx.createLinearGradient(0, 0, 0, 620);
      monG.addColorStop(0, '#e8e8e8');
      monG.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = monG;
      ctx.beginPath();
      (ctx as any).roundRect(30, 10, 1040, 610, [20, 20, 0, 0]);
      ctx.fill();
      // Screen bezel
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      (ctx as any).roundRect(45, 22, 1010, 580, [14, 14, 0, 0]);
      ctx.fill();
      // Screen
      ctx.fillStyle = '#000';
      ctx.fillRect(72, 38, 956, 540);
      // Chin
      const chinG = ctx.createLinearGradient(0, 602, 0, 650);
      chinG.addColorStop(0, '#e0e0e0');
      chinG.addColorStop(1, '#ccc');
      ctx.fillStyle = chinG;
      ctx.beginPath();
      (ctx as any).roundRect(30, 620, 1040, 45, [0, 0, 12, 12]);
      ctx.fill();
      // Apple logo
      ctx.fillStyle = '#bbb';
      ctx.beginPath();
      ctx.arc(w / 2, 642, 8, 0, Math.PI * 2);
      ctx.fill();
      // Stand neck
      const neckG = ctx.createLinearGradient(w / 2 - 60, 0, w / 2 + 60, 0);
      neckG.addColorStop(0, '#c0c0c0');
      neckG.addColorStop(0.5, '#d8d8d8');
      neckG.addColorStop(1, '#b8b8b8');
      ctx.fillStyle = neckG;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 50, 665);
      ctx.lineTo(w / 2 + 50, 665);
      ctx.lineTo(w / 2 + 70, 810);
      ctx.lineTo(w / 2 - 70, 810);
      ctx.closePath();
      ctx.fill();
      // Stand base
      const baseG = ctx.createLinearGradient(0, 810, 0, 845);
      baseG.addColorStop(0, '#d0d0d0');
      baseG.addColorStop(1, '#b0b0b0');
      ctx.fillStyle = baseG;
      ctx.beginPath();
      (ctx as any).roundRect(w / 2 - 200, 810, 400, 30, [0, 0, 40, 40]);
      ctx.fill();
    },
  },
  {
    id: 'tablet', label: 'iPad', emoji: '📱', category: '📱 Elektronika',
    canvasW: 700, canvasH: 960, bgColor: '#f0f2f5',
    imageArea: { x: 38, y: 50, w: 624, h: 860 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        (ctx as any).roundRect(16, 16, 668, 928, 28);
        ctx.fill();
      }, 35, 'rgba(0,0,0,0.3)', 18);
      const bodyG = ctx.createLinearGradient(0, 0, w, 0);
      bodyG.addColorStop(0, '#303030');
      bodyG.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      (ctx as any).roundRect(16, 16, 668, 928, 28);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      (ctx as any).roundRect(38, 50, 624, 860, 4);
      ctx.fill();
      // Camera
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(w / 2, 33, 5, 0, Math.PI * 2);
      ctx.fill();
      // Edge shine
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(16, 16, 668, 928, 28);
      ctx.stroke();
    },
  },

  // =================== OPAKOWANIA ===================
  {
    id: 'softbox', label: 'Software Box', emoji: '📦', category: '📦 Opakowania',
    canvasW: 800, canvasH: 900, bgColor: '#e8eaed',
    imageArea: { x: 100, y: 60, w: 420, h: 600 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(80, 680);
        ctx.lineTo(540, 680);
        ctx.lineTo(700, 620);
        ctx.lineTo(700, 60);
        ctx.closePath();
        ctx.fill();
      }, 50, 'rgba(0,0,0,0.25)', 20);
      // Front face
      const frontG = ctx.createLinearGradient(80, 0, 540, 0);
      frontG.addColorStop(0, '#f5f5f5');
      frontG.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = frontG;
      ctx.fillRect(80, 40, 460, 640);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(80, 40, 460, 640);
      // Screen area on front
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(100, 60, 420, 600);
      // Spine (left side - 3D)
      const spineG = ctx.createLinearGradient(20, 0, 80, 0);
      spineG.addColorStop(0, '#d0d0d0');
      spineG.addColorStop(0.3, '#e8e8e8');
      spineG.addColorStop(1, '#ddd');
      ctx.fillStyle = spineG;
      ctx.beginPath();
      ctx.moveTo(80, 40);
      ctx.lineTo(20, 80);
      ctx.lineTo(20, 720);
      ctx.lineTo(80, 680);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Top face (3D)
      const topG = ctx.createLinearGradient(0, 0, 0, 80);
      topG.addColorStop(0, '#f0f0f0');
      topG.addColorStop(1, '#ddd');
      ctx.fillStyle = topG;
      ctx.beginPath();
      ctx.moveTo(80, 40);
      ctx.lineTo(20, 80);
      ctx.lineTo(480, 80);
      ctx.lineTo(540, 40);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.stroke();
      // Spine text area
      ctx.save();
      ctx.translate(50, 400);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#999';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOUR PRODUCT', 0, 4);
      ctx.restore();
    },
  },
  {
    id: 'productbox', label: 'Pudełko 3D', emoji: '🎁', category: '📦 Opakowania',
    canvasW: 900, canvasH: 750, bgColor: '#f0f2f5',
    imageArea: { x: 110, y: 85, w: 430, h: 480 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(90, 580);
        ctx.lineTo(560, 580);
        ctx.lineTo(750, 480);
        ctx.lineTo(750, 30);
        ctx.closePath();
        ctx.fill();
      }, 45, 'rgba(0,0,0,0.2)', 15);
      // Front face
      const fG = ctx.createLinearGradient(90, 0, 560, 0);
      fG.addColorStop(0, '#ffffff');
      fG.addColorStop(1, '#f0f0f0');
      ctx.fillStyle = fG;
      ctx.fillRect(90, 65, 470, 515);
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 1;
      ctx.strokeRect(90, 65, 470, 515);
      // Image area bg
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(110, 85, 430, 480);
      // Right face
      const rG = ctx.createLinearGradient(560, 0, 750, 0);
      rG.addColorStop(0, '#e0e0e0');
      rG.addColorStop(0.3, '#d8d8d8');
      rG.addColorStop(1, '#c8c8c8');
      ctx.fillStyle = rG;
      ctx.beginPath();
      ctx.moveTo(560, 65);
      ctx.lineTo(750, 0);
      ctx.lineTo(750, 515);
      ctx.lineTo(560, 580);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#bbb';
      ctx.stroke();
      // Top face
      const tG = ctx.createLinearGradient(0, 0, 0, 65);
      tG.addColorStop(0, '#f8f8f8');
      tG.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = tG;
      ctx.beginPath();
      ctx.moveTo(90, 65);
      ctx.lineTo(280, 0);
      ctx.lineTo(750, 0);
      ctx.lineTo(560, 65);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.stroke();
      // Edge highlights
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(90, 65);
      ctx.lineTo(90, 580);
      ctx.stroke();
    },
  },
  {
    id: 'shoppingbag', label: 'Torba premium', emoji: '🛍️', category: '📦 Opakowania',
    canvasW: 700, canvasH: 950, bgColor: '#f0f2f5',
    imageArea: { x: 110, y: 260, w: 480, h: 380 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(70, 200);
        ctx.lineTo(70, 870);
        ctx.quadraticCurveTo(70, 900, 100, 900);
        ctx.lineTo(600, 900);
        ctx.quadraticCurveTo(630, 900, 630, 870);
        ctx.lineTo(630, 200);
        ctx.closePath();
        ctx.fill();
      }, 40, 'rgba(0,0,0,0.2)', 15);
      // Bag body
      const bagG = ctx.createLinearGradient(70, 0, 630, 0);
      bagG.addColorStop(0, '#f7f5f0');
      bagG.addColorStop(0.5, '#f2efe8');
      bagG.addColorStop(1, '#ebe7de');
      ctx.fillStyle = bagG;
      ctx.beginPath();
      ctx.moveTo(70, 200);
      ctx.lineTo(70, 870);
      ctx.quadraticCurveTo(70, 900, 100, 900);
      ctx.lineTo(600, 900);
      ctx.quadraticCurveTo(630, 900, 630, 870);
      ctx.lineTo(630, 200);
      ctx.closePath();
      ctx.fill();
      // Fold crease
      const foldG = ctx.createLinearGradient(0, 200, 0, 240);
      foldG.addColorStop(0, '#e0dcd2');
      foldG.addColorStop(1, '#ece8de');
      ctx.fillStyle = foldG;
      ctx.fillRect(70, 200, 560, 35);
      // Bottom fold
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(70, 830, 560, 70);
      // Handles with rope texture
      ctx.strokeStyle = '#8a7e6e';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(220, 200);
      ctx.bezierCurveTo(220, 120, 240, 70, 300, 70);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(480, 200);
      ctx.bezierCurveTo(480, 120, 460, 70, 400, 70);
      ctx.stroke();
      // Handle shadows on bag
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(210, 200, 16, 50);
      ctx.fillRect(470, 200, 16, 50);
      // Side creases
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(150, 240);
      ctx.lineTo(150, 890);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(550, 240);
      ctx.lineTo(550, 890);
      ctx.stroke();
    },
  },
  {
    id: 'bottle', label: 'Butelka', emoji: '🍶', category: '📦 Opakowania',
    canvasW: 500, canvasH: 1000, bgColor: '#f0f2f5',
    imageArea: { x: 115, y: 350, w: 270, h: 320 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(190, 100);
        ctx.lineTo(190, 200);
        ctx.quadraticCurveTo(100, 280, 100, 350);
        ctx.lineTo(100, 880);
        ctx.quadraticCurveTo(100, 920, 140, 920);
        ctx.lineTo(360, 920);
        ctx.quadraticCurveTo(400, 920, 400, 880);
        ctx.lineTo(400, 350);
        ctx.quadraticCurveTo(400, 280, 310, 200);
        ctx.lineTo(310, 100);
        ctx.closePath();
        ctx.fill();
      }, 30, 'rgba(0,0,0,0.15)', 12);
      // Bottle body
      const bottleG = ctx.createLinearGradient(100, 0, 400, 0);
      bottleG.addColorStop(0, '#e8e8e8');
      bottleG.addColorStop(0.3, '#f5f5f5');
      bottleG.addColorStop(0.7, '#f0f0f0');
      bottleG.addColorStop(1, '#d8d8d8');
      ctx.fillStyle = bottleG;
      // Neck
      ctx.beginPath();
      ctx.moveTo(210, 60);
      ctx.lineTo(210, 200);
      ctx.quadraticCurveTo(100, 280, 100, 350);
      ctx.lineTo(100, 880);
      ctx.quadraticCurveTo(100, 920, 140, 920);
      ctx.lineTo(360, 920);
      ctx.quadraticCurveTo(400, 920, 400, 880);
      ctx.lineTo(400, 350);
      ctx.quadraticCurveTo(400, 280, 290, 200);
      ctx.lineTo(290, 60);
      ctx.closePath();
      ctx.fill();
      // Cap
      const capG = ctx.createLinearGradient(200, 0, 300, 0);
      capG.addColorStop(0, '#2a2a2a');
      capG.addColorStop(0.5, '#444');
      capG.addColorStop(1, '#222');
      ctx.fillStyle = capG;
      ctx.beginPath();
      (ctx as any).roundRect(200, 20, 100, 50, [8, 8, 0, 0]);
      ctx.fill();
      // Label area
      ctx.fillStyle = '#fff';
      ctx.fillRect(115, 350, 270, 320);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(115, 350, 270, 320);
      // Bottle shine
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(150, 200, 30, 700);
      // Neck ring
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(205, 70);
      ctx.lineTo(295, 70);
      ctx.stroke();
    },
  },

  // =================== PRINT ===================
  {
    id: 'poster', label: 'Plakat w ramie', emoji: '🖼️', category: '🎨 Print',
    canvasW: 700, canvasH: 950, bgColor: '#f5f3ee',
    imageArea: { x: 90, y: 90, w: 520, h: 710 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#999';
        ctx.fillRect(50, 50, 600, 800);
      }, 50, 'rgba(0,0,0,0.25)', 20);
      // Frame outer
      const frameG = ctx.createLinearGradient(0, 0, w, h);
      frameG.addColorStop(0, '#2a2520');
      frameG.addColorStop(0.5, '#3d3530');
      frameG.addColorStop(1, '#252018');
      ctx.fillStyle = frameG;
      ctx.fillRect(50, 50, 600, 800);
      // Mat
      ctx.fillStyle = '#faf8f4';
      ctx.fillRect(70, 70, 560, 760);
      // Image area
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(90, 90, 520, 710);
      // Frame inner bevel
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(51, 51, 598, 798);
      // Frame outer shadow line
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(70, 70, 560, 760);
    },
  },
  {
    id: 'businesscard', label: 'Wizytówka', emoji: '💳', category: '🎨 Print',
    canvasW: 1000, canvasH: 650, bgColor: '#e8eaed',
    imageArea: { x: 55, y: 55, w: 540, h: 310 },
    draw: (ctx, w, h) => {
      // Back card (angled)
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(0.08);
      drawShadow(ctx, () => {
        ctx.fillStyle = '#f0f0f0';
        ctx.beginPath();
        (ctx as any).roundRect(-330, -180, 650, 370, 12);
        ctx.fill();
      }, 25, 'rgba(0,0,0,0.12)', 8);
      ctx.fillStyle = '#f8f8f8';
      ctx.beginPath();
      (ctx as any).roundRect(-330, -180, 650, 370, 12);
      ctx.fill();
      ctx.restore();
      // Front card
      drawShadow(ctx, () => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        (ctx as any).roundRect(40, 40, 570, 340, 14);
        ctx.fill();
      }, 35, 'rgba(0,0,0,0.18)', 12);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      (ctx as any).roundRect(40, 40, 570, 340, 14);
      ctx.fill();
      // Image area
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(55, 55, 540, 310);
      // Card edge
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(40, 40, 570, 340, 14);
      ctx.stroke();
    },
  },
  {
    id: 'book', label: 'Książka', emoji: '📖', category: '🎨 Print',
    canvasW: 650, canvasH: 900, bgColor: '#f0f2f5',
    imageArea: { x: 85, y: 35, w: 450, h: 640 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#888';
        ctx.fillRect(60, 25, 490, 680);
      }, 40, 'rgba(0,0,0,0.25)', 18);
      // Pages (visible from bottom and right)
      ctx.fillStyle = '#f5f0e8';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(62 + i, 700 - i, 486 - i * 2, 4);
      }
      ctx.fillStyle = '#f0ece4';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(552 + i, 30 + i, 4, 668 - i * 2);
      }
      // Spine
      const spineG = ctx.createLinearGradient(30, 0, 75, 0);
      spineG.addColorStop(0, '#555');
      spineG.addColorStop(0.3, '#777');
      spineG.addColorStop(0.7, '#666');
      spineG.addColorStop(1, '#555');
      ctx.fillStyle = spineG;
      ctx.fillRect(30, 20, 45, 690);
      // Cover
      const coverG = ctx.createLinearGradient(75, 0, 560, 0);
      coverG.addColorStop(0, '#e0e0e0');
      coverG.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = coverG;
      ctx.fillRect(75, 20, 480, 690);
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.strokeRect(75, 20, 480, 690);
      // Image area
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(85, 35, 450, 640);
      // Spine highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(30, 20, 8, 690);
      // Cover inner edge shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(75, 20, 6, 690);
    },
  },

  // =================== MERCH ===================
  {
    id: 'tshirt', label: 'Koszulka', emoji: '👕', category: '👕 Merch',
    canvasW: 800, canvasH: 900, bgColor: '#f0f2f5',
    imageArea: { x: 260, y: 260, w: 280, h: 280 },
    draw: (ctx, w, h) => {
      // T-shirt shape
      const shirtG = ctx.createLinearGradient(0, 100, 0, 800);
      shirtG.addColorStop(0, '#f5f5f5');
      shirtG.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = shirtG;
      ctx.beginPath();
      ctx.moveTo(250, 100);
      ctx.quadraticCurveTo(330, 70, 400, 80);
      ctx.quadraticCurveTo(470, 70, 550, 100);
      ctx.lineTo(680, 180);
      ctx.lineTo(730, 350);
      ctx.lineTo(640, 360);
      ctx.lineTo(610, 260);
      ctx.lineTo(610, 800);
      ctx.lineTo(190, 800);
      ctx.lineTo(190, 260);
      ctx.lineTo(160, 360);
      ctx.lineTo(70, 350);
      ctx.lineTo(120, 180);
      ctx.closePath();
      ctx.fill();
      // Outline
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Collar
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(310, 95);
      ctx.quadraticCurveTo(400, 130, 490, 95);
      ctx.stroke();
      // Seam lines
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(190, 260);
      ctx.lineTo(610, 260);
      ctx.stroke();
      // Image area
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      ctx.fillRect(260, 260, 280, 280);
    },
  },
  {
    id: 'mug', label: 'Kubek', emoji: '☕', category: '👕 Merch',
    canvasW: 800, canvasH: 700, bgColor: '#f0f2f5',
    imageArea: { x: 130, y: 170, w: 360, h: 260 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        (ctx as any).roundRect(90, 110, 440, 440, [0, 0, 35, 35]);
        ctx.fill();
      }, 35, 'rgba(0,0,0,0.18)', 12);
      // Mug body
      const mugG = ctx.createLinearGradient(90, 0, 530, 0);
      mugG.addColorStop(0, '#eee');
      mugG.addColorStop(0.3, '#fafafa');
      mugG.addColorStop(0.7, '#f2f2f2');
      mugG.addColorStop(1, '#e0e0e0');
      ctx.fillStyle = mugG;
      ctx.beginPath();
      (ctx as any).roundRect(90, 110, 440, 440, [0, 0, 35, 35]);
      ctx.fill();
      // Image area bg
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(130, 170, 360, 260);
      // Handle
      const handleG = ctx.createLinearGradient(530, 200, 650, 200);
      handleG.addColorStop(0, '#ddd');
      handleG.addColorStop(0.5, '#eee');
      handleG.addColorStop(1, '#ccc');
      ctx.strokeStyle = handleG;
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(560, 330, 80, -1.2, 1.2);
      ctx.stroke();
      // Inner handle
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(560, 330, 80, -1.2, 1.2);
      ctx.stroke();
      // Rim
      const rimG = ctx.createLinearGradient(0, 100, 0, 130);
      rimG.addColorStop(0, '#e0e0e0');
      rimG.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = rimG;
      ctx.beginPath();
      (ctx as any).roundRect(88, 100, 444, 22, [6, 6, 0, 0]);
      ctx.fill();
      // Rim shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(90, 100, 440, 5);
      // Body shine
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(120, 120, 30, 420);
    },
  },
  {
    id: 'cap', label: 'Czapka', emoji: '🧢', category: '👕 Merch',
    canvasW: 800, canvasH: 600, bgColor: '#f0f2f5',
    imageArea: { x: 235, y: 130, w: 270, h: 160 },
    draw: (ctx, w, h) => {
      drawShadow(ctx, () => {
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(160, 350);
        ctx.quadraticCurveTo(160, 80, 400, 60);
        ctx.quadraticCurveTo(640, 80, 640, 350);
        ctx.closePath();
        ctx.fill();
      }, 30, 'rgba(0,0,0,0.15)', 10);
      // Cap dome
      const capG = ctx.createLinearGradient(0, 60, 0, 350);
      capG.addColorStop(0, '#d8d8d8');
      capG.addColorStop(1, '#c0c0c0');
      ctx.fillStyle = capG;
      ctx.beginPath();
      ctx.moveTo(160, 350);
      ctx.quadraticCurveTo(160, 80, 400, 60);
      ctx.quadraticCurveTo(640, 80, 640, 350);
      ctx.closePath();
      ctx.fill();
      // Panel lines
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1.5;
      for (const dx of [-120, 0, 120]) {
        ctx.beginPath();
        ctx.moveTo(400 + dx, 60 + Math.abs(dx) * 0.1);
        ctx.quadraticCurveTo(400 + dx, 200, 400 + dx * 0.8, 350);
        ctx.stroke();
      }
      // Brim
      const brimG = ctx.createLinearGradient(0, 340, 0, 430);
      brimG.addColorStop(0, '#b8b8b8');
      brimG.addColorStop(1, '#a0a0a0');
      ctx.fillStyle = brimG;
      ctx.beginPath();
      ctx.moveTo(140, 350);
      ctx.quadraticCurveTo(100, 370, 80, 420);
      ctx.quadraticCurveTo(300, 470, 720, 410);
      ctx.quadraticCurveTo(680, 365, 640, 350);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Brim edge stitching
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(100, 410);
      ctx.quadraticCurveTo(300, 455, 710, 405);
      ctx.stroke();
      ctx.setLineDash([]);
      // Button on top
      ctx.fillStyle = '#b0b0b0';
      ctx.beginPath();
      ctx.arc(400, 58, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Image area indicator
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(235, 130, 270, 160);
    },
  },
  {
    id: 'hoodie', label: 'Bluza', emoji: '🧥', category: '👕 Merch',
    canvasW: 800, canvasH: 950, bgColor: '#f0f2f5',
    imageArea: { x: 255, y: 300, w: 290, h: 290 },
    draw: (ctx, w, h) => {
      const bodyG = ctx.createLinearGradient(0, 100, 0, 900);
      bodyG.addColorStop(0, '#4a4a4a');
      bodyG.addColorStop(1, '#3a3a3a');
      ctx.fillStyle = bodyG;
      // Body
      ctx.beginPath();
      ctx.moveTo(250, 130);
      ctx.quadraticCurveTo(330, 100, 400, 110);
      ctx.quadraticCurveTo(470, 100, 550, 130);
      // Right sleeve
      ctx.lineTo(680, 210);
      ctx.lineTo(720, 400);
      ctx.lineTo(630, 410);
      ctx.lineTo(610, 280);
      // Body right
      ctx.lineTo(610, 850);
      ctx.lineTo(190, 850);
      // Body left
      ctx.lineTo(190, 280);
      ctx.lineTo(170, 410);
      ctx.lineTo(80, 400);
      ctx.lineTo(120, 210);
      ctx.closePath();
      ctx.fill();
      // Hood
      const hoodG = ctx.createLinearGradient(0, 0, 0, 140);
      hoodG.addColorStop(0, '#555');
      hoodG.addColorStop(1, '#484848');
      ctx.fillStyle = hoodG;
      ctx.beginPath();
      ctx.moveTo(250, 130);
      ctx.quadraticCurveTo(220, 40, 300, 10);
      ctx.quadraticCurveTo(400, -10, 500, 10);
      ctx.quadraticCurveTo(580, 40, 550, 130);
      ctx.quadraticCurveTo(470, 150, 400, 160);
      ctx.quadraticCurveTo(330, 150, 250, 130);
      ctx.closePath();
      ctx.fill();
      // Kangaroo pocket
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      (ctx as any).roundRect(240, 620, 320, 130, 8);
      ctx.stroke();
      // Drawstrings
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(370, 160);
      ctx.lineTo(360, 300);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(430, 160);
      ctx.lineTo(440, 300);
      ctx.stroke();
      // Center line
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(400, 160);
      ctx.lineTo(400, 850);
      ctx.stroke();
      // Image area
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(255, 300, 290, 290);
    },
  },
];
