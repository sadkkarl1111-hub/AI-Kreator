declare module 'imagetracerjs' {
  type PaletteColor = { r: number; g: number; b: number; a: number };
  type TraceData = { width: number; height: number; palette: PaletteColor[]; layers: unknown[][] };
  const tracer: {
    imagedataToTracedata(image: { width: number; height: number; data: Uint8ClampedArray }, options: Record<string, unknown>): TraceData;
    getsvgstring(data: TraceData, options: Record<string, unknown>): string;
  };
  export default tracer;
}
