import { motion } from 'framer-motion';
import { Bell, ExternalLink, Megaphone, ShieldCheck, Sparkles } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCyBzu17EmpgJeG4v0u';

const channelHighlights = [
  {
    icon: Sparkles,
    title: 'Nowe modele i narzędzia',
    description: 'Publikujemy informacje o nowych modelach AI, ulepszeniach generatora i nowych funkcjach w aplikacji.',
  },
  {
    icon: Bell,
    title: 'Promocje i kody',
    description: 'Na kanale mogą pojawiać się promocje, kody rabatowe oraz ważne komunikaty związane z kredytami.',
  },
  {
    icon: ShieldCheck,
    title: 'Prywatność numerów',
    description: 'To kanał informacyjny, nie grupa. Obserwujący nie widzą wzajemnie swoich numerów telefonu.',
  },
];

const WhatsAppChannel = () => {
  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl space-y-6"
      >
        <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="h-2 bg-[#25D366]" />
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#25D366] text-white">
                  <WhatsAppIcon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kanał informacyjny</p>
                  <h1 className="text-3xl font-bold">WhatsApp Kreator Grafik AI</h1>
                </div>
              </div>

              <p className="max-w-2xl text-muted-foreground">
                Dołącz do kanału, jeżeli chcesz dostawać najważniejsze nowości w jednym miejscu: nowe modele,
                aktualizacje narzędzi, promocje, kody rabatowe i komunikaty o zmianach w aplikacji.
              </p>
            </div>

            <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ebd59]">
              <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="h-5 w-5" />
                Otwórz kanał
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {channelHighlights.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#128C7E]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Megaphone className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">Bez zbędnego szumu</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Kanał służy tylko do informacji od Kreatora Grafik AI. To wygodne miejsce na szybkie komunikaty o
                  nowych funkcjach, modelach i promocjach.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="shrink-0">
              <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noreferrer">
                Przejdź do WhatsApp
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
};

export default WhatsAppChannel;
