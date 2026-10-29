import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DailyStats = { date: string; count: number };

type AdminStatsChartsProps = {
  dailyGenerations: DailyStats[];
  styleDistribution: { name: string; value: number }[];
};

const COLORS = ['hsl(280, 72%, 60%)', 'hsl(200, 80%, 55%)', 'hsl(330, 80%, 60%)', 'hsl(45, 90%, 55%)', 'hsl(150, 60%, 50%)'];

export function AdminStatsCharts({ dailyGenerations, styleDistribution }: AdminStatsChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Generacje dziennie (14 dni)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyGenerations}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(280, 72%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Rozkład stylów</CardTitle>
        </CardHeader>
        <CardContent>
          {styleDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={styleDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {styleDistribution.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Brak danych</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
