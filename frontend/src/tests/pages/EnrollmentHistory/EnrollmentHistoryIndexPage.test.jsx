import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import EnrollmentHistoryIndexPage from "main/pages/EnrollmentHistory/EnrollmentHistoryIndexPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { ucsbSubjectsFixtures } from "fixtures/ucsbSubjectsFixtures";

describe("EnrollmentHistoryIndexPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  let queryClient;

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    axiosMock.reset();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/UCSBSubjects/all")
      .reply(200, ucsbSubjectsFixtures.threeSubjects);
  });

  afterEach(() => {
    queryClient.clear();
  });

  afterAll(() => {
    axiosMock.restore();
  });

  test("renders the initial page and form", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        name: "UCSB Course Enrollment History Search",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Subject Area")).toBeInTheDocument();
    expect(screen.getByLabelText("Course Number")).toHaveAttribute(
      "placeholder",
      "e.g. 16 or 130A; omit subject prefix",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();

    expect(
      await screen.findByRole("option", { name: "GEOG - Geography" }),
    ).toBeInTheDocument();
  });

  test("populates the subject dropdown from the UCSB subjects API", async () => {
    renderPage();

    const subjectDropdown = screen.getByRole("combobox", {
      name: "Subject Area",
    });
    expect(await within(subjectDropdown).findAllByRole("option")).toHaveLength(
      ucsbSubjectsFixtures.threeSubjects.length,
    );

    for (const subject of ucsbSubjectsFixtures.threeSubjects) {
      expect(
        within(subjectDropdown).getByRole("option", {
          name: `${subject.subjectCode} - ${subject.subjectTranslation}`,
        }),
      ).toHaveValue(subject.subjectCode);
    }
  });
});
