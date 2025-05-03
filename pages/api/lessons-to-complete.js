// pages/api/lessons-to-complete.js
export default async function handler(req, res) {
    const { enrollment_id } = req.query;

    // Return 400 if enrollment_id is not provided
    if (!enrollment_id) {
        return res.status(400).json({
            error: "Missing required parameter: enrollment_id"
        });
    }

    try {
        const headers = {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DIRECTUS_API_TOKEN}`
        };

        // First, get the enrollment to find the course_id
        const enrollmentUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_enrollments/${enrollment_id}?fields=id,course.id`;
        const enrollmentResponse = await fetch(enrollmentUrl, { headers });

        if (!enrollmentResponse.ok) {
            if (enrollmentResponse.status === 404) {
                return res.status(404).json({ error: "Enrollment not found" });
            }
            throw new Error(`Failed to fetch enrollment: ${enrollmentResponse.status} ${enrollmentResponse.statusText}`);
        }

        const { data: enrollment } = await enrollmentResponse.json();

        if (!enrollment || !enrollment.course) {
            return res.status(404).json({ error: "Enrollment or associated course not found" });
        }

        const course_id = enrollment.course.id;

        // Now fetch the course structure with the course_id, including sort fields
        const courseUrl = `${process.env.NEXT_PUBLIC_OPTICAL_API_ENDPOINT}/items/lms_courses/${course_id}?fields=id,title,modules.id,modules.title,modules.sort,modules.lessons.id,modules.lessons.title,modules.lessons.sort`;
        const courseResponse = await fetch(courseUrl, { headers });

        if (!courseResponse.ok) {
            if (courseResponse.status === 404) {
                return res.status(404).json({ error: "Course not found" });
            }
            throw new Error(`Failed to fetch course: ${courseResponse.status} ${courseResponse.statusText}`);
        }

        const { data: course } = await courseResponse.json();

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        // Format the response structure with sorting
        const formattedResponse = {
            id: course.id,
            title: course.title,
            modules: course.modules
                ? course.modules
                    // Sort modules by their sort field
                    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                    .map(module => ({
                        id: module.id,
                        title: module.title,
                        sort: module.sort || 0,
                        lessons: module.lessons
                            ? module.lessons
                                // Sort lessons by their sort field
                                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                                .map(lesson => ({
                                    id: lesson.id,
                                    title: lesson.title,
                                    sort: lesson.sort || 0
                                }))
                            : []
                    }))
                : []
        };

        return res.status(200).json(formattedResponse);
    } catch (error) {
        console.error('API error:', error);

        return res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
}