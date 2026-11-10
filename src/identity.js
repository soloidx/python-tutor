// Internal IDs are opaque tuples. Publisher slugs stay unchanged in its files.
export const courseIdentity = (source, id) => JSON.stringify([source, id]);
export const originalCourseId = (id) => courseIdentity("original", id);

export function originalLocalId(id) {
  try {
    const value = JSON.parse(id);
    return Array.isArray(value) &&
      value.length === 2 &&
      value[0] === "original" &&
      typeof value[1] === "string"
      ? value[1]
      : null;
  } catch {
    return null;
  }
}

export function originalPublication(publication) {
  const courses = Object.fromEntries(
    Object.entries(publication.courses).map(([id, course]) => {
      const internal = originalCourseId(id);
      return [internal, { ...course, id: internal }];
    }),
  );
  return {
    ...publication,
    originalIdentity: true,
    catalog: {
      ...publication.catalog,
      courses: publication.catalog.courses.map((course) => ({
        ...course,
        id: originalCourseId(course.id),
      })),
      learningPaths: publication.catalog.learningPaths.map((path) => ({
        ...path,
        id: originalCourseId(path.id),
        courseIds: path.courseIds.map(originalCourseId),
      })),
    },
    courses,
  };
}
