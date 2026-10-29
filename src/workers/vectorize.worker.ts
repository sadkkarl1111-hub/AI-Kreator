import { traceRaster } from '@/lib/vectorizeEngine';
import type { VectorRequest } from '@/lib/vectorize';

self.onmessage = (event: MessageEvent<VectorRequest>) => {
  try { self.postMessage({ result: traceRaster(event.data) }); }
  catch (reason) { self.postMessage({ error: reason instanceof Error ? reason.message : 'Nie udało się przetworzyć obrazu.' }); }
};
