import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { MaintenanceGate } from "./components/MaintenanceGate";
import { CookieYesLoader } from "./components/CookieYesLoader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installFrontendErrorReporting } from "@/lib/frontendErrorReporter";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { RouteSeo } from "./components/RouteSeo";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const PublicDemo = lazy(() => import("./pages/PublicDemo"));
const Generator = lazy(() => import("./pages/Generator"));
const Editor = lazy(() => import("./pages/Editor"));
const Tools = lazy(() => import("./pages/Tools"));
const PublicGalleryPage = lazy(() => import("./pages/PublicGalleryPage"));
const RemoveBg = lazy(() => import("./pages/RemoveBg"));
const Upscale = lazy(() => import("./pages/Upscale"));
const CropTool = lazy(() => import("./pages/CropTool"));
const Filters = lazy(() => import("./pages/Filters"));
const StyleTransfer = lazy(() => import("./pages/StyleTransfer"));
const TextOverlay = lazy(() => import("./pages/TextOverlay"));
const Collage = lazy(() => import("./pages/Collage"));
const EmojiLibrary = lazy(() => import("./pages/EmojiLibrary"));
const GifLibrary = lazy(() => import("./pages/GifLibrary"));
const EmbedWidgets = lazy(() => import("./pages/EmbedWidgets"));
const BadgeLibrary = lazy(() => import("./pages/BadgeLibrary"));
const SvgGenerator = lazy(() => import("./pages/SvgGenerator"));
const SvgLibrary = lazy(() => import("./pages/SvgLibrary"));
const ImageVectorizer = lazy(() => import("./pages/ImageVectorizer"));
const TextEffects = lazy(() => import("./pages/TextEffects"));
const CarouselMaker = lazy(() => import("./pages/CarouselMaker"));
const BatchImageEditor = lazy(() => import("./pages/BatchImageEditor"));
const PrintPreparation = lazy(() => import("./pages/PrintPreparation"));
const ColorPalette = lazy(() => import("./pages/ColorPalette"));
const FormatConverter = lazy(() => import("./pages/FormatConverter"));
const ImageCompressor = lazy(() => import("./pages/ImageCompressor"));
const Watermark = lazy(() => import("./pages/Watermark"));
const MemeGenerator = lazy(() => import("./pages/MemeGenerator"));
const MockupGenerator = lazy(() => import("./pages/MockupGenerator"));
const ImageToPdf = lazy(() => import("./pages/ImageToPdf"));
const Colorize = lazy(() => import("./pages/Colorize"));
const Outpainting = lazy(() => import("./pages/Outpainting"));
const ImageVariants = lazy(() => import("./pages/ImageVariants"));
const LogoMaker = lazy(() => import("./pages/LogoMaker"));
const QrCodeGenerator = lazy(() => import("./pages/QrCodeGenerator"));
const OcrTool = lazy(() => import("./pages/OcrTool"));
const FlipTool = lazy(() => import("./pages/FlipTool"));
const ImageToPrompt = lazy(() => import("./pages/ImageToPrompt"));
const PromptGeneratorPro = lazy(() => import("./pages/PromptGeneratorPro"));
const AdPromptGenerator = lazy(() => import("./pages/AdPromptGenerator"));
const SocialResize = lazy(() => import("./pages/SocialResize"));
const BackgroundReplace = lazy(() => import("./pages/BackgroundReplace"));
const Templates = lazy(() => import("./pages/Templates"));
const CompanyAssistant = lazy(() => import("./pages/CompanyAssistantV2"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Credits = lazy(() => import("./pages/Credits"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const SharedGraphic = lazy(() => import("./pages/SharedGraphic"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const WhatsAppChannel = lazy(() => import("./pages/WhatsAppChannel"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm">Ładowanie strony...</p>
    </div>
  );
}

function FrontendErrorReportingInstaller() {
  useEffect(() => {
    installFrontendErrorReporting();
  }, []);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm">Ładowanie konta...</p>
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const location = useLocation();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm">Sprawdzanie dostępu...</p>
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PublicDemo />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/generator" element={<ProtectedRoute><Generator /></ProtectedRoute>} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/galeria-publiczna" element={<PublicGalleryPage />} />
        <Route path="/tools/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/tools/badge-editor" element={<ProtectedRoute><Editor mode="badge" /></ProtectedRoute>} />
        <Route path="/tools/remove-bg" element={<ProtectedRoute><RemoveBg /></ProtectedRoute>} />
        <Route path="/tools/upscale" element={<ProtectedRoute><Upscale /></ProtectedRoute>} />
        <Route path="/tools/crop" element={<CropTool />} />
        <Route path="/tools/filters" element={<Filters />} />
        <Route path="/tools/style" element={<ProtectedRoute><StyleTransfer /></ProtectedRoute>} />
        <Route path="/tools/text" element={<TextOverlay />} />
        <Route path="/tools/collage" element={<Collage />} />
        <Route path="/tools/emoji" element={<EmojiLibrary />} />
        <Route path="/tools/gifs" element={<GifLibrary />} />
        <Route path="/tools/widgets" element={<EmbedWidgets />} />
        <Route path="/tools/badges" element={<BadgeLibrary />} />
        <Route path="/tools/svg-generator" element={<SvgGenerator />} />
        <Route path="/tools/svg-library" element={<SvgLibrary />} />
        <Route path="/tools/vectorize" element={<ImageVectorizer />} />
        <Route path="/tools/text-effects" element={<TextEffects />} />
        <Route path="/tools/carousel" element={<CarouselMaker />} />
        <Route path="/tools/batch-images" element={<BatchImageEditor />} />
        <Route path="/tools/print-preparation" element={<PrintPreparation />} />
        <Route path="/tools/color-palette" element={<ColorPalette />} />
        <Route path="/tools/format" element={<FormatConverter />} />
        <Route path="/tools/compress" element={<ImageCompressor />} />
        <Route path="/tools/watermark" element={<Watermark />} />
        <Route path="/tools/meme" element={<MemeGenerator />} />
        <Route path="/tools/mockup" element={<MockupGenerator />} />
        <Route path="/tools/pdf" element={<ImageToPdf />} />
        <Route path="/tools/colorize" element={<ProtectedRoute><Colorize /></ProtectedRoute>} />
        <Route path="/tools/outpainting" element={<ProtectedRoute><Outpainting /></ProtectedRoute>} />
        <Route path="/tools/variants" element={<ProtectedRoute><ImageVariants /></ProtectedRoute>} />
        <Route path="/tools/logo" element={<ProtectedRoute><LogoMaker /></ProtectedRoute>} />
        <Route path="/tools/qrcode" element={<QrCodeGenerator />} />
        <Route path="/tools/ocr" element={<ProtectedRoute><OcrTool /></ProtectedRoute>} />
        <Route path="/tools/flip" element={<FlipTool />} />
        <Route path="/tools/image-to-prompt" element={<ProtectedRoute><ImageToPrompt /></ProtectedRoute>} />
        <Route path="/tools/prompt-generator" element={<PromptGeneratorPro />} />
        <Route path="/generator-reklam" element={<ProtectedRoute><AdPromptGenerator /></ProtectedRoute>} />
        <Route path="/tools/social-resize" element={<SocialResize />} />
        <Route path="/tools/background-replace" element={<ProtectedRoute><BackgroundReplace /></ProtectedRoute>} />
        <Route path="/editor" element={<Navigate to="/tools/editor" replace />} />
        <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/company-assistant" element={<AdminOnlyRoute><CompanyAssistant /></AdminOnlyRoute>} />
        <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
        <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
        <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppChannel /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminOnlyRoute><Admin /></AdminOnlyRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/shared/:token" element={<SharedGraphic />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/regulamin" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/polityka-prywatnosci" element={<Privacy />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogArticle />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CookieYesLoader />
      <BrowserRouter>
        <RouteSeo />
        <FrontendErrorReportingInstaller />
        <MaintenanceGate>
          <AppRoutes />
        </MaintenanceGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
