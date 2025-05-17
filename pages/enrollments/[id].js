import {useRouter} from 'next/router';
import Head from 'next/head';
import Link from "next/link";

export async function getServerSideProps(context) {
    const {id} = context.params;
    const {completed_lesson_id} = context.query;

    try {
        const baseUrl = process.env.PUBLIC_URL || "http://localhost:3000";
        const callbackUrl = `${baseUrl}/enrollments/${id}`;

        const headers = {'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}`};

        // 1. Fetch enrollment data
        const enrollmentUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_enrollments/${id}`;
        const enrollmentParams = {
            fields: [
                'id',
                'date_created',
                'date_updated',
                'percent_complete',
                'is_completed',
                'course.id',
                'course.title',
                'user_enrolled.first_name',
                'user_enrolled.last_name',
                'lessons_completed.lms_lessons_id.id',
                'lessons_completed.lms_lessons_id.title',
                'lessons_completed.lms_lessons_id.sort',
                'lessons_completed.lms_lessons_id.module.title',
                'lessons_completed.lms_lessons_id.module.id',
                'lessons_completed.lms_lessons_id.module.sort',
            ].join(','),
            sort: [
                'lessons_completed.lms_lessons_id.module.sort',
                'lessons_completed.lms_lessons_id.sort'
            ].join(',')
        };

        const queryString = new URLSearchParams(enrollmentParams).toString();
        const enrollmentResponse = await fetch(`${enrollmentUrl}?${queryString}`, {headers});
        if (!enrollmentResponse.ok) {
            throw new Error(`Failed to fetch enrollment: ${enrollmentUrl} ${enrollmentResponse.status} ${enrollmentResponse.statusText}`);
        }

        let {data: enrollment} = await enrollmentResponse.json();
        const completed_lesson_status = completed_lesson_id ? addLesson(enrollment, completed_lesson_id) : null;

        console.error(`###### 1 ${JSON.stringify(enrollment, null, 2)}`);

        // Refetch the data if added
        if (completed_lesson_status) {
            const enrollmentResponse = await fetch(`${enrollmentUrl}?${queryString}`, {headers});
            if (!enrollmentResponse.ok) {
                throw new Error(`Failed to fetch enrollment: ${enrollmentUrl} ${enrollmentResponse.status} ${enrollmentResponse.statusText}`);
            }
            let {data: enrollment} = await enrollmentResponse.json();
            console.error(JSON.stringify(enrollment, null, 2));
        }

        // Format completed lessons
        const completedLessons = enrollment.lessons_completed.map(item => ({
            id: item.lms_lessons_id.id,
            title: item.lms_lessons_id.title,
            sort: item.lms_lessons_id.sort,
            url: `${baseUrl}/lessons/${item.lms_lessons_id.id}?completed=true&callback=${encodeURIComponent(callbackUrl)}`,
            module: {
                id: item.lms_lessons_id.module.id,
                title: item.lms_lessons_id.module.title,
                sort: item.lms_lessons_id.module.sort
            }
        })).sort((a, b) => {
            const moduleSortDiff = a.module.sort - b.module.sort;
            if (moduleSortDiff !== 0) return moduleSortDiff;
            return a.sort - b.sort;
        });

        // 2. Fetch course structure with all lessons (formerly in lessons-to-complete.js)
        const course_id = enrollment.course.id;
        const courseUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_courses/${course_id}`;
        const courseParams = {
            fields: [
                'id',
                'title',
                'modules.id',
                'modules.title',
                'modules.sort',
                'modules.lessons.id',
                'modules.lessons.title',
                'modules.lessons.sort'
            ].join(',')
        };

        const courseQueryString = new URLSearchParams(courseParams).toString();
        const courseResponse = await fetch(`${courseUrl}?${courseQueryString}`, {headers});

        if (!courseResponse.ok) {
            throw new Error(`Failed to fetch course: ${courseResponse.status} ${courseResponse.statusText}`);
        }

        const {data: course} = await courseResponse.json();

        // Format course structure with proper sorting
        const formattedCourse = {
            id: course.id,
            title: course.title,
            modules: course.modules
                ? course.modules
                    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                    .map(module => ({
                        id: module.id,
                        title: module.title,
                        sort: module.sort || 0,
                        lessons: module.lessons
                            ? module.lessons
                                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                                .map(lesson => ({
                                    id: lesson.id,
                                    title: lesson.title,
                                    url: `${baseUrl}/lessons/${lesson.id}?completed=false&callback=${encodeURIComponent(callbackUrl)}`,
                                    sort: lesson.sort || 0
                                }))
                            : []
                    }))
                : []
        };

        // 3. Calculate progress statistics
        const totalLessonsCount = formattedCourse.modules?.reduce(
            (total, module) => total + module.lessons.length, 0
        ) || 0;

        const progressStats = {
            totalLessons: totalLessonsCount,
            completedCount: completedLessons.length,
            remainingCount: totalLessonsCount - completedLessons.length
        };

        return {
            props: {
                enrollment,
                completedLessons,
                lessonsToComplete: formattedCourse,
                progressStats,
                error: null,
                errorStatus: null,
                stack: null
            }
        };
    } catch (error) {
        console.error('Error in getServerSideProps:', error);
        return {
            props: {
                enrollment: null,
                completedLessons: [],
                lessonsToComplete: {modules: []},
                progressStats: {totalLessons: 0, completedCount: 0, remainingCount: 0},
                error: error.message || 'Failed to load enrollment data',
                errorStatus: error.status || 500,
                stack: process.env.NODE_ENV === 'development' ? error.stack : null
            }
        };
    }
}

// pages/api/add-lesson.js
export async function addLesson(enrollment, lessonId) {
    try {
        // Check if the lesson exists
        const lessonUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_lessons/${lessonId}`;
        const headers = {'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}`};

        const lessonResponse = await fetch(lessonUrl, {headers});
        if (!lessonResponse.ok) {
            return lessonResponse.status;
        }

        // Extract lesson IDs from the enrollment
        const completedLessonIds = enrollment.lessons_completed
            ? enrollment.lessons_completed
                .filter(lesson => lesson && lesson.lms_lessons_id)
                .map(lesson => lesson.lms_lessons_id.id)
            : [];

        // Check if lesson is already completed
        if (completedLessonIds.includes(lessonId)) {
            // Lesson already marked as completed - return 200 with no body
            return 200;
        }

        // Add lesson to completed lessons via Directus API
        const updatedLessonIds = [...completedLessonIds, lessonId];

        // Format the data for Directus junction collection
        const lessonCompletions = updatedLessonIds.map(id => ({
            lms_lessons_id: id
        }));

        // Update the enrollment with the new lessons_completed
        const updateUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_enrollments/${enrollment.id}`;
        const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lessons_completed: lessonCompletions
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Failed to update enrollment: ${updateResponse.status} ${updateResponse.statusText}`);
        }

        // Return 201 Created with the specified response format
        return 201;
    } catch (error) {
        console.error('API error:', error);
        return 500;
    }
}

