import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAiModels } from './useAiModels';
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/vpsApi', () => ({ vpsPublicFetch: api.fetch }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const flash = { model_id: 'gemini-25-flash-image', name: 'Flash', credit_cost: 50, supports_editing: true };
const sunburst = { model_id: 'openai-gpt-image-2.5-sunburst', name: 'Sunburst', credit_cost: 60, supports_editing: true };
it('uses the preferred badge model and its actual price when available', async () => {
  api.fetch.mockResolvedValue({ models: [flash, sunburst] });
  const { result } = renderHook(() => useAiModels({ purpose: 'editing', preferredModelId: sunburst.model_id }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.selectedModel).toBe(sunburst.model_id); expect(result.current.selectedModelOption?.cost).toBe(60);
});
it('keeps a working default when the preferred badge model is unavailable', async () => {
  api.fetch.mockResolvedValue({ models: [flash] });
  const { result } = renderHook(() => useAiModels({ purpose: 'editing', preferredModelId: sunburst.model_id }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.selectedModel).toBe(flash.model_id);
});
