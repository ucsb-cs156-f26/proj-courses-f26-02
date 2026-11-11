import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { useBackend } from "main/utils/useBackend";

export default function EnrollmentHistoryIndexPage() {
  const { data: subjects } = useBackend(
    ["/api/UCSBSubjects/all"],
    { method: "GET", url: "/api/UCSBSubjects/all" },
    [],
  );
  return (
    <BasicLayout>
      <div className="pt-2">
        <h5>UCSB Course Enrollment History Search</h5>
        <Form onSubmit={(event) => event.preventDefault()}>
          <Container>
            <Row>
              <Col md="auto">
                <Form.Group controlId="EnrollmentHistorySearch.Subject">
                  <Form.Label>Subject Area</Form.Label>
                  <Form.Select>
                    {subjects.map((subject) => (
                      <option
                        key={subject.subjectCode}
                        value={subject.subjectCode}
                      >
                        {subject.subjectCode} - {subject.subjectTranslation}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md="auto">
                <Form.Group controlId="EnrollmentHistorySearch.CourseNumber">
                  <Form.Label>Course Number</Form.Label>
                  <Form.Control
                    htmlSize={36}
                    placeholder="e.g. 16 or 130A; omit subject prefix"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row style={{ paddingTop: 10, paddingBottom: 10 }}>
              <Col md="auto">
                <Button variant="primary" type="button">
                  Submit
                </Button>
              </Col>
            </Row>
          </Container>
        </Form>
      </div>
    </BasicLayout>
  );
}
