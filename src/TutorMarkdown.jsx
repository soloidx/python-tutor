import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ children, onCopy }) {
  const code = React.isValidElement(children) ? String(children.props.children ?? "") : String(children ?? "");
  const language = React.isValidElement(children) ? children.props.className?.replace("language-", "") : "";
  return <div className="tutor-code"><div className="tutor-code-toolbar"><span>{language || "Código"}</span><button className="secondary" onClick={() => onCopy(code)}>Copiar código</button></div><pre>{children}</pre></div>;
}

export function TutorMarkdown({ text, onCopy }) {
  return <div className="tutor-answer"><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img"]} components={{
    pre: ({ children }) => <CodeBlock onCopy={onCopy}>{children}</CodeBlock>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
  }}>{text}</Markdown></div>;
}
