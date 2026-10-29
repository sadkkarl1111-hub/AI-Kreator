import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileType,
  Images,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { vpsFetch } from '@/lib/vpsApi';

type Format = 'png' | 'jpeg' | 'webp';
type ConversionStatus = 'idle' | 'converting' | 'done' | 'error';

type ImageItem = {
  id: string;
  fileName: string;
  originalSize: number;
  sourceFormat: string;
  preview: string;
  resultUrl: string | null;
  resultSize: number | null;
  status: ConversionStatus;
};

type CreditPackage = {
  id: string;
  credits: number;
  active: boolean;
};

type CreditPurchase = {
  id: string;
  credits: number;
  status: string;
};

type CreditsOverviewResponse = {
  packages?: CreditPackage[];
  purchases?: CreditPurchase[];
};

const FORMATS: { value: Format; label: string; mime: string; extension: string }[] = [
  { value: 'png', label: 'PNG', mime: 'image/png', extension: 'png' },
  { value: 'jpeg', label: 'JPG', mime: 'image/jpeg', extension: 'jpg' },
  { value: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp' },
];

const STANDARD_FILE_LIMIT = 2;
const PAID_FILE_LIMIT = 5;
const PREMIUM_FILE_LIMIT = 10;
const ADMIN_FILE_LIMIT = 20;

const getImageLimitLabel = (limit: number) => {
  if (limit === 1) return '1 zdjęcie';
  if (limit < 5) return `${limit} zdjęcia`;
  return `${limit} zdjęć`;
};

const resolvePackageFileLimit = (packages: CreditPackage[] = [], purchases: CreditPurchase[] = []) => {
  const completedPurchases = purchases.filter((purchase) => purchase.status === 'completed');
  if (!completedPurchases.length) return STANDARD_FILE_LIMIT;

  const activePackageCredits = packages
    .filter((pack) => pack.active !== false)
    .map((pack) => Number(pack.credits) || 0);
  const highestConfiguredPackage = Math.max(0, ...activePackageCredits);
  const highestCompletedPurchase = Math.max(
    0,
    ...completedPurchases.map((purchase) => Number(purchase.credits) || 0),
  );

  if (highestConfiguredPackage > 0 && highestCompletedPurchase >= highestConfiguredPackage) {
    return PREMIUM_FILE_LIMIT;
  }

  return PAID_FILE_LIMIT;
};

const getFileId = (file: File) => {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${file.name}-${file.size}-${file.lastModified}-${randomPart}`;
};

const getSourceFormat = (file: File) => {
  const mimeFormat = file.type.replace('image/', '').replace('jpeg', 'jpg');
  const fileFormat = file.name.split('.').pop()?.toLowerCase();
  return (mimeFormat || fileFormat || 'obraz').toUpperCase();
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'));
    image.src = src;
  });

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTargetFormat = (targetFormat: Format) => FORMATS.find((format) => format.value === targetFormat) || FORMATS[0];

const convertImage = async (item: ImageItem, targetFormat: Format, quality: number) => {
  const image = await loadImage(item.preview);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Przeglądarka nie pozwoliła utworzyć obrazu wynikowego.');
  }

  if (targetFormat === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  const format = getTargetFormat(targetFormat);
  const resultUrl = canvas.toDataURL(format.mime, quality / 100);
  const base64 = resultUrl.split(',')[1] || '';

  return {
    resultUrl,
    resultSize: Math.round((base64.length * 3) / 4),
  };
};

const downloadDataUrl = (url: string, fileName: string, targetFormat: Format) => {
  const format = getTargetFormat(targetFormat);
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const link = document.createElement('a');
  link.download = `${baseName}.${format.extension}`;
  link.href = url;
  link.click();
};

const FormatConverter = () => {
  const { isAdmin, loading: adminLoading, user } = useIsAdmin();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(92);
  const [converting, setConverting] = useState(false);
  const [packageFileLimit, setPackageFileLimit] = useState(STANDARD_FILE_LIMIT);
  const [packageLimitLoading, setPackageLimitLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileLimit = isAdmin ? ADMIN_FILE_LIMIT : packageFileLimit;
  const limitLoading = adminLoading || packageLimitLoading;
  const convertedItems = items.filter((item) => item.resultUrl);
  const canConvert = items.length > 0 && !converting;

  useEffect(() => {
    if (adminLoading) return;

    if (isAdmin) {
      setPackageFileLimit(ADMIN_FILE_LIMIT);
      setPackageLimitLoading(false);
      return;
    }

    if (!user) {
      setPackageFileLimit(STANDARD_FILE_LIMIT);
      setPackageLimitLoading(false);
      return;
    }

    let mounted = true;
    setPackageLimitLoading(true);

    vpsFetch<CreditsOverviewResponse>('/billing/credits/overview')
      .then((data) => {
        if (!mounted) return;
        setPackageFileLimit(resolvePackageFileLimit(data.packages || [], data.purchases || []));
      })
      .catch(() => {
        if (!mounted) return;
        setPackageFileLimit(STANDARD_FILE_LIMIT);
      })
      .finally(() => {
        if (mounted) {
          setPackageLimitLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [adminLoading, isAdmin, user]);

  const updateItem = (id: string, patch: Partial<ImageItem>) => {
    setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleFiles = async (fileList: FileList | null) => {
    const imageFiles = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    const availableSlots = Math.max(fileLimit - items.length, 0);
    if (availableSlots <= 0) {
      toast.warning(`Kolejka ma już maksymalnie ${getImageLimitLabel(fileLimit)}.`);
      return;
    }

    const selectedFiles = imageFiles.slice(0, availableSlots);
    if (imageFiles.length > availableSlots) {
      toast.warning(`Możesz wybrać maksymalnie ${getImageLimitLabel(fileLimit)} naraz.`);
    }

    try {
      const nextItems = await Promise.all(
        selectedFiles.map(async (file) => ({
          id: getFileId(file),
          fileName: file.name,
          originalSize: file.size,
          sourceFormat: getSourceFormat(file),
          preview: await readFileAsDataUrl(file),
          resultUrl: null,
          resultSize: null,
          status: 'idle' as ConversionStatus,
        })),
      );

      setItems((currentItems) => [...currentItems, ...nextItems]);
      toast.success(
        nextItems.length > 1
          ? `Dodano ${getImageLimitLabel(nextItems.length)} do konwersji.`
          : 'Dodano zdjęcie do konwersji.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się wczytać zdjęć.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConvertAll = async () => {
    if (!items.length) return;

    setConverting(true);
    let failed = 0;

    for (const item of items) {
      updateItem(item.id, { status: 'converting', resultUrl: null, resultSize: null });

      try {
        const result = await convertImage(item, targetFormat, quality);
        updateItem(item.id, { ...result, status: 'done' });
      } catch {
        failed += 1;
        updateItem(item.id, { status: 'error', resultUrl: null, resultSize: null });
      }
    }

    setConverting(false);

    if (failed) {
      toast.error(`Nie udało się przekonwertować ${failed} zdjęć.`);
      return;
    }

    toast.success(items.length > 1 ? `Przekonwertowano ${items.length} zdjęć.` : 'Konwersja zakończona.');
  };

  const handleDownloadAll = () => {
    convertedItems.forEach((item, index) => {
      window.setTimeout(() => {
        if (item.resultUrl) {
          downloadDataUrl(item.resultUrl, item.fileName, targetFormat);
        }
      }, index * 120);
    });

    toast.success('Rozpoczęto pobieranie wyników.');
  };

  const removeItem = (id: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  };

  const clearItems = () => {
    setItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileType className="h-6 w-6 text-primary" /> Zmiana formatu
            </h1>
            <p className="text-sm text-muted-foreground">
              Konwertuj obrazy między PNG, JPG i WebP. Standardowo 2 zdjęcia, w pakietach 5 lub 10.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={fileLimit > 1}
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Tryb administratora: do {ADMIN_FILE_LIMIT} zdjęć naraz
                  </>
                ) : limitLoading ? (
                  'Sprawdzam limit pakietu...'
                ) : user && fileLimit >= PREMIUM_FILE_LIMIT ? (
                  `Pakiet premium: do ${getImageLimitLabel(PREMIUM_FILE_LIMIT)} naraz`
                ) : user && fileLimit >= PAID_FILE_LIMIT ? (
                  `Wykupiony pakiet: do ${getImageLimitLabel(PAID_FILE_LIMIT)} naraz`
                ) : (
                  `Limit standardowy: do ${getImageLimitLabel(STANDARD_FILE_LIMIT)} naraz`
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={limitLoading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Wybierz zdjęcia
              </Button>
            </div>

            {!items.length ? (
              <button
                type="button"
                className="w-full rounded-xl border-2 border-dashed p-12 text-center transition-colors hover:border-primary/50"
                onClick={() => fileInputRef.current?.click()}
                disabled={limitLoading}
              >
                <Images className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Kliknij, aby wgrać zdjęcia</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Możesz zaznaczyć do {getImageLimitLabel(fileLimit)}.
                </p>
              </button>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">Format wynikowy</span>
                  <div className="flex gap-2">
                    {FORMATS.map((format) => (
                      <Button
                        key={format.value}
                        type="button"
                        size="sm"
                        variant={targetFormat === format.value ? 'default' : 'outline'}
                        onClick={() => {
                          setTargetFormat(format.value);
                          setItems((currentItems) =>
                            currentItems.map((item) => ({ ...item, resultUrl: null, resultSize: null, status: 'idle' })),
                          );
                        }}
                      >
                        {format.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {targetFormat !== 'png' && (
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Jakość: {quality}%</label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={quality}
                      onChange={(event) => {
                        setQuality(Number(event.target.value));
                        setItems((currentItems) =>
                          currentItems.map((item) => ({ ...item, resultUrl: null, resultSize: null, status: 'idle' })),
                        );
                      }}
                      className="w-full"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleConvertAll} disabled={!canConvert} className="gap-2">
                    {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
                    {items.length > 1 ? 'Konwertuj wszystkie' : 'Konwertuj'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={converting || limitLoading || items.length >= fileLimit}
                  >
                    Dodaj zdjęcia
                  </Button>
                  <Button type="button" variant="outline" onClick={clearItems} disabled={converting}>
                    Wyczyść
                  </Button>
                  {convertedItems.length > 1 && (
                    <Button type="button" variant="outline" onClick={handleDownloadAll} className="gap-2">
                      <Download className="h-4 w-4" />
                      Pobierz wszystkie
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  {items.map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[88px,1fr,auto]">
                      <img src={item.preview} alt={item.fileName} className="h-20 w-20 rounded-lg object-cover" />
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-medium">{item.fileName}</p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {item.sourceFormat}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase text-primary">
                            {getTargetFormat(targetFormat).extension}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Oryginał: {formatSize(item.originalSize)}</span>
                          {item.resultSize && <span>Wynik: {formatSize(item.resultSize)}</span>}
                          {item.status === 'converting' && <span>Konwertuję...</span>}
                          {item.status === 'done' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Gotowe
                            </span>
                          )}
                          {item.status === 'error' && <span className="text-destructive">Błąd konwersji</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {item.resultUrl && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => downloadDataUrl(item.resultUrl!, item.fileName, targetFormat)}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Pobierz
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          disabled={converting}
                          aria-label={`Usuń ${item.fileName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default FormatConverter;
