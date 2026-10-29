import { motion } from "framer-motion";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, ListChecks } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_ARTICLES, getBlogArticle } from "@/content/blog";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const BlogArticle = () => {
  const { slug = "" } = useParams();
  const article = getBlogArticle(slug);


  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const relatedArticles = BLOG_ARTICLES.filter((entry) => article.relatedSlugs.includes(entry.slug));
  const tocItems = article.sections.map((section) => ({
    id: slugify(section.title),
    title: section.title,
  }));

  return (
    <AppLayout>
      <article className="mx-auto min-w-0 max-w-5xl py-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Wróć do bloga
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {article.category}
            </Badge>
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {article.publishedAt}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <Clock3 className="h-4 w-4" />
              {article.readingTime}
            </span>
          </div>

          <h1 className="mt-4 max-w-4xl break-words text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 max-w-3xl break-words text-base leading-7 text-slate-600">{article.description}</p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-border/70 bg-white">
            <div className="relative">
              <img
                src={article.coverImage}
                alt={article.coverAlt}
                style={article.coverFilter ? { filter: article.coverFilter } : undefined}
                className="aspect-[16/8] w-full object-cover"
              />
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${article.coverOverlayClass || "from-transparent via-transparent to-transparent"}`}
              />
            </div>
          </div>
        </motion.div>

        <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <motion.div className="min-w-0" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="space-y-6">
              {article.intro.map((paragraph) => (
                <p key={paragraph} className="break-words text-base leading-8 text-slate-700">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-10 space-y-10">
              {article.sections.map((section) => {
                const sectionId = slugify(section.title);

                return (
                  <section key={section.title} id={sectionId} className="min-w-0 scroll-mt-24">
                    <h2 className="break-words text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                    <div className="mt-4 space-y-5">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="break-words text-base leading-8 text-slate-700">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {section.table && (
                      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-white">
                        {section.table.caption && (
                          <div className="border-b border-border/70 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                            {section.table.caption}
                          </div>
                        )}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="min-w-full table-fixed text-left text-sm">
                            <thead className="bg-slate-950 text-white">
                              <tr>
                                {section.table.headers.map((header) => (
                                  <th key={header} className="break-words px-4 py-3 font-medium">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.table.rows.map((row, rowIndex) => (
                                <tr key={`${section.title}-${rowIndex}`} className="border-t border-border/60">
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${section.title}-${rowIndex}-${cellIndex}`} className="break-words px-4 py-3 align-top text-slate-700">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid gap-3 p-3 md:hidden">
                          {section.table.rows.map((row, rowIndex) => (
                            <div key={`${section.title}-mobile-${rowIndex}`} className="rounded-xl border border-border/60 bg-slate-50 p-3">
                              {row.map((cell, cellIndex) => (
                                <div
                                  key={`${section.title}-mobile-${rowIndex}-${cellIndex}`}
                                  className={cellIndex === 0 ? "" : "mt-3 border-t border-border/60 pt-3"}
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    {section.table.headers[cellIndex]}
                                  </p>
                                  <p className="mt-1 break-words text-sm leading-6 text-slate-700">{cell}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {section.links && section.links.length > 0 && (
                      <div className="mt-6 rounded-2xl border border-border/70 bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Czytaj dalej: poradniki o grafikach AI
                        </h3>
                        <div className="mt-3 grid gap-2">
                          {section.links.map((link) =>
                            link.external ? (
                              <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-slate-800 transition-colors hover:text-slate-950"
                              >
                                {link.label}
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            ) : (
                              <Link
                                key={link.href}
                                to={link.href}
                                className="inline-flex items-center gap-2 text-sm text-slate-800 transition-colors hover:text-slate-950"
                              >
                                {link.label}
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </motion.div>

          <motion.aside initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="sticky top-24 space-y-4">
              <Card className="border-border/70 bg-white">
                <CardContent className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <ListChecks className="h-4 w-4" />
                    W tym artykule o grafikach AI
                  </h3>
                  <nav className="mt-4 grid gap-2">
                    {tocItems.map((item, index) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="rounded-xl border border-border/60 px-3 py-2 text-sm leading-5 text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                      >
                        <span className="mr-2 text-xs text-slate-400">{index + 1}.</span>
                        {item.title}
                      </a>
                    ))}
                  </nav>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-white">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Powiązane poradniki o grafikach AI
                  </h3>
                  <div className="mt-4 space-y-4">
                    {relatedArticles.map((related) => (
                      <Link key={related.slug} to={`/blog/${related.slug}`} className="block rounded-2xl border border-border/60 p-4 transition-colors hover:bg-slate-50">
                        <p className="text-xs text-slate-500">{related.category}</p>
                        <h4 className="mt-2 text-sm font-semibold leading-6 text-slate-950">{related.title}</h4>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-gradient-to-br from-cyan-50 via-white to-amber-50">
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-slate-950">Dokumentacja modeli AI do obrazów</h3>
                  <div className="mt-3 grid gap-2">
                    <a
                      href="https://ai.google.dev/gemini-api/docs/image-generation"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      Gemini API
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <a
                      href="https://platform.openai.com/docs/guides/image-generation"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      OpenAI image guide
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.aside>
        </div>
      </article>
    </AppLayout>
  );
};

export default BlogArticle;