export default function EnrollmentPage({
                                           enrollment,
                                           completedLessons,
                                           lessonsToComplete,
                                           progressStats,
                                           error,
                                           errorStatus,
                                           stack
                                       }) {
    const router = useRouter();

    // Conditional renders for fallback, error, and missing enrollment
    if (router.isFallback) {
        return (
            <div className="container">
                <Head><title>Loading Enrollment | Next.js Starter</title></Head>
                <main><h1>Loading...</h1></main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container">
                <Head><title>Error {errorStatus} | Next.js Starter</title></Head>
                <main>
                    <div className="content-box">
                        <h1>Error Loading Enrollment</h1>
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
        );
    }

    if (!enrollment) {
        return (
            <div className="container">
                <Head><title>Enrollment Not Found | Next.js Starter</title></Head>
                <main>
                    <div className="content-box">
                        <h1>Enrollment Not Found</h1>
                        <p>We couldn't find the enrollment you're looking for.</p>
                        <div className="actions">
                            <button onClick={() => router.push('/')}>Return Home</button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const studentName = enrollment.user_enrolled
        ? `${enrollment.user_enrolled.first_name} ${enrollment.user_enrolled.last_name}`
        : "Student";

    // Format dates
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Check if a lesson is completed
    const isLessonCompleted = (lessonId) => {
        return completedLessons.some(lesson => lesson.id === lessonId);
    };

    return (
        <div className="container">
            <Head>
                <title>Course Progress for {studentName} | Next.js Starter</title>
            </Head>
            <main className="left-aligned">
                <div className="content-box">
                    <h1>Course Progress for {studentName}</h1>
                </div>

                <div className="content-box">
                    <h2>Course Information</h2>
                    {enrollment.course && (
                        <p>Course: <strong>{enrollment.course.title}</strong></p>
                    )}
                    <p>Status: {enrollment.is_completed
                        ? <strong>Completed</strong>
                        : <strong>{enrollment.percent_complete}% complete</strong>}
                    </p>
                    <p>Date Created: <strong>{formatDate(enrollment.date_created)}</strong></p>
                    <p>Last Updated: <strong>{formatDate(enrollment.date_updated)}</strong></p>
                </div>

                {/* Progress Summary Block */}
                <div className="content-box">
                    <h2>Progress Summary</h2>
                    <div className="progress-summary">
                        <div className="progress-stat">
                            <div className="stat-number">{progressStats.totalLessons}</div>
                            <div className="stat-label">Total Lessons</div>
                        </div>
                        <div className="progress-stat">
                            <div className="stat-number">{progressStats.completedCount}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <div className="progress-stat">
                            <div className="stat-number">{progressStats.remainingCount}</div>
                            <div className="stat-label">Remaining</div>
                        </div>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{
                                    width: `${progressStats.totalLessons > 0 ?
                                        (progressStats.completedCount / progressStats.totalLessons) * 100 : 0}%`
                                }}
                            ></div>
                        </div>
                    </div>
                </div>

                <div className="content-box">
                    <h2>Completed Lessons</h2>
                    {completedLessons.length > 0 ? (
                        <div className="table-container">
                            <table className="lessons-table">
                                <thead>
                                <tr>
                                    <th className="module-cell">Module</th>
                                    <th className="lesson-cell">Lesson</th>
                                </tr>
                                </thead>
                                <tbody>
                                {completedLessons.map(lesson => (
                                    <tr key={lesson.id} className="lesson-row">
                                        <td className="module-cell">{lesson.module.title}</td>
                                        <td className="lesson-cell">
                                            <Link href={lesson.url} rel="prefetch">
                                                {lesson.title}
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>No lessons completed yet.</p>
                    )}
                </div>

                <div className="content-box">
                    <h2>Lessons to Complete</h2>
                    {lessonsToComplete.modules && lessonsToComplete.modules.length > 0 ? (
                        <div className="table-container">
                            <table className="lessons-table">
                                <thead>
                                <tr>
                                    <th className="module-cell">Module</th>
                                    <th className="lesson-cell">Lesson</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lessonsToComplete.modules.flatMap(module =>
                                    module.lessons
                                        .filter(lesson => !isLessonCompleted(lesson.id))
                                        .map(lesson => (
                                            <tr key={lesson.id} className="lesson-row">
                                                <td className="module-cell">{module.title}</td>
                                                <td className="lesson-cell">
                                                    <Link href={lesson.url} rel="prefetch">
                                                        {lesson.title}
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>All lessons completed!</p>
                    )}
                </div>

                <div className="content-box">
                    <div className="actions">
                        <button onClick={() => router.push('/')}>Back to Home</button>
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

                .table-container {
                    overflow-x: auto;
                }

                .lessons-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                    table-layout: fixed; /* This ensures the width settings are respected */
                }

                .lessons-table th {
                    background-color: #e0e0e0;
                    text-align: left;
                    padding: 0.75rem;
                    font-weight: 600;
                }

                .lessons-table td {
                    padding: 0.75rem;
                    border-bottom: 1px solid #e0e0e0;
                }

                .module-cell {
                    width: 40%; /* Module title column takes 40% of table width */
                }

                .lesson-cell {
                    width: 60%; /* Lesson title column takes 60% of table width */
                }

                .lesson-cell a {
                    cursor: pointer;
                    color: #0070f3;
                    text-decoration: none;
                }

                .lesson-cell a:hover {
                    text-decoration: underline;
                }

                .progress-summary {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 1rem;
                    gap: 1rem;
                }

                .progress-stat {
                    flex: 1;
                    text-align: center;
                    padding: 1rem;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                    min-width: 100px;
                }

                .stat-number {
                    font-size: 1.8rem;
                    font-weight: bold;
                    color: #0070f3;
                    margin-bottom: 0.5rem;
                }

                .stat-label {
                    font-size: 0.9rem;
                    color: #555;
                }

                .progress-bar-container {
                    width: 100%;
                    height: 12px;
                    background-color: #e0e0e0;
                    border-radius: 6px;
                    margin-top: 1rem;
                    overflow: hidden;
                }

                .progress-bar-fill {
                    height: 100%;
                    background-color: #0070f3;
                    border-radius: 6px;
                    transition: width 0.3s ease;
                }

                .actions {
                    margin-top: 1rem;
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
    );
}