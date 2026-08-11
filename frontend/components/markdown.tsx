"use client";

import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-[13.5px] leading-relaxed text-[var(--fg)]">
      <ReactMarkdown
        components={{
          a: (props) => (
            <a
              {...props}
              className="text-[var(--brand)] underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            />
          ),
          ul: (props) => <ul className="my-1.5 list-disc pl-5" {...props} />,
          ol: (props) => <ol className="my-1.5 list-decimal pl-5" {...props} />,
          li: (props) => <li className="my-0.5" {...props} />,
          p: (props) => <p className="my-1.5" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          code: (props) => (
            <code
              className="rounded bg-[var(--hover)] px-1 py-0.5 font-mono text-[12px]"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="my-2 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[12px]"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-2 border-l-2 border-[var(--brand)]/50 pl-3 text-[var(--muted)] italic"
              {...props}
            />
          ),
          h1: (props) => <h1 className="mt-3 mb-1.5 text-base font-bold" {...props} />,
          h2: (props) => <h2 className="mt-3 mb-1.5 text-sm font-bold" {...props} />,
          h3: (props) => <h3 className="mt-2 mb-1 text-sm font-semibold" {...props} />,
          hr: (props) => <hr className="my-3 border-[var(--border)]" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
