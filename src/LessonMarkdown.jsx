import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SvgWalkthrough from './SvgWalkthrough.jsx';
import { lessonOccurrences } from './lesson-walkthroughs.js';

const labels = {NOTE:'Nota', TIP:'Consejo', IMPORTANT:'Importante', WARNING:'Advertencia', CAUTION:'Precaución'};

export default function LessonMarkdown({lesson, session}) {
  const occurrences = lessonOccurrences(lesson.markdown);
  const walkthroughs = lesson.walkthroughs || [];
  function walkthroughPlugin() {
    return tree => {
      function visit(node) {
        if (!node.children) return;
        if (node.type === 'blockquote') {
          const paragraph = node.children[0];
          const first = paragraph?.type === 'paragraph' && paragraph.children[0];
          const match = first?.type === 'text' && first.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/);
          if (match) {
            const rest = first.value.slice(match[0].length);
            paragraph.children.splice(0, 1, {type:'strong', children:[{type:'text', value:labels[match[1]]}]}, ...(rest ? [{type:'text', value:`\n${rest}`}] : []));
          }
        }
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          const index = occurrences.findIndex(item => item.start === child.position?.start.offset);
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
    return <SvgWalkthrough key={key} walkthrough={item.walkthrough} example={item.code || ''} session={session.lessonWalkthroughs[key]}/>;
  }}}>{lesson.markdown}</Markdown>;
}
