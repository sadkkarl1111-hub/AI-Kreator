import { useEffect } from 'react';
import { vpsPublicFetch } from '@/lib/vpsApi';

export function CookieYesLoader() {
  useEffect(() => {
    const load = async () => {
      const data = await vpsPublicFetch<{ ok?: boolean; settings?: Record<string, string> }>('/public/settings?keys=cookieyes_script');
      const value = data.settings?.cookieyes_script;
      if (!value) return;

      const srcMatch = value.match(/src=["']([^"']+)["']/);
      const idMatch = value.match(/id=["']([^"']+)["']/);

      if (srcMatch?.[1]) {
        if (document.querySelector(`script[src="${srcMatch[1]}"]`)) return;

        const script = document.createElement('script');
        script.src = srcMatch[1];
        if (idMatch?.[1]) script.id = idMatch[1];
        script.async = true;
        document.head.appendChild(script);
      }
    };

    load();
  }, []);

  return null;
}
