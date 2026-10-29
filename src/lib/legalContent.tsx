import type { ReactNode } from "react";

export function renderLegalContent(content: string) {
  const lines = content.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let key = 0;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;

    elements.push(
      <ul key={`list-${key++}`} className="text-muted-foreground list-disc pl-5 space-y-1">
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{item}</li>
        ))}
      </ul>
    );

    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      elements.push(<div key={`space-${key++}`} className="h-2" />);
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`heading-${key++}`} className="mt-6 text-lg font-semibold">
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    elements.push(
      <p key={`paragraph-${key++}`} className="text-muted-foreground">
        {line}
      </p>
    );
  }

  flushList();
  return elements;
}
