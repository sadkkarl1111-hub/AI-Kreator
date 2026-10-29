import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { DEFAULT_SITE_CONTENT } from "@/content/legal";
import { renderLegalContent } from "@/lib/legalContent";
import { vpsPublicFetch } from "@/lib/vpsApi";

const TERMS_COMPLIANCE_ADDENDUM = `## §13. Realizacja zamówienia i kontakt reklamacyjny
Pakiety kredytów są produktami cyfrowymi i są aktywowane automatycznie po potwierdzeniu płatności online.
- maksymalny czas realizacji zamówienia wynosi 1 dzień roboczy od chwili potwierdzenia płatności
- w większości przypadków kredyty są dodawane do konta w ciągu kilku minut
- reklamacje dotyczące płatności, aktywacji pakietu lub działania produktu można składać mailowo na adres: sadkkarl1111@gmail.com albo listownie na adres: SnappyWeb Karol Sadowski, Główna 6, 56-100 Mojęcice
- reklamacje są rozpatrywane w terminie 14 dni roboczych od dnia ich otrzymania`;

const TERMS_AI_CONTENT_ADDENDUM = `## §7a. Grafiki generowane przez AI i odpowiedzialność użytkownika
Grafiki tworzone lub edytowane w Aplikacji są generowane automatycznie z użyciem narzędzi sztucznej inteligencji.
- użytkownik odpowiada za treść promptów, opisów, zdjęć, plików referencyjnych oraz innych materiałów przesyłanych do Aplikacji
- użytkownik powinien posiadać odpowiednie prawa, licencje lub zgody do materiałów przesyłanych do Aplikacji oraz do sposobu wykorzystania wygenerowanych grafik
- zabronione jest używanie cudzych znaków towarowych, logo, nazw marek, utworów chronionych prawem autorskim lub wizerunku osób bez odpowiedniej zgody albo innej podstawy prawnej
- zabronione jest generowanie, przesyłanie lub wykorzystywanie treści nielegalnych, naruszających prawa osób trzecich, dobra osobiste, prywatność, prawa autorskie, prawa własności przemysłowej albo obowiązujące przepisy prawa
- Operator nie gwarantuje, że każda wygenerowana grafika będzie unikalna, niepowtarzalna albo wolna od podobieństw do grafik wygenerowanych wcześniej lub przez innych użytkowników`;

const ensureTermsComplianceContent = (value: string) => {
  let normalized = value.trim();
  if (!normalized) return TERMS_COMPLIANCE_ADDENDUM;

  if (!/nie gwarantuje, że każda wygenerowana grafika będzie unikalna/i.test(normalized)) {
    normalized = normalized.includes("## §8. Dostępność usługi")
      ? normalized.replace("## §8. Dostępność usługi", `${TERMS_AI_CONTENT_ADDENDUM}\n\n## §8. Dostępność usługi`)
      : `${normalized}\n\n${TERMS_AI_CONTENT_ADDENDUM}`;
  }

  if (/maksymalny czas realizacji zam[oó]wienia wynosi 1 dzie[nń] roboczy/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}\n\n${TERMS_COMPLIANCE_ADDENDUM}`;
};

const Terms = () => {
  const [title, setTitle] = useState(DEFAULT_SITE_CONTENT.terms.title);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    vpsPublicFetch<{ ok?: boolean; content?: { title?: string; content?: string } | null }>("/public/content/terms")
      .then(({ content: data }) => {
        if (data?.title) setTitle(data.title);
        if (data?.content) setContent(data.content);
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-sm mx-auto max-w-3xl py-8"
      >
        <h1 className="text-2xl font-bold gradient-text">{title}</h1>
        {renderLegalContent(ensureTermsComplianceContent(loaded && content ? content : DEFAULT_SITE_CONTENT.terms.content))}
      </motion.div>
    </AppLayout>
  );
};

export default Terms;
