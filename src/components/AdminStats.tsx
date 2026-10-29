import { lazy, Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Image, Coins, UserPlus, Zap, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCsv } from '@/lib/csvExport';
import { vpsFetch } from '@/lib/vpsApi';

type DailyStats = { date: string; count: number };
type AdminUsersActionResponse = {
  users?: Array<{ id: string; email: string; created_at: string }>;
};
type AdminStatsActionResponse = {
  totalGraphics?: number;
  generationsToday?: number;
  totalRevenue?: number;
  revenueToday?: number;
  revenueMonth?: number;
  dailyGenerations?: DailyStats[];
  styleDistribution?: { name: string; value: number }[];
  error?: string;
};

const AdminStatsCharts = lazy(() => import('@/components/AdminStatsCharts').then((module) => ({ default: module.AdminStatsCharts })));

export function AdminStats() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalGraphics, setTotalGraphics] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [dailyGenerations, setDailyGenerations] = useState<DailyStats[]>([]);
  const [styleDistribution, setStyleDistribution] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard summary metrics
  const [newUsersToday, setNewUsersToday] = useState(0);
  const [newUsersWeek, setNewUsersWeek] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [generationsToday, setGenerationsToday] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const usersData = await vpsFetch<AdminUsersActionResponse>('/admin/users/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_users' }),
      });
      const allUsers = usersData.users || [];
      setTotalUsers(allUsers.length);
      setNewUsersToday(allUsers.filter((u: any) => u.created_at >= todayStart).length);
      setNewUsersWeek(allUsers.filter((u: any) => u.created_at >= weekAgo).length);

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const statsData = await vpsFetch<AdminStatsActionResponse>('/admin/stats/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'dashboard',
          todayStart,
          monthStart,
          fourteenDaysAgo: fourteenDaysAgo.toISOString(),
        }),
      });
      if (statsData.error) throw new Error(statsData.error);

      setTotalGraphics(statsData.totalGraphics ?? 0);
      setGenerationsToday(statsData.generationsToday ?? 0);
      setTotalRevenue(statsData.totalRevenue ?? 0);
      setRevenueToday(statsData.revenueToday ?? 0);
      setRevenueMonth(statsData.revenueMonth ?? 0);
      setDailyGenerations(statsData.dailyGenerations || []);
      setStyleDistribution(statsData.styleDistribution || []);
    } catch (e) {
      console.error('Stats error:', e);
    }
    setLoading(false);
  };

  const handleExportStats = () => {
    exportToCsv('statystyki.csv', dailyGenerations.map(d => ({
      data: d.date,
      generacje: d.count,
    })), [
      { key: 'data', label: 'Data' },
      { key: 'generacje', label: 'Generacje' },
    ]);
    toast.success('Eksportowano statystyki');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Dashboard
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportStats}>
          <Download className="w-3.5 h-3.5" /> Eksport CSV
        </Button>
      </div>

      {/* Quick summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-primary/20">
          <CardContent className="pt-3 pb-2 text-center">
            <UserPlus className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{newUsersToday}</p>
            <p className="text-[10px] text-muted-foreground">Nowi dziś</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{newUsersWeek}</p>
            <p className="text-[10px] text-muted-foreground">Nowi (7 dni)</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="pt-3 pb-2 text-center">
            <Coins className="w-4 h-4 mx-auto text-green-500 mb-1" />
            <p className="text-xl font-bold">{(revenueToday / 100).toFixed(2)} zł</p>
            <p className="text-[10px] text-muted-foreground">Przychód dziś</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <Coins className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-xl font-bold">{(revenueMonth / 100).toFixed(2)} zł</p>
            <p className="text-[10px] text-muted-foreground">Przychód (miesiąc)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <Zap className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{generationsToday}</p>
            <p className="text-[10px] text-muted-foreground">Generacje dziś</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <Image className="w-4 h-4 mx-auto text-secondary mb-1" />
            <p className="text-xl font-bold">{totalGraphics}</p>
            <p className="text-[10px] text-muted-foreground">Grafiki łącznie</p>
          </CardContent>
        </Card>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">Użytkownicy łącznie</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Coins className="w-5 h-5 mx-auto text-accent mb-1" />
            <p className="text-2xl font-bold">{((totalRevenue ?? 0) / 100).toFixed(2)} zł</p>
            <p className="text-xs text-muted-foreground">Przychody łącznie</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{dailyGenerations.reduce((s, d) => s + d.count, 0)}</p>
            <p className="text-xs text-muted-foreground">Generacje (14 dni)</p>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AdminStatsCharts dailyGenerations={dailyGenerations} styleDistribution={styleDistribution} />
      </Suspense>
    </div>
  );
}
