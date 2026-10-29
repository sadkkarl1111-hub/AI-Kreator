import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Laugh, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type MemeTextSlot = {
  id: string;
  label: string;
  placeholder: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: CanvasTextAlign;
  verticalAlign?: 'top' | 'center' | 'bottom';
  rotation?: number;
  fillStyle?: string;
  strokeStyle?: string;
  defaultText?: string;
};

type MemeTemplate = {
  id: string;
  label: string;
  url: string;
  hint: string;
  textSlots: MemeTextSlot[];
};

const defaultTopBottomSlots: MemeTextSlot[] = [
  {
    id: 'top',
    label: 'Tekst gorny',
    placeholder: 'Wpisz tekst gornej czesci mema...',
    x: 0.06,
    y: 0.04,
    width: 0.88,
    height: 0.18,
    align: 'center',
    verticalAlign: 'top',
    defaultText: 'TEKST GORA',
  },
  {
    id: 'bottom',
    label: 'Tekst dolny',
    placeholder: 'Wpisz tekst dolnej czesci mema...',
    x: 0.06,
    y: 0.78,
    width: 0.88,
    height: 0.16,
    align: 'center',
    verticalAlign: 'bottom',
    defaultText: 'TEKST DOL',
  },
];

const MEME_TEMPLATES: MemeTemplate[] = [
  {
    id: 'custom',
    label: 'Wlasne zdjecie',
    url: '',
    hint: 'Tryb klasyczny: dwa podpisy gora i dol.',
    textSlots: defaultTopBottomSlots,
  },
  {
    id: 'drake',
    label: 'Drake',
    url: 'https://i.imgflip.com/30b1gx.jpg',
    hint: 'Dwa pola po prawej stronie, po jednym dla kazdego panelu.',
    textSlots: [
      { id: 'reject', label: 'Gorny panel', placeholder: 'Czego Drake nie chce?', x: 0.56, y: 0.08, width: 0.36, height: 0.28, align: 'center', verticalAlign: 'center' },
      { id: 'approve', label: 'Dolny panel', placeholder: 'Co Drake wybiera?', x: 0.56, y: 0.58, width: 0.36, height: 0.24, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'distracted',
    label: 'Distracted Boyfriend',
    url: 'https://i.imgflip.com/1ur9b0.jpg',
    hint: 'Trzy podpisy nad postaciami.',
    textSlots: [
      { id: 'girlfriend', label: 'Lewa postac', placeholder: 'Podpis lewej postaci...', x: 0.05, y: 0.06, width: 0.24, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'boyfriend', label: 'Srodkowa postac', placeholder: 'Podpis srodkowej postaci...', x: 0.38, y: 0.04, width: 0.24, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'other', label: 'Prawa postac', placeholder: 'Podpis prawej postaci...', x: 0.69, y: 0.06, width: 0.24, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'change',
    label: 'Change My Mind',
    url: 'https://i.imgflip.com/24y43o.jpg',
    hint: 'Tekst trafia bezposrednio na tabliczke.',
    textSlots: [
      {
        id: 'sign',
        label: 'Napis na tabliczce',
        placeholder: 'Wpisz tekst na tabliczce...',
        x: 0.46,
        y: 0.62,
        width: 0.28,
        height: 0.17,
        align: 'center',
        verticalAlign: 'center',
        rotation: -24,
        fillStyle: '#111111',
        strokeStyle: '#ffffff',
      },
    ],
  },
  {
    id: 'buttons',
    label: 'Two Buttons',
    url: 'https://i.imgflip.com/1g8my4.jpg',
    hint: 'Opis dylematu oraz podpisy na obu przyciskach.',
    textSlots: [
      { id: 'question', label: 'Dylemat', placeholder: 'Opis sytuacji...', x: 0.08, y: 0.06, width: 0.38, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'buttonA', label: 'Lewy przycisk', placeholder: 'Podpis lewego przycisku...', x: 0.53, y: 0.24, width: 0.18, height: 0.12, align: 'center', verticalAlign: 'center', fillStyle: '#111111', strokeStyle: '#ffffff' },
      { id: 'buttonB', label: 'Prawy przycisk', placeholder: 'Podpis prawego przycisku...', x: 0.72, y: 0.37, width: 0.18, height: 0.12, align: 'center', verticalAlign: 'center', fillStyle: '#111111', strokeStyle: '#ffffff' },
    ],
  },
  {
    id: 'expanding',
    label: 'Expanding Brain',
    url: 'https://i.imgflip.com/1jwhww.jpg',
    hint: 'Cztery pola, po jednym dla kazdego poziomu braina.',
    textSlots: [
      { id: 'level1', label: 'Poziom 1', placeholder: 'Pierwszy poziom...', x: 0.52, y: 0.03, width: 0.43, height: 0.18, align: 'center', verticalAlign: 'center' },
      { id: 'level2', label: 'Poziom 2', placeholder: 'Drugi poziom...', x: 0.52, y: 0.28, width: 0.43, height: 0.18, align: 'center', verticalAlign: 'center' },
      { id: 'level3', label: 'Poziom 3', placeholder: 'Trzeci poziom...', x: 0.52, y: 0.53, width: 0.43, height: 0.18, align: 'center', verticalAlign: 'center' },
      { id: 'level4', label: 'Poziom 4', placeholder: 'Czwarty poziom...', x: 0.52, y: 0.78, width: 0.43, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'success',
    label: 'Success Kid',
    url: 'https://i.imgflip.com/1bhk.jpg',
    hint: 'Najlepiej sprawdza sie jeden mocny podpis u gory.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.04, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'disaster',
    label: 'Disaster Girl',
    url: 'https://i.imgflip.com/23ls.jpg',
    hint: 'Jeden podpis u gory dobrze pasuje do tego kadru.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.04, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'doge',
    label: 'Doge',
    url: 'https://i.imgflip.com/4t0m5.jpg',
    hint: 'Kilka krotszych tekstow w roznych miejscach kadru.',
    textSlots: [
      { id: 'wow', label: 'Lewa gora', placeholder: 'Pierwszy tekst...', x: 0.08, y: 0.08, width: 0.26, height: 0.12, align: 'center', verticalAlign: 'center' },
      { id: 'much', label: 'Prawa gora', placeholder: 'Drugi tekst...', x: 0.58, y: 0.12, width: 0.28, height: 0.12, align: 'center', verticalAlign: 'center' },
      { id: 'so', label: 'Prawy dol', placeholder: 'Trzeci tekst...', x: 0.56, y: 0.68, width: 0.30, height: 0.12, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'batman',
    label: 'Batman Slap',
    url: 'https://i.imgflip.com/9ehk.jpg',
    hint: 'Po jednym podpisie nad kazda postacia.',
    textSlots: [
      { id: 'left', label: 'Lewa postac', placeholder: 'Lewy podpis...', x: 0.12, y: 0.06, width: 0.22, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'right', label: 'Prawa postac', placeholder: 'Prawy podpis...', x: 0.59, y: 0.06, width: 0.24, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'onedoes',
    label: 'One Does Not Simply',
    url: 'https://i.imgflip.com/1bij.jpg',
    hint: 'Klasyczny pojedynczy podpis u gory.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.07, y: 0.05, width: 0.86, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'rollsafe',
    label: 'Roll Safe',
    url: 'https://i.imgflip.com/1h7in3.jpg',
    hint: 'Najlepiej dziala jeden podpis po prawej u gory.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.44, y: 0.06, width: 0.44, height: 0.18, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'everywhere',
    label: 'X Everywhere',
    url: 'https://i.imgflip.com/i2wvt.jpg',
    hint: 'Dwa napisy: obiekt z lewej i to, co jest wszedzie.',
    textSlots: [
      { id: 'thing', label: 'Obiekt z lewej', placeholder: 'Co jest na obrazku?', x: 0.05, y: 0.08, width: 0.26, height: 0.14, align: 'center', verticalAlign: 'center' },
      { id: 'everywhere', label: 'To wszedzie', placeholder: 'Co jest wszedzie?', x: 0.44, y: 0.67, width: 0.30, height: 0.14, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'waiting',
    label: 'Waiting Skeleton',
    url: 'https://i.imgflip.com/2fm6x.jpg',
    hint: 'Jeden podpis w dolnej czesci dobrze pasuje do kadru.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.76, width: 0.84, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'surprised',
    label: 'Surprised Pikachu',
    url: 'https://i.imgflip.com/2kbn1e.jpg',
    hint: 'Najczesciej sprawdza sie jeden podpis u gory.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.06, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'bernie',
    label: 'Bernie Sanders',
    url: 'https://i.imgflip.com/4ecbya.jpg',
    hint: 'Jeden podpis u gory lub po lewej sprawdza sie najlepiej.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.06, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'fine',
    label: 'This Is Fine',
    url: 'https://i.imgflip.com/wxica.jpg',
    hint: 'Jeden mocny podpis u gory pasuje do sceny.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.05, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
  {
    id: 'aliens',
    label: 'Ancient Aliens',
    url: 'https://i.imgflip.com/26am.jpg',
    hint: 'Jeden podpis u gory i drugi przy prezenterze.',
    textSlots: [
      { id: 'headline', label: 'Gorny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.05, width: 0.84, height: 0.16, align: 'center', verticalAlign: 'top' },
      { id: 'aliens', label: 'Tekst przy rece', placeholder: 'Drugi tekst...', x: 0.42, y: 0.56, width: 0.40, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'spongebob',
    label: 'Mocking Spongebob',
    url: 'https://i.imgflip.com/1otk96.jpg',
    hint: 'Najlepiej dziala jeden podpis w dolnej czesci.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.78, width: 0.84, height: 0.14, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'isthis',
    label: 'Is This...?',
    url: 'https://i.imgflip.com/1o00in.jpg',
    hint: 'Jedno pole przy motylu i jedno jako glowny podpis.',
    textSlots: [
      { id: 'butterfly', label: 'Motyl', placeholder: 'Co to jest?', x: 0.60, y: 0.19, width: 0.25, height: 0.12, align: 'center', verticalAlign: 'center' },
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.75, width: 0.84, height: 0.14, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'trade',
    label: 'Trade Offer',
    url: 'https://i.imgflip.com/54hjww.jpg',
    hint: 'Dwa glowne pola: co dajesz i co dostajesz.',
    textSlots: [
      { id: 'offer', label: 'Ja ci dam', placeholder: 'Co oferujesz?', x: 0.08, y: 0.28, width: 0.34, height: 0.24, align: 'center', verticalAlign: 'center' },
      { id: 'receive', label: 'Ty mi dasz', placeholder: 'Co chcesz w zamian?', x: 0.58, y: 0.28, width: 0.34, height: 0.24, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'gru',
    label: 'Gru Plan',
    url: 'https://i.imgflip.com/26jxvz.jpg',
    hint: 'Cztery pola, po jednym dla kazdego kadru planu Gru.',
    textSlots: [
      { id: 'step1', label: 'Kadr 1', placeholder: 'Pierwszy etap planu...', x: 0.05, y: 0.04, width: 0.40, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'step2', label: 'Kadr 2', placeholder: 'Drugi etap planu...', x: 0.55, y: 0.04, width: 0.40, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'step3', label: 'Kadr 3', placeholder: 'Trzeci etap planu...', x: 0.05, y: 0.54, width: 0.40, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'step4', label: 'Kadr 4', placeholder: 'Finał planu...', x: 0.55, y: 0.54, width: 0.40, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'chad',
    label: 'Average Fan vs Enjoyer',
    url: 'https://i.imgflip.com/46e43q.jpg',
    hint: 'Dwa pola nad obiema stronami porownania.',
    textSlots: [
      { id: 'left', label: 'Lewa strona', placeholder: 'Podpis lewej strony...', x: 0.05, y: 0.07, width: 0.36, height: 0.16, align: 'center', verticalAlign: 'center' },
      { id: 'right', label: 'Prawa strona', placeholder: 'Podpis prawej strony...', x: 0.59, y: 0.07, width: 0.36, height: 0.16, align: 'center', verticalAlign: 'center' },
    ],
  },
  {
    id: 'stonks',
    label: 'Stonks',
    url: 'https://i.imgflip.com/3lmzyx.jpg',
    hint: 'Jeden podpis u gory najlepiej oddaje ten format.',
    textSlots: [
      { id: 'headline', label: 'Glowny podpis', placeholder: 'Wpisz glowny tekst...', x: 0.08, y: 0.05, width: 0.84, height: 0.18, align: 'center', verticalAlign: 'top' },
    ],
  },
];

const createInitialTexts = (template: MemeTemplate) =>
  Object.fromEntries(template.textSlots.map((slot) => [slot.id, slot.defaultText ?? ''])) as Record<string, string>;

const getStrokeColorForFill = (fillColor: string) => {
  const hex = fillColor.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#000000';
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);

  return luminance > 160 ? '#000000' : '#ffffff';
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.replace(/\n/g, ' \n ').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (word === '\n') {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine.trim());
    currentLine = word;
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.length > 0 ? lines : [''];
};

const fitTextToBox = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
) => {
  for (let size = maxFontSize; size >= 14; size -= 2) {
    ctx.font = `bold ${size}px Impact, Arial Black, sans-serif`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.05;
    if (lines.length * lineHeight <= maxHeight) {
      return { fontSize: size, lines, lineHeight };
    }
  }

  ctx.font = 'bold 14px Impact, Arial Black, sans-serif';
  return {
    fontSize: 14,
    lines: wrapText(ctx, text, maxWidth),
    lineHeight: 14 * 1.05,
  };
};

const drawTextSlot = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  slot: MemeTextSlot,
  text: string,
  baseFontSize: number,
  fillColor: string,
  strokeColor: string,
) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const box = {
    x: slot.x * canvas.width,
    y: slot.y * canvas.height,
    width: slot.width * canvas.width,
    height: slot.height * canvas.height,
  };

  const padding = Math.max(8, Math.min(box.width, box.height) * 0.08);

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = slot.align ?? 'center';
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;

  if (slot.rotation) {
    ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
    ctx.rotate((slot.rotation * Math.PI) / 180);
  }

  const localBox = slot.rotation
    ? { x: -box.width / 2, y: -box.height / 2, width: box.width, height: box.height }
    : box;

  const fitted = fitTextToBox(
    ctx,
    trimmed,
    localBox.width - padding * 2,
    localBox.height - padding * 2,
    baseFontSize,
  );

  ctx.font = `bold ${fitted.fontSize}px Impact, Arial Black, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, fitted.fontSize / 11);

  const contentHeight = fitted.lines.length * fitted.lineHeight;
  let startY = localBox.y + padding;

  if (slot.verticalAlign === 'center') {
    startY = localBox.y + (localBox.height - contentHeight) / 2;
  } else if (slot.verticalAlign === 'bottom') {
    startY = localBox.y + localBox.height - padding - contentHeight;
  }

  const textX = slot.align === 'left'
    ? localBox.x + padding
    : slot.align === 'right'
      ? localBox.x + localBox.width - padding
      : localBox.x + localBox.width / 2;

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.strokeText(line, textX, y, localBox.width - padding * 2);
    ctx.fillText(line, textX, y, localBox.width - padding * 2);
  });

  ctx.restore();
};

const MemeGenerator = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(MEME_TEMPLATES[0]);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [captionTexts, setCaptionTexts] = useState<Record<string, string>>(createInitialTexts(MEME_TEMPLATES[0]));
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState('#ffffff');
  const [isImageLoading, setIsImageLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imageLoadRequestRef = useRef(0);

  const imageUrl = selectedTemplate.id === 'custom' ? customImage : selectedTemplate.url;
  const activeSlots = selectedTemplate.textSlots;
  const strokeColor = getStrokeColorForFill(textColor);

  const drawMeme = (sourceImage = imgRef.current) => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    for (const slot of activeSlots) {
      drawTextSlot(ctx, canvas, slot, captionTexts[slot.id] ?? '', fontSize, textColor, strokeColor);
    }
  };

  useEffect(() => {
    setCaptionTexts(createInitialTexts(selectedTemplate));
  }, [selectedTemplate]);

  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      setIsImageLoading(false);
      return;
    }

    const requestId = imageLoadRequestRef.current + 1;
    imageLoadRequestRef.current = requestId;
    imgRef.current = null;
    setIsImageLoading(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (imageLoadRequestRef.current !== requestId) return;
      imgRef.current = img;
      setIsImageLoading(false);
      drawMeme(img);
    };
    img.onerror = () => {
      if (imageLoadRequestRef.current !== requestId) return;
      setIsImageLoading(false);
      toast.error(`Nie udało się załadować szablonu mema: ${selectedTemplate.label}`);
    };
    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, selectedTemplate.label]);

  useEffect(() => {
    drawMeme();
  }, [captionTexts, fontSize, selectedTemplate, textColor]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomImage(event.target?.result as string);
      setSelectedTemplate(MEME_TEMPLATES[0]);
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateSelect = (template: MemeTemplate) => {
    if (template.id === 'custom') {
      fileInputRef.current?.click();
      return;
    }

    setSelectedTemplate(template);
  };

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'meme.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('Mem zostal pobrany');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Laugh className="w-6 h-6 text-primary" /> Meme Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Tekst jest teraz dopasowywany do ukladu wybranego mema, a nie tylko do strefy gora/dol.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = '';
              }}
            />

            <div className="space-y-3">
              <label className="text-sm text-muted-foreground block">Wybierz szablon:</label>
              <div className="flex flex-wrap gap-2">
                {MEME_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    size="sm"
                    variant={selectedTemplate.id === template.id ? 'default' : 'outline'}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {selectedTemplate.hint}
              </div>
            </div>

            <div className={`grid gap-4 ${activeSlots.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {activeSlots.map((slot) => (
                <div key={slot.id} className="space-y-2">
                  <label className="text-sm text-muted-foreground">{slot.label}</label>
                  <Textarea
                    value={captionTexts[slot.id] ?? ''}
                    onChange={(event) => setCaptionTexts((prev) => ({ ...prev, [slot.id]: event.target.value }))}
                    placeholder={slot.placeholder}
                    className="min-h-[88px] resize-y"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Rozmiar czcionki: {fontSize}px</label>
              <input
                type="range"
                min={18}
                max={96}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground">Kolor tekstu:</label>
              <input
                type="color"
                value={textColor}
                onChange={(event) => setTextColor(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded border bg-transparent p-1"
              />
              <span className="text-sm text-muted-foreground">{textColor.toUpperCase()}</span>
            </div>

            {imageUrl ? (
              <div className="space-y-3">
                {isImageLoading && (
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-center">
                    Ładowanie szablonu mema...
                  </div>
                )}
                <div className="flex justify-center">
                  <canvas
                    ref={canvasRef}
                    className={`w-full max-w-[520px] max-h-[420px] h-auto rounded-lg border bg-black/5 ${isImageLoading ? 'opacity-60' : ''}`}
                    style={{ display: 'block' }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Podgląd mema jest pomniejszony w edytorze, ale pobierany plik zachowuje pełny rozmiar.
                </p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Wybierz szablon albo wgraj wlasne zdjecie</p>
              </div>
            )}

            {imageUrl && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={download} className="gap-2">
                  <Download className="w-4 h-4" /> Pobierz mema
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> Podmien obraz
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default MemeGenerator;
