import { useState, useEffect } from 'react';
import { vpsPublicFetch } from '@/lib/vpsApi';

type ToolPrice = {
  tool_id: string;
  credit_cost: number;
  active: boolean;
};

let cachedPricing: ToolPrice[] | null = null;

type ToolPricingResponse = {
  ok?: boolean;
  tools?: ToolPrice[];
};

export function useToolPricing(toolId: string) {
  const [cost, setCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (cachedPricing) {
        const found = cachedPricing.find(t => t.tool_id === toolId && t.active);
        setCost(found ? found.credit_cost : null);
        setLoading(false);
        return;
      }

      const data = await vpsPublicFetch<ToolPricingResponse>('/public/tool-pricing');

      cachedPricing = data.tools || [];
      const found = cachedPricing.find(t => t.tool_id === toolId && t.active);
      setCost(found ? found.credit_cost : null);
      setLoading(false);
    };

    fetch();
  }, [toolId]);

  return { cost, loading };
}
