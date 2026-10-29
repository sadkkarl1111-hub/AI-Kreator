export type ErrorLogLike = {
  message: string;
  error_type: string;
  details: Record<string, unknown> | null;
};

export type GuideSeverity = 'critical' | 'high' | 'medium' | 'low';

export type TroubleshootGuide = {
  title: string;
  symptoms: string[];
  match?: string[];
  causes: string[];
  fixes: string[];
  files: string[];
  severity: GuideSeverity;
};

export const sourceLabels: Record<string, string> = {
  'frontend': 'Frontend',
  'generate-image': 'Generowanie',
  'edit-image': 'Edycja',
  'create-checkout': 'Płatność',
  'verify-payment': 'Weryfikacja płatności',
  'stripe-webhook': 'Stripe webhook',
  'remove-bg': 'Usuwanie tła',
  'auth': 'Autoryzacja',
  'auth-email': 'Autoryzacja e-mail',
  'send-email': 'E-mail',
  'verify-turnstile': 'Captcha',
  'storage': 'Storage',
  'database': 'Baza danych',
  'ocr': 'OCR',
  'outpainting': 'Outpainting',
  'daily-credits': 'Darmowe kredyty',
  'generate-invoice': 'Faktury',
  'ksef-send-invoice': 'KSeF',
  'admin': 'Admin',
  'mailerlite': 'MailerLite',
  'colorize': 'Koloryzacja',
  'style-transfer': 'Transfer stylu',
  'upscale': 'Upscale',
};

export const sourceColors: Record<string, string> = {
  'frontend': 'bg-red-500/10 text-red-500',
  'generate-image': 'bg-blue-500/10 text-blue-500',
  'edit-image': 'bg-purple-500/10 text-purple-500',
  'create-checkout': 'bg-orange-500/10 text-orange-500',
  'verify-payment': 'bg-orange-500/10 text-orange-500',
  'stripe-webhook': 'bg-red-500/10 text-red-500',
  'remove-bg': 'bg-emerald-500/10 text-emerald-500',
  'auth': 'bg-yellow-500/10 text-yellow-500',
  'auth-email': 'bg-yellow-500/10 text-yellow-500',
  'send-email': 'bg-yellow-500/10 text-yellow-500',
  'verify-turnstile': 'bg-yellow-500/10 text-yellow-500',
  'storage': 'bg-cyan-500/10 text-cyan-500',
  'database': 'bg-pink-500/10 text-pink-500',
  'ocr': 'bg-indigo-500/10 text-indigo-500',
  'outpainting': 'bg-violet-500/10 text-violet-500',
  'daily-credits': 'bg-lime-500/10 text-lime-500',
  'generate-invoice': 'bg-amber-500/10 text-amber-500',
  'ksef-send-invoice': 'bg-amber-500/10 text-amber-500',
  'admin': 'bg-rose-500/10 text-rose-500',
  'mailerlite': 'bg-teal-500/10 text-teal-500',
  'colorize': 'bg-fuchsia-500/10 text-fuchsia-500',
  'style-transfer': 'bg-sky-500/10 text-sky-500',
  'upscale': 'bg-green-500/10 text-green-500',
};

export const sourceFilterOptions = Object.entries(sourceLabels)
  .sort(([, a], [, b]) => a.localeCompare(b, 'pl'))
  .map(([value, label]) => ({ value, label }));

