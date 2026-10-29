import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { DEFAULT_SITE_CONTENT } from "@/content/legal";
import { renderLegalContent } from "@/lib/legalContent";
import { vpsPublicFetch } from "@/lib/vpsApi";

const Privacy = () => {
  const [title, setTitle] = useState(DEFAULT_SITE_CONTENT.privacy.title);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    vpsPublicFetch<{ ok?: boolean; content?: { title?: string; content?: string } | null }>("/public/content/privacy")
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
        {renderLegalContent(loaded && content ? content : DEFAULT_SITE_CONTENT.privacy.content)}
      </motion.div>
    </AppLayout>
  );
};

export default Privacy;
