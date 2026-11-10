export const practiceEntryKey = (courseId, exerciseId) => JSON.stringify([courseId, exerciseId]);

// Change this limit to configure the size of newly drawn rounds.
export const PRACTICE_ROUND_LIMIT = 10;

export function createPracticeRound(publication) {
  const unique = new Map();
  // A shared course appears once in the registry regardless of path references.
  for (const { id } of publication.catalog.courses) {
    const course = publication.courses[id];
    for (const topic of course.topics) {
      for (const exercise of topic.exercises) {
        const key = practiceEntryKey(course.id, exercise.id);
        if (!unique.has(key)) {
          unique.set(key, {
            key,
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
    currentId: entries[0]?.key ?? null,
    reviewing: false,
  };
}
