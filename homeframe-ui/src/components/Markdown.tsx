import { lazy, Suspense } from 'react';
const RichMarkdown = lazy(() =>
  import('./RichMarkdown').then((module) => ({ default: module.Markdown })),
);
export function Markdown({ children }: { children: string }) {
  return (
    <Suspense
      fallback={
        <div className="markdown selectable">
          <pre className="markdown-loading">{children}</pre>
        </div>
      }
    >
      <RichMarkdown>{children}</RichMarkdown>
    </Suspense>
  );
}
