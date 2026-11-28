import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SvgWalkthrough from './SvgWalkthrough.jsx';
import { lessonOccurrences } from './lesson-walkthroughs.js';

const labels = {NOTE:'Nota', TIP:'Consejo', IMPORTANT:'Importante', WARNING:'Advertencia', CAUTION:'Precaución'};

export default function LessonMarkdown({lesson, session}) {
  const occurrences = lessonOccurrences(lesson.markdown);
  const walkthroughs = lesson.walkthroughs || [];
  const markdown = lesson.markdown.replace(/^([ \t]*>\s*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gm, (_, prefix, type) => `${prefix}**${labels[type]}**`);
  // Match nodes by their original source positions; alert title expansion changes offsets,
  // so derive positions again after the Markdown transformation.
  const transformed = lessonOccurrences(markdown);
  function walkthroughPlugin() {
    return tree => {
      function visit(node) {
        if (!node.children) return;
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          const index = transformed.findIndex(item => item.start === child.position?.start.offset);
          if (index >= 0) {
            const item = walkthroughs[index];
            if (item.walkthrough.code && occurrences[index].codeStart !== null) { node.children.splice(i - 1, 1); i--; }
            node.children[i] = { type:'text', value:'', data:{hName:'lesson-walkthrough', hProperties:{index}} };
          } else visit(child);
        }
      }
      visit(tree);
    };
  }
  session.lessonWalkthroughs ||= {};
  return <Markdown remarkPlugins={[remarkGfm, walkthroughPlugin]} skipHtml disallowedElements={['img']} components={{'lesson-walkthrough': ({index}) => {
    const item = walkthroughs[Number(index)];
    const key = `${lesson.id}:${index}`;
    session.lessonWalkthroughs[key] ||= {};
    return <SvgWalkthrough walkthrough={item.walkthrough} example={item.code || ''} session={session.lessonWalkthroughs[key]}/>;
  }}}>{markdown}</Markdown>;
}
