import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

const challenges = [
  {
    title: "Comparing stocks and funds",
    prompt: "Which usually spreads your investment across more companies?",
    options: ["A single company's stock", "A broad stock fund"],
    correct: 1,
    explanation:
      "A broad stock fund can hold many companies. That reduces dependence on one company, but the whole market can still fall.",
    lesson: "diversification",
  },
  {
    title: "Calculating a percentage loss",
    prompt: "Your practice investment goes from $100 to $90. What happened?",
    options: [
      "It lost 10% of its starting value",
      "It lost 90% of its starting value",
    ],
    correct: 0,
    explanation:
      "The loss is $10 out of the original $100: 10%. Price changes can go either way; this example isn't a forecast.",
    lesson: "risk",
  },
  {
    title: "Writing a decision reason",
    prompt: "Which plan gives you more to learn from later?",
    options: [
      "Buy it because the price just went up",
      "Explain my goal, one risk, and when I'll review",
    ],
    correct: 1,
    explanation:
      "Writing down your reasoning gives you something to review. A gain doesn't prove a good decision, and keeping practice cash is a valid choice.",
    lesson: "decisions",
  },
];

function ConceptChallenge() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const challenge = challenges[index];
  return (
    <section className="concept-challenge" aria-labelledby="challenge-title">
      <div className="challenge-heading">
        <span className="activity-icon">
          <Icon name="spark" />
        </span>
        <div>
          <span className="eyebrow">
            Practice question {index + 1} of {challenges.length}
          </span>
          <h2 id="challenge-title">{challenge.title}</h2>
        </div>
      </div>
      <p>{challenge.prompt}</p>
      <div
        className="challenge-options"
        role="group"
        aria-label="Warm-up answers"
      >
        {challenge.options.map((option, i) => (
          <button
            key={option}
            type="button"
            aria-pressed={answer === i}
            className={
              answer === i ? "challenge-answer picked" : "challenge-answer"
            }
            onClick={() => setAnswer(i)}
          >
            <span className="answer-letter" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            {option}
          </button>
        ))}
      </div>
      {answer !== null && (
        <div
          className={`challenge-feedback${answer === challenge.correct ? " understood" : ""}`}
          role="status"
        >
          <strong>
            {answer === challenge.correct
              ? "Your answer is correct. The explanation below shows why."
              : "That answer is incorrect. Read the explanation below before trying again."}
          </strong>
          <p>{challenge.explanation}</p>
          <div className="challenge-next">
            <Link to={`/lessons/${challenge.lesson}`}>
              Explore the lesson <Icon name="arrow" />
            </Link>
            <button
              className="quiet"
              onClick={() => {
                setIndex((index + 1) % challenges.length);
                setAnswer(null);
              }}
            >
              Try another idea <Icon name="replay" />
            </button>
          </div>
        </div>
      )}
      <small className="challenge-note">
        These questions let you practice without changing your saved lesson
        progress. To complete a lesson, open it from Lessons and submit its
        exercise and knowledge check.
      </small>
    </section>
  );
}

export default function StudentActivities({ completed, lessons, portfolio }) {
  const decisions = portfolio?.orders.length || 0;
  return (
    <div className="student-activities">
      <details className="activity-directory">
        <summary>Browse other practice activities</summary>
        <section className="learning-trail" aria-labelledby="trail-title">
          <div className="section-intro">
            <div>
              <h2 id="trail-title">Practice activities</h2>
            </div>
            <Link to="/tutorial" className="trail-guide">
              Take the guided tutorial <Icon name="arrow" />
            </Link>
          </div>
          <ol>
            {[
              {
                title: "Lessons",
                description:
                  "Read an explanation and complete an exercise about ownership, risk, or investment decisions.",
                icon: "lessons",
                to: "/lessons",
                status: `${completed} of ${lessons.length || 6} lessons complete`,
              },
              {
                title: "Investments",
                description:
                  "Compare the practice investments and write a request when you have a decision to explain.",
                icon: "explore",
                to: "/explore",
                status: decisions
                  ? `${decisions} saved practice decision${decisions === 1 ? "" : "s"} in this space`
                  : "You have not submitted any practice decisions in this account.",
              },
              {
                title: "Market replay",
                description:
                  "Follow a scenario over several sessions and review how its changing prices affect your portfolio.",
                icon: "replay",
                to: "/scenarios",
                status:
                  portfolio?.run.mode === "replay"
                    ? `Session ${portfolio.run.session + 1} of ${portfolio.scenario.sessions}`
                    : "Three made-up market scenarios",
              },
            ].map((activity, i) => (
              <li key={activity.to}>
                <Link to={activity.to}>
                  <span className="trail-top">
                    <span className="activity-icon">
                      <Icon name={activity.icon} />
                    </span>
                    <span className="trail-number">0{i + 1}</span>
                  </span>
                  <h3>{activity.title}</h3>
                  <p>{activity.description}</p>
                  <span className="trail-status">{activity.status}</span>
                  <Icon name="arrow" className="trail-arrow" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </details>
      <details className="optional-challenge">
        <summary>Try a practice question</summary>
        <ConceptChallenge />
      </details>
    </div>
  );
}
