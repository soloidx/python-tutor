import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

// Keep the tutor mounted when hidden so drafts and in-flight replies survive.
export function PracticeWorkspace({ entry, children, renderTutor }) {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 820px)").matches);
  const panel = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const resize = () => {
      setCompact(media.matches);
      setOpen(!media.matches);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    // Switching between modal and non-modal requires closing the native dialog.
    if (dialog.open) dialog.close();
    if (!open) return;
    const previous = document.activeElement;
    if (compact) {
      dialog.showModal();
      (dialog.querySelector("textarea:not(:disabled)") || dialog.querySelector("button"))?.focus();
    } else {
      dialog.show();
      previous?.focus({ preventScroll: true });
    }
    return () => dialog.close();
  }, [open, compact]);

  useLayoutEffect(() => {
    if (!open || compact || !panel.current) return;
    const dialog = panel.current;
    let frame;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = Math.max(16, dialog.getBoundingClientRect().top);
        dialog.style.setProperty("--practice-tutor-height", `${Math.max(300, window.innerHeight - top - 16)}px`);
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(dialog.parentElement);
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, [open, compact]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <section className="practice-workspace" aria-label="Ejercicio de la ronda">
      <div className="practice-context">
        <div><strong>{entry.topic.title}</strong><span>{entry.course.title}</span></div>
        {renderTutor && <button
          ref={trigger}
          className={open ? "secondary" : "primary"}
          aria-expanded={open}
          aria-controls="practice-tutor-panel"
          onClick={() => open ? close() : setOpen(true)}
        >{open ? "Ocultar tutor" : "Abrir tutor"}</button>}
      </div>
      <div className={`practice-workspace-body ${open && !compact && renderTutor ? "with-tutor" : ""}`}>
        <div className="practice-exercise-column">{children}</div>
        {renderTutor && <dialog
          ref={panel}
          id="practice-tutor-panel"
          className="practice-tutor-dock"
          role={compact ? "dialog" : "complementary"}
          aria-label="Tutor de práctica"
          onCancel={event => { event.preventDefault(); close(); }}
          onKeyDown={event => {
            if (!compact && event.key === "Escape" && !event.target.closest(".tutor-settings")) {
              event.preventDefault(); close();
            }
          }}
          onClick={event => { if (compact && event.target === panel.current) close(); }}
        >{renderTutor(entry, close)}</dialog>}
      </div>
    </section>
  );
}
