// Change this limit to configure the size of newly drawn rounds.
export const PRACTICE_ROUND_LIMIT = 10;

export function createPracticeRound(publication) {
  const unique = new Map();
  // Registry order chooses one deterministic course/topic for canonical IDs
  // referenced by more than one course. Learning-path references are irrelevant.
  for (const { id } of publication.catalog.courses) {
    const course = publication.courses[id];
    for (const topic of course.topics) {
      for (const exercise of topic.exercises) {
        if (!unique.has(exercise.id)) {
          unique.set(exercise.id, {
            id: exercise.id,
            course,
            topic,
            exercise,
            status: "pending",
            work: {},
          });
        }
      }
    }
  }
  const pool = [...unique.values()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const entries = pool.slice(0, PRACTICE_ROUND_LIMIT);
  return {
    id: crypto.randomUUID(),
    revision: publication.catalog.revision,
    entries,
    currentId: entries[0]?.id ?? null,
    reviewing: false,
  };
}
