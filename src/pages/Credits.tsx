import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Coins,
  ShoppingCart,
  History,
  Sparkles,
  Zap,
  TrendingUp,
  Tag,
  Loader2,
  Download,
  Building2,
  User,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gem,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { vpsFetch } from '@/lib/vpsApi';

type CreditPackage = {
  id: string;
  label: string;
  credits: number;
  price_grosze: number;
  popular: boolean;
  active: boolean;
  sort_order: number;
};

type Purchase = {
  id: string;
  credits: number;
  amount: number;
  paid_amount: number | null;
  status: string;
  created_at: string;
};

type UsageEntry = {
  id: string;
  credits_used: number;
  model: string;
  created_at: string;
};

type VerifyPaymentResponse = {
  status?: string;
  credits?: number;
  payment_status?: string;
};

type CouponPreviewEntry = {
  packageId: string;
  matched: boolean;
  matchedCode?: string | null;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
};

type CouponPreviewResponse = {
  couponCode?: string;
  matchedAny?: boolean;
  packages?: CouponPreviewEntry[];
};

type CheckoutResponse = {
  url?: string;
};

type InvoiceResponse = {
  html?: string;
  error?: string;
};

type CreditsOverviewResponse = {
  packages?: CreditPackage[];
  purchases?: Purchase[];
  usage?: UsageEntry[];
};

type BuyerType = 'company' | 'individual';

type BillingInfoState = {
  nip: string;
  company: string;
  address: string;
  postalCode: string;
  city: string;
  name: string;
};

type PackagePresentation = {
  badge: string;
  description: string;
  highlights: string[];
  icon: LucideIcon;
  accentClassName: string;
};

