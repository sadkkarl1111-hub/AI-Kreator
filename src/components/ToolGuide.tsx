import { Link } from 'react-router-dom';
import { getToolGuide } from '@/content/toolGuides';

export function ToolGuide({ pathname }: { pathname: string }) {
  const guide = getToolGuide(pathname);
  if (!guide) return null;

  return (
    <section aria-labelledby="tool-guide-title" className="mx-auto mt-12 max-w-3xl space-y-4 border-t pt-8">
      <h2 id="tool-guide-title" className="text-balance text-xl font-semibold">{guide.title}</h2>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{guide.intro}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        {guide.steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{guide.tip}</p>
      <nav aria-label="Powiązane narzędzia" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {guide.related.map(({ href, label }) => <Link key={href} to={href} className="text-primary underline underline-offset-4">{label}</Link>)}
      </nav>
    </section>
  );
}
