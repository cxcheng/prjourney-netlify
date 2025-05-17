import {useRouter} from 'next/router'
import Head from 'next/head'
import React, {useState} from 'react'
import Link from "next/link";

export async function getServerSideProps(context) {
    const {id} = context.params
    const {completed, callback} = context.query

    const callbackUrl = callback ? decodeURIComponent(callback) : null
    try {
        const url = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_lessons/${id}`
        const headers = {'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}`}
        const response = await fetch(url, {headers: headers})
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        console.error("#####", {
            lesson: null,
            isCompleted: completed === 'true',
            callbackUrl: callbackUrl
        })

        const {data} = await response.json()
        return {
            props: {
                lesson: data,
                error: null,
                errorStatus: null,
                isCompleted: completed === 'true',
                callbackUrl: callbackUrl
            }
        }
    } catch (error) {
        console.error('Error fetching lesson:', error)
        return {
            props: {
                lesson: null,
                error: error.message || 'Unknown error occurred',
                errorStatus: error.status || 500,
                stack: error.stack || null,
                isCompleted: completed === 'true',
                callbackUrl: callbackUrl
            }
        }
    }
}

const QuizComponent = ({quizData}) => {
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [results, setResults] = useState({});
    const [submitted, setSubmitted] = useState(false);

    const handleAnswerSelect = (questionKey, choiceValue) => {
        setSelectedAnswers(prev => ({
            ...prev,
            [questionKey]: choiceValue
        }));
    };

    const handleSubmit = () => {
        // Only process answers if user has selected at least one
        if (Object.keys(selectedAnswers).length > 0) {
            const newResults = {};
            let correctCount = 0;

            quizData.forEach(question => {
                const isCorrect = selectedAnswers[question.question_key] === question.answer;
                newResults[question.question_key] = isCorrect;
                if (isCorrect) correctCount++;
            });

            setResults(newResults);
            setSubmitted(true);
        }
    };

    const handleReset = () => {
        setSelectedAnswers({});
        setResults({});
        setSubmitted(false);
    };

    return (
        <div className="quiz-container">
            {quizData.map((question, index) => (
                <div key={question.question_key} className="quiz-question">
                    <h3>Question {index + 1}: {question.question}</h3>

                    <div className="choices-container">
                        {question.choices.map(choice => (
                            <div key={choice.choice} className="choice-item">
                                <label className={`choice-label ${
                                    submitted && selectedAnswers[question.question_key] === choice.choice
                                        ? results[question.question_key]
                                            ? "correct-answer"
                                            : "incorrect-answer"
                                        : ""
                                }`}>
                                    <input
                                        type="radio"
                                        name={question.question_key}
                                        value={choice.choice}
                                        onChange={() => handleAnswerSelect(question.question_key, choice.choice)}
                                        checked={selectedAnswers[question.question_key] === choice.choice}
                                        disabled={submitted}
                                    />
                                    {choice.text}
                                </label>
                                {submitted && !results[question.question_key] &&
                                    question.answer === choice.choice &&
                                    selectedAnswers[question.question_key] !== choice.choice && (
                                        <div className="correct-answer-indicator">
                                            ← Correct Answer
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>

                    {submitted && selectedAnswers[question.question_key] && (
                        <div className="question-feedback">
                            {results[question.question_key]
                                ? "Correct!"
                                : "Incorrect. Please review the correct answer."}
                        </div>
                    )}
                </div>
            ))}

            <div className="quiz-controls">
                {!submitted ? (
                    <button
                        onClick={handleSubmit}
                        className="submit-button"
                    >
                        Submit Answers
                    </button>
                ) : (
                    <>
                        <div className="quiz-result-summary">
                            You got {Object.values(results).filter(Boolean).length} out of {quizData.length} questions
                            correct.
                        </div>
                        <button onClick={handleReset} className="reset-button">
                            Take Quiz Again
                        </button>
                    </>
                )}
            </div>

            <style jsx>{`
                .quiz-container {
                    margin: 2rem 0;
                    padding: 1.5rem;
                    background-color: #f7f9fc;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }

                .quiz-question {
                    margin-bottom: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #e0e0e0;
                }

                .choices-container {
                    margin: 1rem 0;
                }

                .choice-item {
                    margin: 0.75rem 0;
                    position: relative;
                }

                .choice-label {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .choice-label:hover {
                    background-color: #f0f0f0;
                }

                .choice-label input {
                    margin-right: 0.75rem;
                }

                .correct-answer {
                    background-color: #e6f7e6;
                    border: 1px solid #2e7d32;
                }

                .incorrect-answer {
                    background-color: #ffebee;
                    border: 1px solid #c62828;
                }

                .result-indicator {
                    margin-left: 0.5rem;
                    font-weight: bold;
                    font-size: 1.1rem;
                }

                .question-feedback {
                    margin-top: 0.75rem;
                    padding: 0.5rem;
                    font-style: italic;
                }

                .correct-answer-indicator {
                    margin-left: 2rem;
                    padding: 0.5rem;
                    color: #2e7d32;
                    font-weight: bold;
                }

                .quiz-controls {
                    margin-top: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .submit-button, .reset-button {
                    padding: 0.5rem 1.5rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 1rem;
                }

                .submit-button {
                    background-color: #0070f3;
                    color: white;
                }

                .submit-button:hover {
                    background-color: #005dca;
                }

                .reset-button {
                    background-color: #e0e0e0;
                    color: #333;
                    margin-top: 1rem;
                }

                .reset-button:hover {
                    background-color: #d0d0d0;
                }

                .quiz-result-summary {
                    margin-bottom: 1rem;
                    font-weight: bold;
                    font-size: 1.1rem;
                }
            `}</style>
        </div>
    );
};

export default function Page({lesson, error, errorStatus, stack, isCompleted, callbackUrl}) {
    const router = useRouter();
    const {id} = router.query;
    const [buttonState, setButtonState] = useState(isCompleted ? 'alreadyCompleted' : 'default');
    const [errorMessage, setErrorMessage] = useState('');

    const completedUrl = isCompleted ? null : `${callbackUrl}?completed_lesson_id=${id}`;

    if (router.isFallback) {
        return (
            <div className="container">
                <Head><title>Loading Lesson | Next.js Starter</title></Head>
                <main><h1>Loading...</h1></main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container">
                <Head><title>Error {errorStatus} | Next.js Starter</title></Head>
                <main>
                    <div className="content-box">
                        <h1>Error Loading Lesson</h1>
                        <p>Status: {errorStatus || "Unknown"}</p>
                        <p>{error}</p>
                        {stack && <pre className="error-stack">{stack}</pre>}
                        <div className="actions">
                            <button onClick={() => window.location.reload()}>Try Again</button>
                            {callbackUrl &&
                                <button onClick={handleBackClick}>Return {callbackUrl ? 'to Course' : 'Home'}</button>
                            }
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    if (!lesson) {
        return (
            <div className="container">
                <Head><title>Lesson Not Found | Next.js Starter</title></Head>
                <main>
                    <div className="content-box">
                        <h1>Lesson Not Found</h1>
                        <p>We couldn't find the lesson you're looking for.</p>
                        <div className="actions">
                            {callbackUrl &&
                                <button onClick={handleBackClick}>Return {callbackUrl ? 'to Course' : 'Home'}</button>
                            }
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="container">
            <Head>
                <title>{lesson.title || `Lesson ${id}`} | Next.js Starter</title>
            </Head>
            <main className="left-aligned">
                <div className="content-box">
                    <h1>{lesson.title}</h1>
                </div>

                {lesson.video_url && (
                    <div className="content-box">
                        <h2>Video</h2>
                        <div className="video-container">
                            {lesson.video_type === 'url' && (
                                <iframe
                                    src={lesson.video_url.replace('watch?v=', 'embed/')}
                                    frameBorder="0"
                                    allowFullScreen
                                    width="100%"
                                    height="450"
                                ></iframe>
                            )}
                        </div>
                    </div>
                )}

                <div className="content-box">
                    <h2>Lesson Content</h2>
                    {lesson.content ? (
                        <div dangerouslySetInnerHTML={{__html: lesson.content}}/>
                    ) : (
                        <p>No content available for this lesson.</p>
                    )}
                </div>

                {lesson.resources?.length > 0 && (
                    <div className="content-box">
                        <h2>Resources</h2>
                        <ul>
                            {lesson.resources.map((resource, index) => (
                                <li key={index}>{resource.title}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {lesson.quiz && lesson.quiz.length > 0 && (
                    <div className="content-box">
                        <h2>Quiz</h2>
                        <QuizComponent quizData={lesson.quiz}/>
                    </div>
                )}

                <div className="content-box">
                    <div className="actions">
                        {completedUrl &&
                            <Link href={completedUrl}><span className="status-text">Mark as Completed</span>
                            </Link>
                        }
                        {!completedUrl &&
                            <span className="status-text">Lesson already completed</span>
                        }
                        <div className="secondary-button">
                            {callbackUrl &&
                                <Link href={callbackUrl}>Back to {callbackUrl ? 'Enrollment' : 'Home'}
                                </Link>
                            }
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 1rem;
                }

                .left-aligned {
                    text-align: left;
                }

                h1 {
                    margin-bottom: 1rem;
                }

                h2 {
                    margin-top: 0;
                    color: #333;
                }

                .content-box {
                    width: 100%;
                    margin-bottom: 2rem;
                    padding: 1.5rem;
                    background-color: #ffffff;
                    border-radius: 5px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }

                .video-container {
                    position: relative;
                    padding-bottom: 56.25%;
                    height: 0;
                    overflow: hidden;
                    max-width: 100%;
                    margin: 1.5rem 0 1rem;
                }

                .video-container iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .resources ul {
                    padding-left: 1.5rem;
                }

                .actions {
                    margin-top: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                button {
                    padding: 0.5rem 1rem;
                    background-color: #0070f3;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                button:hover {
                    background-color: #005dca;
                }

                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }

                .secondary-button {
                    background-color: #e0e0e0;
                    color: #333;
                }

                .secondary-button:hover {
                    background-color: #d0d0d0;
                }

                .status-text {
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    background-color: #e6f7e6;
                    color: #2e7d32;
                    text-decoration: none;
                }

                .error-text {
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    background-color: #ffebee;
                    color: #c62828;
                }

                .error-stack {
                    background-color: #f5f5f5;
                    padding: 1rem;
                    overflow-x: auto;
                    border-radius: 4px;
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    )
}