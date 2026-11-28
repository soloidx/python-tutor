import { unified } from 'unified';
import remarkParse from 'remark-parse';

// Walkthrough links are JSON links and must occupy an entire paragraph.
export function lessonOccurrences(markdown) {
  const tree = unified().use(remarkParse).parse(markdown), occurrences = [];
  const definitions = new Map();
  function collect(node) {
    if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node.url);
    for (const child of node.children || []) collect(child);
  }
  collect(tree);
  function visit(node) {
    if (!node.children) return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.type === 'paragraph') {
        const links = [];
        const scan = value => { const url = value.type === 'link' ? value.url : value.type === 'linkReference' ? definitions.get(value.identifier.toLowerCase()) : null; if (url && /\.json(?:[?#].*)?$/i.test(url)) links.push({ node: value, url }); for (const x of value.children || []) scan(x); };
        scan(child);
        if (links.length) {
          if (links.length !== 1 || child.children.length !== 1 || child.children[0] !== links[0].node) throw Error('El enlace del recorrido debe ocupar todo el párrafo');
          const previous = node.children[i - 1];
          const code = previous?.type === 'code' && previous.lang === 'python' ? previous.value : null;
          occurrences.push({ url: links[0].url, code, start: child.position.start.offset, codeStart: code === null ? null : previous.position.start.offset });
        }
      }
      visit(child);
    }
  }
  visit(tree);
  return occurrences;
}
