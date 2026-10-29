import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Paintbrush, Lasso, Undo2, Check, X, Eraser, Circle } from 'lucide-react';

type Tool = 'brush' | 'lasso' | 'eraser' | 'circle';

interface Props {
  imageDataUrl: string;
  onApply: (resultDataUrl: string) => void;
  onCancel: () => void;
}

export const ManualMaskEditor = ({ imageDataUrl, onApply, onCancel }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, scale: 1 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [circleStart, setCircleStart] = useState<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load image and set up canvases
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const maxW = container.clientWidth;
      const maxH = 500;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setImgSize({ w, h, scale });

      const canvas = canvasRef.current!;
      const maskCanvas = maskCanvasRef.current!;
      canvas.width = w;
      canvas.height = h;
      maskCanvas.width = w;
      maskCanvas.height = h;

      // Draw source image
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // Clear mask (transparent = not selected)
      const mctx = maskCanvas.getContext('2d')!;
      mctx.clearRect(0, 0, w, h);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const saveMaskHistory = useCallback(() => {
    const mctx = maskCanvasRef.current?.getContext('2d');
    if (!mctx) return;
    const data = mctx.getImageData(0, 0, imgSize.w, imgSize.h);
    setHistory(prev => [...prev.slice(-20), data]);
  }, [imgSize]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const mctx = maskCanvasRef.current?.getContext('2d');
    if (mctx) mctx.putImageData(prev, 0, 0);
    setHistory(h => h.slice(0, -1));
  }, [history]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const rect = maskCanvasRef.current!.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const paintAt = useCallback((x: number, y: number) => {
    const mctx = maskCanvasRef.current?.getContext('2d');
    if (!mctx) return;
    mctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    mctx.beginPath();
    mctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(0, 200, 100, 0.5)';
    mctx.fill();
  }, [brushSize, tool]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'lasso') {
      saveMaskHistory();
      setLassoPoints([pos]);
      return;
    }
    if (tool === 'circle') {
      saveMaskHistory();
      setCircleStart(pos);
      return;
    }
    saveMaskHistory();
    setIsDrawing(true);
    paintAt(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    lastPosRef.current = pos;
    if (tool === 'lasso' && lassoPoints.length > 0) {
      setLassoPoints(prev => [...prev, pos]);
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx && lassoPoints.length > 1) {
        mctx.globalCompositeOperation = 'source-over';
        mctx.strokeStyle = 'rgba(0, 200, 100, 0.8)';
        mctx.lineWidth = 2;
        mctx.beginPath();
        mctx.moveTo(lassoPoints[lassoPoints.length - 1].x, lassoPoints[lassoPoints.length - 1].y);
        mctx.lineTo(pos.x, pos.y);
        mctx.stroke();
      }
      return;
    }
    if (tool === 'circle' && circleStart) {
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx && history.length > 0) {
        mctx.putImageData(history[history.length - 1], 0, 0);
      }
      if (mctx) {
        const cx = (circleStart.x + pos.x) / 2;
        const cy = (circleStart.y + pos.y) / 2;
        const rx = Math.abs(pos.x - circleStart.x) / 2;
        const ry = Math.abs(pos.y - circleStart.y) / 2;
        mctx.globalCompositeOperation = 'source-over';
        mctx.beginPath();
        mctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
        mctx.fillStyle = 'rgba(0, 200, 100, 0.5)';
        mctx.fill();
      }
      return;
    }
    if (!isDrawing) return;
    paintAt(pos.x, pos.y);
  };

  const handlePointerUp = () => {
    if (tool === 'lasso' && lassoPoints.length > 2) {
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx) {
        mctx.globalCompositeOperation = 'source-over';
        mctx.beginPath();
        mctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        lassoPoints.forEach(p => mctx.lineTo(p.x, p.y));
        mctx.closePath();
        mctx.fillStyle = 'rgba(0, 200, 100, 0.5)';
        mctx.fill();
      }
      setLassoPoints([]);
      return;
    }
    if (tool === 'circle' && circleStart) {
      const endPos = lastPosRef.current;
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx && history.length > 0) {
        mctx.putImageData(history[history.length - 1], 0, 0);
      }
      if (mctx) {
        const cx = (circleStart.x + endPos.x) / 2;
        const cy = (circleStart.y + endPos.y) / 2;
        const rx = Math.abs(endPos.x - circleStart.x) / 2;
        const ry = Math.abs(endPos.y - circleStart.y) / 2;
        mctx.globalCompositeOperation = 'source-over';
        mctx.beginPath();
        mctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
        mctx.fillStyle = 'rgba(0, 200, 100, 0.5)';
        mctx.fill();
      }
      setCircleStart(null);
      return;
    }
    setIsDrawing(false);
  };

  const handleApply = () => {
    const img = new Image();
    img.onload = () => {
      // Create full-res result
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = img.naturalWidth;
      resultCanvas.height = img.naturalHeight;
      const rctx = resultCanvas.getContext('2d')!;

      // Scale mask up to full resolution
      const maskCanvas = maskCanvasRef.current!;
      const scaledMask = document.createElement('canvas');
      scaledMask.width = img.naturalWidth;
      scaledMask.height = img.naturalHeight;
      const smctx = scaledMask.getContext('2d')!;
      smctx.drawImage(maskCanvas, 0, 0, img.naturalWidth, img.naturalHeight);

      // Get mask data - anywhere with alpha > 0 means "keep"
      const maskData = smctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

      // Draw original image
      rctx.drawImage(img, 0, 0);
      const imgData = rctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

      // Apply mask: where mask alpha is 0, make image transparent
      for (let i = 0; i < imgData.data.length; i += 4) {
        if (maskData.data[i + 3] === 0) {
          imgData.data[i + 3] = 0; // transparent
        }
      }

      rctx.putImageData(imgData, 0, 0);
      onApply(resultCanvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={tool === 'brush' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('brush')}
          className={tool === 'brush' ? 'gradient-bg' : ''}
        >
          <Paintbrush className="w-4 h-4 mr-1" /> Pędzel
        </Button>
        <Button
          variant={tool === 'lasso' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('lasso')}
          className={tool === 'lasso' ? 'gradient-bg' : ''}
        >
          <Lasso className="w-4 h-4 mr-1" /> Lasso
        </Button>
        <Button
          variant={tool === 'circle' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('circle')}
          className={tool === 'circle' ? 'gradient-bg' : ''}
        >
          <Circle className="w-4 h-4 mr-1" /> Okrąg
        </Button>
        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('eraser')}
          className={tool === 'eraser' ? 'gradient-bg' : ''}
        >
          <Eraser className="w-4 h-4 mr-1" /> Gumka
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
          <Undo2 className="w-4 h-4 mr-1" /> Cofnij
        </Button>
      </div>

      {(tool === 'brush' || tool === 'eraser') && (
        <div className="flex items-center gap-3 max-w-xs">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Rozmiar: {brushSize}px</span>
          <Slider value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} min={5} max={100} step={1} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {tool === 'lasso'
          ? '🖱️ Narysuj obrys wokół obszaru do zachowania. Reszta stanie się przezroczysta.'
          : tool === 'circle'
            ? '🖱️ Kliknij i przeciągnij, aby narysować elipsę. Wnętrze zostanie zachowane.'
            : tool === 'eraser'
              ? '🖱️ Wymaż zaznaczone obszary.'
              : '🖱️ Zamaluj pędzlem obszar, który chcesz zachować. Reszta stanie się przezroczysta.'}
      </p>

      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] select-none touch-none"
        style={{ maxHeight: 500 }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: imgSize.w, height: imgSize.h }}
        />
        <canvas
          ref={maskCanvasRef}
          className="absolute top-0 left-0"
          style={{ width: imgSize.w, height: imgSize.h, cursor: (tool === 'lasso' || tool === 'circle') ? 'crosshair' : 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="gap-1.5 gradient-bg">
          <Check className="w-4 h-4" /> Zastosuj maskę
        </Button>
        <Button variant="outline" onClick={onCancel} className="gap-1.5">
          <X className="w-4 h-4" /> Anuluj
        </Button>
      </div>
    </div>
  );
};