const usageModelLabels: Record<string, string> = {
  'gemini-25-image-economy': 'Studio Economy',
  'gemini-25-flash-image': 'Studio Flash',
  'openai-gpt-image-2': 'Studio Pro',
  'openai-gpt-image-2.5-flare': 'Flare',
  'openai-gpt-image-2.5-sunburst': 'Sunburst',
  'gemini-3-pro-image': 'Studio Ultra',
  gemini: 'Canvas Pro',
  'dall-e-3': 'DALL-E 3',
  'openai-gpt-image-1': 'High Quality',
  'gpt-image-1-mini': 'Wisdom 1',
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const normalizePostalCode = (value: string) => {
  const digits = onlyDigits(value).slice(0, 5);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
};

const normalizeCouponCode = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase();

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const formatPrice = (amountGrosze: number) => {
  const amountPln = amountGrosze / 100;
  const fractionDigits = Number.isInteger(amountPln) ? 0 : 2;

  return `${amountPln.toLocaleString('pl-PL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  })} zł`;
};

const resolvePackagePresentation = (
  pack: CreditPackage,
  index: number,
  totalPackages: number
): PackagePresentation => {
  if (pack.popular) {
    return {
      badge: 'Najczęściej wybierany',
      description: 'Najlepszy balans ceny i liczby kredytów do regularnego generowania grafik AI.',
      highlights: ['Produkt cyfrowy', 'Aktywacja zwykle w kilka minut', 'Faktura po zakupie'],
      icon: Gem,
      accentClassName: 'from-primary/20 via-primary/10 to-accent/20 text-primary',
    };
  }

  if (index === 0) {
    return {
      badge: 'Na start',
      description: 'Dobry pakiet na pierwsze testy generatora, edycji i narzędzi AI w serwisie.',
      highlights: ['Dobry na początek', 'Bez subskrypcji', 'Szybka płatność online'],
      icon: Sparkles,
      accentClassName: 'from-sky-500/15 via-cyan-500/10 to-primary/20 text-sky-600',
    };
  }

  if (index === totalPackages - 1) {
    return {
      badge: 'Dla intensywnej pracy',
      description: 'Pakiet dla osób, które generują większe serie grafik i chcą niższy koszt jednostkowy.',
      highlights: ['Najwięcej kredytów', 'Korzystniejsza cena jednostkowa', 'Wygodny dla firm'],
      icon: Zap,
      accentClassName: 'from-amber-500/20 via-orange-500/10 to-primary/20 text-amber-600',
    };
  }

  return {
    badge: 'Produkt cyfrowy',
    description: 'Jednorazowy zakup kredytów do wykorzystania w generatorze oraz narzędziach AI.',
    highlights: ['Aktywacja do 1 dnia roboczego', 'Faktura po zakupie', 'Płatność online'],
    icon: Coins,
    accentClassName: 'from-emerald-500/20 via-primary/10 to-accent/20 text-emerald-600',
  };
};

const validateBillingInfo = (buyerType: BuyerType, billingInfo: BillingInfoState) => {
  const address = billingInfo.address.trim();
  const city = billingInfo.city.trim();
  const postalDigits = onlyDigits(billingInfo.postalCode);

  if (buyerType === 'company') {
    if (!address) return 'Adres jest wymagany do faktury.';
    if (!city) return 'Miasto jest wymagane do faktury.';
    if (postalDigits.length !== 5) return 'Kod pocztowy musi mieć 5 cyfr (00-000).';

    const nipDigits = onlyDigits(billingInfo.nip);
    if (nipDigits.length !== 10) return 'NIP musi mieć dokładnie 10 cyfr.';
    if (!billingInfo.company.trim()) return 'Nazwa firmy jest wymagana do faktury.';
    return null;
  }

  if (!billingInfo.name.trim()) return 'Imię i nazwisko jest wymagane do faktury.';
  if (postalDigits.length > 0 && postalDigits.length !== 5) return 'Kod pocztowy musi mieć 5 cyfr (00-000).';
  return null;
};

const Credits = () => {
  const { user } = useAuth();
  const { balance, isAdmin, loading: balanceLoading, refetch } = useCredits();
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponPreviewByPackage, setCouponPreviewByPackage] = useState<Record<string, CouponPreviewEntry>>({});
  const [couponPreviewLoading, setCouponPreviewLoading] = useState(false);
  const [couponPreviewMessage, setCouponPreviewMessage] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const [billingDialog, setBillingDialog] = useState<CreditPackage | null>(null);
  const [buyerType, setBuyerType] = useState<BuyerType>('individual');
  const [billingInfo, setBillingInfo] = useState<BillingInfoState>({
    nip: '',
    company: '',
    address: '',
    postalCode: '',
    city: '',
    name: '',
  });
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (searchParams.get('success') === 'true' && sessionId && user) {
      const verifyPayment = async () => {
        toast.success('Płatność zakończona. Sprawdzam potwierdzenie operatora płatności...');

        for (let attempt = 0; attempt < 6; attempt += 1) {
          try {
            const data = await vpsFetch<VerifyPaymentResponse>('/billing/payments/verify', {
              method: 'POST',
              body: JSON.stringify({ sessionId }),
            });

            if (data?.status === 'completed') {
              toast.success(`Dodano ${data.credits} kredytów!`);
              refetch();
              return;
            }

            if (data?.status === 'already_completed') {
              toast.success('Kredyty już zostały dodane.');
              refetch();
              return;
            }

            if (data?.status === 'not_paid') {
              if (attempt === 0) {
                toast.info('Operator płatności potwierdza płatność. Zwykle trwa to kilka sekund.');
              }

              if (attempt < 5) {
                await wait(3000);
                continue;
              }

              toast.info(
                'Operator płatności nadal przetwarza płatność. Najczęściej kończy się to w mniej niż minutę i kredyty dodadzą się automatycznie.'
              );
              refetch();
              return;
            }
          } catch (error) {
            console.error('Verify payment failed:', error);

            if (attempt === 5) {
              toast.error('Nie udało się jeszcze potwierdzić płatności. Sprawdzimy ją ponownie automatycznie.');
            }
          }

          await wait(3000);
        }
      };

      verifyPayment();
    } else if (searchParams.get('success') === 'true') {
      toast.success('Płatność zakończona. Kredyty powinny pojawić się w ciągu kilku sekund.');
      refetch();
      window.setTimeout(() => refetch(), 5000);
    }

    if (searchParams.get('canceled') === 'true') {
      toast.info('Płatność została anulowana.');
    }
  }, [searchParams, refetch, user]);

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    let isMounted = true;
    setLoadingData(true);

    vpsFetch<CreditsOverviewResponse>('/billing/credits/overview')
      .then((data) => {
        if (!isMounted) return;
        setCreditPackages(data.packages || []);
        setPurchases(data.purchases || []);
        setUsage(data.usage || []);
      })
      .catch((error) => {
        console.error('Credits overview error:', error);
        toast.error('Nie udało się pobrać danych kredytów.');
      })
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const normalizedCode = normalizeCouponCode(couponCode);

    if (!user || !normalizedCode) {
      setCouponPreviewByPackage({});
      setCouponPreviewLoading(false);
      setCouponPreviewMessage(null);
      return;
    }

    let isMounted = true;
    setCouponPreviewLoading(true);
    setCouponPreviewMessage(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await vpsFetch<CouponPreviewResponse>('/billing/coupons/preview', {
          method: 'POST',
          body: JSON.stringify({ couponCode: normalizedCode }),
        });

        if (!isMounted) return;

        const previewMap = Object.fromEntries((data.packages || []).map((item) => [item.packageId, item]));
        setCouponPreviewByPackage(previewMap);

        if (data.matchedAny) {
          setCouponPreviewMessage(`Kod ${data.couponCode} jest aktywny. Obniżone ceny są już widoczne przy pakietach.`);
        } else {
          setCouponPreviewMessage(`Nie znaleziono aktywnego kodu rabatowego: ${normalizedCode}.`);
        }
      } catch (error) {
        console.error('Coupon preview error:', error);
        if (!isMounted) return;

        setCouponPreviewByPackage({});
        setCouponPreviewMessage(error instanceof Error ? error.message : 'Nie udało się sprawdzić kuponu.');
      } finally {
        if (isMounted) {
          setCouponPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [couponCode, user]);

  const getPreviewForPackage = (packageId: string) => couponPreviewByPackage[packageId] || null;

  const handleBuyClick = (pack: CreditPackage) => {
    setBillingDialog(pack);
    setBuyerType('individual');
    setBillingInfo({
      nip: '',
      company: '',
      address: '',
      postalCode: '',
      city: '',
      name: '',
    });
  };

  const handleBuyCredits = async () => {
    const pack = billingDialog;
    if (!pack) return;

    const billingValidationError = validateBillingInfo(buyerType, billingInfo);
    if (billingValidationError) {
      toast.error(billingValidationError);
      return;
    }

    setBuyingPack(pack.id);
    setBillingDialog(null);

    try {
      if (!user) {
        toast.error('Musisz być zalogowany.');
        return;
      }

      const body: Record<string, unknown> = {
        packageId: pack.id,
        couponCode: normalizeCouponCode(couponCode) || undefined,
        origin: window.location.origin,
      };

      body.billing = {
        type: buyerType,
        nip: buyerType === 'company' ? onlyDigits(billingInfo.nip).slice(0, 10) : '',
        company: buyerType === 'company' ? billingInfo.company.trim() : '',
        address: billingInfo.address.trim(),
        postalCode: normalizePostalCode(billingInfo.postalCode),
        city: billingInfo.city.trim(),
        name: buyerType === 'individual' ? billingInfo.name.trim() : '',
      };

      const { url } = await vpsFetch<CheckoutResponse>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Brak adresu przekierowania do operatora płatności.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      const message = error instanceof Error ? error.message : '';
      toast.error(message || 'Wystąpił błąd podczas tworzenia płatności.');
    } finally {
      setBuyingPack(null);
    }
  };

  const handleDownloadInvoice = async (purchaseId: string) => {
    setDownloadingInvoice(purchaseId);

    try {
      const data = await vpsFetch<InvoiceResponse>('/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ purchaseId }),
      });

      if (data?.error) {
        throw new Error(data.error);
      }

      const win = window.open('', '_blank');
      if (win && data?.html) {
        win.document.write(data.html);
        win.document.close();
      }
    } catch {
      toast.error('Nie udało się wygenerować faktury.');
    }

    setDownloadingInvoice(null);
  };

  const statusLabel = (status: string) => {
    if (status === 'completed') return <Badge variant="default">Opłacone</Badge>;
    if (status === 'pending') return <Badge variant="secondary">Oczekujące</Badge>;
    return <Badge variant="destructive">Anulowane</Badge>;
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Coins className="inline w-6 h-6 text-primary mr-2" />
            Moje <span className="gradient-text">kredyty</span>
          </h1>
          <p className="text-muted-foreground mt-1">Zarządzaj kredytami i kupuj pakiety.</p>
        </div>

        <Card className="border-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Twoje saldo</p>
                {balanceLoading || isAdmin === null ? (
                  <Skeleton className="h-10 w-32" />
                ) : isAdmin ? (
                  <div>
                    <p className="text-4xl font-bold">
                      ∞ <span className="text-lg text-muted-foreground">nielimitowane</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Konto administratora nie korzysta z limitu zapisanego w tabeli kredytów.
                    </p>
                  </div>
                ) : (
                  <p className="text-4xl font-bold">
                    {balance?.toLocaleString('pl-PL')}{' '}
                    <span className="text-lg text-muted-foreground">kredytów</span>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" /> Studio Economy: 30 kr
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" /> Studio Flash: 50 kr
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" /> Studio Pro: 60 kr
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" /> Studio Ultra: 80 kr
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-primary shrink-0" />
              <Input
                placeholder="Wpisz kod kuponu (opcjonalnie)"
                value={couponCode}
                onChange={(e) => setCouponCode(normalizeCouponCode(e.target.value))}
                className="max-w-xs"
              />
              {couponCode && (
                <Badge variant="secondary" className="shrink-0">
                  Kupon: {couponCode}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-8">
              Kupon zostanie zastosowany automatycznie przy zakupie pakietu.
            </p>
            {couponCode && (
              <p
                className={`mt-2 ml-8 text-xs ${
                  couponPreviewMessage?.startsWith('Kod ')
                    ? 'text-emerald-600'
                    : couponPreviewMessage
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                {couponPreviewLoading ? 'Sprawdzam kod rabatowy...' : couponPreviewMessage}
              </p>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Kup kredyty
          </h2>
          <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Gem className="h-4 w-4 text-primary" />
                  Pakiety kredytów AI
                </div>
                <p className="text-sm text-muted-foreground">
                  Kupujesz jednorazowy pakiet kredytów do generowania i edycji grafik AI w serwisie ai-kreator.pl.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Czas realizacji
                </div>
                <p className="text-sm text-muted-foreground">
                  Kredyty aktywują się zwykle w kilka minut, a maksymalny czas realizacji zamówienia wynosi 1 dzień roboczy.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Płatność i dokumenty
                </div>
                <p className="text-sm text-muted-foreground">
                  Obsługujemy płatność online przez zewnętrznego operatora, a po zakupie wystawiana jest faktura. Dla firm dokument może zostać wysłany do KSeF.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPackages.map((pack, index) => {
              const preview = getPreviewForPackage(pack.id);
              const finalAmount = preview?.matched ? preview.finalAmount : pack.price_grosze;
              const discountAmount = preview?.matched ? preview.discountAmount : 0;
              const pricePerThousand = ((finalAmount / 100) / pack.credits) * 1000;
              const presentation = resolvePackagePresentation(pack, index, creditPackages.length);
              const PackageIcon = presentation.icon;

              return (
                <Card
                  key={pack.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                    pack.popular ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {pack.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-bl-lg font-medium">
                      Popularne
                    </div>
                  )}
                  <div className={`h-1 ${pack.popular ? 'bg-gradient-to-r from-primary to-accent' : 'bg-muted'}`} />
                  <CardHeader className="pb-2">
                    <div
                      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${presentation.accentClassName}`}
                    >
                      <PackageIcon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="mb-3 w-fit">
                      {presentation.badge}
                    </Badge>
                    <CardDescription>{pack.label}</CardDescription>
                    <CardTitle className="text-2xl">{pack.credits.toLocaleString('pl-PL')}</CardTitle>
                    <p className="text-sm text-muted-foreground">kredytów</p>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-3 min-h-[60px] text-sm leading-6 text-muted-foreground">
                      {presentation.description}
                    </p>
                    <p className="text-3xl font-bold mb-1">
                      {formatPrice(finalAmount)}
                      {preview?.matched && (
                        <span className="ml-2 align-middle text-xs font-medium text-emerald-600">
                          -{formatPrice(discountAmount)}
                        </span>
                      )}
                    </p>
                    {preview?.matched ? (
                      <p className="mb-2 text-xs text-muted-foreground line-through">
                        Cena regularna: {formatPrice(pack.price_grosze)}
                      </p>
                    ) : (
                      <div className="mb-2" />
                    )}
                    <p className="text-xs text-muted-foreground mb-3">
                      {pricePerThousand.toFixed(1)} zł za 1000 kredytów
                    </p>
                    <div className="mb-4 space-y-2">
                      {presentation.highlights.map((highlight) => (
                        <div key={highlight} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => handleBuyClick(pack)}
                      className="w-full gradient-bg"
                      disabled={buyingPack !== null}
                    >
                      {buyingPack === pack.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1" /> Przekierowanie...
                        </>
                      ) : (
                        'Kup teraz'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Dostępne metody płatności zależą od aktualnie podpiętego operatora płatności.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Użycie kredytów
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : usage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak historii użycia</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {usage.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <span className="font-medium">{usageModelLabels[entry.model] ?? entry.model ?? 'Generator AI'}</span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString('pl-PL', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="text-destructive font-medium">-{entry.credits_used}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5" /> Historia zakupów
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak zakupów</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <span className="font-medium">+{purchase.credits.toLocaleString('pl-PL')} kredytów</span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(purchase.created_at).toLocaleDateString('pl-PL', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPrice(purchase.paid_amount != null ? purchase.paid_amount : purchase.amount)}
                        </span>
                        {purchase.paid_amount != null && purchase.paid_amount < purchase.amount && (
                          <span className="text-xs line-through text-muted-foreground">{formatPrice(purchase.amount)}</span>
                        )}
                        {statusLabel(purchase.status)}
                        {purchase.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 px-2"
                            disabled={downloadingInvoice === purchase.id}
                            onClick={() => handleDownloadInvoice(purchase.id)}
                          >
                            <Download className="w-3 h-3" />
                            {downloadingInvoice === purchase.id ? 'Generuję...' : 'Faktura'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!billingDialog} onOpenChange={() => setBillingDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zamówienie: {billingDialog?.label}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="font-medium">Dane nabywcy</p>
                <p className="mt-1">
                  Wybierz niżej, czy kupujesz jako osoba prywatna czy firma. Dla firmy wyślemy fakturę do KSeF, a dla
                  osoby prywatnej zostawimy ją tylko w systemie.
                </p>
                <p className="mt-2 font-medium">Faktura będzie wystawiona dla każdego zakupu.</p>
                {billingDialog && getPreviewForPackage(billingDialog.id)?.matched && (
                  <p className="mt-2 text-emerald-600">
                    Aktywny rabat: {formatPrice(getPreviewForPackage(billingDialog.id)?.discountAmount || 0)}. Do
                    zapłaty: {formatPrice(getPreviewForPackage(billingDialog.id)?.finalAmount || billingDialog.price_grosze)}.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <RadioGroup
                  value={buyerType}
                  onValueChange={(value) => setBuyerType(value as BuyerType)}
                  className="flex gap-4"
                >
                  <div
                    className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors flex-1"
                    onClick={() => setBuyerType('company')}
                  >
                    <RadioGroupItem value="company" id="buyer-company" />
                    <Building2 className="w-4 h-4 text-primary" />
                    <Label htmlFor="buyer-company" className="cursor-pointer font-medium">
                      Firma
                    </Label>
                  </div>
                  <div
                    className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors flex-1"
                    onClick={() => setBuyerType('individual')}
                  >
                    <RadioGroupItem value="individual" id="buyer-individual" />
                    <User className="w-4 h-4 text-primary" />
                    <Label htmlFor="buyer-individual" className="cursor-pointer font-medium">
                      Osoba prywatna
                    </Label>
                  </div>
                </RadioGroup>

                {buyerType === 'company' ? (
                  <div className="space-y-3">
                    <div>
                      <Label>NIP</Label>
                      <Input
                        placeholder="1234567890"
                        value={billingInfo.nip}
                        onChange={(e) =>
                          setBillingInfo((prev) => ({ ...prev, nip: onlyDigits(e.target.value).slice(0, 10) }))
                        }
                        maxLength={10}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">NIP: dokładnie 10 cyfr.</p>
                    </div>
                    <div>
                      <Label>Nazwa firmy</Label>
                      <Input
                        placeholder="Firma Sp. z o.o."
                        value={billingInfo.company}
                        onChange={(e) => setBillingInfo((prev) => ({ ...prev, company: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Imię i nazwisko</Label>
                    <Input
                      placeholder="Jan Kowalski"
                      value={billingInfo.name}
                      onChange={(e) => setBillingInfo((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                )}

                <div>
                  <Label>{buyerType === 'individual' ? 'Adres (opcjonalnie)' : 'Adres'}</Label>
                  <Input
                    placeholder="ul. Przykładowa 1"
                    value={billingInfo.address}
                    onChange={(e) => setBillingInfo((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{buyerType === 'individual' ? 'Kod pocztowy (opcjonalnie)' : 'Kod pocztowy'}</Label>
                    <Input
                      placeholder="00-000"
                      value={billingInfo.postalCode}
                      onChange={(e) =>
                        setBillingInfo((prev) => ({ ...prev, postalCode: normalizePostalCode(e.target.value) }))
                      }
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <Label>{buyerType === 'individual' ? 'Miasto (opcjonalnie)' : 'Miasto'}</Label>
                    <Input
                      placeholder="Warszawa"
                      value={billingInfo.city}
                      onChange={(e) => setBillingInfo((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBillingDialog(null)}>
                Anuluj
              </Button>
              <Button
                onClick={handleBuyCredits}
                disabled={buyingPack !== null || Boolean(validateBillingInfo(buyerType, billingInfo))}
              >
                Przejdź do płatności
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

export default Credits;
