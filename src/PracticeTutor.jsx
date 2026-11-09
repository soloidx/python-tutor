import React from "react";
import { TutorPanel } from "./TutorAccess.jsx";
import { captureContext } from "./tutorContext.js";

// Scope follows the original course/topic, including retained round snapshots.
export function PracticeTutor({ entry, access, conversation, onConfigure }) {
  const { course, topic, exercise, work } = entry;
  return (
    <section className="practice-tutor" aria-label="Tutor del tema de práctica">
      {!access.config?.key && (
        <div className="practice-tutor-notice">
          <p>El tutor no está configurado.</p>
          <p>Puedes resolver los ejercicios y consultar las pistas.</p>
        </div>
      )}
      <TutorPanel
        key={`${course.id}:${topic.id}`}
        access={access}
        conversation={conversation}
        courseId={course.id}
        topicId={topic.id}
        topicTitle={topic.title}
        onConfigure={onConfigure}
        capture={() => captureContext({
          course,
          topic,
          exercise,
          draft: work.code ?? exercise.starter ?? "",
          lastResult: work.lastCodeResult,
          selectedOptionId: work.selectedOptionId,
          selectionStatus: work.selectionStatus,
          selectionResult: work.selectionResult,
          feedback: work.selectionFeedback,
        })}
      />
    </section>
  );
}
