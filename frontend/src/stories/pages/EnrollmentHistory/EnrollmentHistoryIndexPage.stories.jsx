import EnrollmentHistoryIndexPage from "main/pages/EnrollmentHistory/EnrollmentHistoryIndexPage";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { ucsbSubjectsFixtures } from "fixtures/ucsbSubjectsFixtures";
import { http, HttpResponse } from "msw";

export default {
  title: "pages/EnrollmentHistory/EnrollmentHistoryIndexPage",
  component: EnrollmentHistoryIndexPage,
};

const Template = () => <EnrollmentHistoryIndexPage />;

const sharedHandlers = [
  http.get("/api/systemInfo", () =>
    HttpResponse.json({
      ...systemInfoFixtures.showingBoth,
      startQtrYYYYQ: "20254",
      endQtrYYYYQ: "20262",
    }),
  ),
  http.get("/api/currentUser", () => new HttpResponse(null, { status: 403 })),
  http.get("/api/UCSBSubjects/all", () =>
    HttpResponse.json(ucsbSubjectsFixtures.threeSubjects),
  ),
];

export const Default = Template.bind({});
Default.parameters = {
  msw: sharedHandlers,
};
