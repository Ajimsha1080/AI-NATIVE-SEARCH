'use client';

import React from 'react';

interface MarkdownContentProps {
  content: string;
  onImageClick?: (url: string, alt: string) => void;
  className?: string;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and [link](url)
 */
function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Regex to match **bold**, `code`, *italic*, [link](url)
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.substring(lastIdx, match.index));
    }

    if (match[1]) {
      // **bold**
      tokens.push(
        <strong key={`b-${match.index}`} className="font-semibold text-inherit">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // `inline code`
      tokens.push(
        <code key={`c-${match.index}`} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[11px] font-mono border border-zinc-200/80">
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      // *italic*
      tokens.push(
        <em key={`i-${match.index}`} className="italic text-inherit">
          {match[6]}
        </em>
      );
    } else if (match[7]) {
      // [link](url)
      tokens.push(
        <a
          key={`a-${match.index}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline font-medium"
        >
          {match[8]}
        </a>
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    tokens.push(text.substring(lastIdx));
  }

  return tokens.length > 0 ? tokens : [text];
}

export default function MarkdownContent({ content, onImageClick, className = '' }: MarkdownContentProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    // 1. Skip empty lines
    if (!trimmed) {
      idx++;
      continue;
    }

    // 2. Horizontal divider: --- or ***
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${idx}`} className="border-t border-zinc-200/80 my-2.5" />);
      idx++;
      continue;
    }

    // 3. Headings: #, ##, ###, ####
    const h1Match = trimmed.match(/^#\s+(.*)/);
    if (h1Match) {
      blocks.push(
        <h3 key={`h1-${idx}`} className="text-base font-bold text-zinc-950 mt-3 mb-1.5 first:mt-0 tracking-tight">
          {renderInline(h1Match[1])}
        </h3>
      );
      idx++;
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.*)/);
    if (h2Match) {
      blocks.push(
        <h4 key={`h2-${idx}`} className="text-sm font-bold text-zinc-900 mt-2.5 mb-1 first:mt-0 tracking-tight">
          {renderInline(h2Match[1])}
        </h4>
      );
      idx++;
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.*)/);
    if (h3Match) {
      blocks.push(
        <h5 key={`h3-${idx}`} className="text-xs font-bold text-zinc-900 mt-2 mb-1 first:mt-0 uppercase tracking-wider text-zinc-700">
          {renderInline(h3Match[1])}
        </h5>
      );
      idx++;
      continue;
    }

    const h4Match = trimmed.match(/^####\s+(.*)/);
    if (h4Match) {
      blocks.push(
        <h6 key={`h4-${idx}`} className="text-xs font-semibold text-zinc-800 mt-1.5 mb-0.5 first:mt-0">
          {renderInline(h4Match[1])}
        </h6>
      );
      idx++;
      continue;
    }

    // 4. Blockquotes: > quote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push(
        <blockquote key={`bq-${idx}`} className="border-l-3 border-indigo-500 bg-indigo-50/40 px-3 py-1.5 rounded-r-lg my-2 text-xs text-zinc-700 italic">
          {renderInline(quoteText)}
        </blockquote>
      );
      idx++;
      continue;
    }

    // 5. Tables: lines starting and ending with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (idx < lines.length && lines[idx].trim().startsWith('|') && lines[idx].trim().endsWith('|')) {
        tableLines.push(lines[idx].trim());
        idx++;
      }

      if (tableLines.length >= 2) {
        // Parse header and rows
        const parseRow = (line: string) => line.split('|').slice(1, -1).map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        // line 1 is usually separator (|---|---|)
        const rowStartIndex = tableLines[1].includes('---') ? 2 : 1;
        const rows = tableLines.slice(rowStartIndex).map(parseRow);

        blocks.push(
          <div key={`tbl-${idx}`} className="overflow-x-auto my-2.5 rounded-lg border border-zinc-200/90 shadow-2xs">
            <table className="min-w-full divide-y divide-zinc-200 text-xs text-left">
              <thead className="bg-zinc-100/90 text-zinc-800 font-semibold">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/40'}>
                    {r.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5 text-zinc-700 align-top">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 6. Inline Images: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const [, alt, url] = imgMatch;
      blocks.push(
        <div 
          key={`img-${idx}`}
          onClick={() => onImageClick && onImageClick(url, alt)}
          className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-white cursor-pointer max-w-sm my-2 shadow-xs hover:border-zinc-300 transition"
        >
          <img src={url} alt={alt} className="w-full max-h-56 object-cover" />
        </div>
      );
      idx++;
      continue;
    }

    // 7. Bullet Lists: - item, * item, • item
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (idx < lines.length && /^[-*•]\s+/.test(lines[idx].trim())) {
        listItems.push(lines[idx].trim().replace(/^[-*•]\s+/, ''));
        idx++;
      }
      blocks.push(
        <ul key={`ul-${idx}`} className="space-y-1 my-1.5 pl-1">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Numbered Lists: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: Array<{ num: string; text: string }> = [];
      while (idx < lines.length && /^\d+\.\s+/.test(lines[idx].trim())) {
        const itemMatch = lines[idx].trim().match(/^(\d+)\.\s+(.*)/);
        if (itemMatch) {
          listItems.push({ num: itemMatch[1], text: itemMatch[2] });
        }
        idx++;
      }
      blocks.push(
        <ol key={`ol-${idx}`} className="space-y-1 my-1.5 pl-1">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-800">
              <span className="font-semibold text-zinc-600 text-[11px] shrink-0 min-w-4 text-right">{item.num}.</span>
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Standard Paragraph Text
    blocks.push(
      <p key={`p-${idx}`} className="text-xs leading-relaxed text-inherit my-1 first:mt-0 last:mb-0">
        {renderInline(trimmed)}
      </p>
    );
    idx++;
  }

  return <div className={`markdown-body space-y-1 ${className}`}>{blocks}</div>;
}