export const TROUBLESHOOT_GUIDES: Record<string, TroubleshootGuide> = {
  API_KEY_INVALID: {
    title: 'Klucze API / AI service unavailable',
    symptoms: ['401 Unauthorized', 'Invalid API key', 'Authentication failed', 'AI service unavailable'],
    match: ['AI_SERVICE_UNAVAILABLE', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'Invalid API key', 'Authentication failed'],
    causes: [
      'Brak klucza API albo zly sekret po stronie backendu.',
      'Klucz wygasl, zostal cofniety albo nie ma aktywnego billingu.',
      'Model wskazuje na innego dostawce niz skonfigurowany klucz.',
    ],
    fixes: [
      '1. Sprawdz sekrety projektu oraz tabele z kluczami modeli AI.',
      '2. Wygeneruj nowy klucz u dostawcy i podmien go w panelu admina lub secrets.',
      '3. Zweryfikuj czy aktywny model korzysta z tego samego providera co zapisany klucz.',
      '4. Po zmianie klucza wdroz ponownie funkcje lub odswiez konfiguracje.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
      'src/components/AdminModels.tsx',
      'Tabela: ai_model_keys',
    ],
    severity: 'critical',
  },
  RATE_LIMIT: {
    title: 'Rate limit / quota exceeded',
    symptoms: ['429 Too Many Requests', 'quota exceeded', 'resource_exhausted', 'Rate limit exceeded'],
    match: ['RATE_LIMIT', '429 Too Many Requests', 'quota exceeded', 'resource_exhausted'],
    causes: [
      'Za duzo wywolan API w krotkim czasie.',
      'Za niski plan lub limit dostawcy AI.',
      'Brak odstepow miedzy probami po stronie klienta albo backendu.',
    ],
    fixes: [
      '1. Poczekaj chwile i sprobuj ponownie.',
      '2. Zwieksz limity po stronie OpenAI / Google / innego providera.',
      '3. Ogranicz rownolegla liczbe generacji i dodaj kolejke lub debounce.',
      '4. Sprawdz czy uzywany model nie ma nizszego limitu od pozostalych.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
      'src/pages/Generator.tsx',
    ],
    severity: 'high',
  },
  MODEL_CONFIG: {
    title: 'Konfiguracja modeli AI',
    symptoms: ['Model not found', 'Brak aktywnego modelu', 'unsupported model', 'Wybrany model nie obsluguje'],
    match: ['Model not found', 'Brak aktywnego modelu', 'does not support reference images', 'unsupported model', 'inactive model'],
    causes: [
      'Model zostal wylaczony albo usuniety w panelu admina.',
      'Zapisany model ma zly provider, model_id albo flagi wsparcia.',
      'Frontend probuje uzyc funkcji niewspieranej przez dany model.',
    ],
    fixes: [
      '1. Wejdz w panel admina i sprawdz aktywne modele oraz ich ID.',
      '2. Zweryfikuj flagi wsparcia dla referencji, edycji i generowania.',
      '3. Ustaw model zapasowy dla danego narzedzia.',
      '4. Przetestuj generacje na najprostszym, potwierdzonym modelu.',
    ],
    files: [
      'src/components/AdminModels.tsx',
      'src/pages/Generator.tsx',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'high',
  },
  IMAGE_GENERATION: {
    title: 'Blad generowania obrazu',
    symptoms: ['Image generation failed', 'Content policy violation', 'timeout', 'blocked', 'GENERATION_FAILED'],
    match: ['GENERATION_FAILED', 'Image generation failed', 'Content policy', 'safety_ratings', 'blocked', 'timeout'],
    causes: [
      'Prompt trafia w blokade bezpieczenstwa.',
      'Provider zwrocil pusty lub niekompletny wynik.',
      'Zapytanie trwa zbyt dlugo albo model chwilowo nie odpowiada.',
    ],
    fixes: [
      '1. Uprosc prompt i usun tresci ryzykowne lub zbyt niejednoznaczne.',
      '2. Przelacz sie na inny model i porownaj wynik.',
      '3. Zmniejsz liczbe referencji lub rozmiar wejscia.',
      '4. Sprawdz logi edge function, zeby zobaczyc status odpowiedzi providera.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'src/pages/Generator.tsx',
      'src/pages/Templates.tsx',
      'src/pages/LogoMaker.tsx',
    ],
    severity: 'medium',
  },
  IMAGE_EDIT: {
    title: 'Blad edycji obrazu',
    symptoms: ['Edit image error', 'DALL-E error', 'OpenAI vision error', 'Gemini API error'],
    match: ['Edit image error', 'DALL-E error', 'OpenAI vision error', 'Gemini API error', 'Nie udało się edytować obrazu'],
    causes: [
      'Wejscie jest za duze, uszkodzone albo w niewspieranym formacie.',
      'Model edycyjny nie przyjal obrazu, maski albo promptu.',
      'Upload wyniku do storage nie powiodl sie po stronie backendu.',
    ],
    fixes: [
      '1. Przetestuj na mniejszym pliku PNG lub JPG.',
      '2. Sprawdz czy prompt opisuje tylko lokalna zmiane, a nie nowa generacje.',
      '3. Zweryfikuj logi DALL-E / Gemini / OpenAI vision w edge function.',
      '4. Sprawdz bucket graphics i prawa zapisu.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'src/pages/Editor.tsx',
      'src/pages/Outpainting.tsx',
    ],
    severity: 'medium',
  },
  REFERENCE_IMAGES: {
    title: 'Zdjecia referencyjne',
    symptoms: ['FILE_READ_FAILED', 'reference image', 'reference images', 'zdjecia referencyjne'],
    match: ['FILE_READ_FAILED', 'does not support reference images', 'Nie udało się przesłać zdjęcia referencyjnego', 'maksymalnie', 'reference image'],
    causes: [
      'Plik nie daje sie odczytac w przegladarce.',
      'Wybrany model nie wspiera referencji albo limit zdjec zostal przekroczony.',
      'Upload referencji do storage albo ich konwersja na backendzie nie powiodly sie.',
    ],
    fixes: [
      '1. Uzyj kompatybilnego modelu i pilnuj limitu liczby referencji.',
      '2. Zmniejsz pliki i uzyj popularnych formatow PNG/JPG/WEBP.',
      '3. Sprawdz komunikaty z frontendu oraz logi generate-image / edit-image.',
      '4. Przy edycjach krytycznych rozwaz przejscie na sciezke edit-image.',
    ],
    files: [
      'src/pages/Generator.tsx',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'medium',
  },
  FILE_VALIDATION: {
    title: 'Walidacja plikow i uploadu',
    symptoms: ['Wybierz plik graficzny', 'Plik jest za duży', 'Max 20MB', 'payload too large'],
    match: ['Max 20MB', 'payload too large', 'Wybierz plik graficzny', 'unsupported file type'],
    causes: [
      'Plik nie jest obrazem albo ma bledny MIME type.',
      'Rozmiar pliku przekracza limit frontendu lub backendu.',
      'Plik jest uszkodzony albo czytnik FileReader zwrocil blad.',
    ],
    fixes: [
      '1. Zmien plik na PNG/JPG/WEBP i zmniejsz jego rozmiar.',
      '2. Sprawdz limity w formularzu oraz w funkcjach edge.',
      '3. Dodaj czytelny komunikat limitu przy polu uploadu.',
      '4. Jezeli problem wraca, przetestuj ten sam plik w innym narzedziu aplikacji.',
    ],
    files: [
      'src/pages/Generator.tsx',
      'src/pages/Editor.tsx',
      'src/pages/RemoveBg.tsx',
      'src/pages/Upscale.tsx',
      'src/pages/StyleTransfer.tsx',
    ],
    severity: 'low',
  },
  STORAGE_FULL: {
    title: 'Brak miejsca w storage',
    symptoms: ['Storage quota exceeded', 'Disk full', 'payload too large', 'quota exceeded'],
    match: ['Storage quota exceeded', 'Disk full', 'quota exceeded', 'payload too large'],
    causes: [
      'Konczy sie miejsce na bucketach albo dysku serwera.',
      'Grafiki i badge zalegaja bez retencji.',
      'Za duze pliki wynikowe sa zapisywane bez kompresji.',
    ],
    fixes: [
      '1. Sprawdz rozmiar bucketow i wolne miejsce na dysku.',
      '2. Usun stare i osierocone pliki z graphics oraz badges.',
      '3. Dodaj retencje albo job czyszczacy stare rekordy.',
      '4. Ogranicz maksymalny rozmiar wynikowych plikow.',
    ],
    files: [
      'src/lib/storage.ts',
      'src/components/StorageImage.tsx',
      'vps/server/src/routes/ai.ts',
      'src/components/AdminBadges.tsx',
    ],
    severity: 'critical',
  },
  STORAGE_ACCESS: {
    title: 'Storage access / signed URL / upload',
    symptoms: ['Upload error', 'signedUrl', 'bucket not found', 'permission denied', 'object not found'],
    match: ['Upload error', 'signedUrl', 'bucket not found', 'permission denied', 'object not found', 'Nie udało się pobrać'],
    causes: [
      'Bucket nie istnieje albo ma zla polityke dostepu.',
      'Sciezka pliku jest nieprawidlowa lub rekord wskazuje na nieistniejacy obiekt.',
      'Signed URL wygasl albo klient nie ma dostepu do obiektu.',
    ],
    fixes: [
      '1. Zweryfikuj istnienie bucketow graphics i badges.',
      '2. Sprawdz polityki storage oraz nazwy plikow zapisywane w bazie.',
      '3. Przetestuj pobranie signed URL i odswiezanie linku.',
      '4. Jezeli obiekt jest uszkodzony, wyczysc rekordy galerii i przeslij plik ponownie.',
    ],
    files: [
      'src/lib/storage.ts',
      'src/pages/Gallery.tsx',
      'src/components/StorageImage.tsx',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'high',
  },
  CHECKOUT_ERROR: {
    title: 'Tworzenie checkoutu Stripe',
    symptoms: ['Checkout error', 'No checkout URL returned', 'Invalid or inactive package', 'STRIPE_SECRET_KEY not configured'],
    match: ['Checkout error', 'No checkout URL returned', 'Invalid or inactive package', 'STRIPE_SECRET_KEY not configured'],
    causes: [
      'Pakiet kredytow jest nieaktywny albo nie istnieje.',
      'Sekret Stripe nie jest skonfigurowany.',
      'Uzytkownik nie jest poprawnie zalogowany albo request ma zly origin.',
    ],
    fixes: [
      '1. Sprawdz aktywne pakiety i ich ceny w panelu admina.',
      '2. Zweryfikuj STRIPE_SECRET_KEY oraz polaczenie ze Stripe.',
      '3. Sprawdz czy frontend przekazuje origin i czy uzytkownik ma aktywna sesje.',
      '4. Otworz log create-checkout i odczytaj konkretna przyczyne bledu.',
    ],
    files: [
      'vps/server/src/routes/billing.ts',
      'src/pages/Credits.tsx',
      'src/components/AdminPackages.tsx',
      'src/components/AdminStripe.tsx',
    ],
    severity: 'high',
  },
  PAYMENT_VERIFY: {
    title: 'Weryfikacja platnosci',
    symptoms: ['Verify payment error', 'Missing sessionId', 'Session does not belong to this user', 'No credits in session metadata'],
    match: ['Verify payment error', 'Missing sessionId', 'Session does not belong to this user', 'No credits in session metadata', 'Płatność nie została jeszcze przetworzona'],
    causes: [
      'Webhook Stripe jeszcze nie zakonczyl procesu.',
      'session_id jest pusty albo nalezy do innego uzytkownika.',
      'Metadane sesji nie zawieraja liczby kredytow.',
    ],
    fixes: [
      '1. Sprawdz czy stripe-webhook wykonal sie poprawnie.',
      '2. Upewnij sie, ze session_id trafia z URL do verify-payment.',
      '3. Zweryfikuj metadane sesji tworzone w create-checkout.',
      '4. Jezeli webhook padl, uruchom ponownie event ze Stripe Dashboard.',
    ],
    files: [
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/billing.ts',
      'src/pages/Credits.tsx',
    ],
    severity: 'medium',
  },
  STRIPE_WEBHOOK: {
    title: 'Stripe webhook',
    symptoms: ['Webhook signature verification failed', 'STRIPE_WEBHOOK_SECRET not configured', 'stripe error'],
    match: ['Webhook signature verification failed', 'STRIPE_WEBHOOK_SECRET not configured', 'checkout.session.completed', 'stripe error'],
    causes: [
      'Webhook secret nie pasuje do endpointu.',
      'Endpoint nie jest publicznie dostepny albo reverse proxy go blokuje.',
      'Stripe wysyla event na stary adres po migracji domeny.',
    ],
    fixes: [
      '1. Sprawdz adres endpointu i STRIPE_WEBHOOK_SECRET.',
      '2. Przetestuj event poleceniem stripe trigger checkout.session.completed.',
      '3. Zweryfikuj logi reverse proxy i edge function.',
      '4. Po zmianie domeny zaktualizuj endpoint w Stripe Dashboard.',
    ],
    files: [
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/billing.ts',
      'src/components/AdminStripe.tsx',
      'src/components/AdminPurchases.tsx',
    ],
    severity: 'critical',
  },
  AUTH_ERROR: {
    title: 'Autoryzacja i sesja',
    symptoms: ['JWT expired', 'Invalid refresh token', 'Unauthorized', 'invalid_grant', 'Email not confirmed'],
    match: ['JWT expired', 'Invalid refresh token', 'Unauthorized', 'No authorization header', 'invalid_grant', 'Email not confirmed'],
    causes: [
      'Sesja wygasla albo refresh token jest niewazny.',
      'Uzytkownik nie potwierdzil maila albo konto zostalo usuniete.',
      'Frontend wykonuje request bez poprawnego Bearer tokena.',
    ],
    fixes: [
      '1. Wyloguj i zaloguj uzytkownika ponownie.',
      '2. Sprawdz czy auth redirect i domena projektu sa poprawne.',
      '3. Zweryfikuj ustawienia potwierdzania emaili i providerow logowania.',
      '4. Sprawdz czy request do edge function idzie z aktualnym Authorization header.',
    ],
    files: [
      'src/hooks/useAuth.ts',
      'src/pages/Auth.tsx',
      'src/pages/Profile.tsx',
      'vps/server/src/routes/auth.ts',
    ],
    severity: 'medium',
  },
  PASSWORD_RESET: {
    title: 'Reset hasla',
    symptoms: ['Failed to generate reset link', 'user_not_found', 'reset password', 'Hasla nie sa identyczne'],
    match: ['Failed to generate reset link', 'user_not_found', 'Nie udało się wysłać linku resetującego', 'Hasła nie są identyczne', 'Hasło musi mieć co najmniej 6 znaków'],
    causes: [
      'Konto nie istnieje albo link resetu nie zostal wygenerowany.',
      'Reset kieruje na zly adres po zmianie domeny.',
      'Email resetujacy nie zostal dostarczony.',
    ],
    fixes: [
      '1. Sprawdz ustawienia URL resetu hasla w panelu admina.',
      '2. Zweryfikuj dzialanie auth-email oraz dostawcy maili.',
      '3. Upewnij sie, ze uzytkownik wpisuje dwa identyczne hasla i spelnia minimum dlugosci.',
      '4. Sprawdz czy konto istnieje w auth.users.',
    ],
    files: [
      'src/pages/Auth.tsx',
      'src/pages/ResetPassword.tsx',
      'src/pages/Profile.tsx',
      'vps/server/src/routes/auth.ts',
    ],
    severity: 'medium',
  },
  CAPTCHA_ERROR: {
    title: 'Captcha / antybot',
    symptoms: ['captcha failed', 'captcha verify error', 'No captcha secret key configured', 'reCAPTCHA render error'],
    match: ['Weryfikacja captcha nie powiodła się', 'No captcha secret key configured', 'Captcha verify error', 'reCAPTCHA render error', 'turnstile'],
    causes: [
      'Brakuje site key albo secret key.',
      'Wybrany provider captcha ma zla konfiguracje domeny.',
      'Token captcha wygasl zanim trafil do backendu.',
    ],
    fixes: [
      '1. Sprawdz ustawienia Captcha w panelu admina.',
      '2. Zweryfikuj dozwolone domeny w Turnstile / reCAPTCHA / hCaptcha.',
      '3. Przetestuj logowanie na czystej karcie bez blokerow skryptow.',
      '4. Upewnij sie, ze verify-turnstile ma dostep do sekretu.',
    ],
    files: [
      'src/components/AdminSettings.tsx',
      'src/pages/Auth.tsx',
      'vps/server/src/routes/auth.ts',
    ],
    severity: 'high',
  },
  EMAIL_DELIVERY: {
    title: 'Dostarczanie emaili',
    symptoms: ['Resend API error', 'EMAIL_WEBHOOK_URL is not configured', 'Email webhook error', 'send-email error', 'auth-email error'],
    match: ['Resend API error', 'EMAIL_WEBHOOK_URL is not configured', 'Email webhook error', 'send-email error', 'auth-email error', 'Welcome email error'],
    causes: [
      'Provider maili nie ma poprawnego klucza lub URL.',
      'Webhook na VPS nie odpowiada albo zwraca blad.',
      'Adres nadawcy nie ma poprawnego SPF/DKIM/zweryfikowanej domeny.',
    ],
    fixes: [
      '1. Sprawdz sekcje Email w panelu admina oraz zapisane klucze.',
      '2. Jezeli uzywasz webhooka, przetestuj endpoint recznie z Authorization Bearer.',
      '3. Zweryfikuj domene nadawcy oraz rekordy SPF, DKIM i DMARC.',
      '4. Sprawdz logi auth-email, send-email i serwera VPS.',
    ],
    files: [
      'src/components/AdminSettings.tsx',
      'vps/server/src/routes/email.ts',
      'vps/server/src/routes/email.ts',
      'vps/server/src/routes/auth.ts',
    ],
    severity: 'high',
  },
  EMAIL_TEMPLATE: {
    title: 'Szablony emaili',
    symptoms: ['Unknown email type', 'template not found', 'inactive template', 'Nie udało się pobrać szablonów'],
    match: ['Unknown email type', 'inactive template', 'html_content', 'Nie udało się pobrać szablonów', 'slug'],
    causes: [
      'Brakuje aktywnego szablonu o danym slug.',
      'Szablon ma zle placeholdery albo pusty subject/html.',
      'Panel emaili zapisuje niepelne dane.',
    ],
    fixes: [
      '1. Sprawdz czy slug welcome/reset istnieje i jest aktywny.',
      '2. Zweryfikuj placeholdery typu {{email}}, {{resetLink}}, {{generatorUrl}}.',
      '3. Jezeli szablon jest pusty, tymczasowo oprzyj sie na fallbacku backendowym.',
      '4. Przetestuj wysylke po kazdej zmianie w szablonie.',
    ],
    files: [
      'src/components/AdminEmails.tsx',
      'vps/server/src/routes/email.ts',
      'vps/server/src/routes/auth.ts',
      'Tabela: email_templates',
    ],
    severity: 'low',
  },
  DB_CONNECTION: {
    title: 'Polaczenie z baza danych',
    symptoms: ['Connection refused', 'Too many connections', 'could not connect', 'connection timeout'],
    match: ['Connection refused', 'Too many connections', 'connection timeout', 'could not connect', 'pg_stat_activity'],
    causes: [
      'PostgreSQL nie odpowiada albo ma za duzo polaczen.',
      'Serwer bazy jest niedostepny z powodu sieci albo firewalla.',
      'Reverse proxy albo kontenery uruchomily sie w zlej kolejnosci.',
    ],
    fixes: [
      '1. Sprawdz stan bazy i liczbe aktywnych polaczen.',
      '2. Ogranicz idle connections albo dodaj pooler typu PgBouncer.',
      '3. Zweryfikuj healthcheck i zaleznosci uslug po starcie VPS.',
      '4. Sprawdz logi db oraz aplikacji.',
    ],
    files: [
      'vps/docker-compose.yml',
      'src/lib/vpsApi.ts',
      'vps/server/src/lib/localCoreData.ts',
    ],
    severity: 'critical',
  },
  DB_PERMISSION: {
    title: 'RLS / permission denied / forbidden',
    symptoms: ['permission denied', 'row-level security', 'Forbidden', 'Access denied', 'Admin only'],
    match: ['permission denied', 'row-level security', 'Forbidden', 'Access denied', 'Admin only', 'Brak dostępu', 'Nieautoryzowany'],
    causes: [
      'RLS blokuje odczyt lub zapis dla danej roli.',
      'Funkcja backendowa wymaga admina, a request idzie od zwyklego usera.',
      'Brakuje poprawnej roli w user_roles lub admin_panel_role_tabs.',
    ],
    fixes: [
      '1. Sprawdz role uzytkownika i przypisane zakladki admina.',
      '2. Zweryfikuj polityki RLS na tabeli, ktora odrzuca request.',
      '3. Upewnij sie, ze backend uzywa service_role tam, gdzie to wymagane.',
      '4. Jezeli to akcja admina, przetestuj ja na koncie z rola admin.',
    ],
    files: [
      'src/hooks/useIsAdmin.ts',
      'src/hooks/useAdminAccess.ts',
      'vps/server/src/routes/admin.ts',
      'Tabela: user_roles',
      'Tabela: admin_panel_role_tabs',
    ],
    severity: 'high',
  },
  CORS_ERROR: {
    title: 'CORS / reverse proxy / origin mismatch',
    symptoms: ['CORS policy', 'Access-Control-Allow-Origin', 'preflight request', 'blocked by CORS'],
    match: ['CORS policy', 'Access-Control-Allow-Origin', 'preflight request', 'blocked by CORS'],
    causes: [
      'Brakuje odpowiednich naglowkow CORS na funkcji lub proxy.',
      'Frontend i backend ida po roznych domenach albo protokolach.',
      'Proxy na VPS ucina naglowki OPTIONS lub Authorization.',
    ],
    fixes: [
      '1. Sprawdz odpowiedzi OPTIONS i naglowki CORS.',
      '2. Upewnij sie, ze frontend oraz API dzialaja po HTTPS.',
      '3. Zweryfikuj konfiguracje Nginx/Caddy po migracji.',
      '4. Dodaj nowa domene do auth allow list, jezeli dotyczy logowania.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'high',
  },
  MEMORY_CPU: {
    title: 'RAM / CPU / resource limits',
    symptoms: ['Out of memory', 'Worker exceeded resource limits', 'slow response', 'killed', 'heap out of memory'],
    match: ['Out of memory', 'Worker exceeded resource limits', 'heap out of memory', 'killed'],
    causes: [
      'Obrazy sa za duze dla przegladarki lub edge function.',
      'Serwer VPS ma za malo RAM albo swap.',
      'Canvas, WASM albo modele ONNX zuzywaja zbyt duzo pamieci.',
    ],
    fixes: [
      '1. Zmniejsz rozmiary plikow i liczbe rownoleglych operacji.',
      '2. Sprawdz wolny RAM, CPU i rozważ dodanie swap.',
      '3. Ogranicz maksymalny input dla narzedzi pracujacych w przegladarce.',
      '4. Monitoruj zuzycie zasobow podczas generacji i remove-bg.',
    ],
    files: [
      'src/pages/RemoveBg.tsx',
      'src/pages/Upscale.tsx',
      'src/components/ManualMaskEditor.tsx',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'high',
  },
  SSL_DOMAIN: {
    title: 'SSL / domena / DNS',
    symptoms: ['SSL certificate error', 'ERR_CERT_AUTHORITY_INVALID', 'DNS resolution failed', 'ERR_SSL_PROTOCOL_ERROR'],
    match: ['ERR_CERT_AUTHORITY_INVALID', 'ERR_SSL_PROTOCOL_ERROR', 'DNS resolution failed', 'SSL certificate error'],
    causes: [
      'Certyfikat wygasl albo reverse proxy wystawia zly cert.',
      'DNS nadal wskazuje na stary serwer lub nie rozpropagowal sie.',
      'Frontend lub webhook korzysta z adresu HTTP zamiast HTTPS.',
    ],
    fixes: [
      '1. Zweryfikuj rekordy DNS i wystawiany certyfikat.',
      '2. Jezeli jest VPS, skonfiguruj automatyczne odnowienie SSL.',
      '3. Ujednolic adresy aplikacji, webhookow i auth redirectow do jednej domeny HTTPS.',
      '4. Przetestuj curl -I oraz otwarcie strony z zewnetrznej sieci.',
    ],
    files: [
      'src/components/AdminSettings.tsx',
      'vps/docker-compose.yml',
      'index.html',
    ],
    severity: 'high',
  },
  NETWORK_ERROR: {
    title: 'Blad sieci / backend nie odpowiada',
    symptoms: ['Failed to fetch', 'NetworkError', 'connection timeout', 'socket hang up'],
    match: ['Failed to fetch', 'NetworkError', 'connection timeout', 'socket hang up', 'fetch failed'],
    causes: [
      'Backend, edge function albo webhook jest niedostepny.',
      'Proxy lub firewall blokuje ruch.',
      'Aplikacja odwoluje sie do starego URL po migracji.',
    ],
    fixes: [
      '1. Sprawdz healthcheck backendu i logi reverse proxy.',
      '2. Zweryfikuj wszystkie URL-e w panelu admina oraz env.',
      '3. Otworz problematyczny endpoint recznie curl-em lub w Postmanie.',
      '4. Sprawdz czy firewall VPS przepuszcza 80 i 443.',
    ],
    files: [
      'src/pages/Credits.tsx',
      'src/pages/Generator.tsx',
      'vps/server/src/routes/email.ts',
      'vps/server/src/routes/billing.ts',
    ],
    severity: 'high',
  },
  OCR_ERROR: {
    title: 'OCR / rozpoznawanie tekstu',
    symptoms: ['OCR failed', 'text extraction failed', 'AI gateway error', 'cannot read image'],
    match: ['OCR failed', 'text extraction failed', 'AI gateway error', 'cannot read image', 'Błąd OCR'],
    causes: [
      'Obraz jest za maly, nieostry albo nie zawiera czytelnego tekstu.',
      'Brakuje klucza do bramki AI albo provider zwrocil blad.',
      'Format pliku nie nadaje sie do OCR.',
    ],
    fixes: [
      '1. Uzyj wyraznego obrazu i sprawdz limit wielkosci.',
      '2. Zweryfikuj konfiguracje klucza AI dla OCR.',
      '3. Przetestuj to samo wejscie w innym modelu lub po przeskalowaniu obrazu.',
      '4. Sprawdz logi edge function OCR.',
    ],
    files: [
      'vps/server/src/routes/ai.ts',
      'src/pages/OcrTool.tsx',
    ],
    severity: 'medium',
  },
  REMOVE_BG: {
    title: 'Usuwanie tla',
    symptoms: ['Background removal failed', 'Segmentation failed', 'Canvas error', 'Worker error', 'imgly'],
    match: ['Background removal failed', 'Segmentation failed', 'Canvas error', 'Worker error', 'imgly', 'Nie udało się usunąć tła'],
    causes: [
      'Przegladarka ma za malo RAM albo blokuje WASM.',
      'Obraz jest za duzy albo zbyt zlozony do lokalnego remove-bg.',
      'Tryb AI i tryb lokalny sa mylone przez uzytkownika.',
    ],
    fixes: [
      '1. Zmniejsz obraz i zamknij ciezkie karty przegladarki.',
      '2. Sprobuj trybu recznego lub AI zamiast lokalnego auto.',
      '3. Sprawdz limit darmowych usuniec tla i kredyty.',
      '4. Jezeli wynik ma byc zapisany, sprawdz tez storage upload.',
    ],
    files: [
      'src/pages/RemoveBg.tsx',
      'src/components/ManualMaskEditor.tsx',
      'src/pages/Editor.tsx',
    ],
    severity: 'medium',
  },
  OUTPAINTING: {
    title: 'Outpainting / rozszerzanie obrazu',
    symptoms: ['Outpainting failed', 'Extension failed', 'Canvas size exceeded'],
    match: ['Outpainting failed', 'Extension failed', 'Canvas size exceeded', 'Błąd rozszerzania'],
    causes: [
      'Rozszerzenie tworzy zbyt duzy canvas.',
      'Prompt nie daje modelowi jasnego kontekstu tla.',
      'Backend edycyjny zwrocil timeout lub pusty wynik.',
    ],
    fixes: [
      '1. Zacznij od mniejszego procentu rozszerzenia.',
      '2. Doprecyzuj prompt dla nowego tla i krawedzi obrazu.',
      '3. Przetestuj mniejszy obraz wejsciowy.',
      '4. Sprawdz logi edit-image.',
    ],
    files: [
      'src/pages/Outpainting.tsx',
      'vps/server/src/routes/ai.ts',
    ],
    severity: 'low',
  },
  UPSCALE_ERROR: {
    title: 'Upscale / powiekszanie obrazu',
    symptoms: ['upscale failed', 'Nie udało się powiększyć obrazu', 'super-resolution'],
    match: ['upscale failed', 'Nie udało się powiększyć obrazu', 'super-resolution'],
    causes: [
      'Plik jest zbyt duzy lub uszkodzony.',
      'Narzedzie nie ma wystarczajacych kredytow albo backend nie odpowiada.',
      'Przegladarka nie radzi sobie z podgladem duzych bitmap.',
    ],
    fixes: [
      '1. Uzyj mniejszego wejscia i sprawdz kredyty.',
      '2. Przetestuj zapis bez dodatkowych operacji w tle.',
      '3. Zweryfikuj komunikat bledu z backendu lub frontendu.',
      '4. Jezeli blad dotyczy pobierania, sprawdz storage i download.',
    ],
    files: [
      'src/pages/Upscale.tsx',
      'src/components/AdminToolPricing.tsx',
    ],
    severity: 'low',
  },
  STYLE_TRANSFER_ERROR: {
    title: 'Transfer stylu',
    symptoms: ['style transfer failed', 'Nie udało się zmienić stylu'],
    match: ['style transfer failed', 'Nie udało się zmienić stylu'],
    causes: [
      'Brakuje obrazu bazowego lub stylu.',
      'Plik jest za duzy albo nie przechodzi walidacji.',
      'Zapis lub pobranie wyniku sie nie powiodlo.',
    ],
    fixes: [
      '1. Sprawdz oba obrazy i ich rozmiary.',
      '2. Upewnij sie, ze wynik moze byc zapisany do storage.',
      '3. Przetestuj z prostszym i mniejszym obrazem.',
      '4. Zobacz czy blad pochodzi z obrobki czy z downloadu.',
    ],
    files: [
      'src/pages/StyleTransfer.tsx',
    ],
    severity: 'low',
  },
  COLORIZE_ERROR: {
    title: 'Koloryzacja obrazu',
    symptoms: ['Błąd koloryzacji', 'colorize failed'],
    match: ['Błąd koloryzacji', 'colorize failed'],
    causes: [
      'Brakuje kredytow lub wybrany model jest zle skonfigurowany.',
      'Obraz wejsciowy jest za slaby jakosciowo.',
      'Provider AI zwrocil blad podczas generacji wariantu.',
    ],
    fixes: [
      '1. Sprawdz koszt narzedzia i saldo kredytow.',
      '2. Zweryfikuj aktywny model dla koloryzacji.',
      '3. Uzyj mniejszego, czytelnego obrazu.',
      '4. Porownaj wynik z dzialaniem innych narzedzi opartych o ten sam backend.',
    ],
    files: [
      'src/pages/Colorize.tsx',
      'src/components/AdminToolPricing.tsx',
      'src/components/AdminModels.tsx',
    ],
    severity: 'low',
  },
  DAILY_CREDITS: {
    title: 'Darmowe kredyty / cron',
    symptoms: ['daily credits failed', 'cron failed', 'add_daily_free_credits', 'CRON_SECRET'],
    match: ['daily credits failed', 'cron failed', 'add_daily_free_credits', 'CRON_SECRET'],
    causes: [
      'Brakuje CRON_SECRET albo cron nie wywoluje endpointu.',
      'Funkcja nie ma poprawnego uwierzytelnienia.',
      'Procedura DB nie zostala wdrozona albo zwraca blad.',
    ],
    fixes: [
      '1. Zweryfikuj CRON_SECRET po obu stronach wywolania.',
      '2. Sprawdz harmonogram cron oraz logi wywolan.',
      '3. Uruchom funkcje recznie w trybie admina.',
      '4. Zweryfikuj procedure add_daily_free_credits i tabele pomocnicze.',
    ],
    files: [
      'vps/server/src/routes/internal.ts',
      'Funkcja DB: add_daily_free_credits()',
      'Tabela: user_credits',
      'Tabela: daily_free_usage',
    ],
    severity: 'medium',
  },
  INVOICE_ERROR: {
    title: 'Faktury i PDF',
    symptoms: ['Invoice generation failed', 'PDF error', 'billing data missing', 'Purchase not found'],
    match: ['Invoice generation failed', 'PDF error', 'billing data missing', 'Purchase not found', 'Nie udało się wygenerować faktury'],
    causes: [
      'Zakup nie ma kompletnych danych rozliczeniowych.',
      'Funkcja PDF nie znajduje zakupu albo plik nie moze byc utworzony.',
      'Uzytkownik probuje pobrac fakture do nieswojego zakupu.',
    ],
    fixes: [
      '1. Zweryfikuj rekord credit_purchases oraz status completed.',
      '2. Sprawdz pola billing_* zapisane przy checkout.',
      '3. Przetestuj generowanie dla jednego, znanego zakupu.',
      '4. Jezeli dotyczy KSeF, sprawdz tez przewodnik KSeF.',
    ],
    files: [
      'vps/server/src/routes/billing.ts',
      'src/components/AdminPurchases.tsx',
      'src/pages/Profile.tsx',
      'Tabela: credit_purchases',
    ],
    severity: 'medium',
  },
  KSEF_ERROR: {
    title: 'KSeF / wysylka faktur',
    symptoms: ['Invalid KSeF token format', 'Auth timeout', 'Invoice send failed', 'KSeF jest wyłączony'],
    match: ['Invalid KSeF token format', 'Challenge failed', 'Token auth failed', 'Auth timeout', 'Invoice send failed', 'KSeF jest wyłączony', 'KSEF token nie jest skonfigurowany'],
    causes: [
      'Token, NIP albo srodowisko KSeF sa zle skonfigurowane.',
      'Sesja autoryzacji lub wymiana certyfikatow nie powiodla sie.',
      'KSeF jest recznie wylaczony w panelu admina.',
    ],
    fixes: [
      '1. Sprawdz sekcje KSeF w panelu admina: wlaczenie, NIP, token, srodowisko.',
      '2. Zweryfikuj format tokenu i aktualnosc certyfikatow.',
      '3. Upewnij sie, ze zakup istnieje i ma komplet danych rozliczeniowych.',
      '4. Przeczytaj log odpowiedzi z KSeF i porownaj z dokumentacja srodowiska demo/test/prod.',
    ],
    files: [
      'src/components/AdminSettings.tsx',
      'src/components/AdminPurchases.tsx',
      'vps/server/src/lib/ksef.ts',
    ],
    severity: 'high',
  },
  MAILERLITE: {
    title: 'MailerLite',
    symptoms: ['MailerLite error', 'subscriber error', 'group not found', 'mailerlite api'],
    match: ['MailerLite error', 'subscriber error', 'group not found', 'mailerlite api', 'Brak dostępu do zakładki MailerLite'],
    causes: [
      'Klucz API jest niepoprawny albo wygasl.',
      'Mapowanie grup do pakietow jest zle skonfigurowane.',
      'Request wychodzi poza limity API MailerLite.',
    ],
    fixes: [
      '1. Zweryfikuj zapisany klucz API i pobranie listy grup.',
      '2. Sprawdz czy group_id w bazie istnieja po stronie MailerLite.',
      '3. Ogranicz masowe zapisy lub dodaj opoznienie miedzy requestami.',
      '4. Sprawdz role admina dla zakladki MailerLite.',
    ],
    files: [
      'src/components/AdminMailerLite.tsx',
      'vps/server/src/routes/email.ts',
      'Tabela: mailerlite_config',
      'Tabela: mailerlite_package_groups',
    ],
    severity: 'low',
  },
  CREDITS_ERROR: {
    title: 'Saldo kredytow i rozliczenia narzedzi',
    symptoms: ['Insufficient credits', 'credit deduction failed', 'balance error', 'Brak kredytów'],
    match: ['Insufficient credits', 'credit deduction failed', 'balance error', 'Brak kredytów', 'Za mało kredytów'],
    causes: [
      'Saldo uzytkownika jest zbyt niskie.',
      'Cena narzedzia jest ustawiona niepoprawnie.',
      'Historia credit_usage lub user_credits jest niespojna.',
    ],
    fixes: [
      '1. Sprawdz balance w user_credits i ostatnie wpisy w credit_usage.',
      '2. Zweryfikuj koszty narzedzi w panelu admina.',
      '3. Porownaj koszt z wybranym modelem i planem uzytkownika.',
      '4. W razie potrzeby skoryguj saldo recznie z panelu admina.',
    ],
    files: [
      'src/hooks/useCredits.ts',
      'src/hooks/useToolPricing.ts',
      'src/components/AdminToolPricing.tsx',
      'Tabela: user_credits',
      'Tabela: credit_usage',
    ],
    severity: 'medium',
  },
  COUPON_ERROR: {
    title: 'Kupony i kody promocyjne',
    symptoms: ['Coupon not found', 'coupon expired', 'invalid coupon', 'coupon already used'],
    match: ['Coupon not found', 'coupon expired', 'invalid coupon', 'coupon already used', 'promotion code'],
    causes: [
      'Kod jest bledny, wygasl albo ma wyczerpany limit.',
      'Kupon istnieje w Stripe, ale nie jest aktywny.',
      'Frontend podaje inny kod niz backend probuje odczytac.',
    ],
    fixes: [
      '1. Sprawdz kupony w panelu admina i w Stripe Dashboard.',
      '2. Zweryfikuj daty waznosci oraz limit wykorzystan.',
      '3. Przetestuj najpierw prosty, aktywny kod bez limitow.',
      '4. Jezeli potrzeba, wygeneruj nowy kupon i porownaj zachowanie.',
    ],
    files: [
      'src/components/AdminCoupons.tsx',
      'vps/server/src/routes/admin.ts',
      'vps/server/src/routes/billing.ts',
    ],
    severity: 'low',
  },
  ADMIN_ACCESS: {
    title: 'Dostep do panelu admina',
    symptoms: ['Access denied', 'Not authorized', 'admin tab not found', 'has_role returned false'],
    match: ['Access denied', 'Not authorized', 'admin tab not found', 'has_role returned false', 'Brak dostępu do zakładki'],
    causes: [
      'Uzytkownik nie ma poprawnej roli.',
      'Brakuje przypisania zakladek dla roli panelowej.',
      'Frontend pokazuje zakladke, ale backend blokuje akcje.',
    ],
    fixes: [
      '1. Sprawdz role w user_roles i admin_panel_user_roles.',
      '2. Zweryfikuj admin_panel_role_tabs dla danej roli.',
      '3. Porownaj dostep frontendu z walidacja backendu.',
      '4. Przetestuj akcje na glownym koncie admina.',
    ],
    files: [
      'src/hooks/useIsAdmin.ts',
      'src/hooks/useAdminAccess.ts',
      'src/pages/Admin.tsx',
      'Tabela: user_roles',
      'Tabela: admin_panel_role_tabs',
    ],
    severity: 'high',
  },
  ADMIN_SETTINGS: {
    title: 'Ustawienia admina / site_settings',
    symptoms: ['Blad zapisu ustawien', 'Nie udalo sie zaladowac ustawien', 'Nie udało się odczytać ustawień'],
    match: ['Blad zapisu ustawien', 'Nie udalo sie zaladowac ustawien', 'Nie udało się odczytać ustawień', 'Nie udało się zapisać ustawień'],
    causes: [
      'Migracje dla site_settings nie zostaly wdrozone.',
      'RLS blokuje zapis ustawien przez admina.',
      'Klucz ustawienia nie istnieje albo jest zle normalizowany.',
    ],
    fixes: [
      '1. Sprawdz czy wszystkie migracje site_settings zostaly odpalone.',
      '2. Zweryfikuj polityki RLS i role admina.',
      '3. Przetestuj zapis pojedynczego pola i odczyt z bazy.',
      '4. Sprawdz czy frontend nie nadpisuje pustymi wartosciami sekretow.',
    ],
    files: [
      'src/components/AdminSettings.tsx',
      'src/components/AdminPurchases.tsx',
      'Tabela: site_settings',
      'vps/postgres/init',
    ],
    severity: 'medium',
  },
  GALLERY_ERROR: {
    title: 'Galeria, usuwanie i pobieranie grafik',
    symptoms: ['Nie udało się usunąć', 'Nie udało się pobrać', 'Nie udało się wyczyścić uszkodzonych grafik'],
    match: ['Nie udało się usunąć', 'Nie udało się pobrać', 'Nie udało się wyczyścić uszkodzonych grafik', 'public gallery'],
    causes: [
      'Signed URL jest niepoprawny albo obiekt zostal juz usuniety.',
      'RLS blokuje usuniecie cudzej grafiki.',
      'W bazie sa rekordy wskazujace na nieistniejace pliki.',
    ],
    fixes: [
      '1. Sprawdz czy rekord w tabeli graphics ma poprawna sciezke pliku.',
      '2. Zweryfikuj polityki odczytu i kasowania.',
      '3. Uruchom czyszczenie uszkodzonych grafik i porownaj wynik.',
      '4. Jezeli blad dotyczy galerii publicznej, sprawdz tez tokeny udostepniania.',
    ],
    files: [
      'src/pages/Gallery.tsx',
      'src/components/PublicGallery.tsx',
      'src/components/AdminUserGraphics.tsx',
      'src/lib/storage.ts',
    ],
    severity: 'low',
  },
  BADGE_ERROR: {
    title: 'Badge, biblioteka i upload',
    symptoms: ['Błąd przesyłania pliku', 'Błąd dodawania badge', 'Błąd usuwania', 'Błąd ukrywania badge'],
    match: ['Błąd przesyłania pliku', 'Błąd dodawania badge', 'Błąd usuwania', 'Błąd ukrywania badge', 'badge'],
    causes: [
      'Plik badge nie przeszedl uploadu lub walidacji.',
      'Storage badge ma zla konfiguracje lub brak miejsca.',
      'Rekord badge nie zapisuje sie poprawnie w bazie.',
    ],
    fixes: [
      '1. Przetestuj upload malego pliku PNG.',
      '2. Sprawdz bucket badges i prawa zapisu.',
      '3. Zweryfikuj rekordy w tabeli badge i stan ukrycia.',
      '4. Jezeli biblioteka nie pokazuje badge, sprawdz tez warunki pakietow.',
    ],
    files: [
      'src/components/AdminBadges.tsx',
      'src/pages/BadgeLibrary.tsx',
      'src/lib/storage.ts',
    ],
    severity: 'low',
  },
  CLIENT_BROWSER: {
    title: 'Przegladarka, canvas, mikrofon, worker',
    symptoms: ['Speech recognition error', 'Twoja przeglądarka nie wspiera rozpoznawania mowy', 'Canvas error', 'Worker error'],
    match: ['Speech recognition error', 'Twoja przeglądarka nie wspiera rozpoznawania mowy', 'Canvas error', 'Worker error'],
    causes: [
      'Przegladarka nie wspiera danej funkcji Web API.',
      'Mikrofon, canvas, WASM albo worker sa zablokowane przez system lub rozszerzenia.',
      'Uruchomienie odbywa sie na zbyt slabym urzadzeniu.',
    ],
    fixes: [
      '1. Przetestuj na aktualnym Chrome lub Edge.',
      '2. Sprawdz uprawnienia mikrofonu i blokery skryptow.',
      '3. Odswiez karte i zamknij ciezkie aplikacje w tle.',
      '4. Dla awarii workerow przejdz na prostszy tryb bez lokalnego AI.',
    ],
    files: [
      'src/pages/Generator.tsx',
      'src/pages/RemoveBg.tsx',
      'src/pages/Editor.tsx',
    ],
    severity: 'low',
  },
  ROUTING_404: {
    title: 'Routing / 404 / zla sciezka po deployu',
    symptoms: ['404', 'non-existent route', 'Not Found'],
    match: ['404', 'non-existent route', 'Not Found'],
    causes: [
      'Reverse proxy nie przekazuje wszystkich tras SPA do index.html.',
      'Link prowadzi na stara lub nieistniejaca sciezke.',
      'Base URL aplikacji zmienil sie po migracji na VPS.',
    ],
    fixes: [
      '1. Dodaj rewrite dla SPA w Nginx lub Caddy.',
      '2. Sprawdz App.tsx i linki po zmianie domeny.',
      '3. Zweryfikuj canonical, sitemap i recznie wpisywane URL-e.',
      '4. Otworz bezposrednio /generator, /reset-password i /credits na produkcji.',
    ],
    files: [
      'src/App.tsx',
      'src/pages/NotFound.tsx',
      'index.html',
    ],
    severity: 'low',
  },
};

export const VPS_CHECKLIST: Array<{ icon: string; title: string; desc: string; files: string[] }> = [
  {
    icon: 'URL',
    title: 'Adresy aplikacji i auth redirect',
    desc: 'Ustaw app_base_url, URL generatora i URL resetu hasla w panelu admina po zmianie domeny.',
    files: [
      'src/components/AdminSettings.tsx',
      'vps/server/src/routes/admin.ts',
      'vps/server/src/routes/auth.ts',
    ],
  },
  {
    icon: 'MAIL',
    title: 'Email provider',
    desc: 'Sprawdz czy wysylka idzie przez Resend czy VPS webhook i czy adres nadawcy jest poprawny.',
    files: [
      'src/components/AdminSettings.tsx',
      'vps/server/src/routes/email.ts',
      'vps/server/src/routes/email.ts',
    ],
  },
  {
    icon: 'KEY',
    title: 'Sekrety i klucze API',
    desc: 'Zweryfikuj klucze AI, Stripe, Captcha, MailerLite i ewentualne tokeny webhookow.',
    files: [
      'vps/server/src/routes/ai.ts',
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/auth.ts',
    ],
  },
  {
    icon: 'DB',
    title: 'Baza danych i migracje',
    desc: 'Upewnij sie, ze migracje, RLS i tabele pomocnicze zostaly wdrozone na nowym serwerze.',
    files: [
      'vps/postgres/init',
      'vps/docker-compose.yml',
      'vps/server/src/lib/localCoreData.ts',
    ],
  },
  {
    icon: 'STOR',
    title: 'Storage i bucket graphics/badges',
    desc: 'Sprawdz upload, signed URL i retencje plikow po przeniesieniu.',
    files: [
      'src/lib/storage.ts',
      'vps/server/src/routes/ai.ts',
      'src/components/AdminBadges.tsx',
    ],
  },
  {
    icon: 'PAY',
    title: 'Stripe i webhooks',
    desc: 'Zweryfikuj checkout, webhook, verify-payment i adresy return URL po zmianie domeny.',
    files: [
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/billing.ts',
      'vps/server/src/routes/billing.ts',
      'src/pages/Credits.tsx',
    ],
  },
  {
    icon: 'KSEF',
    title: 'KSeF',
    desc: 'Sprawdz przelacznik KSeF, token, NIP i srodowisko demo/test/prod.',
    files: [
      'src/components/AdminSettings.tsx',
      'src/components/AdminPurchases.tsx',
      'vps/server/src/lib/ksef.ts',
    ],
  },
  {
    icon: 'SSL',
    title: 'DNS, SSL i reverse proxy',
    desc: 'Nowa domena musi miec poprawny certyfikat, rewrite dla SPA i otwarte porty 80/443.',
    files: [
      'index.html',
      'src/App.tsx',
      'vps/docker-compose.yml',
    ],
  },
  {
    icon: 'BOT',
    title: 'Captcha i logowanie',
    desc: 'Zweryfikuj site key, secret key oraz dozwolone domeny u providera captcha.',
    files: [
      'src/components/AdminSettings.tsx',
      'src/pages/Auth.tsx',
      'vps/server/src/routes/auth.ts',
    ],
  },
  {
    icon: 'CRON',
    title: 'Cron i jobs automatyczne',
    desc: 'Sprawdz daily-credits, backupy i ewentualne zadania czyszczace stare pliki.',
    files: [
      'vps/server/src/routes/internal.ts',
      'Tabela: daily_free_usage',
      'Tabela: user_credits',
    ],
  },
  {
    icon: 'MON',
    title: 'Monitoring i logi',
    desc: 'Po migracji od razu podepnij logi aplikacji, proxy i bazy, zeby szybciej lapac awarie.',
    files: [
      'src/components/AdminErrorLogs.tsx',
      'src/components/AdminStats.tsx',
    ],
  },
  {
    icon: 'BKP',
    title: 'Backup i odzyskiwanie',
    desc: 'Przed wieksza migracja wykonaj backup bazy oraz sprawdz jak odtworzyc storage i env.',
    files: [
      'vps/docker-compose.yml',
      'src/lib/storage.ts',
    ],
  },
];

export function matchGuide(log: ErrorLogLike): string | null {
  const text = `${log.message} ${log.error_type} ${JSON.stringify(log.details || {})}`.toLowerCase();

  for (const [key, guide] of Object.entries(TROUBLESHOOT_GUIDES)) {
    const patterns = [...guide.symptoms, ...(guide.match || [])];
    if (patterns.some((pattern) => text.includes(pattern.toLowerCase()))) {
      return key;
    }
  }

  return null;
}

export const severityOrder: Record<GuideSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const severityColors: Record<GuideSeverity, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

export const severityLabels: Record<GuideSeverity, string> = {
  critical: 'Krytyczny',
  high: 'Wysoki',
  medium: 'Średni',
  low: 'Niski',
};

