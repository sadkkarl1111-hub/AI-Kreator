import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { LayoutGrid, Download, Upload, Image, ArrowLeft, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrimmedGraphicsMessage, saveGraphicToGallery } from '@/lib/graphicsLimit';
import { loadUserGalleryImages } from '@/lib/toolImage';

// --- Template Types ---

type GridTemplate = {
  type: 'grid';
  id: string;
  label: string;
  preview: string;
  cols: number;
  rows: number;
  slots: number;
};

type CreativeSlot = {
  x: number; y: number; w: number; h: number;
  rotate?: number;
  borderRadius?: number;
  border?: { width: number; color: string; style?: string };
  shadow?: string;
  zIndex?: number;
  clipPath?: string;
};

type CreativeTemplate = {
  type: 'creative';
  id: string;
  label: string;
  preview: string;
  canvasW: number;
  canvasH: number;
  slots: CreativeSlot[];
};

type Template = GridTemplate | CreativeTemplate;

const GRID_TEMPLATES: GridTemplate[] = [
  { type: 'grid', id: '2x1', label: '2 obok siebie', preview: '⬜⬜', cols: 2, rows: 1, slots: 2 },
  { type: 'grid', id: '1x2', label: '2 pod sobą', preview: '⬜\n⬜', cols: 1, rows: 2, slots: 2 },
  { type: 'grid', id: '2x2', label: 'Siatka 2×2', preview: '⬜⬜\n⬜⬜', cols: 2, rows: 2, slots: 4 },
  { type: 'grid', id: '3x1', label: '3 obok siebie', preview: '⬜⬜⬜', cols: 3, rows: 1, slots: 3 },
  { type: 'grid', id: '1x3', label: '3 pod sobą', preview: '⬜\n⬜\n⬜', cols: 1, rows: 3, slots: 3 },
  { type: 'grid', id: '3x2', label: 'Siatka 3×2', preview: '⬜⬜⬜\n⬜⬜⬜', cols: 3, rows: 2, slots: 6 },
  { type: 'grid', id: '2x3', label: 'Siatka 2×3', preview: '⬜⬜\n⬜⬜\n⬜⬜', cols: 2, rows: 3, slots: 6 },
  { type: 'grid', id: '3x3', label: 'Siatka 3×3', preview: '⬜⬜⬜\n⬜⬜⬜\n⬜⬜⬜', cols: 3, rows: 3, slots: 9 },
  { type: 'grid', id: '4x2', label: 'Siatka 4×2', preview: '⬜⬜⬜⬜\n⬜⬜⬜⬜', cols: 4, rows: 2, slots: 8 },
  { type: 'grid', id: '4x3', label: 'Siatka 4×3', preview: '⬜⬜⬜⬜\n⬜⬜⬜⬜\n⬜⬜⬜⬜', cols: 4, rows: 3, slots: 12 },
  { type: 'grid', id: '4x4', label: 'Siatka 4×4', preview: '⬜⬜⬜⬜', cols: 4, rows: 4, slots: 16 },
  { type: 'grid', id: '5x2', label: 'Siatka 5×2', preview: '⬜⬜⬜⬜⬜', cols: 5, rows: 2, slots: 10 },
];

