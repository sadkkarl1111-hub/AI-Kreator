import { useState, useEffect } from 'react';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getVpsApiBaseUrl = () => {
  const configured = import.meta.env.VITE_VPS_API_BASE_URL?.trim();
  return configured ? trimTrailingSlash(configured) : '/api';
};

const toRelativeStoragePath = (path: string) => {
  const normalized = path.replace(/^local:/, '').replace(/^\/+/, '');
  if (!normalized) return null;
  if (normalized.startsWith('graphics/')) return normalized;
  return `graphics/${normalized}`;
};

const toVpsFileUrl = (relativePath: string) =>
  `${getVpsApiBaseUrl()}/files/${relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

/**
 * Extract storage path from a URL or return the path as-is.
 * Handles legacy full URLs and new path-only values.
 */
export function getStoragePath(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith('http')) return urlOrPath;

  try {
    const parsedUrl = new URL(urlOrPath);
    const publicMarker = '/storage/v1/object/public/graphics/';
    const signedMarker = '/storage/v1/object/sign/graphics/';

    if (parsedUrl.pathname.includes(publicMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(publicMarker)[1] || '');
    }

    if (parsedUrl.pathname.includes(signedMarker)) {
      return decodeURIComponent(parsedUrl.pathname.split(signedMarker)[1] || '');
    }
  } catch {
    return null;
  }

  return urlOrPath;
}

/**
 * Hook that returns a signed URL for a storage path.
 * Works for both authenticated users (own files) and public graphics.
 */
export function useSignedUrl(urlOrPath: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    const path = getStoragePath(urlOrPath);
    if (!path) {
      setSignedUrl(null);
      return;
    }

    if (path.startsWith('http')) {
      setSignedUrl(path);
      return;
    }

    const relativePath = toRelativeStoragePath(path);
    setSignedUrl(relativePath ? toVpsFileUrl(relativePath) : null);
  }, [urlOrPath]);

  return signedUrl;
}
