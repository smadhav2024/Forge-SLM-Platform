// components/markdown-renderer.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  return (
    <div
      className="
        prose prose-sm
        dark:prose-invert
        max-w-none

        prose-p:my-2
        prose-headings:my-3
        prose-ul:my-2
        prose-ol:my-2
        prose-li:my-1

        prose-pre:my-3
        prose-pre:rounded-lg
        prose-pre:border

        prose-code:before:content-none
        prose-code:after:content-none
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}