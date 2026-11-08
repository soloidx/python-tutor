export function assessAnswers(questions, answers) {
  const responses = questions.map((question) => ({
    questionId: question.id,
    correct: answers[question.id] === question.answer,
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
