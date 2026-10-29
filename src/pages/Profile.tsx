import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BriefcaseBusiness,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  FileSignature,
  Gift,
  History,
  ImagePlus,
  Images,
  KeyRound,
  Mail,
  Megaphone,
  MessageSquareText,
  Save,
  Shield,
  Trash2,
  User,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { cn } from '@/lib/utils';
import { vpsFetch } from '@/lib/vpsApi';

type Purchase = {
  id: string;
  credits: number;
  amount: number;
  paid_amount: number | null;
  status: string;
  created_at: string;
  billing_company: string | null;
};

type InvoiceResponse = {
  html?: string;
};

type ProfileResponse = {
  ok: boolean;
  profile: {
    display_name: string | null;
  } | null;
  purchases: Purchase[];
};

type CompanyAssistantPrompt = {
  materialId: string;
  title: string;
  format: string;
  style: string;
  prompt: string;
};

type CompanyAssistantPackage = {
  id: string;
  createdAt: string;
  companyName: string;
  industry: string;
  profile: Record<string, string>;
  prompts: CompanyAssistantPrompt[];
};

type CompanyAssistantAsset = {
  id: string;
  packageId?: string | null;
  sessionId?: string | null;
  graphicId?: string | null;
  signedUrl?: string | null;
  materialId: string;
  materialTitle: string;
  assetType: string;
  dimensions?: string | null;
  createdAt: string;
};

type AdPrompt = {
  title: string;
  hookPl: string;
  prompt: string;
  needsImage: boolean;
  imageNote: string;
  styleId?: string;
  visualStyle?: string;
  category?: string;
  colors?: string[];
  ctaPl?: string;
  subheadPl?: string;
  benefitsPl?: string[];
};

type AdPromptSession = {
  id: string;
  inputText: string;
  imageCount: number;
  prompts: AdPrompt[];
  createdAt: string;
};

type ProfileSection = 'profile' | 'companies' | 'adPrompts' | 'admin' | 'purchases' | 'security' | 'danger';
type CompanyPanelTab = 'crm' | 'studio' | 'brief' | 'prompts' | 'assets' | 'brandbook';
type PdfDocument = import('jspdf').jsPDF;

type BusinessCardEditorDraft = {
  variantId: 'brand-first' | 'typographic-premium' | 'bold-split';
  primary: string;
  paper: string;
  accent: string;
  showSlogan: boolean;
  showLocation: boolean;
};

type DocumentStyleDraft = {
  primary: string;
  paper: string;
  accent: string;
  logoAssetId: string;
};

const editableBriefFields: Array<{ key: string; label: string; long?: boolean; placeholder?: string }> = [
  { key: 'companyName', label: 'Nazwa firmy', placeholder: 'np. AutoFlow Pro' },
  { key: 'industry', label: 'Branża', placeholder: 'np. automatyzacje procesów' },
  { key: 'stage', label: 'Etap', placeholder: 'existing / starting / idea' },
  { key: 'offer', label: 'Oferta', long: true, placeholder: 'Co dokładnie sprzedaje firma?' },
  { key: 'specialization', label: 'Specjalizacja', long: true, placeholder: 'W czym firma jest najmocniejsza?' },
  { key: 'targetAudience', label: 'Klient docelowy', long: true, placeholder: 'Dla kogo są materiały?' },
  { key: 'differentiator', label: 'Wyróżnik', long: true, placeholder: 'Dlaczego klient ma wybrać tę firmę?' },
  { key: 'tone', label: 'Ton komunikacji', long: true, placeholder: 'np. premium, konkretny, prosty, ekspercki' },
  { key: 'cta', label: 'CTA', placeholder: 'np. Umów konsultację' },
  { key: 'location', label: 'Lokalizacja', placeholder: 'np. Warszawa / online' },
  { key: 'contactPerson', label: 'Imię i nazwisko na wizytówce', placeholder: 'np. Karol Kowalski' },
  { key: 'jobTitle', label: 'Stanowisko / rola', placeholder: 'np. Właściciel / Doradca' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'E-mail' },
  { key: 'website', label: 'WWW' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'priceListItems', label: 'Pozycje cennika', long: true, placeholder: 'Każda pozycja w nowej linii: Usługa | Cena | Krótki opis' },
  { key: 'voucherTitle', label: 'Nazwa vouchera', placeholder: 'np. Voucher na konsultację' },
  { key: 'voucherValue', label: 'Wartość / usługa vouchera', placeholder: 'np. Konsultacja 60 min albo 300 zł' },
  { key: 'voucherTerms', label: 'Warunki vouchera', long: true, placeholder: 'np. Ważny 6 miesięcy, wymagana rezerwacja terminu' },
  { key: 'customColors', label: 'Kolory własne', long: true, placeholder: 'np. #111111, #ffffff, #38bdf8' },
  { key: 'avoidList', label: 'Czego unikać', long: true, placeholder: 'np. chaosu, zbyt wielu kolorów, małych napisów' },
];

const DELETE_ACCOUNT_CONFIRM_PHRASE = 'USUN KONTO';

const adStyleLabels: Record<string, string> = {
  impact: 'Mocny plakat', cinematic: 'Filmowa historia', editorial: 'Nowoczesna typografia',
  product: 'Produkt i efekt 3D', collage: 'Kreatywny kolaż', contrast: 'Problem → rozwiązanie',
  demo: 'Pokaż, jak działa', premium: 'Eleganckie premium', jungle: 'Dżungla · wyjście z chaosu',
  pool: 'Basen · chwila oddechu', mountains: 'Góry · droga do celu', worksite: 'Budowa · mocne fundamenty',
};

const adCategoryLabels: Record<string, string> = {
  performance: 'Sprzedażowa', creative: 'Kreatywna', modern: 'Nowoczesna',
  educational: 'Edukacyjna', premium: 'Premium', scenic: 'Sceniczna',
};

