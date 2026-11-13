import { useState } from "react";
import { quarterRange } from "main/utils/quarterUtilities";
import { useSystemInfo } from "main/utils/systemInfo";
import SingleQuarterDropdown from "main/components/Quarters/SingleQuarterDropdown";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { useBackend } from "main/utils/useBackend";

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
  return (
    <BasicLayout>
      <div className="pt-2">
        <h5>UCSB Course Enrollment History Search</h5>
        <Form>
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
                  <Form.Control as="select">
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
                  <Form.Control />
                  <Form.Text muted>
                    {
                      "For example: '16' or '130A'; omit the subject area prefix."
                    }
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Row className="my-2">
              <Col md="auto">
                <Button variant="primary" type="button">
                  Submit
                </Button>
              </Col>
            </Row>
            <Row>
              <p>This feature not yet implemented; coming soon!</p>
            </Row>
          </Container>
        </Form>
      </div>
    </BasicLayout>
  );
}
