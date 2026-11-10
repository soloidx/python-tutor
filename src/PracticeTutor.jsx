import React from "react";
import { TutorPanel } from "./TutorAccess.jsx";
import { captureContext } from "./tutorContext.js";

// Scope follows the original course/topic, including retained round snapshots.
export function PracticeTutor({ entry, access, conversation, onConfigure, onClose }) {
  const { course, topic, exercise, work } = entry;
  return (
    <section className="practice-tutor" aria-label="Tutor del tema de práctica">
      <TutorPanel
        key={`${course.id}:${topic.id}`}
        onClose={onClose}
        notice={!access.config?.key && (
          <div className="practice-tutor-notice">
            <p>El tutor no está configurado.</p>
            <p>Puedes continuar con el ejercicio sin configurar el tutor.</p>
          </div>
        )}
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
