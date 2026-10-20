import { Fragment, type ReactNode } from "react";

const inlineToken = /(\*\*([^*\n]+)\*\*|`([^`\n]+)`|\*([^*\n]+)\*|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\))/g;

export function inlineMarkdown(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  inlineToken.lastIndex = 0;
  while ((match = inlineToken.exec(value)) !== null) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index));
    const key = `${match.index}-${match[0].length}`;
    if (match[2] !== undefined) result.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3] !== undefined) result.push(<code key={key}>{match[3]}</code>);
    else if (match[4] !== undefined) result.push(<em key={key}>{match[4]}</em>);
    else if (match[5] !== undefined && match[6] !== undefined) {
      result.push(<a key={key} href={match[6]} target="_blank" rel="noreferrer">{match[5]}</a>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

function isTableSeparator(line: string) {
  const cells = line.replace(/^\s*\||\|\s*$/g, "").split("|").map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableCells(line: string) {
  return line.replace(/^\s*\||\|\s*$/g, "").split("|").map((cell) => cell.trim());
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index] ?? "";
  return /^\s*```/.test(line)
    || /^\s{0,3}#{1,4}\s+/.test(line)
    || /^\s*>\s?/.test(line)
    || /^\s*[-+*]\s+/.test(line)
    || /^\s*\d+[.)]\s+/.test(line)
    || (line.includes("|") && isTableSeparator(lines[index + 1] ?? ""));
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) { index += 1; continue; }
    const line = lines[index];

    const fence = line.match(/^\s*```([^\s`]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`}><code data-language={fence[1] || undefined}>{code.join("\n")}</code></pre>);
      continue;
    }

    if (line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(tableCells(lines[index++]));
      blocks.push(<div className="markdown-table-scroll" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{inlineMarkdown(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/);
    if (heading) {
      const children = inlineMarkdown(heading[2]);
      const level = heading[1].length;
      blocks.push(level === 1 ? <h2 key={`heading-${index}`}>{children}</h2> : level === 2 ? <h3 key={`heading-${index}`}>{children}</h3> : <h4 key={`heading-${index}`}>{children}</h4>);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((part, partIndex) => <Fragment key={partIndex}>{partIndex > 0 && <br/>}{inlineMarkdown(part)}</Fragment>)}</blockquote>);
      continue;
    }

    const unordered = /^\s*[-+*]\s+/.test(line);
    const ordered = /^\s*\d+[.)]\s+/.test(line);
    if (unordered || ordered) {
      const items: string[] = [];
      const itemPattern = unordered ? /^\s*[-+*]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push(item[1]); index += 1;
      }
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>);
      blocks.push(ordered ? <ol key={`list-${index}`}>{children}</ol> : <ul key={`list-${index}`}>{children}</ul>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) paragraph.push(lines[index++]);
    if (!paragraph.length) { paragraph.push(lines[index]); index += 1; }
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((part, partIndex) => <Fragment key={partIndex}>{partIndex > 0 && <br/>}{inlineMarkdown(part)}</Fragment>)}</p>);
  }
  return <div className="message-text markdown-message">{blocks}</div>;
}

export function plainMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, "[bloque de código]")
    .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/([*_`~])/g, "")
    .replace(/^\s{0,3}#{1,4}\s+/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
