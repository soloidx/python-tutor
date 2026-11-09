export function assessAnswers(questions, answers) {
  const responses = questions.map((question) => ({
    questionId: question.id,
    correct: answers[question.id] === question.answerId,
  }));
  return {
    answers: Object.fromEntries(
      questions.map((question) => [question.id, answers[question.id]]),
    ),
    responses,
    score: responses.filter((response) => response.correct).length,
    total: questions.length,
  };
}

// Stored responses outlive content removal. Only show a submitted review when
// every current question still has an answer with the same option identity.
export function assessmentReview(questions, result) {
  if (!questions?.length || !result?.answers || !questions.every(question =>
    question.options.some(option => option.id === result.answers[question.id]),
  )) return null;
  return {
    ...assessAnswers(questions, result.answers),
    answers: result.answers,
  };
}
