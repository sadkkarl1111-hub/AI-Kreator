import { useSignedUrl } from '@/lib/storage';
import { Skeleton } from '@/components/ui/skeleton';

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  storagePath: string | null;
  alt: string;
  fallback?: React.ReactNode;
}

export function StorageImage({ storagePath, alt, fallback, className, ...props }: StorageImageProps) {
  const signedUrl = useSignedUrl(storagePath);

  if (!storagePath) return <>{fallback}</> || null;
  if (!signedUrl) return <Skeleton className={className} />;

  return <img src={signedUrl} alt={alt} className={className} {...props} />;
}
