import { useState } from "react";
import { fromFormat, quarterRange } from "main/utils/quarterUtilities";
import EnrollmentHistoryGraph from "main/components/EnrollmentHistory/EnrollmentHistoryGraph";
import { useSystemInfo } from "main/utils/systemInfo";
import SingleQuarterDropdown from "main/components/Quarters/SingleQuarterDropdown";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Alert, Button, Col, Container, Form, Row } from "react-bootstrap";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { courseNumRegex } from "main/utils/courseNumberUtilities";
import { formatInstructors } from "main/utils/sectionUtils";

const courseHistoryUrl = "/api/public/courseovertime/search";

const lectureKey = (quarter, courseId, section) =>
  JSON.stringify([quarter, courseId?.trim(), section.slice(0, 2)]);

export default function EnrollmentHistoryIndexPage() {
  const { data: systemInfo } = useSystemInfo();
  const firstQtr = systemInfo?.startQtrYYYYQ || "20211";
  const lastQtr = systemInfo?.endQtrYYYYQ || "20214";
  const quarters = quarterRange(firstQtr, lastQtr);
  const [startQuarter, setStartQuarter] = useState(
    localStorage.getItem("EnrollmentHistorySearch.StartQuarter") || firstQtr,
  );
  const [endQuarter, setEndQuarter] = useState(
    // Stryker disable next-line ConditionalExpression : false is equivalent because SingleQuarterDropdown restores the saved quarter or defaults to the last quarter itself
    localStorage.getItem("EnrollmentHistorySearch.EndQuarter") || lastQtr,
  );
  const { data: subjects } = useBackend(
    // Stryker disable next-line all : don't test internal caching of React Query
    ["/api/UCSBSubjects/all"],
    {
      // Stryker disable next-line StringLiteral : GET is the default, so replacing with empty string is an equivalent mutation
      method: "GET",
      url: "/api/UCSBSubjects/all",
    },
    [],
  );
  const [validationError, setValidationError] = useState("");
  const [courseNumberError, setCourseNumberError] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState(null);
  const search = useBackendMutation(
    (params) => ({ url: "/api/enrollment/search", params }),
    {},
  );
  const { data: courseHistory } = useBackend(
    [courseHistoryUrl, submittedSearch],
    {
      // Stryker disable next-line StringLiteral : Axios defaults to GET.
      method: "GET",
      url: courseHistoryUrl,
      params: submittedSearch,
    },
    undefined,
    { enabled: search.isSuccess && search.data.length > 0 },
  );
  const metadataByLecture = new Map();
  courseHistory?.courses?.forEach(({ quarter, courseId, primary }) => {
    if (primary?.section?.endsWith("00")) {
      metadataByLecture.set(lectureKey(quarter, courseId, primary.section), {
        instructors: formatInstructors(primary.instructors),
        capacity: primary.maxEnroll,
      });
    }
  });
  const historyByLecture = new Map();
  for (const point of search.data ?? []) {
    const key = lectureKey(point.yyyyq, point.courseId, point.section);
    if (!historyByLecture.has(key)) {
      historyByLecture.set(key, []);
    }
    historyByLecture.get(key).push(point);
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    search.reset();
    setValidationError("");
    setCourseNumberError("");
    if (startQuarter > endQuarter) {
      setValidationError(
        "Start Quarter must be before or equal to End Quarter.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    const courseNumber = form.get("courseNumber").trim().toUpperCase();
    if (!courseNumber) {
      setCourseNumberError("Course Number is required.");
      return;
    }
    if (!courseNumRegex.test(courseNumber)) {
      setCourseNumberError(
        "Course number should be a 1 to 3 digit number, optionally followed by up to two letters.",
      );
      return;
    }
    setValidationError("");
    const params = {
      startQtr: startQuarter,
      endQtr: endQuarter,
      subjectArea: form.get("subjectArea"),
      courseNumber,
    };
    setSubmittedSearch(params);
    search.mutate(params);
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        <h5>UCSB Course Enrollment History Search</h5>
        <Form onSubmit={handleSubmit} noValidate>
          <Container>
            <Row>
              <Col md="auto">
                <SingleQuarterDropdown
                  quarters={quarters}
                  quarter={startQuarter}
                  setQuarter={setStartQuarter}
                  controlId="EnrollmentHistorySearch.StartQuarter"
                  label="Start Quarter"
                />
              </Col>
              <Col md="auto">
                <SingleQuarterDropdown
                  quarters={quarters}
                  quarter={endQuarter}
                  setQuarter={setEndQuarter}
                  controlId="EnrollmentHistorySearch.EndQuarter"
                  label="End Quarter"
                />
              </Col>
              <Col md="auto">
                <Form.Group controlId="EnrollmentHistorySearch.Subject">
                  <Form.Label>Subject Area</Form.Label>
                  <Form.Control as="select" name="subjectArea" required>
                    {subjects.map((subject) => (
                      <option
                        key={subject.subjectCode}
                        value={subject.subjectCode}
                      >
                        {subject.subjectCode} - {subject.subjectTranslation}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="EnrollmentHistorySearch.CourseNumber">
                  <Form.Label>Course Number</Form.Label>
                  <Form.Control
                    name="courseNumber"
                    required
                    isInvalid={Boolean(courseNumberError)}
                    aria-invalid={Boolean(courseNumberError)}
                    aria-describedby="EnrollmentHistorySearch.CourseNumber.Feedback"
                  />
                  <Form.Text muted>
                    {
                      "For example: '16' or '130A'; omit the subject area prefix."
                    }
                  </Form.Text>
                  {courseNumberError && (
                    <Form.Control.Feedback
                      type="invalid"
                      id="EnrollmentHistorySearch.CourseNumber.Feedback"
                      role="alert"
                    >
                      {courseNumberError}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>
            <Row className="my-2">
              <Col md="auto">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={search.isLoading || subjects.length === 0}
                >
                  Submit
                </Button>
              </Col>
            </Row>
          </Container>
        </Form>
        {validationError && <Alert variant="danger">{validationError}</Alert>}
        {search.isLoading && <p role="status">Loading enrollment history...</p>}
        {search.isError && (
          <Alert variant="danger">
            Unable to load enrollment history. Please try again.
          </Alert>
        )}
        {search.isSuccess && search.data.length === 0 && (
          <Alert variant="info" role="status">
            No matching enrollment history is available for the selected
            criteria.
          </Alert>
        )}
        {[...historyByLecture.keys()].sort().map((key) => {
          const data = historyByLecture.get(key);
          const quarter = fromFormat(data[0].yyyyq);
          const { instructors, capacity } = metadataByLecture.get(key) ?? {};
          const title = instructors ? `${quarter} - ${instructors}` : quarter;
          return (
            <EnrollmentHistoryGraph
              key={key}
              title={title}
              data={data}
              lectureCapacity={capacity}
            />
          );
        })}
      </div>
    </BasicLayout>
  );
}
