export default function LearningHistory({
  learning,
  lessonId,
  parent = false,
}) {
  if (!learning) return null;
  const lessons = learning.lessons.filter(
    (l) => !lessonId || l.id === lessonId,
  );
  const recent = learning.recent_attempts.filter(
    (a) => !lessonId || a.lesson === lessonId,
  );
  if (!lessons.some((l) => l.attempts)) return null;
  return (
    <section
      className="learning-history plain-section"
      aria-label="Learning history"
    >
      <h2>{parent ? "Learning review" : "Your learning history"}</h2>
      <p>
        This table records your attempts at each lesson's exercise and knowledge
        check. You can review the parts that need another attempt without losing
        a completed lesson. Trading activity does not count toward lesson
        completion.
      </p>
      <div
        className="table-wrap"
        tabIndex="0"
        role="region"
        aria-label="Lesson attempt summary"
      >
        <table>
          <caption>
            Saved lesson progress and the most recent recorded attempt
          </caption>
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Status</th>
              <th className="numeric">Attempts</th>
              <th>Latest quiz</th>
              <th>Latest exercise</th>
            </tr>
          </thead>
          <tbody>
            {lessons
              .filter((l) => l.attempts)
              .map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.title}</th>
                  <td>{l.completed ? "Completed" : "In progress"}</td>
                  <td className="numeric">{l.attempts}</td>
                  <td>
                    {l.last_attempt
                      ? l.last_attempt.quiz_correct
                        ? "Correct"
                        : "Revisit concept"
                      : "Earlier result only"}
                  </td>
                  <td>
                    {l.last_attempt
                      ? l.last_attempt.exercise_correct
                        ? "Completed exercise"
                        : "Try worked example"
                      : "Earlier result only"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <details className="attempt-history">
        <summary>Review recent attempts</summary>
        {recent.length ? (
          <ol>
            {recent.map((a) => (
              <li key={a.id}>
                <strong>
                  {learning.lessons.find((l) => l.id === a.lesson)?.title}
                </strong>
                <small>
                  {new Date(a.created).toLocaleString()} · Quiz{" "}
                  {a.quiz_correct ? "correct" : "to revisit"} · Exercise{" "}
                  {a.exercise_correct ? "complete" : "to revisit"}
                </small>
                <p>Exercise response: {a.exercise}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>No recent detailed attempts for this lesson.</p>
        )}
        <p className="muted">
          Showing up to the latest 20 attempts across lessons.
        </p>
      </details>
      {learning.unrecorded_legacy_attempts > 0 && (
        <p className="muted">
          {learning.unrecorded_legacy_attempts} earlier attempt(s) retain their
          saved progress. Detailed attempt history begins with the database
          upgrade.
        </p>
      )}
    </section>
  );
}
