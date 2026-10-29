import { motion } from 'framer-motion';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PublicGallery } from '@/components/PublicGallery';

const PublicGalleryPage = () => {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Publiczne inspiracje
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ImageIcon className="h-7 w-7 text-primary" />
            Galeria publiczna
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Przeglądaj grafiki udostępnione publicznie przez użytkowników, kopiuj prompty albo remiksuj je w Generatorze Promptów Pro pod własną ofertę.
          </p>
        </div>

        <PublicGallery limit={24} title="" className="w-full max-w-none" />
      </motion.div>
    </AppLayout>
  );
};

export default PublicGalleryPage;
