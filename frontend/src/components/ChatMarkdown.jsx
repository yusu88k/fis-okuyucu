// Sohbet için hafif markdown render'ı (bağımlılıksız).
// Destekler: **kalın**, `kod`, - / * madde listesi, ### başlık, ve | GFM tablolar |.
// Asistan yanıtlarını güzel göstermek için kullanılır (ham ** ve | görünmesin).
import { Fragment } from 'react';

// Satır içi: **kalın** ve `kod`
function renderInline(text) {
  const out = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+?)`)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<code key={key++} className="chat-md-code">{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableLine = (l) => /^\s*\|.*\|\s*$/.test(l);
const parseCells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSeparator = (l) => parseCells(l).every((c) => /^:?-{1,}:?$/.test(c));

export function ChatMarkdown({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Tablo bloğu
    if (isTableLine(line)) {
      const tbl = [];
      while (i < lines.length && isTableLine(lines[i])) { tbl.push(lines[i]); i++; }
      const rows = tbl.filter((r) => !isSeparator(r)).map(parseCells);
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      continue;
    }

    // Madde listesi
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Başlık (### / ## / #)
    const h = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (h) { blocks.push({ type: 'h', text: h[1] }); i++; continue; }

    blocks.push({ type: 'p', text: line });
    i++;
  }

  return (
    <div className="chat-md">
      {blocks.map((b, bi) => {
        if (b.type === 'table') {
          const [head, ...body] = b.rows;
          return (
            <div key={bi} className="chat-md-tablewrap">
              <table className="chat-md-table">
                <thead>
                  <tr>{head.map((c, ci) => <th key={ci}>{renderInline(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {body.map((r, ri) => (
                    <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={bi} className="chat-md-ul">
              {b.items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        if (b.type === 'h') return <p key={bi} className="chat-md-h">{renderInline(b.text)}</p>;
        // Boş satır -> küçük boşluk
        if (b.text.trim() === '') return <div key={bi} className="chat-md-gap" />;
        return <p key={bi} className="chat-md-p">{renderInline(b.text)}</p>;
      })}
    </div>
  );
}