const getAdPromptColors = (prompt: AdPrompt) => {
  const direct = Array.isArray(prompt.colors) ? prompt.colors : [];
  const fallback = prompt.prompt.match(/#[0-9a-f]{6}/gi) || [];
  return [...new Set([...direct, ...fallback].filter((color) => /^#[0-9a-f]{6}$/i.test(color)).map((color) => color.toLowerCase()))].slice(0, 5);
};

const getAdPromptCta = (prompt: AdPrompt) => {
  if (prompt.ctaPl?.trim()) return prompt.ctaPl.trim();
  const visible = prompt.prompt.match(/BEGIN_VISIBLE_TEXT\s*([\s\S]*?)\s*END_VISIBLE_TEXT/i)?.[1];
  if (!visible) return '';
  try {
    const values = JSON.parse(visible);
    return Array.isArray(values) && typeof values.at(-1) === 'string' ? values.at(-1) : '';
  } catch {
    return '';
  }
};

const profileMenu: Array<{
  id: ProfileSection;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  { id: 'profile', label: 'Profil', description: 'Dane konta', icon: User },
  { id: 'companies', label: 'Moje firmy', description: 'Brandbooki i prompty', icon: BriefcaseBusiness },
  { id: 'adPrompts', label: 'Prompty reklamowe', description: 'Historia reklam', icon: Megaphone },
  { id: 'admin', label: 'Admin', description: 'Panel administratora', icon: Shield },
  { id: 'purchases', label: 'Zakupy', description: 'Historia płatności', icon: CreditCard },
  { id: 'security', label: 'Bezpieczeństwo', description: 'Hasło i logowanie', icon: KeyRound },
  { id: 'danger', label: 'Konto', description: 'Usunięcie konta', icon: AlertTriangle },
];

const normalizePdfText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');

const safeFileName = (value: string) =>
  normalizePdfText(value || 'brandbook')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'brandbook';

const addPdfWrappedText = (pdf: PdfDocument, text: string, x: number, y: number, width: number, lineHeight = 5) => {
  const lines = pdf.splitTextToSize(normalizePdfText(text), width);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
};

type TwoFactorStatusResponse = {
  ok: boolean;
  enabled: boolean;
  recoveryCodes?: {
    total: number;
    unused: number;
  };
};

type TwoFactorSetupResponse = {
  ok: boolean;
  secret: string;
  otpauthUrl: string;
};

type TwoFactorEnableResponse = {
  ok: boolean;
  enabled: boolean;
  recoveryCodes?: string[];
};

type TwoFactorRecoveryCodesResponse = {
  ok: boolean;
  recoveryCodes: string[];
};

const addPdfPageTitle = (pdf: PdfDocument, title: string, page: number) => {
  if (page > 1) pdf.addPage();
  pdf.setFillColor(17, 24, 39);
  pdf.rect(0, 0, 210, 18, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text(normalizePdfText(title), 14, 11);
  pdf.text(String(page).padStart(2, '0'), 190, 11);
  pdf.setTextColor(17, 24, 39);
};

const drawPdfCard = (pdf: PdfDocument, x: number, y: number, width: number, height: number, fill = [249, 250, 251]) => {
  pdf.setFillColor(fill[0], fill[1], fill[2]);
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(x, y, width, height, 4, 4, 'FD');
};

const drawPdfLabelValue = (pdf: PdfDocument, label: string, value: string, x: number, y: number, width: number) => {
  pdf.setFontSize(7);
  pdf.setTextColor(107, 114, 128);
  pdf.text(normalizePdfText(label).toUpperCase(), x, y);
  pdf.setFontSize(9);
  pdf.setTextColor(17, 24, 39);
  return addPdfWrappedText(pdf, value || '-', x, y + 5, width, 4) + 3;
};

const extractHexColors = (value: string) => {
  const matches = value.match(/#[0-9a-fA-F]{3,6}/g) || [];
  return matches.slice(0, 6);
};

const profileBrandbookThemes = [
  {
    id: 'minimal-white',
    title: 'Minimal White',
    colors: ['#ffffff', '#111827', '#e5e7eb', '#9ca3af'],
    fontMood: 'nowoczesny',
    headingFont: 'Montserrat / Poppins SemiBold',
    bodyFont: 'Inter / Open Sans Regular',
    description: 'Czysty, prosty i bardzo czytelny kierunek wizualny.',
  },
  {
    id: 'premium-black-gold',
    title: 'Premium Black & Gold',
    colors: ['#111111', '#f7f2e8', '#c9a227', '#ffffff'],
    fontMood: 'elegancki',
    headingFont: 'Playfair Display / Cormorant Bold',
    bodyFont: 'Inter / Lato Regular',
    description: 'Luksusowy kontrast, spokojne tło i złote akcenty.',
  },
  {
    id: 'automations-ai',
    title: 'Automation AI',
    colors: ['#08111f', '#f8fbff', '#38bdf8', '#8b5cf6', '#22c55e'],
    fontMood: 'nowoczesny',
    headingFont: 'Space Grotesk / Sora Bold',
    bodyFont: 'Inter / IBM Plex Sans Regular',
    description: 'Technologiczny styl dla AI, automatyzacji i procesów.',
  },
  {
    id: 'construction-premium',
    title: 'Construction Premium',
    colors: ['#18181b', '#f8fafc', '#f59e0b', '#52525b'],
    fontMood: 'techniczny',
    headingFont: 'Oswald / Bebas Neue',
    bodyFont: 'Inter / Roboto Regular',
    description: 'Solidny, techniczny i kontrastowy styl dla wykonawców.',
  },
  {
    id: 'finance-navy-gold',
    title: 'Finance Navy Gold',
    colors: ['#0b1324', '#f8fafc', '#d4af37', '#64748b'],
    fontMood: 'elegancki',
    headingFont: 'Libre Baskerville / Playfair Display',
    bodyFont: 'Inter / Source Sans 3',
    description: 'Spokojny styl premium dla finansów i doradztwa.',
  },
  {
    id: 'tattoo-dark-ink',
    title: 'Tattoo Dark Ink',
    colors: ['#0b0b0f', '#f3efe7', '#8b1e3f', '#c7a76c'],
    fontMood: 'odważny',
    headingFont: 'Oswald / Archivo Black',
    bodyFont: 'Inter / Roboto Condensed',
    description: 'Ciemny, mocny klimat studia tatuażu lub marki kreatywnej.',
  },
  {
    id: 'salon-champagne',
    title: 'Salon Champagne',
    colors: ['#3f2a2d', '#fff7f2', '#e7c8a0', '#b76e79'],
    fontMood: 'elegancki',
    headingFont: 'Cormorant Garamond / Playfair Display',
    bodyFont: 'Lato / Inter Regular',
    description: 'Miękki, kobiecy i elegancki styl beauty premium.',
  },
  {
    id: 'local-clean',
    title: 'Local Clean',
    colors: ['#1f2937', '#ffffff', '#10b981', '#e5e7eb'],
    fontMood: 'klasyczny',
    headingFont: 'Montserrat / Poppins',
    bodyFont: 'Inter / Lato Regular',
    description: 'Schludny i praktyczny kierunek dla lokalnych usług.',
  },
];

const getProfileBrandbookTheme = (themeId: string, industry: string) => {
  const direct = profileBrandbookThemes.find((theme) => theme.id === themeId);
  if (direct) return direct;

  const text = normalizePdfText(`${themeId} ${industry}`).toLowerCase();
  if (/automat| ai |workflow|zapier|make|proces/.test(text)) return profileBrandbookThemes.find((theme) => theme.id === 'automations-ai') || profileBrandbookThemes[0];
  if (/budow|remont|wykon|elektry|hydraul|tapet|malowan/.test(text)) return profileBrandbookThemes.find((theme) => theme.id === 'construction-premium') || profileBrandbookThemes[0];
  if (/finans|forex|trading|inwest|kapital/.test(text)) return profileBrandbookThemes.find((theme) => theme.id === 'finance-navy-gold') || profileBrandbookThemes[0];
  if (/tatua|tattoo|piercing/.test(text)) return profileBrandbookThemes.find((theme) => theme.id === 'tattoo-dark-ink') || profileBrandbookThemes[0];
  if (/beauty|salon|kosmet|fryz|paznok/.test(text)) return profileBrandbookThemes.find((theme) => theme.id === 'salon-champagne') || profileBrandbookThemes[0];
  return profileBrandbookThemes.find((theme) => theme.id === 'minimal-white') || profileBrandbookThemes[0];
};

const resolveBrandbookColors = (customColors: string, themeColors: string[]) => {
  const custom = extractHexColors(customColors);
  return (custom.length ? custom : themeColors).slice(0, 6);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((char) => `${char}${char}`).join('') : clean;
  const number = Number.parseInt(full, 16);
  if (!Number.isFinite(number)) return [17, 24, 39];
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

const loadAssetDataUrl = async (url?: string | null) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const pdfImageFormat = (dataUrl: string) => (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG');

const brandbookValue = (pack: CompanyAssistantPackage, key: string, fallback = '') => {
  const value = pack.profile?.[key] || (key === 'companyName' ? pack.companyName : key === 'industry' ? pack.industry : fallback);
  return String(value || fallback || '').trim();
};

const resolveDocumentPalette = (
  pack: CompanyAssistantPackage,
  theme: (typeof profileBrandbookThemes)[number],
) => {
  const base = resolveBrandbookColors(pack.profile?.customColors || '', theme.colors);
  return [
    brandbookValue(pack, 'documentPrimary') || base[0] || '#111827',
    brandbookValue(pack, 'documentPaper') || base[1] || '#ffffff',
    brandbookValue(pack, 'documentAccent') || base[2] || '#38bdf8',
    base[3] || '#64748b',
    ...base.slice(4),
  ];
};

const resolveDocumentLogo = (pack: CompanyAssistantPackage, assets: CompanyAssistantAsset[]) => {
  const selectedId = brandbookValue(pack, 'documentLogoAssetId');
  if (selectedId === 'none') return undefined;
  if (selectedId) {
    const selected = assets.find((asset) => asset.id === selectedId);
    if (selected) return selected;
  }
  return assets.find((asset) => asset.assetType === 'logo' || asset.materialId === 'logo-concept' || asset.materialId === 'uploaded-logo');
};

const getBrandbookCompleteness = (pack: CompanyAssistantPackage) => {
  const checks = [
    { label: 'Nazwa firmy', ok: Boolean(brandbookValue(pack, 'companyName')) },
    { label: 'Branża / specjalizacja', ok: Boolean(brandbookValue(pack, 'industry')) },
    { label: 'Oferta', ok: Boolean(brandbookValue(pack, 'offer') || brandbookValue(pack, 'specialization')) },
    { label: 'Klient docelowy', ok: Boolean(brandbookValue(pack, 'targetAudience')) },
    { label: 'Wyróżnik', ok: Boolean(brandbookValue(pack, 'differentiator')) },
    { label: 'Ton komunikacji', ok: Boolean(brandbookValue(pack, 'tone')) },
    { label: 'CTA', ok: Boolean(brandbookValue(pack, 'cta')) },
    { label: 'Kolory marki', ok: Boolean(brandbookValue(pack, 'customColors') || brandbookValue(pack, 'selectedThemeId')) },
  ];
  return {
    checks,
    completed: checks.filter((item) => item.ok).length,
    total: checks.length,
    missing: checks.filter((item) => !item.ok).map((item) => item.label),
  };
};

const drawPdfFooter = (pdf: PdfDocument, brandName: string) => {
  pdf.setDrawColor(229, 231, 235);
  pdf.line(14, 284, 196, 284);
  pdf.setFontSize(7);
  pdf.setTextColor(107, 114, 128);
  pdf.text(normalizePdfText(`${brandName} / brandbook dokumentowy`), 14, 290);
  pdf.text(normalizePdfText(new Date().toLocaleDateString('pl-PL')), 174, 290);
  pdf.setTextColor(17, 24, 39);
};

const addBrandbookDocPage = (pdf: PdfDocument, title: string, page: number, brandName: string) => {
  addPdfPageTitle(pdf, title, page);
  drawPdfFooter(pdf, brandName);
};

const drawPdfSectionLead = (pdf: PdfDocument, title: string, description: string, y = 38) => {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(17, 24, 39);
  pdf.text(normalizePdfText(title), 14, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(75, 85, 99);
  return addPdfWrappedText(pdf, description, 14, y + 8, 178, 5) + 8;
};

const drawPdfSwatch = (pdf: PdfDocument, color: string, label: string, x: number, y: number, width = 54) => {
  const [r, g, b] = hexToRgb(color);
  pdf.setFillColor(r, g, b);
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(x, y, width, 26, 4, 4, 'FD');
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(8);
  pdf.text(normalizePdfText(label), x, y + 36);
  pdf.setFont('helvetica', 'bold');
  pdf.text(color.toUpperCase(), x, y + 42);
  pdf.setFont('helvetica', 'normal');
};

const drawPdfChecklistItem = (pdf: PdfDocument, text: string, ok: boolean, x: number, y: number, width = 84) => {
  pdf.setFillColor(ok ? 236 : 254, ok ? 253 : 242, ok ? 245 : 242);
  pdf.setDrawColor(ok ? 16 : 248, ok ? 185 : 113, ok ? 129 : 113);
  pdf.roundedRect(x, y, width, 12, 3, 3, 'FD');
  pdf.setFontSize(8);
  pdf.setTextColor(ok ? 6 : 153, ok ? 95 : 27, ok ? 70 : 27);
  pdf.text(normalizePdfText(`${ok ? 'OK' : 'DO UZUP.'} ${text}`), x + 4, y + 8);
  pdf.setTextColor(17, 24, 39);
};

const escapeHtml = (value?: string | null) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const nl2br = (value?: string | null) => escapeHtml(value).replace(/\n/g, '<br />');

const buildBrandbookHtmlDocument = ({
  pack,
  relatedAssets,
  logoAsset,
  brandbookTheme,
  palette,
}: {
  pack: CompanyAssistantPackage;
  relatedAssets: CompanyAssistantAsset[];
  logoAsset?: CompanyAssistantAsset;
  brandbookTheme: (typeof profileBrandbookThemes)[number];
  palette: string[];
}) => {
  const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
  const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
  const offer = brandbookValue(pack, 'offer') || brandbookValue(pack, 'specialization') || industry;
  const audience = brandbookValue(pack, 'targetAudience') || 'Do uzupełnienia';
  const differentiator = brandbookValue(pack, 'differentiator') || 'Do uzupełnienia';
  const tone = brandbookValue(pack, 'tone') || 'Profesjonalny, konkretny i czytelny';
  const cta = brandbookValue(pack, 'cta') || 'Skontaktuj się / sprawdź ofertę';
  const avoidList = brandbookValue(pack, 'avoidList') || 'chaosu, losowych kolorów, zbyt wielu fontów, nieczytelnych napisów';
  const contact = [
    brandbookValue(pack, 'phone'),
    brandbookValue(pack, 'email'),
    brandbookValue(pack, 'website'),
    brandbookValue(pack, 'instagram'),
  ].filter(Boolean);
  const completeness = getBrandbookCompleteness(pack);
  const primary = palette[0] || '#111827';
  const paper = palette[1] || '#ffffff';
  const accent = palette[2] || '#38bdf8';
  const neutral = palette[3] || '#64748b';
  const colorRoles = ['Primary', 'Background', 'Accent / CTA', 'Text / neutral', 'Support', 'Extra'];
  const prompts = pack.prompts || [];
  const previewAssets = relatedAssets.slice(0, 9);

  const swatches = palette.map((color, index) => `
    <div class="swatch">
      <div class="swatch-color" style="background:${escapeHtml(color)}"></div>
      <div class="swatch-label">${escapeHtml(colorRoles[index] || 'Extra')}</div>
      <div class="swatch-hex">${escapeHtml(color.toUpperCase())}</div>
    </div>
  `).join('');

  const checklist = completeness.checks.map((item) => `
    <div class="check ${item.ok ? 'ok' : 'missing'}">
      <span>${item.ok ? '✓' : '!'}</span>
      <strong>${escapeHtml(item.label)}</strong>
    </div>
  `).join('');

  const promptCards = prompts.length
    ? prompts.map((prompt, index) => `
      <article class="prompt-card">
        <div class="eyebrow">Prompt ${index + 1} · ${escapeHtml(prompt.format || 'format')}</div>
        <h3>${escapeHtml(prompt.title)}</h3>
        <p>${nl2br(prompt.prompt.slice(0, 900))}</p>
      </article>
    `).join('')
    : '<p class="muted">Brak zapisanych promptów w tym projekcie.</p>';

  const assetCards = previewAssets.length
    ? previewAssets.map((asset) => `
      <article class="asset-card">
        ${asset.signedUrl ? `<img src="${escapeHtml(asset.signedUrl)}" alt="${escapeHtml(asset.materialTitle || asset.materialId)}" />` : '<div class="asset-empty">Brak podglądu</div>'}
        <div>
          <strong>${escapeHtml(asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId || 'Materiał')}</strong>
          <span>${escapeHtml(asset.dimensions || 'format nieznany')}</span>
        </div>
      </article>
    `).join('')
    : '<p class="muted">Brak wygenerowanych elementów przypiętych do firmy.</p>';

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} — Brandbook</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 12px;
      background: rgba(255,255,255,.92);
      border-bottom: 1px solid #d1d5db;
      backdrop-filter: blur(12px);
    }
    .toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 11px 18px;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
      background: linear-gradient(135deg, #c13ee7, #ef3f93, #38a9e8);
    }
    .toolbar span { align-self: center; color: #6b7280; font-size: 13px; }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      padding: 18mm;
      page-break-after: always;
      background: #fff;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 60px rgba(15,23,42,.18);
    }
    .page:last-child { page-break-after: auto; }
    .cover {
      color: #fff;
      background:
        radial-gradient(circle at 82% 18%, ${escapeHtml(accent)}88, transparent 32%),
        radial-gradient(circle at 16% 78%, ${escapeHtml(neutral)}66, transparent 32%),
        linear-gradient(135deg, ${escapeHtml(primary)}, #020617 72%);
    }
    .cover-card {
      margin-top: 78mm;
      max-width: 128mm;
    }
    .cover h1 {
      margin: 0;
      font-size: 52px;
      line-height: 1.08;
      letter-spacing: -2.6px;
    }
    .cover p { color: rgba(255,255,255,.78); font-size: 16px; line-height: 1.65; }
    .cover-logo {
      position: absolute;
      right: 18mm;
      top: 18mm;
      width: 42mm;
      height: 42mm;
      border-radius: 24px;
      background: rgba(255,255,255,.95);
      display: grid;
      place-items: center;
      padding: 8px;
    }
    .cover-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .kicker { text-transform: uppercase; letter-spacing: 2.4px; font-size: 11px; font-weight: 900; color: ${escapeHtml(accent)}; }
    h2 { margin: 0 0 12px; font-size: 34px; line-height: 1.14; letter-spacing: -1.4px; }
    h3 { margin: 0 0 8px; font-size: 18px; letter-spacing: -.3px; }
    p { line-height: 1.65; }
    .muted { color: #6b7280; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 22px;
      padding: 18px;
      background: #f8fafc;
    }
    .dark-card {
      background: ${escapeHtml(primary)};
      color: #fff;
      border: 0;
    }
    .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 900; }
    .value { margin-top: 6px; font-size: 15px; font-weight: 700; }
    .swatch { border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; background: #fff; }
    .swatch-color { height: 76px; }
    .swatch-label { padding: 12px 14px 2px; color: #6b7280; font-size: 12px; font-weight: 800; }
    .swatch-hex { padding: 0 14px 14px; font-size: 16px; font-weight: 900; }
    .logo-stage {
      min-height: 94mm;
      border-radius: 28px;
      border: 1px solid #e5e7eb;
      background: ${escapeHtml(paper)};
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .logo-stage img { max-width: 75%; max-height: 70mm; object-fit: contain; }
    .type-sample {
      padding: 28px;
      border-radius: 26px;
      background: linear-gradient(135deg, #f8fafc, #eef2ff);
      border: 1px solid #e5e7eb;
    }
    .type-sample strong { display: block; font-size: 42px; line-height: 1.12; letter-spacing: -2px; }
    .check {
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 999px;
      padding: 10px 13px;
      font-size: 13px;
      border: 1px solid #e5e7eb;
    }
    .check span {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      color: #fff;
      font-weight: 900;
    }
    .check.ok { background: #ecfdf5; border-color: #a7f3d0; }
    .check.ok span { background: #10b981; }
    .check.missing { background: #fff7ed; border-color: #fed7aa; }
    .check.missing span { background: #f97316; }
    .prompt-card {
      break-inside: avoid;
      margin-bottom: 12px;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      background: #f8fafc;
    }
    .prompt-card p { margin-bottom: 0; font-size: 12px; color: #334155; }
    .eyebrow { color: ${escapeHtml(accent)}; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.2px; }
    .asset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .asset-card { border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden; background: #fff; break-inside: avoid; }
    .asset-card img, .asset-empty { width: 100%; height: 42mm; object-fit: cover; background: #f3f4f6; display: grid; place-items: center; color: #6b7280; font-size: 12px; }
    .asset-card div:last-child { padding: 10px 12px 12px; }
    .asset-card strong { display: block; font-size: 13px; }
    .asset-card span { color: #6b7280; font-size: 12px; }
    .footer {
      position: absolute;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      display: flex;
      justify-content: space-between;
      color: #9ca3af;
      font-size: 10px;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Pobierz / zapisz jako PDF</button>
    <span>W oknie drukowania wybierz „Zapisz jako PDF”.</span>
  </div>

  <section class="page cover">
    ${logoAsset?.signedUrl ? `<div class="cover-logo"><img src="${escapeHtml(logoAsset.signedUrl)}" alt="Logo ${escapeHtml(brandName)}" /></div>` : ''}
    <div class="cover-card">
      <div class="kicker">Brandbook dokumentowy</div>
      <h1>${escapeHtml(brandName)}</h1>
      <p>${escapeHtml(industry)} · ${escapeHtml(brandbookTheme.title)}</p>
      <p>Spójny system marki: brief, logo, kolory, typografia, komunikacja, prompty i zapisane elementy.</p>
    </div>
  </section>

  <section class="page">
    <div class="kicker">01 / Fundament</div>
    <h2>Tak rozumiemy markę</h2>
    <div class="grid-2">
      <div class="card"><div class="label">Oferta</div><div class="value">${escapeHtml(offer)}</div></div>
      <div class="card"><div class="label">Klient docelowy</div><div class="value">${escapeHtml(audience)}</div></div>
      <div class="card"><div class="label">Wyróżnik</div><div class="value">${escapeHtml(differentiator)}</div></div>
      <div class="card"><div class="label">CTA</div><div class="value">${escapeHtml(cta)}</div></div>
      <div class="card"><div class="label">Ton komunikacji</div><div class="value">${escapeHtml(tone)}</div></div>
      <div class="card"><div class="label">Kontakt</div><div class="value">${contact.length ? escapeHtml(contact.join(' · ')) : 'Do uzupełnienia'}</div></div>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>01</span></div>
  </section>

  <section class="page">
    <div class="kicker">02 / Logo</div>
    <h2>Logo i zasady użycia</h2>
    <div class="grid-2">
      <div class="logo-stage">${logoAsset?.signedUrl ? `<img src="${escapeHtml(logoAsset.signedUrl)}" alt="Logo" />` : '<p class="muted">Brak logo. Wygeneruj logo, a aplikacja doda je do brandbooka.</p>'}</div>
      <div>
        <div class="card dark-card">
          <h3>Używaj</h3>
          <p>Logo na spokojnym tle, z dużym marginesem ochronnym i bez zmiany proporcji. W reklamach nazwa ma być czytelna.</p>
        </div>
        <br />
        <div class="card">
          <h3>Unikaj</h3>
          <p>Nie rozciągaj logo, nie zmieniaj liter, nie dodawaj przypadkowych cieni, ramek ani efektów, jeśli nie są częścią identyfikacji.</p>
        </div>
      </div>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>02</span></div>
  </section>

  <section class="page">
    <div class="kicker">03 / Kolory</div>
    <h2>Paleta kolorów</h2>
    <p class="muted">Kolory mają role — dzięki temu wizytówka, oferta, post i reklama wyglądają jak jedna marka.</p>
    <div class="grid-3">${swatches}</div>
    <br />
    <div class="card">
      <h3>Rekomendacja</h3>
      <p>Kolor główny stosuj w logo, nagłówkach i tłach premium. Akcent ${escapeHtml(accent)} zostaw dla CTA, ikon i elementów wymagających uwagi. Tekst musi mieć wysoki kontrast względem tła.</p>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>03</span></div>
  </section>

  <section class="page">
    <div class="kicker">04 / Typografia</div>
    <h2>Fonty i hierarchia</h2>
    <div class="type-sample">
      <strong>${escapeHtml(brandName)}</strong>
      <p>${escapeHtml(offer)}</p>
    </div>
    <br />
    <div class="grid-2">
      <div class="card"><div class="label">Nagłówki</div><div class="value">${escapeHtml(brandbookTheme.headingFont)}</div></div>
      <div class="card"><div class="label">Tekst zwykły</div><div class="value">${escapeHtml(brandbookTheme.bodyFont)}</div></div>
      <div class="card"><h3>Zasada headline</h3><p>Krótki, mocny, maksymalnie 1–2 linie. Bez drobnych napisów na skomplikowanym tle.</p></div>
      <div class="card"><h3>Zasada opisów</h3><p>Prosty język, czytelny kontrast i jedna hierarchia. Mniej tekstu, więcej oddechu.</p></div>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>04</span></div>
  </section>

  <section class="page">
    <div class="kicker">05 / Styl i komunikacja</div>
    <h2>${escapeHtml(brandbookTheme.title)}</h2>
    <div class="grid-2">
      <div class="card"><h3>Styl wizualny</h3><p>${escapeHtml(brandbookTheme.description)}</p></div>
      <div class="card"><h3>Ton marki</h3><p>${escapeHtml(tone)}</p></div>
      <div class="card"><h3>Przykładowe hasła</h3><p>${escapeHtml(brandName)} — ${escapeHtml(offer)}<br />${escapeHtml(cta)}</p></div>
      <div class="card"><h3>Unikać</h3><p>${escapeHtml(avoidList)}</p></div>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>05</span></div>
  </section>

  <section class="page">
    <div class="kicker">06 / Checklist</div>
    <h2>Gotowość brandbooka</h2>
    <p class="muted">Kompletność: ${completeness.completed}/${completeness.total}. Braki nie blokują PDF, ale wpływają na jakość kolejnych promptów.</p>
    <div class="grid-2">${checklist}</div>
    <br />
    <div class="card">
      <h3>Następne kroki</h3>
      <p>Uzupełnij brakujące pola, dopnij finalne logo, wygeneruj dwustronną wizytówkę, ofertę i 3–5 reklam. Każdy dobry wynik zapisuj do firmy.</p>
    </div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>06</span></div>
  </section>

  <section class="page">
    <div class="kicker">07 / Prompty</div>
    <h2>Prompty materiałów</h2>
    ${promptCards}
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>07</span></div>
  </section>

  <section class="page">
    <div class="kicker">08 / Assety</div>
    <h2>Wygenerowane elementy</h2>
    <div class="asset-grid">${assetCards}</div>
    <div class="footer"><span>${escapeHtml(brandName)}</span><span>08</span></div>
  </section>
</body>
</html>`;
};

const readableTextColor = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#111827' : '#ffffff';
};

const buildBusinessCardHtmlDocument = ({
  pack,
  logoAsset,
  brandbookTheme,
  palette,
  editor,
}: {
  pack: CompanyAssistantPackage;
  logoAsset?: CompanyAssistantAsset;
  brandbookTheme: (typeof profileBrandbookThemes)[number];
  palette: string[];
  editor?: BusinessCardEditorDraft;
}) => {
  const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
  const industry = brandbookValue(pack, 'industry', '');
  const specialization = brandbookValue(pack, 'specialization') || brandbookValue(pack, 'offer') || industry;
  const contactPerson = brandbookValue(pack, 'contactPerson');
  const jobTitle = brandbookValue(pack, 'jobTitle');
  const slogan = editor?.showSlogan === false ? '' : brandbookValue(pack, 'slogan') || brandbookValue(pack, 'mainMessage');
  const location = editor?.showLocation === false ? '' : brandbookValue(pack, 'location');
  const primary = editor?.primary || brandbookValue(pack, 'businessCardPrimary') || palette[0] || '#111827';
  const paper = editor?.paper || brandbookValue(pack, 'businessCardPaper') || palette[1] || '#ffffff';
  const accent = editor?.accent || brandbookValue(pack, 'businessCardAccent') || palette[2] || '#38bdf8';
  const neutral = palette[3] || '#64748b';
  const primaryText = readableTextColor(primary);
  const paperText = readableTextColor(paper);
  const initials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
  const contactRows = [
    brandbookValue(pack, 'phone') ? ['TEL', brandbookValue(pack, 'phone')] : null,
    brandbookValue(pack, 'email') ? ['E-MAIL', brandbookValue(pack, 'email')] : null,
    brandbookValue(pack, 'website') ? ['WWW', brandbookValue(pack, 'website')] : null,
    brandbookValue(pack, 'instagram') ? ['IG', brandbookValue(pack, 'instagram')] : null,
    location ? ['OBSZAR', location] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const rowsHtml = contactRows.length
    ? contactRows.map(([label, value]) => `
      <div class="contact-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('')
    : '<div class="empty-contact">Uzupełnij dane kontaktowe w panelu firmy.</div>';
  const logoHtml = logoAsset?.signedUrl
    ? `<img src="${escapeHtml(logoAsset.signedUrl)}" alt="Logo ${escapeHtml(brandName)}" />`
    : `<div class="initials">${escapeHtml(initials)}</div>`;
  const variantId = editor?.variantId || brandbookValue(pack, 'business-cardVariantId', 'brand-first');
  const variantClass = ['typographic-premium', 'bold-split'].includes(variantId) ? variantId : 'brand-first';

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} — wizytówka 90x50 mm</title>
  <style>
    @page { size: 96mm 56mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body {
      background: #e5e7eb;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      background: rgba(255,255,255,.95);
      border-bottom: 1px solid #d1d5db;
      backdrop-filter: blur(12px);
    }
    .toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 11px 18px;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
      background: linear-gradient(135deg, #c13ee7, #ef3f93, #38a9e8);
    }
    .toolbar span { color: #64748b; font-size: 12px; }
    .sheet {
      position: relative;
      width: 96mm;
      height: 56mm;
      margin: 22px auto;
      page-break-after: always;
      overflow: hidden;
      background: var(--bleed-background);
      box-shadow: 0 14px 45px rgba(15,23,42,.22);
    }
    .sheet:last-child { page-break-after: auto; }
    .trim {
      position: absolute;
      inset: 3mm;
      width: 90mm;
      height: 50mm;
      overflow: hidden;
    }
    .safe {
      position: absolute;
      inset: 3.5mm;
      z-index: 2;
      display: flex;
    }
    .front {
      --bleed-background: ${escapeHtml(primary)};
      color: ${escapeHtml(primaryText)};
    }
    .front .trim { background: ${escapeHtml(primary)}; }
    .front .safe { align-items: center; justify-content: center; text-align: center; }
    .brand-lockup { max-width: 72mm; }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 16mm;
      margin: 0 auto 3mm;
    }
    .logo img { max-width: 48mm; max-height: 16mm; object-fit: contain; }
    .initials {
      display: grid;
      place-items: center;
      width: 14mm;
      height: 14mm;
      margin: 0 auto;
      border: .6mm solid ${escapeHtml(accent)};
      border-radius: 4mm;
      color: ${escapeHtml(accent)};
      font-size: 7mm;
      font-weight: 950;
      letter-spacing: -.6mm;
    }
    .brand-name { margin: 0; font-size: 6mm; line-height: 1.1; letter-spacing: -.25mm; font-weight: 950; }
    .brand-line { margin: 2mm auto 0; max-width: 65mm; font-size: 2.45mm; line-height: 1.5; opacity: .78; }
    .accent-line { width: 13mm; height: .8mm; margin: 3mm auto 0; border-radius: 1mm; background: ${escapeHtml(accent)}; }
    .back {
      --bleed-background: ${escapeHtml(paper)};
      color: ${escapeHtml(paperText)};
    }
    .back .trim { background: ${escapeHtml(paper)}; }
    .back .safe { align-items: stretch; gap: 5mm; }
    .identity {
      width: 32mm;
      padding-right: 4mm;
      border-right: .35mm solid ${escapeHtml(accent)};
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .identity .mini-logo { display: flex; align-items: center; min-height: 9mm; margin-bottom: 2.5mm; }
    .identity .mini-logo img { max-width: 27mm; max-height: 9mm; object-fit: contain; object-position: left center; }
    .identity .mini-logo .initials { width: 8mm; height: 8mm; margin: 0; border-width: .35mm; border-radius: 2mm; font-size: 3.6mm; letter-spacing: -.3mm; }
    .person { margin: 0; font-size: 3.5mm; line-height: 1.18; font-weight: 900; }
    .role { margin: 1.2mm 0 0; font-size: 2.1mm; line-height: 1.45; color: ${escapeHtml(neutral)}; }
    .details { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 1.6mm; min-width: 0; }
    .contact-row { display: grid; grid-template-columns: 10mm minmax(0, 1fr); align-items: baseline; gap: 2mm; }
    .contact-row span { color: ${escapeHtml(accent)}; font-size: 1.65mm; font-weight: 900; letter-spacing: .18mm; }
    .contact-row strong { min-width: 0; overflow-wrap: anywhere; font-size: 2.25mm; line-height: 1.3; font-weight: 720; }
    .empty-contact { padding: 3mm; border: .3mm dashed ${escapeHtml(neutral)}; border-radius: 2mm; color: ${escapeHtml(neutral)}; font-size: 2.2mm; line-height: 1.55; }
    .typographic-premium.front .logo { display: none; }
    .typographic-premium.front .brand-name { font-family: Georgia, "Times New Roman", serif; font-size: 7mm; font-weight: 700; letter-spacing: -.15mm; }
    .typographic-premium.front .accent-line { width: 22mm; height: .35mm; }
    .bold-split.front .trim::after {
      content: "";
      position: absolute;
      top: -12mm;
      right: -11mm;
      width: 42mm;
      height: 75mm;
      background: ${escapeHtml(accent)};
      transform: rotate(18deg);
      opacity: .95;
    }
    .bold-split.front .safe { justify-content: flex-start; text-align: left; }
    .bold-split.front .brand-lockup { max-width: 54mm; }
    .bold-split.front .logo { justify-content: flex-start; margin-left: 0; }
    .bold-split.front .initials { margin-left: 0; }
    .bold-split.front .brand-line { margin-left: 0; }
    .bold-split.front .accent-line { margin-left: 0; }
    .guide {
      position: absolute;
      inset: 3mm;
      z-index: 10;
      pointer-events: none;
      border: 1px dashed rgba(239,68,68,.55);
    }
    .guide::after {
      content: "strefa cięcia 90 × 50 mm";
      position: absolute;
      right: 1mm;
      bottom: .6mm;
      padding: .4mm 1mm;
      border-radius: 1mm;
      color: #b91c1c;
      background: rgba(255,255,255,.82);
      font-size: 1.5mm;
    }
    @media print {
      body { background: #fff; }
      .toolbar, .guide { display: none; }
      .sheet { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Pobierz / zapisz jako PDF</button>
    <span>PDF ma 2 strony po 96 × 56 mm: format netto 90 × 50 mm + spad 3 mm.</span>
  </div>

  <section class="sheet front ${escapeHtml(variantClass)}">
    <div class="trim"></div>
    <div class="safe">
      <div class="brand-lockup">
        <div class="logo">${logoHtml}</div>
        ${!logoAsset?.signedUrl || variantClass === 'typographic-premium' ? `<h1 class="brand-name">${escapeHtml(brandName)}</h1>` : ''}
        ${specialization ? `<p class="brand-line">${escapeHtml(specialization)}</p>` : ''}
        ${slogan && slogan !== specialization ? `<p class="brand-line">${escapeHtml(slogan)}</p>` : ''}
        <div class="accent-line"></div>
      </div>
    </div>
    <div class="guide"></div>
  </section>

  <section class="sheet back ${escapeHtml(variantClass)}">
    <div class="trim"></div>
    <div class="safe">
      <div class="identity">
        <div class="mini-logo">${logoHtml}</div>
        <h2 class="person">${escapeHtml(contactPerson || brandName)}</h2>
        <p class="role">${escapeHtml(jobTitle || specialization || industry)}</p>
      </div>
      <div class="details">${rowsHtml}</div>
    </div>
    <div class="guide"></div>
  </section>
</body>
</html>`;
};

const buildOfferHtmlDocument = ({
  pack,
  logoAsset,
  brandbookTheme,
  palette,
}: {
  pack: CompanyAssistantPackage;
  logoAsset?: CompanyAssistantAsset;
  brandbookTheme: (typeof profileBrandbookThemes)[number];
  palette: string[];
}) => {
  const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
  const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
  const offer = brandbookValue(pack, 'offer') || brandbookValue(pack, 'specialization') || industry;
  const audience = brandbookValue(pack, 'targetAudience') || 'Klient docelowy do uzupełnienia';
  const customerProblem = brandbookValue(pack, 'customerProblem') || brandbookValue(pack, 'positioning');
  const differentiator = brandbookValue(pack, 'differentiator') || 'Wyróżnik marki do uzupełnienia';
  const cta = brandbookValue(pack, 'cta') || 'Skontaktuj się i poznaj szczegóły';
  const slogan = brandbookValue(pack, 'slogan') || brandbookValue(pack, 'mainMessage');
  const primary = palette[0] || '#111827';
  const paper = palette[1] || '#ffffff';
  const accent = palette[2] || '#38bdf8';
  const neutral = palette[3] || '#64748b';
  const contact = [
    brandbookValue(pack, 'phone'),
    brandbookValue(pack, 'email'),
    brandbookValue(pack, 'website'),
    brandbookValue(pack, 'instagram'),
    brandbookValue(pack, 'location'),
  ].filter(Boolean);
  const logoHtml = logoAsset?.signedUrl
    ? `<img src="${escapeHtml(logoAsset.signedUrl)}" alt="Logo ${escapeHtml(brandName)}" />`
    : `<strong>${escapeHtml(brandName)}</strong>`;

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} — oferta A4</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding: 12px; background: rgba(255,255,255,.94); border-bottom: 1px solid #d1d5db; }
    .toolbar button { border: 0; border-radius: 999px; padding: 11px 18px; color: #fff; font-weight: 800; cursor: pointer; background: linear-gradient(135deg, #c13ee7, #ef3f93, #38a9e8); }
    .toolbar span { color: #64748b; font-size: 12px; }
    .page { position: relative; width: 210mm; min-height: 297mm; margin: 18px auto; overflow: hidden; background: ${escapeHtml(paper)}; color: ${escapeHtml(readableTextColor(paper))}; box-shadow: 0 16px 60px rgba(15,23,42,.18); }
    .hero { min-height: 96mm; padding: 16mm 18mm 14mm; color: ${escapeHtml(readableTextColor(primary))}; background: radial-gradient(circle at 88% 12%, ${escapeHtml(accent)}aa, transparent 31%), linear-gradient(135deg, ${escapeHtml(primary)}, ${escapeHtml(primary)}e8); }
    .topline { display: flex; align-items: center; justify-content: space-between; gap: 12mm; }
    .logo { display: flex; align-items: center; min-height: 12mm; }
    .logo img { max-width: 45mm; max-height: 13mm; object-fit: contain; object-position: left center; }
    .logo strong { font-size: 6mm; letter-spacing: -.3mm; }
    .industry { max-width: 72mm; text-align: right; font-size: 2.4mm; font-weight: 800; letter-spacing: .2mm; text-transform: uppercase; opacity: .7; }
    .hero-copy { max-width: 145mm; margin-top: 20mm; }
    .eyebrow { color: ${escapeHtml(accent)}; font-size: 2.5mm; font-weight: 950; letter-spacing: .45mm; text-transform: uppercase; }
    h1 { margin: 3mm 0 0; font-size: 13mm; line-height: 1.08; letter-spacing: -.7mm; }
    .lead { max-width: 125mm; margin: 5mm 0 0; font-size: 4mm; line-height: 1.58; opacity: .78; }
    .content { padding: 14mm 18mm 12mm; }
    .section-title { margin: 0; font-size: 7mm; letter-spacing: -.35mm; }
    .section-lead { max-width: 150mm; margin: 3mm 0 8mm; color: ${escapeHtml(neutral)}; font-size: 3.5mm; line-height: 1.62; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .card { min-height: 54mm; padding: 6mm; border: .3mm solid #e5e7eb; border-radius: 5mm; background: rgba(248,250,252,.82); }
    .number { display: grid; place-items: center; width: 9mm; height: 9mm; border-radius: 3mm; color: ${escapeHtml(readableTextColor(accent))}; background: ${escapeHtml(accent)}; font-size: 3mm; font-weight: 950; }
    .card h2 { margin: 5mm 0 2.5mm; font-size: 4.2mm; line-height: 1.22; }
    .card p { margin: 0; color: #475569; font-size: 2.75mm; line-height: 1.68; overflow-wrap: anywhere; }
    .cta { display: grid; grid-template-columns: 1.25fr .75fr; gap: 8mm; align-items: center; margin-top: 10mm; padding: 8mm; border-radius: 6mm; color: ${escapeHtml(readableTextColor(primary))}; background: ${escapeHtml(primary)}; }
    .cta h2 { margin: 0; font-size: 6mm; line-height: 1.18; }
    .cta p { margin: 2mm 0 0; font-size: 2.8mm; line-height: 1.5; opacity: .72; }
    .contact { display: flex; flex-direction: column; gap: 1.5mm; padding-left: 6mm; border-left: .5mm solid ${escapeHtml(accent)}; }
    .contact strong { font-size: 2.65mm; overflow-wrap: anywhere; }
    .contact .empty { font-size: 2.5mm; opacity: .7; }
    .footer { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; padding-top: 3mm; border-top: .25mm solid #e5e7eb; color: ${escapeHtml(neutral)}; font-size: 2.3mm; }
    @media print { body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Pobierz / zapisz jako PDF</button><span>A4, jedna strona. Włącz drukowanie grafik tła.</span></div>
  <main class="page">
    <section class="hero">
      <div class="topline"><div class="logo">${logoHtml}</div><div class="industry">${escapeHtml(industry)}</div></div>
      <div class="hero-copy">
        <div class="eyebrow">Oferta ${escapeHtml(brandName)}</div>
        <h1>${escapeHtml(offer)}</h1>
        ${slogan || customerProblem ? `<p class="lead">${escapeHtml(slogan || customerProblem)}</p>` : ''}
      </div>
    </section>
    <section class="content">
      <h2 class="section-title">Konkretna wartość dla właściwego klienta</h2>
      <p class="section-lead">Jedna czytelna oferta oparta na zatwierdzonym briefie marki.</p>
      <div class="cards">
        <article class="card"><div class="number">01</div><h2>Dla kogo</h2><p>${escapeHtml(audience)}</p></article>
        <article class="card"><div class="number">02</div><h2>Co oferujemy</h2><p>${escapeHtml(offer)}</p></article>
        <article class="card"><div class="number">03</div><h2>Dlaczego warto</h2><p>${escapeHtml(differentiator)}</p></article>
      </div>
      <div class="cta">
        <div><h2>${escapeHtml(cta)}</h2><p>${escapeHtml(brandName)} · ${escapeHtml(industry)}</p></div>
        <div class="contact">${contact.length ? contact.map((item) => `<strong>${escapeHtml(item)}</strong>`).join('') : '<span class="empty">Uzupełnij dane kontaktowe w briefie.</span>'}</div>
      </div>
    </section>
    <footer class="footer"><span>${escapeHtml(brandName)}</span><span>${escapeHtml(brandbookTheme.title)} · oferta A4</span></footer>
  </main>
</body>
</html>`;
};

type CompanyUtilityDocumentKind = 'letterhead' | 'email-signature' | 'price-list' | 'voucher';

const buildCompanyUtilityHtmlDocument = ({
  kind,
  pack,
  logoAsset,
  brandbookTheme,
  palette,
}: {
  kind: CompanyUtilityDocumentKind;
  pack: CompanyAssistantPackage;
  logoAsset?: CompanyAssistantAsset;
  brandbookTheme: (typeof profileBrandbookThemes)[number];
  palette: string[];
}) => {
  const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
  const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
  const offer = brandbookValue(pack, 'offer') || brandbookValue(pack, 'specialization') || industry;
  const contactPerson = brandbookValue(pack, 'contactPerson');
  const jobTitle = brandbookValue(pack, 'jobTitle');
  const primary = palette[0] || '#111827';
  const paper = palette[1] || '#ffffff';
  const accent = palette[2] || '#38bdf8';
  const neutral = palette[3] || '#64748b';
  const contacts = [
    brandbookValue(pack, 'phone'),
    brandbookValue(pack, 'email'),
    brandbookValue(pack, 'website'),
    brandbookValue(pack, 'instagram'),
    brandbookValue(pack, 'location'),
  ].filter(Boolean);
  const logoHtml = logoAsset?.signedUrl
    ? `<img src="${escapeHtml(logoAsset.signedUrl)}" alt="Logo ${escapeHtml(brandName)}" />`
    : `<strong class="fallback-logo">${escapeHtml(brandName)}</strong>`;
  const priceItems = brandbookValue(pack, 'priceListItems')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const [name = '', price = '', description = ''] = line.split('|').map((item) => item.trim());
      return { name, price, description };
    });
  const voucherTitle = brandbookValue(pack, 'voucherTitle') || 'Voucher prezentowy';
  const voucherValue = brandbookValue(pack, 'voucherValue');
  const voucherTerms = brandbookValue(pack, 'voucherTerms');

  const documentConfig: Record<CompanyUtilityDocumentKind, { title: string; pageSize: string; body: string; help: string }> = {
    letterhead: {
      title: 'Papier firmowy A4',
      pageSize: 'A4',
      help: 'A4, jedna strona wzorcowa. Włącz grafiki tła.',
      body: `
        <main class="page letterhead">
          <header class="letterhead-header">
            <div class="document-logo">${logoHtml}</div>
            <div class="company-meta"><strong>${escapeHtml(brandName)}</strong><span>${escapeHtml(industry)}</span></div>
          </header>
          <div class="letterhead-accent"></div>
          <section class="letter-body">
            <div class="date-line">Miejscowość, data: ____________________</div>
            <h1>Tytuł dokumentu</h1>
            <p class="placeholder-copy">Miejsce na treść pisma, oferty, umowy lub oficjalnej korespondencji firmy. Dokument zachowuje logo, paletę i dane kontaktowe marki.</p>
            <p class="placeholder-copy">Treść dokumentu możesz przygotować w edytorze tekstowym, korzystając z tego układu jako wzoru firmowego.</p>
          </section>
          <footer class="letterhead-footer"><strong>${escapeHtml(brandName)}</strong><span>${contacts.length ? escapeHtml(contacts.join(' · ')) : 'Dane kontaktowe do uzupełnienia'}</span></footer>
        </main>`,
    },
    'email-signature': {
      title: 'Podpis e-mail',
      pageSize: 'A4',
      help: 'Kliknij „Kopiuj podpis”, a następnie wklej go w ustawieniach poczty.',
      body: `
        <main class="signature-page">
          <section id="signature" class="signature">
            <div class="signature-logo">${logoHtml}</div>
            <div class="signature-divider"></div>
            <div class="signature-copy">
              <strong>${escapeHtml(contactPerson || brandName)}</strong>
              <span>${escapeHtml(jobTitle || offer)}</span>
              <b>${escapeHtml(brandName)}</b>
              ${contacts.map((item) => `<small>${escapeHtml(item)}</small>`).join('') || '<small>Dane kontaktowe do uzupełnienia</small>'}
            </div>
          </section>
          <p class="signature-note">Podgląd podpisu. Kopiowanie zachowuje układ, kolory i logo.</p>
        </main>`,
    },
    'price-list': {
      title: 'Cennik A4',
      pageSize: 'A4',
      help: 'A4, jedna strona. Pozycje pobierane są z briefu firmy.',
      body: `
        <main class="page price-page">
          <header class="price-header"><div class="document-logo">${logoHtml}</div><div><span>Cennik usług</span><h1>${escapeHtml(brandName)}</h1><p>${escapeHtml(offer)}</p></div></header>
          <section class="price-content">
            ${priceItems.length ? priceItems.map((item, index) => `
              <article class="price-row"><span class="price-index">${String(index + 1).padStart(2, '0')}</span><div><h2>${escapeHtml(item.name)}</h2>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div><strong>${escapeHtml(item.price || 'Cena indywidualna')}</strong></article>
            `).join('') : '<div class="missing-data"><strong>Uzupełnij pozycje cennika w briefie firmy.</strong><span>Format: Usługa | Cena | Krótki opis — każda pozycja w nowej linii.</span></div>'}
          </section>
          <footer class="price-footer"><strong>${escapeHtml(brandbookValue(pack, 'cta') || 'Skontaktuj się po szczegóły')}</strong><span>${contacts.length ? escapeHtml(contacts.join(' · ')) : 'Kontakt do uzupełnienia'}</span></footer>
        </main>`,
    },
    voucher: {
      title: 'Voucher do druku',
      pageSize: '210mm 99mm',
      help: 'Format DL 210 × 99 mm. Włącz grafiki tła.',
      body: `
        <main class="voucher-page">
          <div class="voucher-brand"><div class="document-logo">${logoHtml}</div><span>${escapeHtml(industry)}</span></div>
          <section class="voucher-main">
            <div class="voucher-kicker">${escapeHtml(voucherTitle)}</div>
            <h1>${escapeHtml(voucherValue || offer)}</h1>
            <div class="voucher-fields"><span>Dla: ____________________</span><span>Od: ____________________</span><span>Kod: ____________________</span></div>
          </section>
          <footer class="voucher-footer"><span>${escapeHtml(voucherTerms || 'Warunki realizacji zgodnie z ustaleniami firmy.')}</span><strong>${contacts.length ? escapeHtml(contacts.join(' · ')) : 'Kontakt do uzupełnienia'}</strong></footer>
        </main>`,
    },
  };
  const config = documentConfig[kind];
  const isSignature = kind === 'email-signature';

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)} — ${escapeHtml(config.title)}</title>
  <style>
    @page { size: ${config.pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #111827; font-family: Inter, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding: 12px; background: rgba(255,255,255,.95); border-bottom: 1px solid #d1d5db; }
    .toolbar button { border: 0; border-radius: 999px; padding: 11px 18px; color: #fff; font-weight: 800; cursor: pointer; background: linear-gradient(135deg, #c13ee7, #ef3f93, #38a9e8); }
    .toolbar span { color: #64748b; font-size: 12px; }
    .page { position: relative; width: 210mm; min-height: 297mm; margin: 18px auto; padding: 18mm; background: ${escapeHtml(paper)}; color: ${escapeHtml(readableTextColor(paper))}; line-height: 1.45; box-shadow: 0 16px 60px rgba(15,23,42,.18); overflow: hidden; }
    .document-logo { min-width: 36mm; min-height: 12mm; display: flex; align-items: center; }
    .document-logo img { max-width: 42mm; max-height: 14mm; object-fit: contain; object-position: left center; }
    .fallback-logo { font-size: 6mm; letter-spacing: -.3mm; }
    .letterhead-header { display: flex; justify-content: space-between; align-items: center; gap: 12mm; }
    .company-meta { display: flex; flex-direction: column; text-align: right; }
    .company-meta strong { font-size: 4mm; } .company-meta span { color: ${escapeHtml(neutral)}; font-size: 2.6mm; }
    .letterhead-accent { height: 1mm; margin-top: 7mm; background: linear-gradient(90deg, ${escapeHtml(primary)}, ${escapeHtml(accent)}, transparent); }
    .letter-body { margin-top: 26mm; } .date-line { text-align: right; color: ${escapeHtml(neutral)}; font-size: 3mm; }
    .letter-body h1 { margin: 18mm 0 8mm; font-size: 9mm; line-height: 1.14; letter-spacing: -.5mm; }
    .placeholder-copy { max-width: 155mm; color: #475569; font-size: 3.5mm; line-height: 1.8; }
    .letterhead-footer { position: absolute; left: 18mm; right: 18mm; bottom: 12mm; display: flex; justify-content: space-between; gap: 8mm; padding-top: 4mm; border-top: .6mm solid ${escapeHtml(accent)}; font-size: 2.4mm; color: ${escapeHtml(neutral)}; }
    .price-page { padding: 0; }
    .price-header { min-height: 78mm; padding: 16mm 18mm; display: flex; justify-content: space-between; align-items: flex-start; color: ${escapeHtml(readableTextColor(primary))}; background: radial-gradient(circle at 90% 12%, ${escapeHtml(accent)}aa, transparent 30%), ${escapeHtml(primary)}; }
    .price-header > div:last-child { max-width: 105mm; text-align: right; } .price-header span { color: ${escapeHtml(accent)}; font-size: 2.5mm; font-weight: 900; text-transform: uppercase; letter-spacing: .5mm; }
    .price-header h1 { margin: 3mm 0 1mm; font-size: 11mm; line-height: 1.1; } .price-header p { margin: 0; font-size: 3.2mm; line-height: 1.5; opacity: .75; }
    .price-content { padding: 12mm 18mm 30mm; display: flex; flex-direction: column; gap: 3mm; }
    .price-row { display: grid; grid-template-columns: 12mm 1fr 36mm; gap: 4mm; align-items: center; padding: 4mm 5mm; border: .3mm solid #e5e7eb; border-radius: 4mm; }
    .price-index { color: ${escapeHtml(accent)}; font-size: 3mm; font-weight: 950; } .price-row h2 { margin: 0; font-size: 3.6mm; line-height: 1.22; } .price-row p { margin: 1mm 0 0; color: ${escapeHtml(neutral)}; font-size: 2.4mm; line-height: 1.5; }
    .price-row > strong { text-align: right; color: ${escapeHtml(primary)}; font-size: 3.2mm; }
    .missing-data { padding: 12mm; border: .5mm dashed ${escapeHtml(accent)}; border-radius: 5mm; display: flex; flex-direction: column; gap: 2mm; color: ${escapeHtml(neutral)}; }
    .price-footer { position: absolute; left: 18mm; right: 18mm; bottom: 12mm; display: flex; justify-content: space-between; gap: 8mm; padding: 6mm; border-radius: 4mm; color: ${escapeHtml(readableTextColor(primary))}; background: ${escapeHtml(primary)}; font-size: 2.5mm; }
    .voucher-page { position: relative; width: 210mm; height: 99mm; margin: 28px auto; overflow: hidden; color: ${escapeHtml(readableTextColor(primary))}; line-height: 1.4; background: radial-gradient(circle at 88% 20%, ${escapeHtml(accent)}bb, transparent 30%), ${escapeHtml(primary)}; box-shadow: 0 16px 60px rgba(15,23,42,.18); }
    .voucher-brand { position: absolute; left: 12mm; top: 10mm; display: flex; align-items: center; gap: 7mm; } .voucher-brand span { font-size: 2.3mm; opacity: .65; text-transform: uppercase; letter-spacing: .35mm; }
    .voucher-main { position: absolute; left: 12mm; right: 12mm; top: 33mm; } .voucher-kicker { color: ${escapeHtml(accent)}; font-size: 2.6mm; font-weight: 950; text-transform: uppercase; letter-spacing: .6mm; }
    .voucher-main h1 { margin: 2mm 0 5mm; max-width: 145mm; font-size: 9mm; line-height: 1.16; }
    .voucher-fields { display: flex; gap: 7mm; font-size: 2.5mm; line-height: 1.45; opacity: .78; }
    .voucher-footer { position: absolute; left: 12mm; right: 12mm; bottom: 8mm; display: flex; justify-content: space-between; gap: 8mm; padding-top: 3mm; border-top: .35mm solid ${escapeHtml(accent)}; font-size: 2.2mm; line-height: 1.45; }
    .voucher-footer span { max-width: 95mm; opacity: .7; } .voucher-footer strong { text-align: right; }
    .signature-page { width: min(760px, calc(100% - 32px)); margin: 40px auto; padding: 32px; border-radius: 24px; background: #fff; box-shadow: 0 16px 60px rgba(15,23,42,.18); }
    .signature { display: inline-flex; align-items: center; gap: 18px; padding: 18px; border: 1px solid #e5e7eb; background: #fff; color: #111827; line-height: 1.4; }
    .signature-logo { width: 150px; display: flex; align-items: center; justify-content: center; } .signature-logo img { max-width: 140px; max-height: 64px; object-fit: contain; }
    .signature-divider { align-self: stretch; width: 4px; border-radius: 9px; background: ${escapeHtml(accent)}; }
    .signature-copy { display: flex; flex-direction: column; min-width: 220px; } .signature-copy > strong { font-size: 18px; line-height: 1.25; } .signature-copy > span { margin-top: 2px; color: ${escapeHtml(neutral)}; font-size: 13px; line-height: 1.4; }
    .signature-copy > b { margin: 8px 0 4px; color: ${escapeHtml(primary)}; font-size: 13px; line-height: 1.35; } .signature-copy small { margin-top: 2px; color: #475569; font-size: 12px; line-height: 1.45; }
    .signature-note { color: ${escapeHtml(neutral)}; font-size: 13px; }
    @media print { body { background: #fff; } .toolbar { display: none; } .page, .voucher-page { margin: 0; box-shadow: none; } .signature-page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="${isSignature ? "var r=document.createRange();r.selectNode(document.getElementById('signature'));var s=window.getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();this.textContent='Skopiowano podpis';" : 'window.print()'}">${isSignature ? 'Kopiuj podpis HTML' : 'Pobierz / zapisz jako PDF'}</button>
    <span>${escapeHtml(config.help)}</span>
  </div>
  ${config.body}
</body>
</html>`;
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [twoFactorQrCode, setTwoFactorQrCode] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRecoveryStats, setTwoFactorRecoveryStats] = useState<{ total: number; unused: number }>({ total: 0, unused: 0 });
  const [visibleRecoveryCodes, setVisibleRecoveryCodes] = useState<string[]>([]);
  const [recoveryRegenerateCode, setRecoveryRegenerateCode] = useState('');
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState('');
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<string | null>(null);
  const [companyPackages, setCompanyPackages] = useState<CompanyAssistantPackage[]>([]);
  const [companyAssets, setCompanyAssets] = useState<CompanyAssistantAsset[]>([]);
  const [adPromptSessions, setAdPromptSessions] = useState<AdPromptSession[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingAdPrompts, setLoadingAdPrompts] = useState(true);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingAdPromptSessionId, setDeletingAdPromptSessionId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [activeCompanyTab, setActiveCompanyTab] = useState<CompanyPanelTab>('crm');
  const [generatingBrandbookId, setGeneratingBrandbookId] = useState<string | null>(null);
  const [generatingBusinessCardId, setGeneratingBusinessCardId] = useState<string | null>(null);
  const [generatingOfferId, setGeneratingOfferId] = useState<string | null>(null);
  const [generatingUtilityKey, setGeneratingUtilityKey] = useState<string | null>(null);
  const [businessCardEditorPackId, setBusinessCardEditorPackId] = useState<string | null>(null);
  const [businessCardDraft, setBusinessCardDraft] = useState<BusinessCardEditorDraft | null>(null);
  const [documentStylePackId, setDocumentStylePackId] = useState<string | null>(null);
  const [documentStyleDraft, setDocumentStyleDraft] = useState<DocumentStyleDraft | null>(null);
  const [savingDocumentStyle, setSavingDocumentStyle] = useState(false);
  const [uploadingDocumentLogo, setUploadingDocumentLogo] = useState(false);
  const [editingBriefId, setEditingBriefId] = useState<string | null>(null);
  const [briefDraft, setBriefDraft] = useState<Record<string, string>>({});
  const [savingBriefId, setSavingBriefId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoadingPurchases(true);
    setLoadingAdPrompts(true);

    vpsFetch<ProfileResponse>('/me/profile')
      .then((data) => {
        setDisplayName(data.profile?.display_name || '');
        setPurchases(data.purchases || []);
      })
      .catch(() => {
        toast.error('Nie udało się pobrać profilu');
      })
      .finally(() => {
        setLoadingPurchases(false);
      });

    if (isAdmin) {
      setLoadingCompanies(true);
      Promise.all([
        vpsFetch<{ ok: boolean; packages: CompanyAssistantPackage[] }>('/me/company-assistant-packages?limit=20'),
        vpsFetch<{ ok: boolean; assets: CompanyAssistantAsset[] }>('/me/company-assistant-assets?limit=80'),
      ])
        .then(([packagesData, assetsData]) => {
          setCompanyPackages(packagesData.packages || []);
          setCompanyAssets(assetsData.assets || []);
          setExpandedPrompts(
            Object.fromEntries((packagesData.packages || []).map((pack) => [pack.id, Boolean(pack.prompts?.length)])),
          );
        })
        .catch(() => {
          setCompanyPackages([]);
          setCompanyAssets([]);
        })
        .finally(() => {
          setLoadingCompanies(false);
        });
    } else {
      setCompanyPackages([]);
      setCompanyAssets([]);
      setExpandedPrompts({});
      setSelectedCompanyId(null);
      setLoadingCompanies(false);
    }

    vpsFetch<{ ok: boolean; sessions: AdPromptSession[] }>('/me/ad-prompt-sessions?limit=50')
      .then((data) => {
        setAdPromptSessions(data.sessions || []);
      })
      .catch(() => {
        setAdPromptSessions([]);
      })
      .finally(() => {
        setLoadingAdPrompts(false);
      });
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    vpsFetch<TwoFactorStatusResponse>('/me/2fa/status')
      .then((data) => {
        setTwoFactorEnabled(Boolean(data.enabled));
        setTwoFactorRecoveryStats(data.recoveryCodes || { total: 0, unused: 0 });
      })
      .catch(() => {
        setTwoFactorEnabled(false);
        setTwoFactorRecoveryStats({ total: 0, unused: 0 });
      });
  }, [isAdmin, user]);

  useEffect(() => {
    let cancelled = false;

    if (!twoFactorSetup?.otpauthUrl) {
      setTwoFactorQrCode('');
      return;
    }

    QRCode.toDataURL(twoFactorSetup.otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 224,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setTwoFactorQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setTwoFactorQrCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [twoFactorSetup?.otpauthUrl]);

  const menuStats = useMemo(
    () => ({
      companies: companyPackages.length,
      assets: companyAssets.length,
      adPrompts: adPromptSessions.length,
      purchases: purchases.length,
    }),
    [adPromptSessions.length, companyAssets.length, companyPackages.length, purchases.length],
  );

  const visibleProfileMenu = useMemo(
    () => profileMenu.filter((item) => (item.id !== 'admin' && item.id !== 'companies') || isAdmin),
    [isAdmin],
  );

  const selectedCompany = useMemo(
    () => companyPackages.find((pack) => pack.id === selectedCompanyId) || null,
    [companyPackages, selectedCompanyId],
  );

  useEffect(() => {
    if (!isAdmin && (activeSection === 'admin' || activeSection === 'companies')) {
      setActiveSection('profile');
    }
  }, [activeSection, isAdmin]);

  useEffect(() => {
    if (selectedCompanyId && !selectedCompany) {
      setSelectedCompanyId(null);
      setActiveCompanyTab('crm');
    }
  }, [selectedCompany, selectedCompanyId]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await vpsFetch('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName }),
      });
      toast.success('Profil zaktualizowany');
    } catch {
      toast.error('Nie udało się zapisać profilu');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Hasło musi mieć minimum 6 znaków');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Hasła nie są identyczne');
      return;
    }

    setChangingPassword(true);
    try {
      await vpsFetch('/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      toast.success('Hasło zmienione');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zmienić hasła');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleStartTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    try {
      const data = await vpsFetch<TwoFactorSetupResponse>('/me/2fa/setup', { method: 'POST' });
      setTwoFactorSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      setTwoFactorCode('');
      toast.success('Sekret 2FA wygenerowany');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się przygotować 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleEnableTwoFactor = async () => {
    if (!twoFactorSetup || !twoFactorCode.trim()) {
      toast.error('Podaj kod z aplikacji 2FA.');
      return;
    }

    setTwoFactorLoading(true);
    try {
      const data = await vpsFetch<TwoFactorEnableResponse>('/me/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({
          secret: twoFactorSetup.secret,
          code: twoFactorCode,
        }),
      });
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      const recoveryCodes = data.recoveryCodes || [];
      setVisibleRecoveryCodes(recoveryCodes);
      setTwoFactorRecoveryStats({ total: recoveryCodes.length, unused: recoveryCodes.length });
      toast.success('2FA włączone dla konta administratora');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się włączyć 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDownloadRecoveryCodes = () => {
    if (!visibleRecoveryCodes.length) {
      toast.error('Brak kodów do pobrania.');
      return;
    }

    const content = [
      'Kreator Grafik AI - kody odzyskiwania 2FA',
      '',
      'Zapisz te kody w bezpiecznym miejscu. Każdy kod działa tylko raz.',
      '',
      ...visibleRecoveryCodes,
      '',
      `Wygenerowano: ${new Date().toLocaleString('pl-PL')}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-kreator-kody-odzyskiwania-2fa.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const refreshTwoFactorStatus = async () => {
    const data = await vpsFetch<TwoFactorStatusResponse>('/me/2fa/status');
    setTwoFactorEnabled(Boolean(data.enabled));
    setTwoFactorRecoveryStats(data.recoveryCodes || { total: 0, unused: 0 });
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!recoveryRegenerateCode.trim()) {
      toast.error('Podaj aktualny kod 2FA albo kod odzyskiwania.');
      return;
    }

    setTwoFactorLoading(true);
    try {
      const isRecovery = /[A-Za-z]/.test(recoveryRegenerateCode);
      const data = await vpsFetch<TwoFactorRecoveryCodesResponse>('/me/2fa/recovery-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify(isRecovery ? { recoveryCode: recoveryRegenerateCode } : { code: recoveryRegenerateCode }),
      });
      setVisibleRecoveryCodes(data.recoveryCodes || []);
      setRecoveryRegenerateCode('');
      setTwoFactorRecoveryStats({ total: data.recoveryCodes.length, unused: data.recoveryCodes.length });
      toast.success('Wygenerowano nowe kody odzyskiwania. Stare zostały unieważnione.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wygenerować kodów odzyskiwania');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!twoFactorDisableCode.trim()) {
      toast.error('Podaj kod 2FA.');
      return;
    }

    setTwoFactorLoading(true);
    try {
      await vpsFetch('/me/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({
          password: twoFactorDisablePassword,
          ...(/[A-Za-z]/.test(twoFactorDisableCode) ? { recoveryCode: twoFactorDisableCode } : { code: twoFactorDisableCode }),
        }),
      });
      setTwoFactorEnabled(false);
      setVisibleRecoveryCodes([]);
      setTwoFactorRecoveryStats({ total: 0, unused: 0 });
      setTwoFactorDisablePassword('');
      setTwoFactorDisableCode('');
      toast.success('2FA wyłączone');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wyłączyć 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDownloadInvoice = async (purchaseId: string) => {
    setDownloadingInvoice(purchaseId);
    try {
      const data = await vpsFetch<InvoiceResponse>('/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ purchaseId }),
      });
      if (!data?.html) throw new Error('Brak treści faktury');
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `faktura-${purchaseId.slice(0, 8)}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Nie udało się wygenerować faktury');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handlePreviewInvoice = async (purchaseId: string) => {
    setPreviewingInvoice(purchaseId);
    try {
      const data = await vpsFetch<InvoiceResponse>('/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ purchaseId }),
      });
      if (!data?.html) throw new Error('Brak treści faktury');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(data.html);
        win.document.close();
      }
    } catch {
      toast.error('Nie udało się wygenerować podglądu faktury');
    } finally {
      setPreviewingInvoice(null);
    }
  };

  const handleDeleteCompanyPackage = async (pack: CompanyAssistantPackage) => {
    const confirmed = window.confirm(
      `Usunąć firmę „${pack.companyName || 'Projekt bez nazwy'}” z profilu? Wygenerowane grafiki zostaną w galerii.`,
    );
    if (!confirmed) return;

    setDeletingCompanyId(pack.id);
    try {
      await vpsFetch(`/me/company-assistant-packages/${encodeURIComponent(pack.id)}`, { method: 'DELETE' });
      setCompanyPackages((current) => current.filter((item) => item.id !== pack.id));
      setCompanyAssets((current) =>
        current.filter((asset) => {
          if (asset.packageId && asset.packageId === pack.id) return false;
          if (asset.sessionId && pack.profile?.sessionId && asset.sessionId === pack.profile.sessionId) return false;
          return true;
        }),
      );
      setExpandedPrompts((current) => {
        const next = { ...current };
        delete next[pack.id];
        return next;
      });
      toast.success('Firma usunięta z profilu');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć firmy');
    } finally {
      setDeletingCompanyId(null);
    }
  };

  const handleDeleteCompanyAsset = async (asset: CompanyAssistantAsset) => {
    const confirmed = window.confirm('Usunąć ten element z firmy? Grafika zostanie w ogólnej galerii.');
    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    try {
      await vpsFetch(`/me/company-assistant-assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
      setCompanyAssets((current) => current.filter((item) => item.id !== asset.id));
      toast.success('Element usunięty z firmy');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć elementu');
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleCopyCompanyPrompt = async (prompt: CompanyAssistantPrompt) => {
    await navigator.clipboard.writeText(prompt.prompt);
    toast.success('Prompt skopiowany');
  };

  const handleUseCompanyPrompt = (pack: CompanyAssistantPackage, prompt: CompanyAssistantPrompt) => {
    window.sessionStorage.setItem('companyAssistantPrompt', prompt.prompt);
    window.sessionStorage.setItem('companyAssistantFormat', prompt.format);
    window.sessionStorage.setItem('companyAssistantStyle', prompt.style);
    window.sessionStorage.setItem(
      'companyAssistantContext',
      JSON.stringify({
        packageId: pack.id,
        sessionId: pack.profile?.sessionId || null,
        materialId: prompt.materialId,
        materialTitle: prompt.title,
        companyName: pack.companyName || '',
        industry: pack.industry || '',
        selectedThemeId: pack.profile?.selectedThemeId || '',
        customColors: pack.profile?.customColors || '',
      }),
    );
    navigate('/generator');
  };

  const handleCopyAdPrompt = async (prompt: AdPrompt) => {
    await navigator.clipboard.writeText(prompt.prompt);
    toast.success('Prompt reklamowy skopiowany');
  };

  const handleUseAdPrompt = (prompt: AdPrompt) => {
    window.sessionStorage.setItem('companyAssistantPrompt', prompt.prompt);
    window.sessionStorage.setItem('companyAssistantFormat', '1:1');
    window.sessionStorage.setItem('companyAssistantStyle', 'realistic');
    navigate('/generator');
  };

  const handleDeleteAdPromptSession = async (session: AdPromptSession) => {
    const confirmed = window.confirm('Usunąć tę historię promptów reklamowych?');
    if (!confirmed) return;

    setDeletingAdPromptSessionId(session.id);
    try {
      await vpsFetch(`/me/ad-prompt-sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      setAdPromptSessions((current) => current.filter((item) => item.id !== session.id));
      toast.success('Historia promptów usunięta');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć historii promptów');
    } finally {
      setDeletingAdPromptSessionId(null);
    }
  };

  const getRelatedCompanyAssets = (pack: CompanyAssistantPackage) => {
    const packageSessionId = pack.profile?.sessionId;
    return companyAssets.filter((asset) => {
      if (asset.packageId && asset.packageId === pack.id) return true;
      if (asset.sessionId && packageSessionId && asset.sessionId === packageSessionId) return true;
      return false;
    });
  };

  const openCompanyPanel = (pack: CompanyAssistantPackage, tab: CompanyPanelTab = 'crm') => {
    setSelectedCompanyId(pack.id);
    setActiveCompanyTab(tab);
    setEditingBriefId(null);
    setBriefDraft({});
  };

  const buildBriefDraft = (pack: CompanyAssistantPackage) => ({
    companyName: pack.companyName || pack.profile?.companyName || '',
    industry: pack.industry || pack.profile?.industry || '',
    stage: pack.profile?.stage || '',
    offer: pack.profile?.offer || '',
    specialization: pack.profile?.specialization || '',
    targetAudience: pack.profile?.targetAudience || '',
    differentiator: pack.profile?.differentiator || '',
    tone: pack.profile?.tone || '',
    cta: pack.profile?.cta || '',
    location: pack.profile?.location || '',
    phone: pack.profile?.phone || '',
    email: pack.profile?.email || '',
    website: pack.profile?.website || '',
    instagram: pack.profile?.instagram || '',
    customColors: pack.profile?.customColors || '',
    avoidList: pack.profile?.avoidList || '',
  });

  const startEditingBrief = (pack: CompanyAssistantPackage) => {
    setBriefDraft(buildBriefDraft(pack));
    setEditingBriefId(pack.id);
    setActiveCompanyTab('brief');
  };

  const cancelEditingBrief = () => {
    setEditingBriefId(null);
    setBriefDraft({});
  };

  const updateBriefDraft = (key: string, value: string) => {
    setBriefDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSaveCompanyBrief = async (pack: CompanyAssistantPackage) => {
    if (!pack.prompts?.length) {
      toast.error('Ten pakiet nie ma promptów, więc nie można go bezpiecznie nadpisać');
      return;
    }

    const nextProfile = {
      ...(pack.profile || {}),
      ...briefDraft,
      companyName: (briefDraft.companyName || pack.companyName || '').trim(),
      industry: (briefDraft.industry || pack.industry || '').trim(),
    };

    setSavingBriefId(pack.id);
    try {
      const data = await vpsFetch<{ ok: boolean; package: CompanyAssistantPackage }>('/me/company-assistant-packages', {
        method: 'POST',
        body: JSON.stringify({
          companyName: nextProfile.companyName || 'Projekt bez nazwy',
          industry: nextProfile.industry || 'Branża nieuzupełniona',
          profile: nextProfile,
          prompts: pack.prompts,
        }),
      });

      const savedPackage = data.package;
      setCompanyPackages((current) =>
        current.map((item) => {
          const sameId = item.id === pack.id || item.id === savedPackage.id;
          const sameSession =
            Boolean(item.profile?.sessionId) &&
            Boolean(savedPackage.profile?.sessionId) &&
            item.profile.sessionId === savedPackage.profile.sessionId;
          return sameId || sameSession ? savedPackage : item;
        }),
      );
      setSelectedCompanyId(savedPackage.id);
      setEditingBriefId(null);
      setBriefDraft({});
      toast.success('Brief firmy zapisany');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać briefu');
    } finally {
      setSavingBriefId(null);
    }
  };

  const openDocumentStyleEditor = (pack: CompanyAssistantPackage) => {
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const theme = getProfileBrandbookTheme(pack.profile?.selectedThemeId || '', industry);
    const palette = resolveDocumentPalette(pack, theme);
    const relatedAssets = getRelatedCompanyAssets(pack);
    const selectedLogo = resolveDocumentLogo(pack, relatedAssets);
    setDocumentStyleDraft({
      primary: palette[0] || '#111827',
      paper: palette[1] || '#ffffff',
      accent: palette[2] || '#38bdf8',
      logoAssetId: brandbookValue(pack, 'documentLogoAssetId') || selectedLogo?.id || 'none',
    });
    setDocumentStylePackId(pack.id);
  };

  const handleSaveDocumentStyle = async () => {
    const pack = companyPackages.find((item) => item.id === documentStylePackId);
    if (!pack || !documentStyleDraft) return;

    const nextProfile = {
      ...pack.profile,
      documentPrimary: documentStyleDraft.primary,
      documentPaper: documentStyleDraft.paper,
      documentAccent: documentStyleDraft.accent,
      documentLogoAssetId: documentStyleDraft.logoAssetId,
    };

    setSavingDocumentStyle(true);
    try {
      const data = await vpsFetch<{ ok: boolean; package: CompanyAssistantPackage }>('/me/company-assistant-packages', {
        method: 'POST',
        body: JSON.stringify({
          companyName: pack.companyName,
          industry: pack.industry,
          profile: nextProfile,
          prompts: pack.prompts,
        }),
      });
      const savedPackage = data.package || { ...pack, profile: nextProfile };
      setCompanyPackages((current) => current.map((item) => item.id === pack.id ? savedPackage : item));
      setSelectedCompanyId(savedPackage.id);
      setDocumentStylePackId(null);
      setDocumentStyleDraft(null);
      toast.success('Wygląd dokumentów zapisany');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się zapisać wyglądu dokumentów');
    } finally {
      setSavingDocumentStyle(false);
    }
  };

  const handleUploadDocumentLogo = async (file?: File) => {
    const pack = companyPackages.find((item) => item.id === documentStylePackId);
    if (!file || !pack) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Logo wgraj jako PNG, JPG lub WebP. Najlepszy będzie PNG z przezroczystym tłem.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Plik logo może mieć maksymalnie 5 MB.');
      return;
    }

    setUploadingDocumentLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Nie udało się odczytać logo'));
        reader.onerror = () => reject(new Error('Nie udało się odczytać logo'));
        reader.readAsDataURL(file);
      });
      const upload = await vpsFetch<{ ok: boolean; path: string }>('/gallery/reference-upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      await vpsFetch('/me/company-assistant-assets', {
        method: 'POST',
        body: JSON.stringify({
          packageId: pack.id,
          sessionId: pack.profile?.sessionId || null,
          graphicId: null,
          url: upload.path,
          materialId: 'uploaded-logo',
          materialTitle: `Logo własne — ${file.name}`,
          assetType: 'logo',
          prompt: 'Logo wgrane przez użytkownika do dokumentów firmy.',
          dimensions: null,
        }),
      });
      const refreshed = await vpsFetch<{ ok: boolean; assets: CompanyAssistantAsset[] }>('/me/company-assistant-assets?limit=80');
      const assets = refreshed.assets || [];
      setCompanyAssets(assets);
      const uploaded = assets.find((asset) => asset.packageId === pack.id && asset.materialId === 'uploaded-logo' && asset.materialTitle.includes(file.name));
      if (uploaded) {
        setDocumentStyleDraft((current) => current ? { ...current, logoAssetId: uploaded.id } : current);
      }
      toast.success('Logo dodane do projektu firmy');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się dodać logo');
    } finally {
      setUploadingDocumentLogo(false);
    }
  };

  const openBusinessCardEditor = (pack: CompanyAssistantPackage) => {
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const theme = getProfileBrandbookTheme(pack.profile?.selectedThemeId || '', industry);
    const palette = resolveDocumentPalette(pack, theme);
    const storedVariant = brandbookValue(pack, 'business-cardVariantId', 'brand-first');
    setBusinessCardDraft({
      variantId: ['typographic-premium', 'bold-split'].includes(storedVariant)
        ? storedVariant as BusinessCardEditorDraft['variantId']
        : 'brand-first',
      primary: brandbookValue(pack, 'businessCardPrimary') || palette[0] || '#111827',
      paper: brandbookValue(pack, 'businessCardPaper') || palette[1] || '#ffffff',
      accent: brandbookValue(pack, 'businessCardAccent') || palette[2] || '#38bdf8',
      showSlogan: brandbookValue(pack, 'businessCardShowSlogan', 'true') !== 'false',
      showLocation: brandbookValue(pack, 'businessCardShowLocation', 'true') !== 'false',
    });
    setBusinessCardEditorPackId(pack.id);
  };

  const handleOpenBusinessCardPdf = async (pack: CompanyAssistantPackage, editor?: BusinessCardEditorDraft) => {
    const relatedAssets = getRelatedCompanyAssets(pack);
    const logoAsset = resolveDocumentLogo(pack, relatedAssets);
    const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const selectedTheme = pack.profile?.selectedThemeId || '';
    const brandbookTheme = getProfileBrandbookTheme(selectedTheme, industry);
    const palette = resolveDocumentPalette(pack, brandbookTheme);
    const hasContact = ['phone', 'email', 'website', 'instagram'].some((key) => Boolean(brandbookValue(pack, key)));

    setGeneratingBusinessCardId(pack.id);
    try {
      const html = buildBusinessCardHtmlDocument({ pack, logoAsset, brandbookTheme, palette, editor });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank');

      if (popup) {
        popup.opener = null;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success('Wizytówka otwarta — wybierz „Zapisz jako PDF”.');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFileName(brandName)}-wizytowka-druk.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
        toast.success('Plik wizytówki pobrany. Otwórz go i zapisz jako PDF.');
      }

      if (!logoAsset) toast.info('Brak zapisanego logo — użyłem inicjałów firmy.');
      if (!hasContact) toast.warning('Uzupełnij kontakt w briefie firmy przed wysłaniem wizytówki do druku.');
    } catch (error) {
      console.error('Business card HTML error:', error);
      toast.error('Nie udało się przygotować wizytówki PDF');
    } finally {
      setGeneratingBusinessCardId(null);
    }
  };

  const handleExportBusinessCardFromEditor = async () => {
    const pack = companyPackages.find((item) => item.id === businessCardEditorPackId);
    if (!pack || !businessCardDraft) return;

    const nextProfile = {
      ...pack.profile,
      'business-cardVariantId': businessCardDraft.variantId,
      businessCardPrimary: businessCardDraft.primary,
      businessCardPaper: businessCardDraft.paper,
      businessCardAccent: businessCardDraft.accent,
      businessCardShowSlogan: String(businessCardDraft.showSlogan),
      businessCardShowLocation: String(businessCardDraft.showLocation),
    };
    const editedPack = { ...pack, profile: nextProfile };

    try {
      const data = await vpsFetch<{ ok: boolean; package: CompanyAssistantPackage }>('/me/company-assistant-packages', {
        method: 'POST',
        body: JSON.stringify({
          companyName: pack.companyName,
          industry: pack.industry,
          profile: nextProfile,
          prompts: pack.prompts,
        }),
      });
      const savedPackage = data.package || editedPack;
      setCompanyPackages((current) => current.map((item) => item.id === pack.id ? savedPackage : item));
      setBusinessCardEditorPackId(null);
      await handleOpenBusinessCardPdf(savedPackage, businessCardDraft);
    } catch (error) {
      console.error('Business card settings save error:', error);
      toast.error('Nie udało się zapisać ustawień wizytówki');
    }
  };

  const handleOpenOfferPdf = async (pack: CompanyAssistantPackage) => {
    const relatedAssets = getRelatedCompanyAssets(pack);
    const logoAsset = resolveDocumentLogo(pack, relatedAssets);
    const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const brandbookTheme = getProfileBrandbookTheme(pack.profile?.selectedThemeId || '', industry);
    const palette = resolveDocumentPalette(pack, brandbookTheme);

    setGeneratingOfferId(pack.id);
    try {
      const html = buildOfferHtmlDocument({ pack, logoAsset, brandbookTheme, palette });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank');
      if (popup) {
        popup.opener = null;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success('Oferta A4 otwarta — wybierz „Zapisz jako PDF”.');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFileName(brandName)}-oferta-a4.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
        toast.success('Plik oferty pobrany. Otwórz go i zapisz jako PDF.');
      }
      if (!logoAsset) toast.info('Oferta używa nazwy firmy, ponieważ nie zapisano jeszcze logo.');
    } catch (error) {
      console.error('Offer HTML error:', error);
      toast.error('Nie udało się przygotować oferty A4');
    } finally {
      setGeneratingOfferId(null);
    }
  };

  const handleOpenUtilityDocument = async (pack: CompanyAssistantPackage, kind: CompanyUtilityDocumentKind) => {
    const actionKey = `${pack.id}:${kind}`;
    const relatedAssets = getRelatedCompanyAssets(pack);
    const logoAsset = resolveDocumentLogo(pack, relatedAssets);
    const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const brandbookTheme = getProfileBrandbookTheme(pack.profile?.selectedThemeId || '', industry);
    const palette = resolveDocumentPalette(pack, brandbookTheme);
    const labels: Record<CompanyUtilityDocumentKind, string> = {
      letterhead: 'Papier firmowy',
      'email-signature': 'Podpis e-mail',
      'price-list': 'Cennik',
      voucher: 'Voucher',
    };

    setGeneratingUtilityKey(actionKey);
    try {
      const html = buildCompanyUtilityHtmlDocument({ kind, pack, logoAsset, brandbookTheme, palette });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank');
      if (popup) {
        popup.opener = null;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success(`${labels[kind]} otwarty.`);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFileName(brandName)}-${kind}.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
        toast.success(`${labels[kind]} pobrany jako HTML.`);
      }
    } catch (error) {
      console.error(`${kind} HTML error:`, error);
      toast.error(`Nie udało się przygotować: ${labels[kind]}`);
    } finally {
      setGeneratingUtilityKey(null);
    }
  };

  const handleDownloadCompanyBrandbook = async (pack: CompanyAssistantPackage) => {
    const relatedAssets = getRelatedCompanyAssets(pack);
    const logoAsset = resolveDocumentLogo(pack, relatedAssets);
    const brandName = brandbookValue(pack, 'companyName', 'Projekt bez nazwy');
    const industry = brandbookValue(pack, 'industry', 'Branża nieuzupełniona');
    const offer = brandbookValue(pack, 'offer') || brandbookValue(pack, 'specialization');
    const audience = brandbookValue(pack, 'targetAudience');
    const differentiator = brandbookValue(pack, 'differentiator');
    const tone = brandbookValue(pack, 'tone');
    const cta = brandbookValue(pack, 'cta') || 'Skontaktuj się / sprawdź ofertę';
    const avoidList = brandbookValue(pack, 'avoidList');
    const location = brandbookValue(pack, 'location');
    const contact = [
      brandbookValue(pack, 'phone'),
      brandbookValue(pack, 'email'),
      brandbookValue(pack, 'website'),
      brandbookValue(pack, 'instagram'),
    ].filter(Boolean).join(' · ');
    const customColors = pack.profile?.customColors || '';
    const selectedTheme = pack.profile?.selectedThemeId || '';
    const brandbookTheme = getProfileBrandbookTheme(selectedTheme, industry);
    const palette = resolveDocumentPalette(pack, brandbookTheme);
    const primaryColor = palette[0] || '#111827';
    const secondaryColor = palette[1] || '#ffffff';
    const accentColor = palette[2] || '#38bdf8';

    setGeneratingBrandbookId(pack.id);
    try {
      const html = buildBrandbookHtmlDocument({
        pack,
        relatedAssets,
        logoAsset,
        brandbookTheme,
        palette,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');

      if (!popup) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeFileName(brandName)}-brandbook.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Brandbook HTML pobrany. Otwórz plik i zapisz jako PDF.');
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success('Brandbook HTML otwarty — wybierz „Zapisz jako PDF”.');
      }
      return;
    } catch (error) {
      console.error('Brandbook HTML error:', error);
      toast.error('Nie udało się otworzyć brandbooka HTML');
      return;
    } finally {
      setGeneratingBrandbookId(null);
    }

    setGeneratingBrandbookId(pack.id);
    try {
      const logoDataUrl = await loadAssetDataUrl(logoAsset?.signedUrl);
      const previewAssets = relatedAssets.slice(0, 12);
      const assetPreviews = await Promise.all(
        previewAssets.map(async (asset) => ({
          asset,
          dataUrl: await loadAssetDataUrl(asset.signedUrl),
        })),
      );
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const [primaryR, primaryG, primaryB] = hexToRgb(primaryColor);
      const [secondaryR, secondaryG, secondaryB] = hexToRgb(secondaryColor);
      const [accentR, accentG, accentB] = hexToRgb(accentColor);
      const completeness = getBrandbookCompleteness(pack);
      const colorRoles = ['Kolor główny', 'Tło / jasny kontrast', 'Akcent / CTA', 'Tekst / neutralny', 'Kolor pomocniczy', 'Kolor dodatkowy'];
      let page = 1;

      addBrandbookDocPage(pdf, 'Brandbook / dokument marki', page++, brandName);
      pdf.setFillColor(secondaryR, secondaryG, secondaryB);
      pdf.rect(0, 18, 210, 279, 'F');
      pdf.setFillColor(primaryR, primaryG, primaryB);
      pdf.roundedRect(14, 34, 182, 86, 8, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.text('BRAND IDENTITY SYSTEM', 24, 52);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(30);
      addPdfWrappedText(pdf, brandName, 24, 72, 122, 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      addPdfWrappedText(pdf, industry, 24, 100, 122, 6);
      pdf.setFillColor(accentR, accentG, accentB);
      pdf.roundedRect(24, 106, 66, 8, 3, 3, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text(normalizePdfText(brandbookTheme.title).toUpperCase(), 28, 111);
      if (logoDataUrl) {
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(152, 52, 32, 32, 4, 4, 'F');
        pdf.addImage(logoDataUrl, pdfImageFormat(logoDataUrl), 156, 56, 24, 24);
      }
      pdf.setTextColor(17, 24, 39);
      drawPdfCard(pdf, 14, 136, 56, 38);
      drawPdfCard(pdf, 77, 136, 56, 38);
      drawPdfCard(pdf, 140, 136, 56, 38);
      pdf.setFontSize(10);
      drawPdfLabelValue(pdf, 'Kompletność', `${completeness.completed}/${completeness.total}`, 22, 150, 42);
      drawPdfLabelValue(pdf, 'Promptów', String(pack.prompts?.length || 0), 85, 150, 42);
      drawPdfLabelValue(pdf, 'Elementów', String(relatedAssets.length), 148, 150, 42);
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Esencja marki', 14, 196);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      addPdfWrappedText(
        pdf,
        `${brandName} to marka w obszarze: ${industry}. Dokument zbiera zatwierdzony brief, styl wizualny, zasady uzycia logo, kolory, typografie, komunikacje, prompty oraz wygenerowane elementy przypiete do projektu.`,
        14,
        208,
        180,
        6,
      );
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Paleta marki', 14, 244);
      pdf.setFont('helvetica', 'normal');
      palette.forEach((color, index) => {
        const [r, g, b] = hexToRgb(color);
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(14 + index * 30, 254, 22, 16, 3, 3, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(17, 24, 39);
        pdf.text(color, 14 + index * 30, 277);
      });

      addBrandbookDocPage(pdf, '01 / Fundament marki', page++, brandName);
      let y = drawPdfSectionLead(
        pdf,
        'Tak rozumiemy markę',
        'To jest źródło prawdy dla kolejnych materiałów: logo, wizytówek, ofert, reklam, postów i brandbooka.',
      );
      const briefRows = [
        ['Nazwa firmy', brandName],
        ['Branża', industry],
        ['Etap', pack.profile?.stage],
        ['Oferta', offer],
        ['Specjalizacja', pack.profile?.specialization],
        ['Klient docelowy', audience],
        ['Wyróżnik', differentiator],
        ['Ton komunikacji', tone],
        ['CTA', cta],
        ['Lokalizacja', location],
        ['Kontakt', contact],
        ['Czego unikać', avoidList],
      ].filter(([, value]) => String(value || '').trim());
      briefRows.forEach(([label, value], index) => {
        const slot = index % 14;
        if (index > 0 && slot === 0) {
          addBrandbookDocPage(pdf, '01 / Fundament marki cd.', page++, brandName);
          y = 36;
        }
        const x = slot % 2 === 0 ? 14 : 108;
        const rowY = y + Math.floor(slot / 2) * 28;
        drawPdfCard(pdf, x, rowY, 88, 22, [255, 255, 255]);
        drawPdfLabelValue(pdf, label, String(value), x + 5, rowY + 8, 78);
      });

      addBrandbookDocPage(pdf, '02 / Logo i znak', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Logo główne',
        'Logo powinno być używane konsekwentnie: bez rozciągania, bez przypadkowych efektów i bez zmiany proporcji.',
      );
      drawPdfCard(pdf, 14, y, 88, 88, [255, 255, 255]);
      if (logoDataUrl) {
        try {
          pdf.addImage(logoDataUrl, pdfImageFormat(logoDataUrl), 24, y + 12, 68, 52);
        } catch {
          pdf.setFontSize(9);
          pdf.text('Logo zapisane, ale bez podglądu w PDF.', 24, y + 42);
        }
      } else {
        pdf.setFontSize(10);
        addPdfWrappedText(pdf, 'Brak logo przypiętego do firmy. Po wygenerowaniu logo pojawi się ono automatycznie w brandbooku.', 24, y + 32, 68, 5);
      }
      drawPdfCard(pdf, 110, y, 86, 88, [249, 250, 251]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Zasady użycia', 118, y + 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      addPdfWrappedText(
        pdf,
        `Używaj logo na jasnym albo bardzo ciemnym tle, zostawiaj bezpieczny margines wokół znaku i nie dodawaj cieni, gradientów ani ramek, jeśli nie są częścią znaku. W materiałach reklamowych nazwa musi być czytelna.`,
        118,
        y + 26,
        70,
        6,
      );
      y += 110;
      drawPdfCard(pdf, 14, y, 182, 42, [255, 255, 255]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Nie rób', 22, y + 14);
      pdf.setFont('helvetica', 'normal');
      addPdfWrappedText(pdf, 'Nie rozciągaj logo, nie zmieniaj liter, nie obracaj znaku, nie kładź logo na chaotycznym zdjęciu i nie używaj kilku wersji naraz.', 22, y + 25, 160, 5);

      addBrandbookDocPage(pdf, '03 / Kolory marki', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Paleta i role kolorów',
        'Każdy kolor ma konkretną rolę. Dzięki temu reklamy, wizytówki i oferta wyglądają jak jedna marka, a nie losowe projekty.',
      );
      palette.forEach((color, index) => {
        const x = 14 + (index % 3) * 62;
        const boxY = y + Math.floor(index / 3) * 62;
        drawPdfSwatch(pdf, color, colorRoles[index] || 'Kolor dodatkowy', x, boxY);
      });
      drawPdfCard(pdf, 14, 214, 182, 44, [249, 250, 251]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Rekomendacja użycia', 22, 228);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      addPdfWrappedText(
        pdf,
        `Kolor główny stosuj w logo, nagłówkach i mocnych tłach. Akcent ${accentColor} zostaw dla CTA, ikon i najważniejszych elementów. Tekst powinien mieć wysoki kontrast względem tła.`,
        22,
        239,
        160,
        5,
      );

      addBrandbookDocPage(pdf, '04 / Typografia', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Krój pisma i hierarchia',
        'Wygenerowane grafiki AI często psują napisy, dlatego brandbook jasno określa styl liter i hierarchię tekstu.',
      );
      drawPdfCard(pdf, 14, y, 182, 54, [255, 255, 255]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.text(normalizePdfText(brandName).slice(0, 30), 24, y + 22);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      addPdfWrappedText(pdf, `Nagłówki: ${brandbookTheme.headingFont}\nTekst zwykły: ${brandbookTheme.bodyFont}\nKlimat: ${brandbookTheme.fontMood}`, 24, y + 34, 160, 5);
      y += 74;
      drawPdfCard(pdf, 14, y, 86, 74, [249, 250, 251]);
      drawPdfCard(pdf, 110, y, 86, 74, [249, 250, 251]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Zasada headline', 22, y + 14);
      pdf.text('Zasada tekstu', 118, y + 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      addPdfWrappedText(pdf, 'Krótki, mocny, maksymalnie 1-2 linie. Bez małych, cienkich liter na skomplikowanym tle.', 22, y + 28, 68, 5);
      addPdfWrappedText(pdf, 'Opis ma być prosty, czytelny i bez przeładowania. Lepiej mniej tekstu niż chaos.', 118, y + 28, 68, 5);

      addBrandbookDocPage(pdf, '05 / Styl graficzny', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        brandbookTheme.title,
        `${brandbookTheme.description} Ten kierunek powinien prowadzić wszystkie materiały: od logo po reklamy i ofertę.`,
      );
      drawPdfCard(pdf, 14, y, 182, 76, [255, 255, 255]);
      drawPdfLabelValue(pdf, 'Styl', brandbookTheme.title, 22, y + 16, 72);
      drawPdfLabelValue(pdf, 'Klimat fontu', brandbookTheme.fontMood, 112, y + 16, 72);
      drawPdfLabelValue(pdf, 'Branża', industry, 22, y + 44, 72);
      drawPdfLabelValue(pdf, 'CTA', cta, 112, y + 44, 72);
      y += 96;
      drawPdfCard(pdf, 14, y, 86, 88, [255, 255, 255]);
      drawPdfCard(pdf, 110, y, 86, 88, [255, 255, 255]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Używaj', 22, y + 16);
      pdf.text('Unikaj', 118, y + 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      addPdfWrappedText(pdf, `- spójna paleta\n- dużo światła/marginesu\n- czytelne CTA\n- jeden styl ikon\n- zdjęcia pasujące do branży`, 22, y + 30, 70, 6);
      addPdfWrappedText(pdf, `- losowe kolory\n- wiele fontów naraz\n- AI-artefakty w tekście\n- przeładowane układy\n- nieczytelne mini napisy`, 118, y + 30, 70, 6);

      addBrandbookDocPage(pdf, '06 / Komunikacja', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Ton marki',
        'Ta sekcja pomaga pisać teksty na stronę, reklamy, wizytówki i posty w jednym stylu.',
      );
      drawPdfCard(pdf, 14, y, 182, 52, [255, 255, 255]);
      addPdfWrappedText(
        pdf,
        `Ton: ${tone || 'do doprecyzowania'}\nGłówna obietnica: ${offer || industry}\nCTA: ${cta}\nCzego unikać: ${avoidList || 'ogólników, chaosu i obietnic bez konkretu'}`,
        22,
        y + 14,
        160,
        6,
      );
      y += 74;
      drawPdfCard(pdf, 14, y, 86, 84, [249, 250, 251]);
      drawPdfCard(pdf, 110, y, 86, 84, [249, 250, 251]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Przykładowe hasła', 22, y + 14);
      pdf.text('Nie pisać tak', 118, y + 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      addPdfWrappedText(pdf, `1. ${brandName} — ${offer || industry}\n2. ${cta}\n3. Profesjonalny styl, jasna oferta, konkretny efekt.`, 22, y + 28, 68, 5);
      addPdfWrappedText(pdf, 'Unikaj pustych sloganów typu „najlepsza jakość”, „pełen profesjonalizm” bez dowodu, zbyt długich zdań i zbyt wielu komunikatów na jednej grafice.', 118, y + 28, 68, 5);

      addBrandbookDocPage(pdf, '07 / Gotowość brandbooka', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Checklist przed użyciem',
        'Im więcej pól uzupełnionych, tym lepiej aplikacja przygotuje prompty i materiały firmowe.',
      );
      completeness.checks.forEach((item, index) => {
        const x = index % 2 === 0 ? 14 : 108;
        const itemY = y + Math.floor(index / 2) * 18;
        drawPdfChecklistItem(pdf, item.label, item.ok, x, itemY);
      });
      drawPdfCard(pdf, 14, y + 92, 182, 58, [255, 255, 255]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Do poprawy / uzupełnienia', 22, y + 108);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      addPdfWrappedText(
        pdf,
        completeness.missing.length
          ? completeness.missing.map((item) => `- ${item}`).join('\n')
          : 'Brandbook ma komplet podstawowych danych. Kolejny krok: dopiąć realne logo, wersje wizytówki i szablony social media.',
        22,
        y + 120,
        160,
        5,
      );

      addBrandbookDocPage(pdf, '08 / Prompty materiałów', page++, brandName);
      y = 36;
      if (!pack.prompts?.length) {
        addPdfWrappedText(pdf, 'Brak zapisanych promptów w tym projekcie.', 14, y, 180, 6);
      } else {
        pack.prompts.forEach((prompt, index) => {
          if (y > 238) {
            addBrandbookDocPage(pdf, '08 / Prompty materiałów cd.', page++, brandName);
            y = 36;
          }
          drawPdfCard(pdf, 14, y - 6, 182, 44, [255, 255, 255]);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text(normalizePdfText(`${index + 1}. ${prompt.title}`), 20, y + 2);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(107, 114, 128);
          pdf.text(normalizePdfText(`Format: ${prompt.format || 'brak'} / Styl: ${prompt.style || 'brak'}`), 20, y + 8);
          pdf.setTextColor(17, 24, 39);
          pdf.setFontSize(8);
          y = addPdfWrappedText(pdf, prompt.prompt.slice(0, 650), 20, y + 16, 170, 4) + 12;
        });
      }

      addBrandbookDocPage(pdf, '09 / Wygenerowane elementy', page++, brandName);
      if (!relatedAssets.length) {
        addPdfWrappedText(pdf, 'Brak wygenerowanych elementów przypiętych do tej firmy.', 14, 36, 180, 6);
      } else {
        assetPreviews.forEach(({ asset, dataUrl }, index) => {
          if (index > 0 && index % 6 === 0) {
            addBrandbookDocPage(pdf, '09 / Wygenerowane elementy cd.', page++, brandName);
          }
          const slot = index % 6;
          const x = 14 + (slot % 3) * 62;
          const itemY = 36 + Math.floor(slot / 3) * 104;
          drawPdfCard(pdf, x, itemY, 56, 88, [255, 255, 255]);
          if (dataUrl) {
            try {
              pdf.addImage(dataUrl, pdfImageFormat(dataUrl), x + 4, itemY + 4, 48, 48);
            } catch {
              pdf.setFontSize(8);
              pdf.text('Brak podgladu', x + 8, itemY + 28);
            }
          } else {
            pdf.setFontSize(8);
            pdf.text('Brak podgladu', x + 8, itemY + 28);
          }
          pdf.setFontSize(10);
          addPdfWrappedText(
            pdf,
            `${asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId || 'Material'}\n${asset.dimensions || 'format nieznany'}\n${new Date(asset.createdAt).toLocaleDateString('pl-PL')}`,
            x + 4,
            itemY + 60,
            48,
            4,
          );
        });
      }

      addBrandbookDocPage(pdf, '10 / Następne kroki', page++, brandName);
      y = drawPdfSectionLead(
        pdf,
        'Plan rozwoju materiałów',
        'Brandbook powinien żyć razem z firmą. Każde nowe logo, wizytówka, oferta i reklama przypięta do firmy może być później dopisana jako asset marki.',
      );
      const nextSteps = [
        logoDataUrl ? 'Zatwierdzić finalną wersję logo i nie mieszać kilku wariantów naraz.' : 'Wygenerować lub dodać finalne logo marki.',
        'Przygotować dwustronną wizytówkę w spójnym stylu.',
        'Zrobić szablon oferty / ulotki z jasnym CTA.',
        'Dodać 3-5 reklam lub postów pokazujących ofertę, problem klienta i efekt.',
        'Po każdej dobrej generacji zapisać grafikę do firmy, żeby budować bibliotekę brandbooka.',
      ];
      nextSteps.forEach((step, index) => {
        drawPdfCard(pdf, 14, y + index * 24, 182, 16, [255, 255, 255]);
        pdf.setFontSize(9);
        pdf.text(normalizePdfText(`${index + 1}. ${step}`), 22, y + 10 + index * 24);
      });

      pdf.save(`${safeFileName(brandName)}-brandbook.pdf`);
      toast.success('Brandbook PDF pobrany');
    } catch (error) {
      console.error('Brandbook PDF error:', error);
      toast.error('Nie udało się wygenerować brandbooka PDF');
    } finally {
      setGeneratingBrandbookId(null);
    }
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteConfirmText('');
      setDeletePassword('');
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deletingAccount) return;

    const isConfirmed = deleteConfirmText.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRM_PHRASE;
    if (!isConfirmed) {
      toast.error(`Wpisz "${DELETE_ACCOUNT_CONFIRM_PHRASE}", aby potwierdzić.`);
      return;
    }

    setDeletingAccount(true);
    try {
      await vpsFetch('/me/account', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmText: deleteConfirmText,
          password: deletePassword || undefined,
        }),
      });

      await signOut();
      toast.success('Konto zostało usunięte');
      window.location.assign('/auth');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć konta');
      setDeletingAccount(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === 'completed') return <Badge variant="default">Opłacone</Badge>;
    if (status === 'pending') return <Badge variant="secondary">Oczekujące</Badge>;
    return <Badge variant="destructive">Anulowane</Badge>;
  };

  const isDeleteConfirmed = deleteConfirmText.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRM_PHRASE;

  const renderProfileSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Dane profilu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ''} disabled className="mt-1" />
        </div>
        <div>
          <Label>Nazwa wyświetlana</Label>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Twoja nazwa"
            className="mt-1"
          />
        </div>
        <Button onClick={handleSaveProfile} disabled={saving} className="gradient-bg gap-1.5">
          <Save className="h-4 w-4" /> {saving ? 'Zapisywanie...' : 'Zapisz profil'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderCompanyPanel = (pack: CompanyAssistantPackage) => {
    const relatedAssets = getRelatedCompanyAssets(pack);
    const logoAssets = relatedAssets.filter((asset) => asset.assetType === 'logo' || asset.materialId === 'logo-concept');
    const brandbookAssets = relatedAssets.filter((asset) => asset.assetType === 'brandbook' || asset.materialId === 'brandbook');
    const brandbookTheme = getProfileBrandbookTheme(pack.profile?.selectedThemeId || '', pack.industry || pack.profile?.industry || '');
    const brandbookColors = resolveDocumentPalette(pack, brandbookTheme);
    const profileRows = [
      ['Nazwa firmy', pack.companyName || pack.profile?.companyName],
      ['Branża', pack.industry || pack.profile?.industry],
      ['Etap', pack.profile?.stage],
      ['Oferta', pack.profile?.offer],
      ['Specjalizacja', pack.profile?.specialization],
      ['Klient docelowy', pack.profile?.targetAudience],
      ['Wyróżnik', pack.profile?.differentiator],
      ['Ton komunikacji', pack.profile?.tone],
      ['CTA', pack.profile?.cta],
      ['Lokalizacja', pack.profile?.location],
      ['Telefon', pack.profile?.phone],
      ['E-mail', pack.profile?.email],
      ['WWW', pack.profile?.website],
      ['Instagram', pack.profile?.instagram],
      ['Kolory własne', pack.profile?.customColors],
      ['Czego unikać', pack.profile?.avoidList],
    ].filter(([, value]) => String(value || '').trim());

    const requiredBrandFields = [
      ['Nazwa firmy', pack.companyName || pack.profile?.companyName],
      ['Branża', pack.industry || pack.profile?.industry],
      ['Oferta', pack.profile?.offer || pack.profile?.specialization],
      ['Klient docelowy', pack.profile?.targetAudience],
      ['Wyróżnik', pack.profile?.differentiator],
      ['Ton komunikacji', pack.profile?.tone],
      ['CTA', pack.profile?.cta],
      ['Kolory / styl', pack.profile?.customColors || pack.profile?.selectedThemeId],
    ];
    const completedBrandFields = requiredBrandFields.filter(([, value]) => String(value || '').trim()).length;
    const brandHealth = Math.round((completedBrandFields / requiredBrandFields.length) * 100);
    const missingBrandFields = requiredBrandFields
      .filter(([, value]) => !String(value || '').trim())
      .map(([label]) => label);
    const contactItems = [
      ['Telefon', pack.profile?.phone],
      ['E-mail', pack.profile?.email],
      ['WWW', pack.profile?.website],
      ['Instagram', pack.profile?.instagram],
      ['Lokalizacja', pack.profile?.location],
    ].filter(([, value]) => String(value || '').trim());
    const latestAssets = [...relatedAssets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
    const nextActions = [
      !pack.companyName && 'Uzupełnij nazwę firmy, żeby logo i materiały nie używały placeholderów.',
      !pack.profile?.targetAudience && 'Dopisz klienta docelowego — prompty będą mniej ogólne.',
      !pack.profile?.cta && 'Dodaj CTA, np. „Umów konsultację”, „Napisz do nas”, „Sprawdź ofertę”.',
      logoAssets.length === 0 && 'Wygeneruj logo / znak marki i przypnij go do brandbooka.',
      relatedAssets.length === 0 && 'Wygeneruj pierwszą wizytówkę, post albo ofertę z promptu firmowego.',
      pack.prompts?.length === 0 && 'Utwórz pakiet promptów w Asystencie firmowym.',
      brandHealth >= 80 && logoAssets.length > 0 && 'Marka ma solidny fundament — możesz pobrać brandbook PDF.',
    ].filter(Boolean) as string[];

    const studioTools = [
      {
        id: 'brandbook',
        title: 'Brandbook dokumentowy',
        description: 'Wielostronicowy dokument A4: fundament marki, logo, kolory, typografia, komunikacja, prompty i assety.',
        format: 'A4 · wiele stron',
        icon: BriefcaseBusiness,
        ready: brandHealth >= 60,
        missing: brandHealth >= 60 ? '' : 'Uzupełnij podstawowe pola briefu.',
        loading: generatingBrandbookId === pack.id,
        action: () => handleDownloadCompanyBrandbook(pack),
        actionLabel: 'Otwórz brandbook',
      },
      {
        id: 'business-card',
        title: 'Wizytówka dwustronna',
        description: 'Edytor awersu i rewersu, trzy układy, własne kolory, format netto i spady drukarskie.',
        format: '90 × 50 mm + 3 mm spadu',
        icon: CreditCard,
        ready: Boolean(pack.companyName || pack.profile?.companyName),
        missing: 'Nazwa firmy jest wymagana.',
        loading: generatingBusinessCardId === pack.id,
        action: () => openBusinessCardEditor(pack),
        actionLabel: 'Otwórz edytor',
      },
      {
        id: 'offer',
        title: 'Oferta firmowa',
        description: 'Jednostronicowa oferta z właściwym klientem, wyróżnikiem, CTA, logo i kontaktem.',
        format: 'A4 · jedna strona',
        icon: FileText,
        ready: Boolean(pack.profile?.offer || pack.profile?.specialization),
        missing: 'Uzupełnij ofertę lub specjalizację.',
        loading: generatingOfferId === pack.id,
        action: () => handleOpenOfferPdf(pack),
        actionLabel: 'Otwórz ofertę',
      },
      {
        id: 'letterhead',
        title: 'Papier firmowy',
        description: 'Oficjalny wzór korespondencji z logo, danymi firmy, nagłówkiem i stopką.',
        format: 'A4 · wzór dokumentu',
        icon: FileSignature,
        ready: Boolean(pack.companyName || pack.profile?.companyName),
        missing: 'Nazwa firmy jest wymagana.',
        loading: generatingUtilityKey === `${pack.id}:letterhead`,
        action: () => handleOpenUtilityDocument(pack, 'letterhead'),
        actionLabel: 'Otwórz papier firmowy',
      },
      {
        id: 'email-signature',
        title: 'Podpis e-mail',
        description: 'Podpis HTML z logo, osobą kontaktową, stanowiskiem i danymi firmy.',
        format: 'HTML · Gmail / Outlook',
        icon: Mail,
        ready: Boolean(pack.profile?.email || pack.profile?.phone || pack.profile?.website),
        missing: 'Dodaj przynajmniej jeden kontakt.',
        loading: generatingUtilityKey === `${pack.id}:email-signature`,
        action: () => handleOpenUtilityDocument(pack, 'email-signature'),
        actionLabel: 'Otwórz podpis',
      },
      {
        id: 'price-list',
        title: 'Cennik usług',
        description: 'Czytelny cennik z pozycjami wpisanymi w briefie. Aplikacja nie wymyśla cen.',
        format: 'A4 · maks. 12 pozycji',
        icon: BadgeDollarSign,
        ready: Boolean(pack.profile?.priceListItems),
        missing: 'Dodaj pozycje cennika w briefie.',
        loading: generatingUtilityKey === `${pack.id}:price-list`,
        action: () => handleOpenUtilityDocument(pack, 'price-list'),
        actionLabel: 'Otwórz cennik',
      },
      {
        id: 'voucher',
        title: 'Voucher / bon',
        description: 'Elegancki voucher z usługą lub wartością, polami odbiorcy, kodem i warunkami.',
        format: 'DL · 210 × 99 mm',
        icon: Gift,
        ready: Boolean(pack.profile?.voucherValue || pack.profile?.offer),
        missing: 'Dodaj wartość vouchera albo ofertę.',
        loading: generatingUtilityKey === `${pack.id}:voucher`,
        action: () => handleOpenUtilityDocument(pack, 'voucher'),
        actionLabel: 'Otwórz voucher',
      },
    ];

    const tabs: Array<{ id: CompanyPanelTab; label: string; count?: number }> = [
      { id: 'crm', label: 'CRM marki' },
      { id: 'studio', label: 'Studio marki', count: studioTools.filter((tool) => tool.ready).length },
      { id: 'brief', label: 'Brief' },
      { id: 'prompts', label: 'Prompty', count: pack.prompts?.length || 0 },
      { id: 'assets', label: 'Grafiki', count: relatedAssets.length },
      { id: 'brandbook', label: 'Brandbook', count: logoAssets.length + brandbookAssets.length },
    ];

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Button variant="ghost" className="mb-2 -ml-2 gap-1.5" onClick={() => setSelectedCompanyId(null)}>
                <ArrowLeft className="h-4 w-4" /> Wróć do firm
              </Button>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
                {pack.companyName || 'Projekt bez nazwy'}
                <Badge variant="secondary">{pack.industry || 'Branża nieuzupełniona'}</Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {pack.prompts?.length || 0} promptów · {relatedAssets.length} elementów · zapisano {new Date(pack.createdAt).toLocaleDateString('pl-PL')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-1.5">
                <Link to="/company-assistant">
                  <Wand2 className="h-4 w-4" /> Nowy pakiet
                </Link>
              </Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                disabled={deletingCompanyId === pack.id}
                onClick={() => handleDeleteCompanyPackage(pack)}
              >
                <Trash2 className="h-4 w-4" /> {deletingCompanyId === pack.id ? 'Usuwanie...' : 'Usuń firmę'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border bg-muted/20 p-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeCompanyTab === tab.id ? 'default' : 'ghost'}
                className={cn('gap-1.5', activeCompanyTab === tab.id && 'gradient-bg')}
                onClick={() => setActiveCompanyTab(tab.id)}
              >
                {tab.label}
                {typeof tab.count === 'number' && <span className="rounded-full bg-background/25 px-1.5 text-xs">{tab.count}</span>}
              </Button>
            ))}
          </div>

          {activeCompanyTab === 'crm' && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kompletność marki</p>
                  <p className="mt-2 text-3xl font-bold">{brandHealth}%</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full gradient-bg" style={{ width: `${brandHealth}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {completedBrandFields}/{requiredBrandFields.length} kluczowych pól briefu
                  </p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompty</p>
                  <p className="mt-2 text-3xl font-bold">{pack.prompts?.length || 0}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Gotowe materiały do użycia w generatorze.</p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assety marki</p>
                  <p className="mt-2 text-3xl font-bold">{relatedAssets.length}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Logo, wizytówki, oferty i grafiki przypięte do firmy.</p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Brandbook</p>
                  <p className="mt-2 text-3xl font-bold">{logoAssets.length ? 'OK' : '—'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {logoAssets.length ? 'Logo wykryte, PDF gotowy.' : 'Najpierw dodaj logo.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">Centrum marki</p>
                      <p className="text-sm text-muted-foreground">Najważniejsze dane, które karmią prompty, brandbook i kolejne grafiki.</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startEditingBrief(pack)}>
                      <Save className="h-4 w-4" /> Edytuj brief
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Oferta', pack.profile?.offer || pack.profile?.specialization || 'Nie podano'],
                      ['Klient', pack.profile?.targetAudience || 'Nie podano'],
                      ['Wyróżnik', pack.profile?.differentiator || 'Nie podano'],
                      ['Ton', pack.profile?.tone || 'Nie podano'],
                      ['CTA', pack.profile?.cta || 'Nie podano'],
                      ['Unikać', pack.profile?.avoidList || 'Nie podano'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border bg-muted/20 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className={cn('mt-1 whitespace-pre-wrap text-sm', value === 'Nie podano' && 'text-muted-foreground')}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="font-semibold">Kontakty i kanały</p>
                    {contactItems.length ? (
                      <div className="mt-3 space-y-2">
                        {contactItems.map(([label, value]) => (
                          <div key={label} className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="break-all text-right font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                        Brak danych kontaktowych. Dodaj je w briefie, żeby wizytówki i oferty były kompletne.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    <p className="font-semibold">Braki do uzupełnienia</p>
                    {missingBrandFields.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missingBrandFields.map((field) => (
                          <Badge key={field} variant="secondary" className="whitespace-normal text-left">{field}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-emerald-700">Brief ma komplet kluczowych danych.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">Ostatnie elementy marki</p>
                      <p className="text-sm text-muted-foreground">Szybki podgląd tego, co już powstało.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveCompanyTab('assets')}>Zobacz grafiki</Button>
                  </div>
                  {latestAssets.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {latestAssets.map((asset) => (
                        <div key={`${pack.id}-crm-asset-${asset.id}`} className="overflow-hidden rounded-xl border bg-muted/30">
                          <div className="aspect-square bg-background">
                            {asset.signedUrl ? (
                              <img src={asset.signedUrl} alt={asset.materialTitle || asset.materialId} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Brak podglądu</div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="truncate text-xs font-medium">{asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString('pl-PL')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Nie ma jeszcze grafik przypiętych do tej firmy.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="font-semibold">Następne kroki</p>
                  <p className="text-sm text-muted-foreground">Mała checklista, żeby projekt nie utknął w połowie.</p>
                  <div className="mt-4 space-y-2">
                    {nextActions.slice(0, 6).map((action, index) => (
                      <div key={action} className="flex gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-1.5" onClick={() => setActiveCompanyTab('prompts')}>
                      <MessageSquareText className="h-4 w-4" /> Prompty
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={generatingBusinessCardId === pack.id}
                      onClick={() => openBusinessCardEditor(pack)}
                    >
                      <CreditCard className="h-4 w-4" /> {generatingBusinessCardId === pack.id ? 'Otwieram...' : 'Wizytówka PDF'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={generatingOfferId === pack.id}
                      onClick={() => handleOpenOfferPdf(pack)}
                    >
                      <FileText className="h-4 w-4" /> {generatingOfferId === pack.id ? 'Otwieram...' : 'Oferta A4'}
                    </Button>
                    <Button
                      className="gradient-bg gap-1.5"
                      disabled={generatingBrandbookId === pack.id}
                      onClick={() => handleDownloadCompanyBrandbook(pack)}
                    >
                      <Download className="h-4 w-4" /> Brandbook PDF
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCompanyTab === 'studio' && (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-sky-500/10 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold">Studio materiałów firmy</p>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Dokumenty korzystają z jednego zatwierdzonego briefu, logo i palety. Napisy pozostają poprawne, a brakujące dane nie są wymyślane przez AI.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="gap-1.5 bg-background/80" onClick={() => openDocumentStyleEditor(pack)}>
                      <ImagePlus className="h-4 w-4" /> Edytuj wygląd i logo
                    </Button>
                    <Badge className="gradient-bg w-fit">{studioTools.filter((tool) => tool.ready).length}/{studioTools.length} gotowych</Badge>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/80">
                  <div
                    className="h-full rounded-full gradient-bg"
                    style={{ width: `${Math.round((studioTools.filter((tool) => tool.ready).length / studioTools.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {studioTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <article key={tool.id} className="flex min-h-[260px] flex-col rounded-2xl border bg-background p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-xl gradient-bg text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge variant={tool.ready ? 'default' : 'secondary'} className={cn(tool.ready && 'bg-emerald-600 hover:bg-emerald-600')}>
                          {tool.ready ? 'Gotowe' : 'Brakuje danych'}
                        </Badge>
                      </div>
                      <h3 className="mt-4 text-lg font-bold">{tool.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{tool.format}</p>
                      {!tool.ready && <p className="mt-2 text-xs text-amber-700">{tool.missing}</p>}
                      <div className="mt-auto pt-5">
                        {tool.ready ? (
                          <Button className="gradient-bg w-full gap-1.5" disabled={tool.loading} onClick={tool.action}>
                            <Icon className="h-4 w-4" /> {tool.loading ? 'Przygotowuję...' : tool.actionLabel}
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full gap-1.5" onClick={() => startEditingBrief(pack)}>
                            <Save className="h-4 w-4" /> Uzupełnij brief
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="font-semibold">Jak uzyskać najlepszy efekt?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Najpierw zatwierdź logo, następnie uzupełnij osobę kontaktową, stanowisko, ofertę, CTA i kontakt. Cennik przyjmuje format „Usługa | Cena | Opis”, każda pozycja w nowej linii.
                </p>
              </div>
            </div>
          )}

          {activeCompanyTab === 'brief' && (
            <div className="space-y-3">
              {editingBriefId === pack.id ? (
                <>
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Edytujesz zatwierdzony brief. Te dane będą używane w brandbooku i kolejnych promptach firmy.
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {editableBriefFields.map((field) => (
                      <div key={field.key} className={cn(field.long && 'md:col-span-2')}>
                        <Label>{field.label}</Label>
                        {field.long ? (
                          <Textarea
                            value={briefDraft[field.key] || ''}
                            onChange={(event) => updateBriefDraft(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1 min-h-[90px]"
                          />
                        ) : (
                          <Input
                            value={briefDraft[field.key] || ''}
                            onChange={(event) => updateBriefDraft(field.key, event.target.value)}
                            placeholder={field.placeholder}
                            className="mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gradient-bg gap-1.5"
                      disabled={savingBriefId === pack.id}
                      onClick={() => handleSaveCompanyBrief(pack)}
                    >
                      <Save className="h-4 w-4" /> {savingBriefId === pack.id ? 'Zapisywanie...' : 'Zapisz brief'}
                    </Button>
                    <Button variant="outline" disabled={savingBriefId === pack.id} onClick={cancelEditingBrief}>
                      Anuluj
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="outline" className="gap-1.5" onClick={() => startEditingBrief(pack)}>
                      <Save className="h-4 w-4" /> Edytuj brief
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {profileRows.length > 0 ? (
                      profileRows.map(([label, value]) => (
                        <div key={label} className="rounded-xl border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{String(value)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground md:col-span-2">
                        Brief jest pusty. Wróć do Asystenta firmowego i uzupełnij profil marki.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeCompanyTab === 'prompts' && (
            <div className="space-y-3">
              {pack.prompts?.length ? (
                pack.prompts.map((prompt) => (
                  <div key={`${pack.id}-panel-prompt-${prompt.materialId}`} className="rounded-xl border bg-background p-3">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{prompt.title}</p>
                        <p className="text-xs text-muted-foreground">Format: {prompt.format || 'brak'} · Styl: {prompt.style || 'brak'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopyCompanyPrompt(prompt)}>
                          <Copy className="h-3.5 w-3.5" /> Kopiuj
                        </Button>
                        <Button size="sm" className="gradient-bg gap-1.5" onClick={() => handleUseCompanyPrompt(pack, prompt)}>
                          <Wand2 className="h-3.5 w-3.5" /> Użyj w generatorze
                        </Button>
                      </div>
                    </div>
                    <Textarea value={prompt.prompt} readOnly className="min-h-[170px] text-xs leading-relaxed" />
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Brak promptów w tym projekcie.</div>
              )}
            </div>
          )}

          {activeCompanyTab === 'assets' && (
            relatedAssets.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {relatedAssets.map((asset) => (
                  <div key={asset.id} className="overflow-hidden rounded-xl border bg-muted/30">
                    <div className="aspect-square bg-background">
                      {asset.signedUrl ? (
                        <img src={asset.signedUrl} alt={asset.materialTitle || asset.materialId} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Brak podglądu</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">
                        {asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId || 'Materiał firmowy'}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">{asset.dimensions || 'format nieznany'}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={deletingAssetId === asset.id}
                          onClick={() => handleDeleteCompanyAsset(asset)}
                          title="Usuń z firmy"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Brak wygenerowanych elementów. Użyj promptu firmowego w generatorze, a wynik pojawi się tutaj automatycznie.
              </div>
            )
          )}

          {activeCompanyTab === 'brandbook' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Wizytówka dwustronna do druku</p>
                    <p className="text-sm text-muted-foreground">
                      Osobny awers i rewers, 90 × 50 mm oraz spad 3 mm. Logo, kolory i kontakt są pobierane z aktualnego briefu firmy.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-1.5 bg-background"
                    disabled={generatingBusinessCardId === pack.id}
                    onClick={() => openBusinessCardEditor(pack)}
                  >
                    <CreditCard className="h-4 w-4" /> {generatingBusinessCardId === pack.id ? 'Otwieram...' : 'Otwórz wizytówkę PDF'}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Jednostronicowa oferta A4</p>
                    <p className="text-sm text-muted-foreground">
                      Logo, oferta, klient, wyróżnik, CTA i kontakt z aktualnego briefu. Wszystkie napisy pozostają poprawne i edytowalne w danych firmy.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={generatingOfferId === pack.id}
                    onClick={() => handleOpenOfferPdf(pack)}
                  >
                    <FileText className="h-4 w-4" /> {generatingOfferId === pack.id ? 'Otwieram...' : 'Otwórz ofertę A4'}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Brandbook HTML/CSS do PDF</p>
                    <p className="text-sm text-muted-foreground">
                      Otwiera ładny dokument A4 z okładką, logo, kolorami HEX, typografią, komunikacją, checklistą, promptami i assetami. W oknie drukowania wybierz „Zapisz jako PDF”.
                    </p>
                  </div>
                  <Button
                    className="gradient-bg gap-1.5"
                    disabled={generatingBrandbookId === pack.id}
                    onClick={() => handleDownloadCompanyBrandbook(pack)}
                  >
                    <Download className="h-4 w-4" /> {generatingBrandbookId === pack.id ? 'Otwieram dokument...' : 'Otwórz / zapisz PDF'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-background p-4">
                  <p className="font-medium">Kompletność briefu</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full gradient-bg" style={{ width: `${brandHealth}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {completedBrandFields}/{requiredBrandFields.length} pól gotowych · {brandHealth}%
                  </p>
                  {missingBrandFields.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Do uzupełnienia: {missingBrandFields.join(', ')}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="font-medium">Logo / znak</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {logoAssets.length ? 'Logo jest przypięte do firmy i może być używane w brandbooku.' : 'Brak logo. Wygeneruj materiał „Logo / znak marki”.'}
                  </p>
                  {logoAssets[0]?.signedUrl && (
                    <div className="mt-3 h-20 w-20 overflow-hidden rounded-xl border bg-muted/30">
                      <img src={logoAssets[0].signedUrl} alt="Logo marki" className="h-full w-full object-contain" loading="lazy" />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border bg-background p-4">
                  <p className="font-medium">Kolory i styl</p>
                  <p className="mt-1 text-sm text-muted-foreground">{brandbookTheme.title} · font: {brandbookTheme.fontMood}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {brandbookColors.map((color) => {
                      const [r, g, b] = hexToRgb(color);
                      return (
                        <span key={`${pack.id}-brandbook-color-${color}`} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-1 text-xs">
                          <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }} />
                          {color}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Nagłówki: {brandbookTheme.headingFont} · Tekst: {brandbookTheme.bodyFont}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <p className="font-medium">Rozdziały w PDF</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    'Okładka',
                    'Fundament marki',
                    'Logo i zasady',
                    'Kolory HEX',
                    'Typografia',
                    'Styl graficzny',
                    'Komunikacja',
                    'Checklist',
                    'Prompty',
                    'Assety',
                  ].map((item) => (
                    <Badge key={`${pack.id}-brandbook-section-${item}`} variant="secondary" className="justify-center whitespace-normal py-1.5 text-center">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button asChild variant="outline" className="gap-1.5">
                <Link to="/company-assistant">
                  <Wand2 className="h-4 w-4" /> Wróć do Asystenta firmowego
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCompaniesSection = () => {
    if (selectedCompany) return renderCompanyPanel(selectedCompany);

    return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-primary" /> Moje firmy i brandbooki
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Zapisane pakiety, prompty i elementy wygenerowane z Asystenta firmowego.
            </p>
          </div>
          <Button asChild className="gradient-bg gap-1.5">
            <Link to="/company-assistant">
              <Wand2 className="h-4 w-4" /> Asystent firmowy
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingCompanies ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ładowanie firm...</p>
        ) : companyPackages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="font-medium">Nie masz jeszcze zapisanej firmy.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Utwórz pakiet w Asystencie firmowym, a pojawi się tutaj razem z promptami i wygenerowanymi elementami.
            </p>
          </div>
        ) : (
          companyPackages.map((pack) => {
            const relatedAssets = getRelatedCompanyAssets(pack);
            const logoAssets = relatedAssets.filter((asset) => asset.assetType === 'logo' || asset.materialId === 'logo-concept');
            const brandbookAssets = relatedAssets.filter((asset) => asset.assetType === 'brandbook' || asset.materialId === 'brandbook');
            const logoAsset = logoAssets[0];
            const promptsOpen = expandedPrompts[pack.id] ?? Boolean(pack.prompts?.length);

            return (
              <div key={pack.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="space-y-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-lg font-semibold">{pack.companyName || 'Projekt bez nazwy'}</h3>
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-left">
                        {pack.industry || 'Branża nieuzupełniona'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pack.prompts?.length || 0} promptów · {relatedAssets.length} zapisanych elementów · zapisano{' '}
                      {new Date(pack.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={logoAssets.length ? 'default' : 'secondary'} className={cn(logoAssets.length && 'gradient-bg')}>
                        Logo: {logoAssets.length ? 'dodane' : 'brak'}
                      </Badge>
                      <Badge variant="secondary" className="whitespace-normal text-left">Brandbook PDF gotowy do pobrania</Badge>
                      {brandbookAssets.length > 0 && (
                        <Badge variant="secondary" className="whitespace-normal text-left">Plansze brandbooka: {brandbookAssets.length}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={promptsOpen ? 'default' : 'outline'}
                      className={cn('gap-1.5', promptsOpen && 'gradient-bg')}
                      disabled={!pack.prompts?.length}
                      onClick={() => setExpandedPrompts((current) => ({ ...current, [pack.id]: !promptsOpen }))}
                    >
                      <MessageSquareText className="h-4 w-4" /> Prompty ({pack.prompts?.length || 0})
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={() => openCompanyPanel(pack)}>
                      <BriefcaseBusiness className="h-4 w-4" /> Panel firmy
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={() => openCompanyPanel(pack, 'brandbook')}>
                      <BriefcaseBusiness className="h-4 w-4" /> Brandbook
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={generatingBrandbookId === pack.id}
                      onClick={() => handleDownloadCompanyBrandbook(pack)}
                    >
                      <Download className="h-4 w-4" /> {generatingBrandbookId === pack.id ? 'PDF...' : 'Otwórz PDF'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={generatingBusinessCardId === pack.id}
                      onClick={() => openBusinessCardEditor(pack)}
                    >
                      <CreditCard className="h-4 w-4" /> {generatingBusinessCardId === pack.id ? 'Otwieram...' : 'Wizytówka PDF'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={generatingOfferId === pack.id}
                      onClick={() => handleOpenOfferPdf(pack)}
                    >
                      <FileText className="h-4 w-4" /> {generatingOfferId === pack.id ? 'Otwieram...' : 'Oferta A4'}
                    </Button>
                    <Button asChild variant="outline" className="gap-1.5">
                      <Link to="/company-assistant">
                        <BriefcaseBusiness className="h-4 w-4" /> Nowy pakiet
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-1.5"
                      disabled={deletingCompanyId === pack.id}
                      onClick={() => handleDeleteCompanyPackage(pack)}
                    >
                      <Trash2 className="h-4 w-4" /> {deletingCompanyId === pack.id ? 'Usuwanie...' : 'Usuń'}
                    </Button>
                  </div>
                </div>

                {pack.prompts?.length > 0 && promptsOpen && (
                  <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Copy className="h-4 w-4" /> Zapisane prompty
                    </div>
                    <div className="space-y-3">
                      {pack.prompts.map((prompt) => (
                        <div key={`${pack.id}-prompt-${prompt.materialId}`} className="rounded-xl border bg-background p-3">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{prompt.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Format: {prompt.format || 'brak'} · Styl: {prompt.style || 'brak'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopyCompanyPrompt(prompt)}>
                                <Copy className="h-3.5 w-3.5" /> Kopiuj
                              </Button>
                              <Button size="sm" className="gradient-bg gap-1.5" onClick={() => handleUseCompanyPrompt(pack, prompt)}>
                                <Wand2 className="h-3.5 w-3.5" /> Użyj
                              </Button>
                            </div>
                          </div>
                          <Textarea value={prompt.prompt} readOnly className="min-h-[120px] text-xs leading-relaxed" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {relatedAssets.length > 0 ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Images className="h-4 w-4" /> Zapisane elementy
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {relatedAssets.slice(0, 8).map((asset) => (
                        <div key={asset.id} className="overflow-hidden rounded-xl border bg-muted/30">
                          <div className="aspect-square bg-background">
                            {asset.signedUrl ? (
                              <img src={asset.signedUrl} alt={asset.materialTitle || asset.materialId} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Brak podglądu</div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="truncate text-xs font-medium">
                              {asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId || 'Materiał firmowy'}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className="text-[11px] text-muted-foreground">{asset.dimensions || 'format nieznany'}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                disabled={deletingAssetId === asset.id}
                                onClick={() => handleDeleteCompanyAsset(asset)}
                                title="Usuń z firmy"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                    Brak wygenerowanych elementów. Wygeneruj logo, wizytówkę albo post z promptu firmowego, a pojawią się tutaj automatycznie.
                  </div>
                )}

                {logoAsset && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Logo zostało wykryte i będzie traktowane jako element identyfikacji w brandbooku.
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
    );
  };

  const renderAdPromptsSection = () => {
    const groupedSessions = adPromptSessions.reduce<Record<string, AdPromptSession[]>>((groups, session) => {
      const label = new Date(session.createdAt).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      groups[label] = groups[label] || [];
      groups[label].push(session);
      return groups;
    }, {});

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> Prompty reklamowe
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Historia promptów wygenerowanych w Generatorze reklam, z podziałem na daty i paczki generacji.
              </p>
            </div>
            <Button asChild className="gradient-bg gap-1.5">
              <Link to="/generator-reklam">
                <Wand2 className="h-4 w-4" /> Generator reklam
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingAdPrompts ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ładowanie promptów reklamowych...</p>
          ) : adPromptSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">Nie masz jeszcze zapisanych promptów reklamowych.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Wygeneruj prompty w Generatorze reklam, a automatycznie pojawią się tutaj.
              </p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([dateLabel, sessions]) => (
              <div key={dateLabel} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{dateLabel}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            Generacja z {new Date(session.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </h3>
                          <Badge variant="secondary">{session.prompts?.length || 0} promptów</Badge>
                          {session.imageCount > 0 && <Badge variant="outline">{session.imageCount} zdj.</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {session.inputText || 'Generacja na podstawie przesłanych zdjęć.'}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        disabled={deletingAdPromptSessionId === session.id}
                        onClick={() => handleDeleteAdPromptSession(session)}
                      >
                        <Trash2 className="h-4 w-4" /> {deletingAdPromptSessionId === session.id ? 'Usuwanie...' : 'Usuń'}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {(session.prompts || []).map((prompt, index) => {
                        const colors = getAdPromptColors(prompt);
                        const styleLabel = prompt.visualStyle || (prompt.styleId ? adStyleLabels[prompt.styleId] : '') || 'Styl zapisany w prompcie';
                        const categoryLabel = prompt.category ? adCategoryLabels[prompt.category] : '';
                        const cta = getAdPromptCta(prompt);
                        return <div key={`${session.id}-${index}`} className="rounded-xl border bg-background p-3">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium">
                                {index + 1}. {prompt.title || 'Prompt reklamowy'}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Hook: <span className="text-foreground">{prompt.hookPl || 'brak hooka'}</span>
                              </p>
                              {prompt.imageNote && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Zdjęcie: {prompt.imageNote}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopyAdPrompt(prompt)}>
                                <Copy className="h-3.5 w-3.5" /> Kopiuj
                              </Button>
                              <Button size="sm" className="gradient-bg gap-1.5" onClick={() => handleUseAdPrompt(prompt)}>
                                <Wand2 className="h-3.5 w-3.5" /> Użyj
                              </Button>
                            </div>
                          </div>
                          <div className="mb-3 grid gap-2 rounded-xl border bg-muted/20 p-3 text-xs sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">Styl reklamy</span>
                              <p className="mt-0.5 font-semibold text-foreground">{styleLabel}</p>
                              {categoryLabel && <Badge variant="secondary" className="mt-1.5">{categoryLabel}</Badge>}
                            </div>
                            <div>
                              <span className="text-muted-foreground">CTA</span>
                              <p className="mt-0.5 font-semibold text-foreground">{cta || 'Sprawdź w pełnym prompcie'}</p>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">Kolorystyka reklamy</span>
                              {colors.length ? (
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {colors.map((color) => (
                                    <span key={color} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 font-mono">
                                      <span className="h-4 w-4 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
                                      {color.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              ) : <p className="mt-0.5 text-muted-foreground">Paleta jest opisana w pełnym prompcie.</p>}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">Zdjęcie referencyjne</span>
                              <p className={cn('mt-0.5 font-semibold', prompt.needsImage ? 'text-amber-700' : 'text-emerald-700')}>
                                {prompt.needsImage ? 'Załącz zdjęcie osoby lub produktu.' : 'Nie trzeba — AI może stworzyć scenę od podstaw.'}
                              </p>
                            </div>
                          </div>
                          <Textarea value={prompt.prompt} readOnly className="min-h-[130px] text-xs leading-relaxed" />
                        </div>
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPurchasesSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Moje zakupy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingPurchases ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ładowanie...</p>
        ) : purchases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Brak zakupów</p>
        ) : (
          <div className="max-h-[620px] space-y-2 overflow-y-auto">
            {purchases.map((purchase) => {
              const displayAmount = purchase.paid_amount != null ? purchase.paid_amount : purchase.amount;
              return (
                <div key={purchase.id} className="flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-medium">+{purchase.credits.toLocaleString('pl-PL')} kredytów</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{(displayAmount / 100).toFixed(2)} zł</span>
                      {purchase.paid_amount != null && purchase.paid_amount < purchase.amount && (
                        <span className="text-muted-foreground/50 line-through">{(purchase.amount / 100).toFixed(2)} zł</span>
                      )}
                      <span>{new Date(purchase.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusLabel(purchase.status)}
                    {purchase.status === 'completed' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={previewingInvoice === purchase.id}
                          onClick={() => handlePreviewInvoice(purchase.id)}
                          title="Podgląd faktury"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          disabled={downloadingInvoice === purchase.id}
                          onClick={() => handleDownloadInvoice(purchase.id)}
                        >
                          <Download className="h-3 w-3" />
                          {downloadingInvoice === purchase.id ? '...' : 'Pobierz'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSecuritySection = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Zmień hasło
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nowe hasło</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Min. 6 znaków"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Potwierdź nowe hasło</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Powtórz hasło"
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || newPassword.length < 6}
            variant="outline"
            className="gap-1.5"
          >
            <KeyRound className="h-4 w-4" /> {changingPassword ? 'Zmieniam...' : 'Zmień hasło'}
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> 2FA administratora
              <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
                {twoFactorEnabled ? 'Włączone' : 'Wyłączone'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Po włączeniu 2FA każde logowanie administratora będzie wymagało 6-cyfrowego kodu z aplikacji uwierzytelniającej.
            </p>

            {!twoFactorEnabled ? (
              <div className="space-y-4">
                {!twoFactorSetup ? (
                  <Button onClick={handleStartTwoFactorSetup} disabled={twoFactorLoading} className="gradient-bg">
                    {twoFactorLoading ? 'Przygotowuję...' : 'Skonfiguruj 2FA'}
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="rounded-xl border bg-background p-4">
                      <Label>Zeskanuj kod QR w Google Authenticator</Label>
                      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-56 w-56 items-center justify-center rounded-2xl border bg-white p-3 shadow-sm">
                          {twoFactorQrCode ? (
                            <img
                              src={twoFactorQrCode}
                              alt="Kod QR do konfiguracji 2FA"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-center text-xs text-muted-foreground">Generuję kod QR...</span>
                          )}
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>1. Otwórz Google Authenticator na telefonie.</p>
                          <p>2. Kliknij plus i wybierz skanowanie kodu QR.</p>
                          <p>3. Zeskanuj kod, a potem wpisz poniżej 6-cyfrowy kod z aplikacji.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Klucz ręczny, jeśli skanowanie QR nie działa</Label>
                      <div className="mt-1 flex gap-2">
                        <Input value={twoFactorSetup.secret} readOnly className="font-mono text-xs" />
                        <Button variant="outline" onClick={() => handleCopy(twoFactorSetup.secret)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        To opcja awaryjna. Najwygodniej zeskanować kod QR powyżej.
                      </p>
                    </div>
                    <div>
                      <Label>Kod z aplikacji</Label>
                      <Input
                        inputMode="numeric"
                        value={twoFactorCode}
                        onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleEnableTwoFactor} disabled={twoFactorLoading || twoFactorCode.length !== 6} className="gradient-bg">
                        {twoFactorLoading ? 'Włączam...' : 'Włącz 2FA'}
                      </Button>
                      <Button variant="outline" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(''); }}>
                        Anuluj
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="rounded-xl border bg-background p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label>Kody odzyskiwania 2FA</Label>
                      <p className="text-xs text-muted-foreground">
                        Pozostało: {twoFactorRecoveryStats.unused}/{twoFactorRecoveryStats.total || 10}. Każdy kod działa tylko raz.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refreshTwoFactorStatus().catch(() => toast.error('Nie udało się odświeżyć statusu kodów'))}>
                      Odśwież
                    </Button>
                  </div>

                  {visibleRecoveryCodes.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                      <p className="mb-2 text-sm font-semibold">Zapisz te kody teraz. Po odświeżeniu strony nie pokażemy ich ponownie.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {visibleRecoveryCodes.map((code) => (
                          <code key={code} className="rounded bg-white px-2 py-1 text-sm font-semibold tracking-wide text-foreground">
                            {code}
                          </code>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadRecoveryCodes}>
                          <Download className="mr-1 h-4 w-4" /> Pobierz .txt
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setVisibleRecoveryCodes([])}>
                          Ukryj kody
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={recoveryRegenerateCode}
                      onChange={(event) => setRecoveryRegenerateCode(event.target.value.toUpperCase().slice(0, 18))}
                      placeholder="Kod 2FA albo kod odzyskiwania"
                    />
                    <Button variant="outline" onClick={handleRegenerateRecoveryCodes} disabled={twoFactorLoading}>
                      Wygeneruj nowe kody
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wygenerowanie nowych kodów unieważnia wszystkie stare kody odzyskiwania.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Wyłączaj tylko awaryjnie. Do wyłączenia wymagany jest aktualny kod 2FA, a przy koncie hasłowym także hasło.
                </p>
                <div>
                  <Label>Hasło konta</Label>
                  <Input
                    type="password"
                    value={twoFactorDisablePassword}
                    onChange={(event) => setTwoFactorDisablePassword(event.target.value)}
                    placeholder="Wymagane dla konta z hasłem"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Kod 2FA albo kod odzyskiwania</Label>
                  <Input
                    inputMode="text"
                    value={twoFactorDisableCode}
                    onChange={(event) => setTwoFactorDisableCode(event.target.value.toUpperCase().slice(0, 18))}
                    placeholder="123456 albo ABCD-EFGH-12"
                    className="mt-1"
                  />
                </div>
                <Button variant="destructive" onClick={handleDisableTwoFactor} disabled={twoFactorLoading || twoFactorDisableCode.trim().length < 6}>
                  {twoFactorLoading ? 'Wyłączam...' : 'Wyłącz 2FA'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAdminSection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Panel administratora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Narzędzia administracyjne są schowane w profilu, żeby nie zajmowały miejsca w głównym menu.
        </p>
        <Button asChild className="gradient-bg gap-1.5">
          <Link to="/admin">
            <Shield className="h-4 w-4" /> Otwórz panel admina
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  const renderDangerSection = () => (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" /> Strefa nieodwracalna
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usunięcie konta jest nieodwracalne. Dane profilu, sesje, zakupy i historia grafik zostaną trwale usunięte.
        </p>
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-1.5">
          <Trash2 className="h-4 w-4" /> Usuń konto
        </Button>
      </CardContent>
    </Card>
  );

  const renderActiveSection = () => {
    if (activeSection === 'profile') return renderProfileSection();
    if (activeSection === 'companies') return isAdmin ? renderCompaniesSection() : renderProfileSection();
    if (activeSection === 'adPrompts') return renderAdPromptsSection();
    if (activeSection === 'admin') return isAdmin ? renderAdminSection() : renderProfileSection();
    if (activeSection === 'purchases') return renderPurchasesSection();
    if (activeSection === 'security') return renderSecuritySection();
    return renderDangerSection();
  };

  const businessCardEditorPack = companyPackages.find((item) => item.id === businessCardEditorPackId);
  const businessCardEditorLogo = businessCardEditorPack
    ? resolveDocumentLogo(businessCardEditorPack, getRelatedCompanyAssets(businessCardEditorPack))
    : undefined;
  const documentStylePack = companyPackages.find((item) => item.id === documentStylePackId);
  const documentStyleLogos = documentStylePack
    ? getRelatedCompanyAssets(documentStylePack).filter((asset) => asset.assetType === 'logo' || asset.materialId === 'logo-concept' || asset.materialId === 'uploaded-logo')
    : [];
  const documentStylePreviewLogo = documentStyleDraft?.logoAssetId === 'none'
    ? undefined
    : documentStyleLogos.find((asset) => asset.id === documentStyleDraft?.logoAssetId);
  const businessCardPreviewName = businessCardEditorPack ? brandbookValue(businessCardEditorPack, 'companyName', 'Nazwa firmy') : 'Nazwa firmy';
  const businessCardPreviewSpecialization = businessCardEditorPack
    ? brandbookValue(businessCardEditorPack, 'specialization') || brandbookValue(businessCardEditorPack, 'offer') || brandbookValue(businessCardEditorPack, 'industry')
    : '';
  const businessCardPreviewPerson = businessCardEditorPack ? brandbookValue(businessCardEditorPack, 'contactPerson') : '';
  const businessCardPreviewRole = businessCardEditorPack ? brandbookValue(businessCardEditorPack, 'jobTitle') : '';
  const businessCardPreviewContacts = businessCardEditorPack
    ? [
        brandbookValue(businessCardEditorPack, 'phone'),
        brandbookValue(businessCardEditorPack, 'email'),
        brandbookValue(businessCardEditorPack, 'website'),
        brandbookValue(businessCardEditorPack, 'instagram'),
        businessCardDraft?.showLocation ? brandbookValue(businessCardEditorPack, 'location') : '',
      ].filter(Boolean)
    : [];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <User className="mr-2 inline h-6 w-6 text-primary" />
            Mój <span className="gradient-text">profil</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? 'Zarządzaj kontem, firmami, promptami i zakupami w jednym miejscu.'
              : 'Zarządzaj kontem, promptami reklamowymi i zakupami w jednym miejscu.'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-3">
                <div className="mb-3 rounded-xl bg-muted/40 p-3">
                  <p className="truncate text-sm font-medium">{displayName || user?.email || 'Użytkownik'}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <nav className="space-y-1">
                  {visibleProfileMenu.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    const count =
                      item.id === 'companies'
                        ? menuStats.companies
                        : item.id === 'adPrompts'
                          ? menuStats.adPrompts
                          : item.id === 'purchases'
                            ? menuStats.purchases
                            : null;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted',
                          active && 'bg-primary/10 text-primary ring-1 ring-primary/20',
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.label}</span>
                            {count !== null && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
                {isAdmin && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Firmy: {menuStats.companies} · Elementy: {menuStats.assets}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          <section>{renderActiveSection()}</section>
        </div>
      </motion.div>

      <Dialog
        open={Boolean(documentStylePackId && documentStyleDraft)}
        onOpenChange={(open) => {
          if (!open) {
            setDocumentStylePackId(null);
            setDocumentStyleDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wygląd dokumentów — {documentStylePack?.companyName || 'firma'}</DialogTitle>
            <DialogDescription>
              Te ustawienia będą wspólne dla brandbooka, oferty, wizytówki, papieru firmowego, cennika, vouchera i podpisu e-mail.
            </DialogDescription>
          </DialogHeader>

          {documentStyleDraft && documentStylePack && (
            <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="font-semibold">Kolory dokumentów</p>
                  <p className="mt-1 text-xs text-muted-foreground">Możesz zmienić tło niezależnie od pierwotnej palety marki.</p>
                  <div className="mt-4 space-y-3">
                    {([
                      ['primary', 'Tło główne'],
                      ['paper', 'Tło jasnych stron'],
                      ['accent', 'Akcent i przyciski'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <Label htmlFor={`document-${key}`} className="text-sm">{label}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`document-${key}`}
                            type="color"
                            value={documentStyleDraft[key]}
                            onChange={(event) => setDocumentStyleDraft((current) => current ? { ...current, [key]: event.target.value } : current)}
                            className="h-10 w-14 cursor-pointer p-1"
                          />
                          <span className="w-20 font-mono text-xs text-muted-foreground">{documentStyleDraft[key]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <p className="font-semibold">Logo w dokumentach</p>
                  <p className="mt-1 text-xs text-muted-foreground">Wybierz zapisane logo albo dodaj własny plik.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDocumentStyleDraft((current) => current ? { ...current, logoAssetId: 'none' } : current)}
                      className={cn(
                        'flex min-h-20 items-center justify-center rounded-xl border p-2 text-xs font-medium transition hover:border-primary',
                        documentStyleDraft.logoAssetId === 'none' && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                      )}
                    >
                      Bez logo — sama nazwa
                    </button>
                    {documentStyleLogos.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setDocumentStyleDraft((current) => current ? { ...current, logoAssetId: asset.id } : current)}
                        className={cn(
                          'flex min-h-20 items-center justify-center overflow-hidden rounded-xl border bg-white p-2 transition hover:border-primary',
                          documentStyleDraft.logoAssetId === asset.id && 'border-primary ring-2 ring-primary/20',
                        )}
                        title={asset.materialTitle || 'Logo'}
                      >
                        {asset.signedUrl ? (
                          <img src={asset.signedUrl} alt={asset.materialTitle || 'Logo'} className="max-h-16 max-w-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Logo bez podglądu</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <Label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                    <ImagePlus className="h-4 w-4" />
                    {uploadingDocumentLogo ? 'Dodawanie logo...' : 'Dodaj własne logo'}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploadingDocumentLogo}
                      onChange={(event) => {
                        void handleUploadDocumentLogo(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </Label>
                  <p className="mt-2 text-[11px] text-muted-foreground">Najlepiej PNG z przezroczystym tłem, maks. 5 MB.</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Podgląd stylu</p>
                <div
                  className="relative mx-auto aspect-[1/1.414] w-full max-w-[430px] overflow-hidden rounded-xl border shadow-xl"
                  style={{ backgroundColor: documentStyleDraft.paper, color: readableTextColor(documentStyleDraft.paper) }}
                >
                  <div
                    className="relative min-h-[35%] overflow-hidden p-[8%]"
                    style={{ backgroundColor: documentStyleDraft.primary, color: readableTextColor(documentStyleDraft.primary) }}
                  >
                    <div
                      className="absolute -right-[8%] -top-[30%] h-[130%] w-[48%] rounded-full blur-3xl"
                      style={{ backgroundColor: `${documentStyleDraft.accent}99` }}
                    />
                    <div className="relative z-10 flex min-h-12 items-center">
                      {documentStylePreviewLogo?.signedUrl ? (
                        <img src={documentStylePreviewLogo.signedUrl} alt="Wybrane logo" className="max-h-14 max-w-[48%] object-contain object-left" />
                      ) : (
                        <p className="text-xl font-black tracking-tight">{brandbookValue(documentStylePack, 'companyName', 'Nazwa firmy')}</p>
                      )}
                    </div>
                    <p className="relative z-10 mt-[10%] max-w-[75%] text-3xl font-black leading-[1.12]">Profesjonalny dokument Twojej marki</p>
                    <div className="relative z-10 mt-5 h-1.5 w-20 rounded-full" style={{ backgroundColor: documentStyleDraft.accent }} />
                  </div>
                  <div className="space-y-4 p-[8%]">
                    <div className="h-3 w-[70%] rounded-full opacity-20" style={{ backgroundColor: readableTextColor(documentStyleDraft.paper) }} />
                    <div className="h-3 w-[88%] rounded-full opacity-15" style={{ backgroundColor: readableTextColor(documentStyleDraft.paper) }} />
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="h-20 rounded-xl border p-3" style={{ borderColor: `${documentStyleDraft.accent}66` }}>
                          <div className="h-2 w-9 rounded-full" style={{ backgroundColor: documentStyleDraft.accent }} />
                          <div className="mt-3 h-2 w-[80%] rounded-full opacity-15" style={{ backgroundColor: readableTextColor(documentStyleDraft.paper) }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground">Podgląd pokazuje paletę i logo. Każdy dokument zachowa swój właściwy układ i format druku.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentStylePackId(null)}>Anuluj</Button>
            <Button
              className="gradient-bg gap-1.5"
              disabled={!documentStylePack || !documentStyleDraft || savingDocumentStyle || uploadingDocumentLogo}
              onClick={handleSaveDocumentStyle}
            >
              <Save className="h-4 w-4" /> {savingDocumentStyle ? 'Zapisywanie...' : 'Zapisz wygląd dokumentów'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(businessCardEditorPackId && businessCardDraft)}
        onOpenChange={(open) => {
          if (!open) {
            setBusinessCardEditorPackId(null);
            setBusinessCardDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytor wizytówki — {businessCardPreviewName}</DialogTitle>
            <DialogDescription>
              Ustaw wygląd awersu i rewersu. Eksport zapisze dwie strony 90 × 50 mm ze spadem 3 mm.
            </DialogDescription>
          </DialogHeader>

          {businessCardDraft && businessCardEditorPack && (
            <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <div className="space-y-4">
                <div>
                  <Label>Układ</Label>
                  <div className="mt-2 space-y-2">
                    {([
                      ['brand-first', 'Marka na pierwszym planie', 'Logo na mocnym tle, spokojny rewers.'],
                      ['typographic-premium', 'Typograficzna premium', 'Nazwa firmy, dużo światła i elegancka hierarchia.'],
                      ['bold-split', 'Nowoczesny podział', 'Mocny akcent kolorystyczny i bardziej dynamiczny układ.'],
                    ] as const).map(([id, title, description]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBusinessCardDraft((current) => current ? { ...current, variantId: id } : current)}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition hover:border-primary',
                          businessCardDraft.variantId === id && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                        )}
                      >
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="block text-xs text-muted-foreground">{description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <Label>Kolory wizytówki</Label>
                  <div className="mt-3 space-y-3">
                    {([
                      ['primary', 'Kolor awersu'],
                      ['paper', 'Kolor rewersu'],
                      ['accent', 'Akcent'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-sm">{label}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={businessCardDraft[key]}
                            onChange={(event) => setBusinessCardDraft((current) => current ? { ...current, [key]: event.target.value } : current)}
                            className="h-9 w-12 cursor-pointer p-1"
                          />
                          <span className="w-[70px] font-mono text-xs text-muted-foreground">{businessCardDraft[key]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={businessCardDraft.showSlogan}
                      onChange={(event) => setBusinessCardDraft((current) => current ? { ...current, showSlogan: event.target.checked } : current)}
                    />
                    Pokaż slogan / główny komunikat
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={businessCardDraft.showLocation}
                      onChange={(event) => setBusinessCardDraft((current) => current ? { ...current, showLocation: event.target.checked } : current)}
                    />
                    Pokaż lokalizację / obszar
                  </label>
                </div>

                <p className="text-xs text-muted-foreground">
                  Nazwę, stanowisko, telefon i pozostałe dane zmienisz w zakładce „Brief”. Puste dane nie są wymyślane.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold">Awers</p>
                  <div
                    className="relative mx-auto aspect-[9/5] w-full max-w-[650px] overflow-hidden rounded-xl border shadow-xl"
                    style={{
                      backgroundColor: businessCardDraft.primary,
                      color: readableTextColor(businessCardDraft.primary),
                    }}
                  >
                    {businessCardDraft.variantId === 'bold-split' && (
                      <div
                        className="absolute -right-[8%] -top-[40%] h-[190%] w-[38%] rotate-12"
                        style={{ backgroundColor: businessCardDraft.accent }}
                      />
                    )}
                    <div className={cn(
                      'relative z-10 flex h-full flex-col justify-center p-[8%]',
                      businessCardDraft.variantId === 'bold-split' ? 'items-start text-left' : 'items-center text-center',
                    )}>
                      {businessCardDraft.variantId !== 'typographic-premium' && (
                        businessCardEditorLogo?.signedUrl ? (
                          <img src={businessCardEditorLogo.signedUrl} alt="Logo" className="mb-[4%] max-h-[28%] max-w-[56%] object-contain" />
                        ) : (
                          <div className="mb-[4%] grid h-12 w-12 place-items-center rounded-xl border-2 font-black" style={{ color: businessCardDraft.accent, borderColor: businessCardDraft.accent }}>
                            {businessCardPreviewName.slice(0, 2).toUpperCase()}
                          </div>
                        )
                      )}
                      {(!businessCardEditorLogo?.signedUrl || businessCardDraft.variantId === 'typographic-premium') && (
                        <p className={cn('font-black tracking-tight', businessCardDraft.variantId === 'typographic-premium' ? 'font-serif text-4xl' : 'text-3xl')}>
                          {businessCardPreviewName}
                        </p>
                      )}
                      {businessCardPreviewSpecialization && <p className="mt-[2%] max-w-[75%] text-xs opacity-75">{businessCardPreviewSpecialization}</p>}
                      {businessCardDraft.showSlogan && brandbookValue(businessCardEditorPack, 'slogan') && (
                        <p className="mt-[1%] max-w-[75%] text-[10px] opacity-65">{brandbookValue(businessCardEditorPack, 'slogan')}</p>
                      )}
                      <div className="mt-[4%] h-1 w-14 rounded-full" style={{ backgroundColor: businessCardDraft.accent }} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Rewers</p>
                  <div
                    className="mx-auto grid aspect-[9/5] w-full max-w-[650px] grid-cols-[38%_1fr] items-center gap-[6%] overflow-hidden rounded-xl border p-[7%] shadow-xl"
                    style={{ backgroundColor: businessCardDraft.paper, color: readableTextColor(businessCardDraft.paper) }}
                  >
                    <div className="border-r pr-[12%]" style={{ borderColor: businessCardDraft.accent }}>
                      {businessCardEditorLogo?.signedUrl && <img src={businessCardEditorLogo.signedUrl} alt="Logo" className="mb-3 max-h-10 max-w-full object-contain object-left" />}
                      <p className="text-lg font-black leading-tight">{businessCardPreviewPerson || businessCardPreviewName}</p>
                      <p className="mt-1 text-xs opacity-60">{businessCardPreviewRole || businessCardPreviewSpecialization}</p>
                    </div>
                    <div className="space-y-2">
                      {businessCardPreviewContacts.length ? businessCardPreviewContacts.map((value, index) => (
                        <div key={`${value}-${index}`} className="flex items-baseline gap-3">
                          <span className="w-8 shrink-0 text-[9px] font-black" style={{ color: businessCardDraft.accent }}>{index + 1}</span>
                          <span className="break-all text-xs font-semibold">{value}</span>
                        </div>
                      )) : (
                        <p className="text-xs opacity-60">Uzupełnij kontakt w briefie firmy.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBusinessCardEditorPackId(null)}>Anuluj</Button>
            <Button
              className="gradient-bg gap-1.5"
              disabled={!businessCardEditorPack || !businessCardDraft || generatingBusinessCardId === businessCardEditorPack?.id}
              onClick={handleExportBusinessCardFromEditor}
            >
              <Download className="h-4 w-4" /> Zapisz ustawienia i otwórz PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć konto?</DialogTitle>
            <DialogDescription>
              Ta operacja jest nieodwracalna. Aby potwierdzić, wpisz:
              <span className="ml-1 font-semibold text-foreground">{DELETE_ACCOUNT_CONFIRM_PHRASE}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Fraza potwierdzająca</Label>
              <Input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder={DELETE_ACCOUNT_CONFIRM_PHRASE}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Aktualne hasło (jeśli ustawione)</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Wpisz hasło"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDeleteDialogChange(false)} disabled={deletingAccount}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={!isDeleteConfirmed || deletingAccount}>
              {deletingAccount ? 'Usuwanie...' : 'Usuń'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Profile;

