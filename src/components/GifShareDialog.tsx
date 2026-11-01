import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LibraryGif } from '@/lib/gifLibrary';

export function GifShareDialog({ gif, onClose }: { gif: LibraryGif | null; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!gif) return;
    const controller = new AbortController();
    let current = true;
    async function prepare() {
      try {
        const response = await fetch(gif!.mp4, { signal: controller.signal });
        if (!response.ok) throw new Error('Nie udało się pobrać animacji. Pobierz MP4 przyciskiem poniżej.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.slice(4, 8)) !== 'ftyp') throw new Error('Serwer zwrócił nieprawidłowy plik. Pobierz MP4 lub spróbuj ponownie później.');
        const prepared = new File([bytes], `ai-kreator-${gif!.id}.mp4`, { type: 'video/mp4' });
        if (!current) return;
        setFile(prepared);
        try { setCanShare(Boolean(navigator.share && navigator.canShare?.({ files: [prepared] }))); } catch { setCanShare(false); }
      } catch (reason) { if (current) setError(reason instanceof Error ? reason.message : 'Nie udało się przygotować animacji. Pobierz plik MP4.'); }
    }
    void prepare();
    return () => { current = false; controller.abort(); };
  }, [gif]);

  async function share() {
    if (!file || !canShare) return;
    setSharing(true); setError(''); setNotice('');
    try {
      // The file is prepared before clicking, preserving browser user activation.
      await navigator.share({ files: [file] });
      setNotice('Zakończono udostępnianie. Sprawdź podgląd w wybranej aplikacji.');
    } catch (reason) {
      if (!(reason && typeof reason === 'object' && 'name' in reason && reason.name === 'AbortError')) setError('Udostępnianie nie powiodło się. Pobierz MP4 i dodaj go do czatu.');
    } finally { setSharing(false); }
  }
  return <Dialog open={Boolean(gif)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Wyślij animację: {gif?.title}</DialogTitle><DialogDescription>Do WhatsApp Web wybierz MP4. Plik zachowuje ruch jako krótki film. Sam link lub skopiowany obraz mogą nie odtwarzać animacji.</DialogDescription></DialogHeader>
      {gif && <>
        <div className="space-y-3">
          <Button asChild className="min-h-12 w-full gap-2"><a href={gif.mp4} download={`ai-kreator-${gif.id}.mp4`}><Download className="h-4 w-4" />Pobierz animację MP4</a></Button>
          <p className="text-sm leading-6 text-muted-foreground">Na komputerze przeciągnij pobrany plik z folderu Pobrane do czatu WhatsApp albo dodaj go przez „Zdjęcia i filmy”. W podglądzie zobaczysz film z przyciskiem odtwarzania.</p>
        </div>
        <video controls playsInline loop preload="none" poster={gif.poster} src={gif.mp4} className="max-h-56 w-full rounded-xl bg-muted" aria-label="Podgląd animacji MP4" />
        {canShare && <Button variant="outline" disabled={sharing} onClick={() => void share()} className="min-h-11 w-full gap-2"><Share2 className="h-4 w-4" />{sharing ? 'Udostępnianie…' : 'Udostępnij plik w aplikacji'}</Button>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Wklejanie animacji przez Ctrl+V zależy od przeglądarki i czatu — schowek może zachować tylko jedną klatkę. MP4 zachowuje ruch, ale nie ma przezroczystego tła ani gwarancji automatycznego zapętlania.</p>
      </>}
    </DialogContent>
  </Dialog>;
}
