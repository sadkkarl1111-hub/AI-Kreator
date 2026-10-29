import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_ARTICLES, type BlogArticle } from "@/content/blog";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getArticleTopic = (article: BlogArticle) => article.cluster || article.category;

const Blog = () => {
  const [featured] = BLOG_ARTICLES;
  const topicEntries = Object.entries(
    BLOG_ARTICLES.reduce<Record<string, BlogArticle[]>>((acc, article) => {
      const topic = getArticleTopic(article);
      acc[topic] = [...(acc[topic] || []), article];
      return acc;
    }, {})
  );


  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl py-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.16),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.18),_transparent_24%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#eef8ff_100%)]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_28%,rgba(15,23,42,0.04)_100%)]" />

          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <Badge
                variant="outline"
                className="mb-4 rounded-full border-fuchsia-200 bg-white/80 px-3 py-1 text-xs text-fuchsia-700 backdrop-blur"
              >
                Blog o grafikach AI
              </Badge>

              <div className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-slate-500">
                Modele, prompty, reklamy, mockupy
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Poradniki o grafikach AI, które{" "}
                <span className="relative inline-block text-transparent bg-gradient-to-r from-fuchsia-600 via-violet-600 to-sky-500 bg-clip-text">
                  pomagają tworzyć lepsze materiały
                  <span className="absolute -bottom-1 left-0 h-3 w-full rounded-full bg-fuchsia-300/60" />
                </span>{" "}
                do reklam, social mediów i sprzedaży
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[16px]">
                Czytaj praktyczne artykuły o modelach AI, promptach, grafikach reklamowych, formatach social media,
                mockupach ebooków i bezpiecznej publikacji materiałów marketingowych.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-slate-950 text-white hover:bg-slate-800">
                  <Link to={`/blog/${featured.slug}`}>
                    Czytaj artykuł główny
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <a href="#tematy-bloga">Tematy na blogu</a>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <a href="https://platform.openai.com/docs/guides/image-generation" target="_blank" rel="noreferrer">
                    OpenAI image guide
                  </a>
                </Button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur">
                  <div className="text-2xl font-semibold text-slate-950">{BLOG_ARTICLES.length}</div>
                  <div className="mt-1 text-sm text-slate-600">praktycznych artykułów</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur">
                  <div className="text-2xl font-semibold text-slate-950">{topicEntries.length}</div>
                  <div className="mt-1 text-sm text-slate-600">głównych tematów</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur">
                  <div className="text-2xl font-semibold text-slate-950">AI</div>
                  <div className="mt-1 text-sm text-slate-600">modele, prompty i przykłady</div>
                </div>
              </div>
            </div>

            <Link to={`/blog/${featured.slug}`} className="group block h-full">
              <div className="relative flex h-full min-h-[420px] items-end overflow-hidden border-l border-border/60 bg-slate-950">
                <div className="absolute inset-0">
                  <img
                    src={featured.coverImage}
                    alt={featured.coverAlt}
                    style={featured.coverFilter ? { filter: featured.coverFilter } : undefined}
                    className="h-full w-full object-cover object-[58%_center] transition-transform duration-700 group-hover:scale-[1.06]"
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${featured.coverOverlayClass || "from-transparent via-transparent to-transparent"}`}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.06)_0%,rgba(2,6,23,0.18)_28%,rgba(2,6,23,0.84)_100%)]" />
                </div>

                <div className="absolute left-5 top-5 inline-flex rounded-full border border-white/15 bg-slate-950/65 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  Polecany artykuł
                </div>

                <div className="relative z-10 p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/75">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur">
                      <BookOpen className="h-3.5 w-3.5" />
                      {featured.category}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 backdrop-blur">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {featured.publishedAt}
                    </span>
                  </div>

                  <h2 className="mt-4 max-w-xl text-2xl font-semibold leading-tight text-white sm:text-[30px]">
                    {featured.title}
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-white/80 sm:text-base">
                    {featured.description}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white">
                    Wejdź w artykuł
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </motion.section>

        <section id="tematy-bloga" className="mt-8 rounded-[24px] border border-border/70 bg-white p-5 scroll-mt-24">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Tematy na blogu o grafikach AI</h2>
              <p className="mt-1 text-sm text-slate-600">
                Wybierz obszar i przejdź do powiązanych poradników.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {topicEntries.map(([topic, articles]) => (
                <a
                  key={topic}
                  href={`#topic-${slugify(topic)}`}
                  className="rounded-full border border-border/70 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                >
                  {topic} ({articles.length})
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-10">
          {topicEntries.map(([topic, articles], topicIndex) => (
            <section key={topic} id={`topic-${slugify(topic)}`} className="scroll-mt-24">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    Artykuły
                  </Badge>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{topic}</h2>
                </div>
                <span className="text-sm text-slate-500">{articles.length} artykułów</span>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {articles.map((article, index) => (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * (topicIndex + index + 1) }}
                  >
                    <Link to={`/blog/${article.slug}`} className="block h-full">
                      <Card className="h-full overflow-hidden border-border/70 bg-white transition-shadow hover:shadow-lg">
                        <div className="aspect-[16/10] overflow-hidden">
                          <div className="relative h-full w-full">
                            <img
                              src={article.coverImage}
                              alt={article.coverAlt}
                              style={article.coverFilter ? { filter: article.coverFilter } : undefined}
                              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                            />
                            <div
                              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${article.coverOverlayClass || "from-transparent via-transparent to-transparent"}`}
                            />
                          </div>
                        </div>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                                {article.category}
                              </Badge>
                            </div>
                            <span>{article.readingTime}</span>
                          </div>
                          <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-950">{article.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{article.description}</p>
                          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                            Czytaj artykuł
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </section>
      </div>
    </AppLayout>
  );
};

export default Blog;
