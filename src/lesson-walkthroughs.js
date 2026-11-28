import { unified } from 'unified';
import remarkParse from 'remark-parse';

// Walkthrough links are JSON links and must occupy an entire paragraph.
export function lessonOccurrences(markdown) {
  const tree = unified().use(remarkParse).parse(markdown), occurrences = [];
  function visit(node) {
    if (!node.children) return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.type === 'paragraph') {
        const links = [];
        const scan = value => { if (value.type === 'link' && /\.json(?:[?#].*)?$/i.test(value.url)) links.push(value); for (const x of value.children || []) scan(x); };
        scan(child);
        if (links.length) {
          if (links.length !== 1 || child.children.length !== 1 || child.children[0] !== links[0]) throw Error('El enlace del recorrido debe ocupar todo el párrafo');
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
