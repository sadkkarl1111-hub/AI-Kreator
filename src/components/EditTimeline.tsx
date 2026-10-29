import { useEffect, useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { vpsFetch } from '@/lib/vpsApi';

type GraphicNode = {
  id: string;
  url: string | null;
  prompt: string;
  created_at: string;
  parent_id: string | null;
  signed_url?: string | null;
  thumbnail_url?: string | null;
};

type TimelineResponse = {
  ok: boolean;
  graphics: GraphicNode[];
};

interface EditTimelineProps {
  graphicId: string;
  onSelect?: (graphic: GraphicNode) => void;
}

export function EditTimeline({ graphicId, onSelect }: EditTimelineProps) {
  const [chain, setChain] = useState<GraphicNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChain();
  }, [graphicId]);

  const loadChain = async () => {
    setLoading(true);
    try {
      const response = await vpsFetch<TimelineResponse>(`/gallery/${graphicId}/timeline`);
      setChain(response.graphics || []);
    } catch (err) {
      console.error('Timeline error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-xs text-muted-foreground">Ładowanie historii...</p>;
  if (chain.length <= 1) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <History className="w-4 h-4 text-primary" /> Historia edycji ({chain.length} wersji)
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {chain.map((g, i) => (
          <div key={g.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onSelect?.(g)}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                g.id === graphicId ? 'border-primary shadow-md' : 'border-border'
              }`}
              title={g.prompt}
            >
              {g.thumbnail_url || g.signed_url || g.url ? (
                <img
                  src={g.thumbnail_url || g.signed_url || g.url || ''}
                  alt={g.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width={64}
                  height={64}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">?</div>
              )}
            </button>
            {i < chain.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {chain.find(g => g.id === graphicId)?.prompt}
      </p>
    </div>
  );
}
