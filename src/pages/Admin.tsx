import { lazy, Suspense, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  Coins,
  CreditCard,
  FileText,
  Image,
  MailOpen,
  Package,
  Receipt,
  Settings,
  Smile,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { ADMIN_TAB_LABELS, ADMIN_TABS, type AdminTabKey } from '@/lib/adminTabs';

const AdminPanel = lazy(() => import('@/components/AdminPanel').then((module) => ({ default: module.AdminPanel })));
const AdminPackages = lazy(() => import('@/components/AdminPackages').then((module) => ({ default: module.AdminPackages })));
const AdminStats = lazy(() => import('@/components/AdminStats').then((module) => ({ default: module.AdminStats })));
const AdminUserGraphics = lazy(() => import('@/components/AdminUserGraphics').then((module) => ({ default: module.AdminUserGraphics })));
const AdminModels = lazy(() => import('@/components/AdminModels').then((module) => ({ default: module.AdminModels })));
const AdminPurchases = lazy(() => import('@/components/AdminPurchases').then((module) => ({ default: module.AdminPurchases })));
const AdminErrorLogs = lazy(() => import('@/components/AdminErrorLogs').then((module) => ({ default: module.AdminErrorLogs })));
const AdminCoupons = lazy(() => import('@/components/AdminCoupons').then((module) => ({ default: module.AdminCoupons })));
const AdminEmojis = lazy(() => import('@/components/AdminEmojis').then((module) => ({ default: module.AdminEmojis })));
const AdminBadges = lazy(() => import('@/components/AdminBadges').then((module) => ({ default: module.AdminBadges })));
const AdminContent = lazy(() => import('@/components/AdminContent').then((module) => ({ default: module.AdminContent })));
const AdminToolPricing = lazy(() => import('@/components/AdminToolPricing').then((module) => ({ default: module.AdminToolPricing })));
const AdminEmails = lazy(() => import('@/components/AdminEmails').then((module) => ({ default: module.AdminEmails })));
const AdminSettings = lazy(() => import('@/components/AdminSettings').then((module) => ({ default: module.AdminSettings })));
const AdminAuditLog = lazy(() => import('@/components/AdminAuditLog').then((module) => ({ default: module.AdminAuditLog })));

const tabIcons: Record<AdminTabKey, any> = {
  stats: TrendingUp,
  users: Users,
  sales: Receipt,
  purchases: Receipt,
  credits: Package,
  coupons: Tags,
  models: Bot,
  toolpricing: Coins,
  graphics: Image,
  emojis: Smile,
  badges: BadgeCheck,
  errors: AlertTriangle,
  content: FileText,
  emails: MailOpen,
  settings: Settings,
  stripe: CreditCard,
  mailerlite: MailOpen,
  audit: Activity,
};

function AdminTabFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function renderTabContent(tab: AdminTabKey, hasAccess: (keys: string[]) => boolean) {
  switch (tab) {
    case 'stats':
      return <AdminStats />;
    case 'users':
      return <AdminPanel />;
    case 'sales':
      return (
        <div className="space-y-6">
          {hasAccess(['purchases', 'sales']) && <AdminPurchases />}
          {hasAccess(['credits', 'sales']) && <AdminPackages />}
          {hasAccess(['coupons', 'sales']) && <AdminCoupons />}
        </div>
      );
    case 'purchases':
      return <AdminPurchases />;
    case 'credits':
      return <AdminPackages />;
    case 'coupons':
      return <AdminCoupons />;
    case 'models':
      return <AdminModels />;
    case 'toolpricing':
      return <AdminToolPricing />;
    case 'graphics':
      return <AdminUserGraphics />;
    case 'emojis':
      return <AdminEmojis />;
    case 'badges':
      return <AdminBadges />;
    case 'errors':
      return <AdminErrorLogs />;
    case 'content':
      return <AdminContent />;
    case 'emails':
      return <AdminEmails />;
    case 'audit':
      return <AdminAuditLog />;
    case 'settings':
      return (
        <AdminSettings
          showCoreSettings={hasAccess(['settings'])}
          showStripe={hasAccess(['stripe'])}
          showMailerLite={hasAccess(['mailerlite'])}
        />
      );
    case 'stripe':
      return <AdminSettings showCoreSettings={false} showStripe showMailerLite={false} />;
    case 'mailerlite':
      return <AdminSettings showCoreSettings={false} showStripe={false} showMailerLite />;
    default:
      return null;
  }
}

const Admin = () => {
  const { canAccessAdmin, allowedTabs, rawTabs, isSuperAdmin, loading } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<AdminTabKey>('stats');

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  const visibleTabs = ADMIN_TABS.filter((tab) => allowedTabs.includes(tab));
  const initialTab = visibleTabs[0];
  const currentTab = visibleTabs.includes(activeTab) ? activeTab : initialTab;
  const hasAccess = (keys: string[]) => isSuperAdmin || keys.some((key) => rawTabs.includes(key));

  if (!initialTab) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        <h1 className="text-2xl font-bold">Panel Administratora</h1>
        <Tabs value={currentTab} onValueChange={(value) => setActiveTab(value as AdminTabKey)} className="w-full overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex flex-wrap gap-1 h-auto p-1 min-w-0">
              {visibleTabs.map((tab) => {
                const Icon = tabIcons[tab];
                return (
                  <TabsTrigger key={tab} value={tab} className="gap-1 text-[10px] sm:text-sm px-2 sm:px-3 py-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">{ADMIN_TAB_LABELS[tab]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {currentTab && (
            <TabsContent value={currentTab} className="overflow-x-auto">
              <Suspense fallback={<AdminTabFallback />}>
                {renderTabContent(currentTab, hasAccess)}
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
