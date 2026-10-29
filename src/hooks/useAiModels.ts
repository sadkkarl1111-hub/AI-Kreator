import { useEffect, useMemo, useState } from 'react';
import { vpsPublicFetch } from '@/lib/vpsApi';

export type AiModelOption = {
  id: string;
  label: string;
  cost: number;
  provider: string | null;
  apiModel: string | null;
  supportsGeneration: boolean;
  supportsEditing: boolean;
  supportsReferenceImages: boolean;
};

type UseAiModelsOptions = {
  purpose?: 'generation' | 'editing';
};

type AiModelsResponse = {
  ok?: boolean;
  models?: any[];
};

const legacyDisplayLabels: Record<string, string> = {
  gemini: 'Canvas Pro',
  'dall-e-3': 'Studio Classic',
};

const defaultModelPriority = [
  'gemini-25-flash-image',
  'gemini-25-image-economy',
  'openai-gpt-image-2',
  'gemini-3-pro-image',
  'gemini',
  'dall-e-3',
];

function pickDefaultModel(loaded: AiModelOption[]) {
  return defaultModelPriority
    .map((modelId) => loaded.find((model) => model.id === modelId))
    .find(Boolean) ?? loaded[0] ?? null;
}

function normalizeModel(model: any): AiModelOption {
  const modelId = String(model.model_id ?? '');
  const provider = model.provider ? String(model.provider).toLowerCase() : null;
  const inferredReferenceSupport = provider ? provider !== 'openai' : modelId === 'gemini';

  return {
    id: modelId,
    label: legacyDisplayLabels[modelId] ?? String(model.name ?? modelId),
    cost: Number(model.credit_cost ?? 50),
    provider,
    apiModel: model.api_model ?? null,
    supportsGeneration: typeof model.supports_generation === 'boolean' ? model.supports_generation : true,
    supportsEditing: typeof model.supports_editing === 'boolean' ? model.supports_editing : true,
    supportsReferenceImages:
      typeof model.supports_reference_images === 'boolean'
        ? model.supports_reference_images
        : inferredReferenceSupport,
  };
}

export function useAiModels({ purpose }: UseAiModelsOptions = {}) {
  const [aiModels, setAiModels] = useState<AiModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      const query = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
      const data = await vpsPublicFetch<AiModelsResponse>(`/public/ai-models${query}`);

      if (cancelled) return;

      const loaded = (data.models || [])
        .map((model: any) => normalizeModel(model))
        .filter((model: AiModelOption) => {
          if (purpose === 'generation') return model.supportsGeneration;
          if (purpose === 'editing') return model.supportsEditing;
          return true;
        });

      setAiModels(loaded);
      setSelectedModel((current) => {
        if (current && loaded.some((model: AiModelOption) => model.id === current)) {
          return current;
        }

        return pickDefaultModel(loaded)?.id || '';
      });
      setLoading(false);
    };

    loadModels().catch(() => {
      if (!cancelled) {
        setAiModels([]);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [purpose]);

  const selectedModelOption = useMemo(
    () => aiModels.find((model) => model.id === selectedModel) ?? null,
    [aiModels, selectedModel],
  );

  return {
    aiModels,
    loading,
    selectedModel,
    selectedModelOption,
    setSelectedModel,
  };
}
