export const CAROUSEL_DECORATIONS = [
  { id: 'pushpin', name: 'Pinezka 3D', group: 'Pinezki i biuro', size: 12, rotation: -18 },
  { id: 'pin-round', name: 'Pinezka okrągła', group: 'Pinezki i biuro', size: 10, rotation: 0 },
  { id: 'map-pin', name: 'Znacznik miejsca', group: 'Pinezki i biuro', size: 14, rotation: 0 },
  { id: 'paperclip', name: 'Spinacz', group: 'Pinezki i biuro', size: 14, rotation: -18 },
  { id: 'binder-clip', name: 'Klip biurowy', group: 'Pinezki i biuro', size: 16, rotation: 8 },
  { id: 'staple', name: 'Zszywka', group: 'Pinezki i biuro', size: 12, rotation: -12 },
  { id: 'tape', name: 'Taśma papierowa', group: 'Taśmy', size: 26, rotation: -12 },
  { id: 'tape-striped', name: 'Taśma w paski', group: 'Taśmy', size: 26, rotation: 12 },
  { id: 'tape-dots', name: 'Taśma w kropki', group: 'Taśmy', size: 26, rotation: -8 },
  { id: 'tape-cross', name: 'Taśmy na krzyż', group: 'Taśmy', size: 22, rotation: 0 },
  { id: 'tape-corner', name: 'Taśma narożna', group: 'Taśmy', size: 22, rotation: 0 },
  { id: 'tape-zigzag', name: 'Taśma zygzak', group: 'Taśmy', size: 26, rotation: 8 },
  { id: 'sticky-note', name: 'Karteczka samoprzylepna', group: 'Papier', size: 34, rotation: -6 },
  { id: 'torn-note', name: 'Wyrwana kartka', group: 'Papier', size: 34, rotation: 5 },
  { id: 'grid-note', name: 'Kartka w kratkę', group: 'Papier', size: 34, rotation: -4 },
  { id: 'note-fold', name: 'Kartka z zagięciem', group: 'Papier', size: 32, rotation: 6 },
  { id: 'ticket', name: 'Bilet', group: 'Papier', size: 28, rotation: -8 },
  { id: 'photo-frame', name: 'Ramka polaroid', group: 'Papier', size: 36, rotation: -7 },
  { id: 'speech-bubble', name: 'Dymek rozmowy', group: 'Odręczne', size: 24, rotation: 0 },
  { id: 'quote-mark', name: 'Cudzysłów', group: 'Odręczne', size: 18, rotation: -8 },
  { id: 'doodle-circle', name: 'Odręczne kółko', group: 'Odręczne', size: 28, rotation: -8 },
  { id: 'doodle-underline', name: 'Odręczne podkreślenie', group: 'Odręczne', size: 32, rotation: -4 },
  { id: 'laurel', name: 'Gałązka', group: 'Odręczne', size: 20, rotation: 12 },
  { id: 'confetti', name: 'Konfetti', group: 'Odręczne', size: 24, rotation: 0 },
] as const;
const tint = (color: string, amount: number) => '#' + [1, 3, 5].map(start => { const value = parseInt(color.slice(start, start + 2), 16); return Math.round(amount >= 0 ? value + (255 - value) * amount : value * (1 + amount)).toString(16).padStart(2, '0'); }).join('');
export function drawCarouselDecoration(ctx: CanvasRenderingContext2D, kind: string, color: string) {
  if (!CAROUSEL_DECORATIONS.some(item => item.id === kind)) return false;
  const paper = tint(color, .78), dark = tint(color, -.35);
  const circle = (x: number, y: number, radius: number, fill: string) => { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  const line = (points: number[][], stroke: string, width: number) => { ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); };
  const rounded = (x: number, y: number, w: number, h: number, radius: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); };
  if (kind === 'pushpin' || kind === 'pin-round') {
    line([[0, -5], [0, 85]], '#64748b', 8);
    if (kind === 'pushpin') { ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-22, -37); ctx.lineTo(22, -37); ctx.lineTo(34, 16); ctx.lineTo(-34, 16); ctx.closePath(); ctx.fill(); rounded(-43, 4, 86, 23, 10, color); }
    const gradient = ctx.createRadialGradient(-14, -52, 1, 0, -32, 39); gradient.addColorStop(0, tint(color, .7)); gradient.addColorStop(.4, color); gradient.addColorStop(1, dark);
    ctx.beginPath(); ctx.arc(0, kind === 'pushpin' ? -40 : -18, kind === 'pushpin' ? 35 : 51, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
  } else if (kind === 'map-pin') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 90); ctx.bezierCurveTo(-105, -20, -62, -88, 0, -88); ctx.bezierCurveTo(62, -88, 105, -20, 0, 90); ctx.fill(); circle(0, -28, 25, '#ffffff');
  } else if (kind === 'paperclip') {
    ctx.strokeStyle = dark; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(28, 44); ctx.lineTo(28, -48); ctx.bezierCurveTo(28, -100, -48, -100, -48, -48); ctx.lineTo(-48, 47); ctx.bezierCurveTo(-48, 99, 50, 99, 50, 47); ctx.lineTo(50, -31); ctx.stroke(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = tint(color, .35); ctx.lineWidth = 6; ctx.stroke();
  } else if (kind === 'binder-clip') {
    rounded(-65, -15, 130, 95, 12, color); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 8;
    for (const x of [-29, 29]) { ctx.beginPath(); ctx.moveTo(x - 15, 0); ctx.lineTo(x - 22, -55); ctx.quadraticCurveTo(x, -92, x + 22, -55); ctx.lineTo(x + 15, 0); ctx.stroke(); }
    rounded(-65, -17, 130, 17, 5, dark);
  } else if (kind === 'staple') {
    line([[-76, 27], [-76, -8], [76, -8], [76, 27]], '#64748b', 13); ctx.shadowColor = 'transparent'; line([[-76, 23], [-76, -10], [76, -10], [76, 23]], '#cbd5e1', 6);
  } else if (kind.startsWith('tape')) {
    const strip = (angle: number) => { ctx.save(); ctx.rotate(angle); ctx.globalAlpha *= .83; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-95, -32); ctx.lineTo(95, -32); for (let i = 0; i <= 6; i++) ctx.lineTo(95 + (i % 2 ? -8 : 0), -32 + i * 64 / 6); ctx.lineTo(-95, 32); for (let i = 6; i >= 0; i--) ctx.lineTo(-95 + (i % 2 ? 8 : 0), -32 + i * 64 / 6); ctx.closePath(); ctx.fill(); ctx.clip(); ctx.shadowColor = 'transparent';
      if (kind === 'tape-striped') for (let x = -140; x < 140; x += 36) line([[x, -40], [x + 50, 40]], tint(color, .6), 12);
      if (kind === 'tape-dots') for (let y = -18; y <= 18; y += 36) for (let x = -75; x <= 75; x += 30) circle(x, y, 5, tint(color, .8));
      if (kind === 'tape-zigzag') for (let x = -90; x < 90; x += 44) line([[x, 15], [x + 22, -15], [x + 44, 15]], tint(color, .7), 6);
      ctx.restore(); };
    if (kind === 'tape-cross') { strip(Math.PI / 4); strip(-Math.PI / 4); }
    else if (kind === 'tape-corner') strip(-Math.PI / 4);
    else strip(0);
  } else if (['sticky-note', 'grid-note', 'note-fold', 'torn-note'].includes(kind)) {
    ctx.fillStyle = paper; ctx.beginPath();
    if (kind === 'torn-note') { ctx.moveTo(-83, -88); ctx.lineTo(83, -88); for (let i = 0; i <= 12; i++) ctx.lineTo(83 - i * 166 / 12, 75 + (i % 2 ? 10 : 0)); ctx.lineTo(-83, -88); }
    else { ctx.moveTo(-84, -88); ctx.lineTo(84, -88); ctx.lineTo(84, 57); ctx.lineTo(54, 88); ctx.lineTo(-84, 88); }
    ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
    if (kind !== 'torn-note') { ctx.fillStyle = tint(color, .4); ctx.beginPath(); ctx.moveTo(54, 88); ctx.lineTo(54, 57); ctx.lineTo(84, 57); ctx.closePath(); ctx.fill(); }
    if (kind === 'sticky-note') { ctx.globalAlpha *= .16; rounded(-84, -88, 168, 29, 0, dark); }
    if (kind === 'grid-note') { ctx.globalAlpha *= .25; for (let value = -65; value <= 65; value += 22) { line([[value, -75], [value, 70]], color, 1); line([[-73, value], [73, value]], color, 1); } }
    if (kind === 'torn-note') for (let x = -60; x <= 60; x += 30) circle(x, -72, 5, '#ffffff');
  } else if (kind === 'ticket') {
    ctx.fillStyle = paper; ctx.beginPath(); ctx.moveTo(-83, -52); ctx.lineTo(83, -52); ctx.quadraticCurveTo(95, -52, 95, -40); ctx.lineTo(95, -13); ctx.bezierCurveTo(77, -13, 77, 13, 95, 13); ctx.lineTo(95, 40); ctx.quadraticCurveTo(95, 52, 83, 52); ctx.lineTo(-83, 52); ctx.quadraticCurveTo(-95, 52, -95, 40); ctx.lineTo(-95, 13); ctx.bezierCurveTo(-77, 13, -77, -13, -95, -13); ctx.lineTo(-95, -40); ctx.quadraticCurveTo(-95, -52, -83, -52); ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.setLineDash([6, 8]); line([[44, -42], [44, 42]], color, 3); ctx.setLineDash([]);
  } else if (kind === 'photo-frame') {
    ctx.fillStyle = paper; ctx.beginPath(); ctx.rect(-86, -97, 172, 194); ctx.rect(-73, -83, 146, 141); ctx.fill('evenodd'); ctx.shadowColor = 'transparent';
  } else if (kind === 'speech-bubble') {
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-70, -65); ctx.lineTo(70, -65); ctx.quadraticCurveTo(92, -65, 92, -40); ctx.lineTo(92, 24); ctx.quadraticCurveTo(92, 48, 65, 48); ctx.lineTo(-10, 48); ctx.lineTo(-50, 84); ctx.lineTo(-43, 48); ctx.lineTo(-70, 48); ctx.quadraticCurveTo(-92, 48, -92, 24); ctx.lineTo(-92, -40); ctx.quadraticCurveTo(-92, -65, -70, -65); ctx.stroke();
  } else if (kind === 'quote-mark') {
    for (const x of [-48, 24]) { rounded(x - 20, -26, 43, 44, 8, color); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + 22, 8); ctx.quadraticCurveTo(x + 30, 58, x - 22, 76); ctx.lineTo(x - 22, 53); ctx.quadraticCurveTo(x + 3, 40, x, 17); ctx.fill(); }
  } else if (kind === 'doodle-circle') {
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 92, 62, -.08, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha *= .65; ctx.beginPath(); ctx.ellipse(0, 2, 88, 68, .05, -.25, Math.PI * 1.9); ctx.stroke();
  } else if (kind === 'doodle-underline') {
    ctx.strokeStyle = color; ctx.lineWidth = 8; for (let y = -8; y <= 10; y += 18) { ctx.beginPath(); ctx.moveTo(-92, y + 8); ctx.bezierCurveTo(-30, y - 12, 15, y + 7, 92, y - 4); ctx.stroke(); }
  } else if (kind === 'laurel') {
    line([[-65, 85], [0, 10], [50, -80]], dark, 5);
    for (let i = 0; i < 5; i++) { const x = -48 + i * 23, y = 60 - i * 31; ctx.save(); ctx.translate(x, y); ctx.rotate(-.5); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-15, -7, 25, 10, .65, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(18, 4, 25, 10, -.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  } else if (kind === 'confetti') {
    for (let i = 0; i < 12; i++) { const angle = i * 2.399, radius = 30 + (i % 3) * 28; ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.rotate(angle); rounded(-5, -12, 10, 24, 2, i % 2 ? tint(color, .45) : color); ctx.restore(); }
  }
  return true;
}
