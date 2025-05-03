import { useRouter } from 'next/router'
import Head from 'next/head'
import { useState } from 'react'

export async function getServerSideProps(context) {
    // Existing fetch logic remains unchanged
    // ...
    const { id } = context.params

    try {
        const url = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_lessons/${id}`
        const headers = { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}` }
        const response = await fetch(url, { headers: headers})
        if (!response.ok) {
            console.error(`Request: ${url} - ${JSON.stringify(headers)}`)
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        const { data } = await response.json()
        return { props: { lesson: data, error: null, errorStatus: null } }
    } catch (error) {
        console.error('Error fetching lesson:', error)
        return {
            props: {
                lesson: null,
                error: error.message || 'Unknown error occurred',
                errorStatus: error.status || 500,
                stack: error.stack || null
            }
        }
    }
}

export default function Page({ lesson, error, errorStatus, stack }) {
    const router = useRouter()
    const { id } = router.query
    const [buttonState, setButtonState] = useState('default') // default, loading, completed, alreadyCompleted, error
    const [errorMessage, setErrorMessage] = useState('')

    const handleMarkAsCompleted = async () => {
        setButtonState('loading')

        try {
            const enrollmentId = "cbaf4279-0214-4244-bffd-5e8a6998ab64"
            const response = await fetch(`/api/add-lesson?enrollment_id=${enrollmentId}&lesson_id=${id}`)

            if (response.status === 200) {
                setButtonState('alreadyCompleted')
            } else if (response.status === 201) {
                setButtonState('completed')
            } else {
                const data = await response.json()
                setErrorMessage(data.error || 'An error occurred')
                setButtonState('error')
            }
        } catch (error) {
            console.error('Error marking lesson as completed:', error)
            setErrorMessage('Network error occurred')
            setButtonState('error')
        }
    }

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
                            <button onClick={() => router.push('/')}>Return Home</button>
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
                            <button onClick={() => router.push('/')}>Return Home</button>
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

                <div className="content-box">
                    <div className="actions">
                        {buttonState === 'default' && (
                            <button onClick={handleMarkAsCompleted}>Mark as Completed</button>
                        )}
                        {buttonState === 'loading' && (
                            <button disabled>Processing...</button>
                        )}
                        {buttonState === 'alreadyCompleted' && (
                            <span className="status-text">Lesson already completed</span>
                        )}
                        {buttonState === 'completed' && (
                            <span className="status-text">Lesson updated as completed</span>
                        )}
                        {buttonState === 'error' && (
                            <span className="error-text">{errorMessage}</span>
                        )}
                        <button onClick={() => router.push('/')} className="secondary-button">Back to Home</button>
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