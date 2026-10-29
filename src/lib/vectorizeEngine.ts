import tracer from 'imagetracerjs';
import { prepareTracePixels, type VectorRequest, type VectorResult } from './vectorize';

export function traceRaster(request: VectorRequest): VectorResult {
    const { image, options, originalWidth, originalHeight } = request;
    const prepared = prepareTracePixels(image, options);
    const smoothing = [0, 1, 2].includes(options.smoothing) ? options.smoothing : 1;
    const settings = {
      numberofcolors: [2, 4, 8, 16].includes(options.colors) ? options.colors : 8,
      colorsampling: 2, colorquantcycles: 3, mincolorratio: 0, layering: 0,
      ltres: [0.2, 1, 2.5][smoothing], qtres: [0.2, 1, 2.5][smoothing],
      pathomit: [2, 8, 20][smoothing], rightangleenhance: smoothing !== 2,
      strokewidth: 0, roundcoords: 2, viewbox: true, desc: false, scale: 1,
      ...(options.monochrome ? { pal: [{ r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }] } : {}),
    };
    const traced = tracer.imagedataToTracedata(prepared, settings);
    let paths = 0;
    traced.layers.forEach((layer, index) => {
      if (traced.palette[index].a < 128) traced.layers[index] = [];
      else { traced.palette[index].a = 255; paths += layer.length; }
    });
    let svg = tracer.getsvgstring(traced, settings);
    if (paths === 0 || !svg.includes('<path')) throw new Error('Nie znaleziono konturów. Zwiększ dokładność lub zmień ustawienia tła.');
    // Tracing uses a smaller canvas; exported dimensions retain the original aspect ratio and size.
    svg = svg.replace('<svg ', `<svg width="${originalWidth}" height="${originalHeight}" `);
    if (svg.length > 5_000_000) throw new Error('Wynik jest zbyt złożony. Zmniejsz liczbę kolorów lub dokładność.');
    return { svg, paths, width: originalWidth, height: originalHeight };
}
