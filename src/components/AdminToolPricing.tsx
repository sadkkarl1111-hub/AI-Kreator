import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Coins, Save, Loader2, Eye, EyeOff, Star } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vpsFetch } from '@/lib/vpsApi';

const ACCESS_TIERS = [
  { value: 'all', label: 'Wszyscy' },
  { value: 'starter', label: 'Starter+' },
  { value: 'pro', label: 'Pro+' },
  { value: 'enterprise', label: 'Enterprise' },
];

type ToolPrice = {
  id: string;
  tool_id: string;
  label: string;
  credit_cost: number;
  active: boolean;
  access_tier: string;
  visible: boolean;
  popular: boolean;
};

type AdminToolPricingResponse = {
  ok?: boolean;
  error?: string;
  tools?: ToolPrice[];
  tool?: ToolPrice;
};

export function AdminToolPricing() {
  const [tools, setTools] = useState<ToolPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});

  const fetchTools = async () => {
    const data = await vpsFetch<AdminToolPricingResponse>('/admin/tool-pricing/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'list' }),
    });
    const error = data?.error ? new Error(data.error) : null;

    if (error) {
      toast.error('Błąd pobierania cen narzędzi');
      setLoading(false);
      return;
    }

    const items = data.tools || [];
    setTools(items);
    const vals: Record<string, number> = {};
    items.forEach((t: ToolPrice) => { vals[t.id] = t.credit_cost; });
    setEditValues(vals);
    setLoading(false);
  };

  useEffect(() => { fetchTools(); }, []);

  const updateTool = async (tool: ToolPrice, updates: Partial<ToolPrice>) => {
    const data = await vpsFetch<AdminToolPricingResponse>('/admin/tool-pricing/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', toolId: tool.id, updates }),
    });
    return data?.error ? new Error(data.error) : null;
  };

  const savePrice = async (tool: ToolPrice) => {
    const newCost = editValues[tool.id];
    if (newCost === undefined || newCost < 0) {
      toast.error('Cena musi być >= 0');
      return;
    }

    setSaving(tool.id);
    const error = await updateTool(tool, { credit_cost: newCost });

    if (error) {
      toast.error('Błąd zapisu');
    } else {
      toast.success(`Cena "${tool.label}" zmieniona na ${newCost} pkt`);
      fetchTools();
    }
    setSaving(null);
  };

  const toggleActive = async (tool: ToolPrice) => {
    const error = await updateTool(tool, { active: !tool.active });

    if (error) {
      toast.error('Błąd zapisu');
    } else {
      toast.success(`${tool.label}: ${!tool.active ? 'włączone' : 'wyłączone'}`);
      fetchTools();
    }
  };

  const toggleVisible = async (tool: ToolPrice) => {
    const error = await updateTool(tool, { visible: !tool.visible });

    if (error) {
      toast.error('Błąd zapisu');
    } else {
      toast.success(`${tool.label}: ${!tool.visible ? 'widoczne' : 'ukryte'}`);
      fetchTools();
    }
  };

  const updateTier = async (tool: ToolPrice, tier: string) => {
    const error = await updateTool(tool, { access_tier: tier });

    if (error) {
      toast.error('Błąd zapisu');
    } else {
      toast.success(`${tool.label}: dostęp → ${ACCESS_TIERS.find(t => t.value === tier)?.label}`);
      fetchTools();
    }
  };

  const togglePopular = async (tool: ToolPrice) => {
    const error = await updateTool(tool, { popular: !tool.popular });

    if (error) {
      toast.error('Błąd zapisu');
    } else {
      toast.success(`${tool.label}: ${!tool.popular ? 'popularne' : 'zwykłe'}`);
      fetchTools();
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5" /> Cennik narzędzi AI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ustaw koszt kredytów, widoczność, aktywność i plan dostępu dla każdego narzędzia.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tools.map(tool => (
            <div key={tool.id} className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${!tool.active ? 'opacity-50' : ''} ${!tool.visible ? 'bg-muted/30' : ''}`}>
              <div className="flex-1 min-w-[140px]">
                <p className="font-medium text-sm truncate">{tool.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{tool.tool_id}</p>
              </div>

              {/* Credits */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={editValues[tool.id] ?? tool.credit_cost}
                  onChange={e => setEditValues(prev => ({ ...prev, [tool.id]: parseInt(e.target.value) || 0 }))}
                  className="w-20 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">pkt</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => savePrice(tool)}
                  disabled={saving === tool.id || editValues[tool.id] === tool.credit_cost}
                  className="gap-1 h-8"
                >
                  {saving === tool.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
              </div>

              {/* Access tier */}
              <Select value={tool.access_tier || 'all'} onValueChange={(v) => updateTier(tool, v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_TIERS.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Popular toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePopular(tool)}
                className={`h-8 w-8 p-0 ${tool.popular ? 'text-yellow-500' : ''}`}
                title={tool.popular ? 'Popularne' : 'Zwykłe'}
              >
                <Star className={`w-4 h-4 ${tool.popular ? 'fill-yellow-500' : 'text-muted-foreground'}`} />
              </Button>

              {/* Visible toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleVisible(tool)}
                className="h-8 w-8 p-0"
                title={tool.visible ? 'Widoczne' : 'Ukryte'}
              >
                {tool.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              </Button>

              {/* Active toggle */}
              <Button
                size="sm"
                variant={tool.active ? 'default' : 'outline'}
                onClick={() => toggleActive(tool)}
                className="text-xs w-14 h-8"
              >
                {tool.active ? 'ON' : 'OFF'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