const CREATIVE_TEMPLATES: CreativeTemplate[] = [
  {
    type: 'creative', id: 'polaroid-scatter', label: 'Polaroidy (rozrzucone)',
    preview: '📷',
    canvasW: 1200, canvasH: 900,
    slots: [
      { x: 50, y: 80, w: 320, h: 380, rotate: -12, border: { width: 12, color: '#ffffff' }, shadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 1 },
      { x: 350, y: 30, w: 320, h: 380, rotate: 5, border: { width: 12, color: '#ffffff' }, shadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 2 },
      { x: 700, y: 100, w: 320, h: 380, rotate: -8, border: { width: 12, color: '#ffffff' }, shadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 3 },
      { x: 180, y: 400, w: 320, h: 380, rotate: 10, border: { width: 12, color: '#ffffff' }, shadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 4 },
      { x: 550, y: 380, w: 320, h: 380, rotate: -4, border: { width: 12, color: '#ffffff' }, shadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 5 },
    ],
  },
  {
    type: 'creative', id: 'tilt-overlap-3', label: 'Nachodzące (3 zdjęcia)',
    preview: '🔀',
    canvasW: 1200, canvasH: 800,
    slots: [
      { x: 50, y: 50, w: 500, h: 600, rotate: -6, border: { width: 6, color: '#ffffff' }, shadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 1 },
      { x: 350, y: 80, w: 500, h: 600, rotate: 3, border: { width: 6, color: '#ffffff' }, shadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 2 },
      { x: 650, y: 30, w: 500, h: 600, rotate: -2, border: { width: 6, color: '#ffffff' }, shadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 3 },
    ],
  },
  {
    type: 'creative', id: 'fan-spread', label: 'Wachlarz',
    preview: '🪭',
    canvasW: 1200, canvasH: 900,
    slots: [
      { x: 250, y: 100, w: 350, h: 500, rotate: -20, border: { width: 8, color: '#ffffff' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 1 },
      { x: 380, y: 60, w: 350, h: 500, rotate: -8, border: { width: 8, color: '#ffffff' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 2 },
      { x: 430, y: 40, w: 350, h: 500, rotate: 0, border: { width: 8, color: '#ffffff' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 3 },
      { x: 480, y: 60, w: 350, h: 500, rotate: 8, border: { width: 8, color: '#ffffff' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 4 },
      { x: 550, y: 100, w: 350, h: 500, rotate: 20, border: { width: 8, color: '#ffffff' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 5 },
    ],
  },
  {
    type: 'creative', id: 'diamond-mosaic', label: 'Romby',
    preview: '◆',
    canvasW: 1000, canvasH: 1000,
    slots: [
      { x: 250, y: -20, w: 400, h: 400, rotate: 45, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 520, y: 250, w: 400, h: 400, rotate: 45, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 250, y: 520, w: 400, h: 400, rotate: 45, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: -20, y: 250, w: 400, h: 400, rotate: 45, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'stack-messy', label: 'Stos zdjęć',
    preview: '📚',
    canvasW: 900, canvasH: 900,
    slots: [
      { x: 150, y: 150, w: 500, h: 500, rotate: 15, border: { width: 10, color: '#f5f0e8' }, shadow: '0 6px 20px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 200, y: 120, w: 500, h: 500, rotate: -8, border: { width: 10, color: '#f5f0e8' }, shadow: '0 6px 20px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 170, y: 170, w: 500, h: 500, rotate: 4, border: { width: 10, color: '#f5f0e8' }, shadow: '0 6px 20px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 220, y: 140, w: 500, h: 500, rotate: -2, border: { width: 10, color: '#ffffff' }, shadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'circle-overlap', label: 'Okręgi (nachodzące)',
    preview: '⭕',
    canvasW: 1200, canvasH: 800,
    slots: [
      { x: 50, y: 100, w: 400, h: 400, rotate: 0, borderRadius: 200, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 280, y: 50, w: 400, h: 400, rotate: 0, borderRadius: 200, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 510, y: 120, w: 400, h: 400, rotate: 0, borderRadius: 200, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 740, y: 70, w: 400, h: 400, rotate: 0, borderRadius: 200, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'tilt-row', label: 'Skośny rząd',
    preview: '📐',
    canvasW: 1400, canvasH: 700,
    slots: [
      { x: 20, y: 80, w: 350, h: 450, rotate: -10, border: { width: 5, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.25)', zIndex: 1 },
      { x: 300, y: 120, w: 350, h: 450, rotate: 6, border: { width: 5, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.25)', zIndex: 2 },
      { x: 600, y: 50, w: 350, h: 450, rotate: -4, border: { width: 5, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.25)', zIndex: 3 },
      { x: 900, y: 110, w: 350, h: 450, rotate: 8, border: { width: 5, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.25)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'vintage-frame', label: 'Vintage (ramki)',
    preview: '🖼️',
    canvasW: 1200, canvasH: 900,
    slots: [
      { x: 40, y: 40, w: 520, h: 380, rotate: -3, border: { width: 18, color: '#8B7355' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 1 },
      { x: 620, y: 60, w: 520, h: 380, rotate: 4, border: { width: 18, color: '#A0522D' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 2 },
      { x: 200, y: 430, w: 520, h: 380, rotate: 2, border: { width: 18, color: '#6B4226' }, shadow: '0 6px 25px rgba(0,0,0,0.3)', zIndex: 3 },
    ],
  },
  // --- NOWE SZABLONY ---
  {
    type: 'creative', id: 'heart-layout', label: 'Serce',
    preview: '❤️',
    canvasW: 1000, canvasH: 1000,
    slots: [
      { x: 200, y: 50, w: 280, h: 280, rotate: -15, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 520, y: 50, w: 280, h: 280, rotate: 15, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 80, y: 250, w: 280, h: 280, rotate: -10, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 640, y: 250, w: 280, h: 280, rotate: 10, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
      { x: 200, y: 450, w: 280, h: 280, rotate: -5, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 5 },
      { x: 520, y: 450, w: 280, h: 280, rotate: 5, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 6 },
      { x: 360, y: 650, w: 280, h: 280, rotate: 0, borderRadius: 140, border: { width: 6, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 7 },
    ],
  },
  {
    type: 'creative', id: 'filmstrip', label: 'Taśma filmowa',
    preview: '🎞️',
    canvasW: 1400, canvasH: 500,
    slots: [
      { x: 30, y: 60, w: 240, h: 340, rotate: 0, border: { width: 4, color: '#1a1a1a' }, shadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 1 },
      { x: 290, y: 60, w: 240, h: 340, rotate: 0, border: { width: 4, color: '#1a1a1a' }, shadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 2 },
      { x: 550, y: 60, w: 240, h: 340, rotate: 0, border: { width: 4, color: '#1a1a1a' }, shadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 3 },
      { x: 810, y: 60, w: 240, h: 340, rotate: 0, border: { width: 4, color: '#1a1a1a' }, shadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 4 },
      { x: 1070, y: 60, w: 240, h: 340, rotate: 0, border: { width: 4, color: '#1a1a1a' }, shadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 5 },
    ],
  },
  {
    type: 'creative', id: 'cascade-stairs', label: 'Schody (kaskada)',
    preview: '🪜',
    canvasW: 1300, canvasH: 900,
    slots: [
      { x: 30, y: 30, w: 380, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 230, y: 180, w: 380, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 430, y: 330, w: 380, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 630, y: 180, w: 380, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
      { x: 830, y: 30, w: 380, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 5 },
    ],
  },
  {
    type: 'creative', id: 'hexagon-grid', label: 'Plaster miodu',
    preview: '🐝',
    canvasW: 1100, canvasH: 900,
    slots: [
      { x: 200, y: 30, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 1 },
      { x: 520, y: 30, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 2 },
      { x: 40, y: 270, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 3 },
      { x: 360, y: 270, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 4 },
      { x: 680, y: 270, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 5 },
      { x: 200, y: 510, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 6 },
      { x: 520, y: 510, w: 300, h: 300, rotate: 0, borderRadius: 150, border: { width: 5, color: '#f5c518' }, shadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 7 },
    ],
  },
  {
    type: 'creative', id: 'big-left', label: 'Duże + małe',
    preview: '🔲',
    canvasW: 1200, canvasH: 800,
    slots: [
      { x: 20, y: 20, w: 700, h: 760, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 740, y: 20, w: 440, h: 245, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 740, y: 278, w: 440, h: 245, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 740, y: 535, w: 440, h: 245, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'cross-layout', label: 'Krzyż',
    preview: '✚',
    canvasW: 1000, canvasH: 1000,
    slots: [
      { x: 330, y: 20, w: 340, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 20, y: 340, w: 300, h: 320, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 340, y: 340, w: 320, h: 320, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 3 },
      { x: 680, y: 340, w: 300, h: 320, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 4 },
      { x: 330, y: 680, w: 340, h: 300, rotate: 0, border: { width: 5, color: '#ffffff' }, shadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 5 },
    ],
  },
  {
    type: 'creative', id: 'spiral-3', label: 'Spirala',
    preview: '🌀',
    canvasW: 1000, canvasH: 1000,
    slots: [
      { x: 50, y: 50, w: 550, h: 400, rotate: -5, border: { width: 6, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.2)', zIndex: 1 },
      { x: 400, y: 300, w: 500, h: 350, rotate: 8, border: { width: 6, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.2)', zIndex: 2 },
      { x: 100, y: 500, w: 450, h: 400, rotate: -3, border: { width: 6, color: '#ffffff' }, shadow: '0 5px 20px rgba(0,0,0,0.2)', zIndex: 3 },
    ],
  },
  {
    type: 'creative', id: 'panorama-strip', label: 'Panorama (pasek)',
    preview: '🏔️',
    canvasW: 1600, canvasH: 500,
    slots: [
      { x: 20, y: 20, w: 380, h: 460, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 1 },
      { x: 410, y: 20, w: 380, h: 460, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 2 },
      { x: 800, y: 20, w: 380, h: 460, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 3 },
      { x: 1190, y: 20, w: 380, h: 460, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 4 },
    ],
  },
  {
    type: 'creative', id: 'mosaic-mixed', label: 'Mozaika (mix)',
    preview: '🧩',
    canvasW: 1200, canvasH: 900,
    slots: [
      { x: 20, y: 20, w: 580, h: 430, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 1 },
      { x: 610, y: 20, w: 280, h: 210, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 2 },
      { x: 900, y: 20, w: 280, h: 210, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 3 },
      { x: 610, y: 240, w: 570, h: 210, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 4 },
      { x: 20, y: 460, w: 390, h: 420, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 5 },
      { x: 420, y: 460, w: 390, h: 420, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 6 },
      { x: 820, y: 460, w: 360, h: 420, rotate: 0, border: { width: 4, color: '#ffffff' }, shadow: '0 3px 10px rgba(0,0,0,0.15)', zIndex: 7 },
    ],
  },
];

const ALL_TEMPLATES: Template[] = [...GRID_TEMPLATES, ...CREATIVE_TEMPLATES];

type SlotImage = {
  url: string;
  img: HTMLImageElement;
};

const getSlotCount = (t: Template) => t.type === 'grid' ? t.slots : t.slots.length;

const Collage = () => {
  const { user } = useAuth();
  const [template, setTemplate] = useState<Template>(ALL_TEMPLATES[2]); // 2x2 default
  const [slots, setSlots] = useState<(SlotImage | null)[]>(Array(getSlotCount(ALL_TEMPLATES[2])).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [gap, setGap] = useState(8);
  const [bgColor, setBgColor] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; url: string; prompt: string }[]>([]);

  useEffect(() => {
    setSlots(Array(getSlotCount(template)).fill(null));
    setActiveSlot(null);
  }, [template]);

  const loadGallery = useCallback(async () => {
    if (!user) return;
    const images = await loadUserGalleryImages(null, user.id, 30);
    setGalleryImages(images);
    setShowGallery(true);
  }, [user]);

  const loadImageToSlot = (slotIndex: number, url: string, skipCrossOrigin = false) => {
    const img = new window.Image();
    if (!skipCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      setSlots(prev => {
        const next = [...prev];
        next[slotIndex] = { url, img };
        return next;
      });
      setShowGallery(false);
      setActiveSlot(null);
    };
    img.onerror = () => toast.error('Nie udało się załadować');
    img.src = url;
  };

  const handleFileForSlot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetSlot = activeSlot;
    if (!file || targetSlot === null) return;
    if (!file.type.startsWith('image/')) { toast.error('Wybierz plik graficzny'); return; }
    const reader = new FileReader();
    reader.onload = () => loadImageToSlot(targetSlot, reader.result as string, true);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Draw helpers ---
  const drawCoverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const slotRatio = w / h;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (imgRatio > slotRatio) {
      sw = sh * slotRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = sw / slotRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };

  const drawCreativeSlot = (ctx: CanvasRenderingContext2D, slot: CreativeSlot, image: SlotImage | null, index: number, isActive: boolean) => {
    const { x, y, w, h, rotate = 0, borderRadius = 0, border, shadow } = slot;
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);

    // Shadow
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;
    }

    // Border (drawn as background rect)
    const bw = border?.width ?? 0;
    if (border) {
      ctx.fillStyle = border.color;
      if (borderRadius > 0) {
        drawRoundedRect(ctx, -w / 2 - bw, -h / 2 - bw, w + bw * 2, h + bw * 2, borderRadius + bw);
        ctx.fill();
      } else {
        ctx.fillRect(-w / 2 - bw, -h / 2 - bw, w + bw * 2, h + bw * 2);
      }
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Clip for borderRadius
    if (borderRadius > 0) {
      ctx.beginPath();
      drawRoundedRect(ctx, -w / 2, -h / 2, w, h, borderRadius);
      ctx.clip();
    }

    if (image) {
      drawCoverImage(ctx, image.img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#e5e5e5';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#999';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${index + 1}`, 0, 0);
    }

    // Active highlight
    if (isActive) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      if (borderRadius > 0) {
        ctx.beginPath();
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, borderRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Render
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    if (template.type === 'grid') {
      const cellSize = 300;
      const totalW = template.cols * cellSize + (template.cols + 1) * gap;
      const totalH = template.rows * cellSize + (template.rows + 1) * gap;
      canvas.width = totalW;
      canvas.height = totalH;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalW, totalH);

      for (let i = 0; i < template.slots; i++) {
        const col = i % template.cols;
        const row = Math.floor(i / template.cols);
        const x = gap + col * (cellSize + gap);
        const y = gap + row * (cellSize + gap);

        const slot = slots[i];
        if (slot) {
          drawCoverImage(ctx, slot.img, x, y, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#e5e5e5';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.fillStyle = '#999';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Slot ${i + 1}`, x + cellSize / 2, y + cellSize / 2);
        }

        if (i === activeSlot) {
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(x, y, cellSize, cellSize);
          ctx.setLineDash([]);
        }
      }
    } else {
      canvas.width = template.canvasW;
      canvas.height = template.canvasH;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, template.canvasW, template.canvasH);

      // Sort by zIndex
      const sortedIndices = template.slots
        .map((s, i) => ({ ...s, originalIndex: i }))
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

      for (const s of sortedIndices) {
        drawCreativeSlot(ctx, s, slots[s.originalIndex], s.originalIndex, s.originalIndex === activeSlot);
      }
    }
  }, [slots, template, activeSlot, gap, bgColor]);

  // Click detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (template.type === 'grid') {
      const cellSize = 300;
      for (let i = 0; i < template.slots; i++) {
        const col = i % template.cols;
        const row = Math.floor(i / template.cols);
        const x = gap + col * (cellSize + gap);
        const y = gap + row * (cellSize + gap);
        if (mx >= x && mx <= x + cellSize && my >= y && my <= y + cellSize) {
          setActiveSlot(i);
          return;
        }
      }
    } else {
      // For creative templates, check in reverse zIndex order (top first)
      const sortedByZDesc = template.slots
        .map((s, i) => ({ ...s, originalIndex: i }))
        .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

      for (const s of sortedByZDesc) {
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const rad = -((s.rotate ?? 0) * Math.PI) / 180;
        const dx = mx - cx;
        const dy = my - cy;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
        if (Math.abs(lx) <= s.w / 2 && Math.abs(ly) <= s.h / 2) {
          setActiveSlot(s.originalIndex);
          return;
        }
      }
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    try {
      if (!user) { toast.error('Zaloguj się'); return; }
      const { trimmedCount } = await saveGraphicToGallery({
        userId: user.id,
        dataUrl,
        prompt: `[Kolaz] ${template.label}`,
        style: 'realistic',
        type: 'edited',
      });
      const trimMessage = getTrimmedGraphicsMessage(trimmedCount);
      toast.success(trimMessage ? `Kolaz zapisany do galerii! ${trimMessage}` : 'Kolaz zapisany do galerii!');
    } catch { toast.error('Nie udało się zapisać'); }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `kolaz-${Date.now()}.png`;
    a.click();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/tools"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold">
              <LayoutGrid className="inline w-6 h-6 text-primary mr-2" />
              <span className="gradient-text">Kolaż</span>
            </h1>
            <p className="text-muted-foreground mt-1">Połącz wiele zdjęć w jednym obrazie. Darmowe.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm font-medium">📐 Szablony klasyczne</p>
            <div className="flex flex-wrap gap-2">
              {GRID_TEMPLATES.map(t => (
                <Button key={t.id} variant={template.id === t.id ? 'default' : 'outline'} size="sm"
                  onClick={() => setTemplate(t)} className={template.id === t.id ? 'gradient-bg' : ''}>
                  {t.label}
                </Button>
              ))}
            </div>

            <p className="text-sm font-medium pt-2">🎨 Szablony kreatywne</p>
            <div className="flex flex-wrap gap-2">
              {CREATIVE_TEMPLATES.map(t => (
                <Button key={t.id} variant={template.id === t.id ? 'default' : 'outline'} size="sm"
                  onClick={() => setTemplate(t)} className={template.id === t.id ? 'gradient-bg' : ''}>
                  <span className="mr-1">{t.preview}</span> {t.label}
                </Button>
              ))}
            </div>

            {template.type === 'grid' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Odstęp: {gap}px</label>
                  <input type="range" min="0" max="30" value={gap} onChange={e => setGap(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Kolor tła</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                    <span className="text-xs text-muted-foreground">{bgColor}</span>
                  </div>
                </div>
              </div>
            )}

            {template.type === 'creative' && (
              <div>
                <label className="text-xs text-muted-foreground">Kolor tła</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                  <span className="text-xs text-muted-foreground">{bgColor}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">🖼️ Podgląd kolażu</p>
              <p className="text-xs text-muted-foreground">Kliknij slot aby dodać zdjęcie</p>
            </div>

            <div className="rounded-lg overflow-hidden border bg-muted/30 flex justify-center">
              <canvas
                ref={canvasRef}
                className="max-w-full cursor-pointer"
                style={{ maxHeight: '500px' }}
                onClick={handleCanvasClick}
              />
            </div>

            {activeSlot !== null && (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                <p className="text-sm font-medium">Slot {activeSlot + 1}</p>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileForSlot} className="hidden" />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="gap-1"><Upload className="w-3.5 h-3.5" /> Z dysku</Button>
                  {user ? (
                    <Button onClick={loadGallery} variant="outline" size="sm" className="gap-1"><Image className="w-3.5 h-3.5" /> Z galerii</Button>
                  ) : (
                    <Link to="/auth?returnTo=/tools/collage">
                      <Button variant="outline" size="sm" className="gap-1"><Image className="w-3.5 h-3.5" /> Galeria po logowaniu</Button>
                    </Link>
                  )}
                  {slots[activeSlot] && (
                    <Button variant="destructive" size="sm" onClick={() => setSlots(prev => { const n = [...prev]; n[activeSlot!] = null; return n; })} className="gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Wyczyść
                    </Button>
                  )}
                </div>
                {showGallery && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {galleryImages.map(g => (
                      <button key={g.id} onClick={() => loadImageToSlot(activeSlot!, g.url)} className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-colors">
                        <img src={g.url} alt={g.prompt} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {user ? (
                <Button onClick={handleSave} className="gradient-bg gap-1.5"><LayoutGrid className="w-4 h-4" /> Zapisz do galerii</Button>
              ) : (
                <Link to="/auth?returnTo=/tools/collage">
                  <Button variant="outline" className="gap-1.5"><LayoutGrid className="w-4 h-4" /> Zapisz w galerii po logowaniu</Button>
                </Link>
              )}
              <Button onClick={handleDownload} variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Pobierz</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default Collage;
