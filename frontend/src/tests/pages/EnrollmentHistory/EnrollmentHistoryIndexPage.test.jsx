import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import * as systemInfoModule from "main/utils/systemInfo";
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
    localStorage.clear();
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
    vi.restoreAllMocks();
    localStorage.clear();
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
    expect(screen.getByLabelText("Course Number")).toBeInTheDocument();
    expect(
      screen.getByText(
        "For example: '16' or '130A'; omit the subject area prefix.",
      ),
    ).toBeInTheDocument();
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
  test("uses the configured quarter range and defaults to its first and last quarters", () => {
    vi.spyOn(systemInfoModule, "useSystemInfo").mockReturnValue({
      data: { startQtrYYYYQ: "20254", endQtrYYYYQ: "20262" },
    });
    renderPage();
    const start = screen.getByLabelText("Start Quarter");
    const end = screen.getByLabelText("End Quarter");
    for (const dropdown of [start, end]) {
      expect(
        within(dropdown)
          .getAllByRole("option")
          .map((option) => [option.value, option.textContent]),
      ).toEqual([
        ["20254", "F25"],
        ["20261", "W26"],
        ["20262", "S26"],
      ]);
    }
    expect(start).toHaveValue("20254");
    expect(end).toHaveValue("20262");
  });

  test.each([undefined, {}])(
    "uses fallback quarters when system info is %s",
    (data) => {
      vi.spyOn(systemInfoModule, "useSystemInfo").mockReturnValue({ data });
      renderPage();
      const start = screen.getByLabelText("Start Quarter");
      const end = screen.getByLabelText("End Quarter");
      expect(start).toHaveValue("20211");
      expect(end).toHaveValue("20214");
      for (const dropdown of [start, end]) {
        expect(
          within(dropdown)
            .getAllByRole("option")
            .map((option) => option.value),
        ).toEqual(["20211", "20212", "20213", "20214"]);
      }
    },
  );

  test("restores saved quarter selections and remembers changes after remounting", async () => {
    const user = userEvent.setup();
    vi.spyOn(systemInfoModule, "useSystemInfo").mockReturnValue({
      data: { startQtrYYYYQ: "20254", endQtrYYYYQ: "20262" },
    });
    localStorage.setItem("EnrollmentHistorySearch.StartQuarter", "20261");
    localStorage.setItem("EnrollmentHistorySearch.EndQuarter", "20261");
    const { unmount } = renderPage();
    const start = screen.getByLabelText("Start Quarter");
    const end = screen.getByLabelText("End Quarter");
    expect(start).toHaveValue("20261");
    expect(end).toHaveValue("20261");
    await user.selectOptions(start, "20254");
    await user.selectOptions(end, "20262");
    expect(start).toHaveValue("20254");
    expect(end).toHaveValue("20262");
    expect(localStorage.getItem("EnrollmentHistorySearch.StartQuarter")).toBe(
      "20254",
    );
    expect(localStorage.getItem("EnrollmentHistorySearch.EndQuarter")).toBe(
      "20262",
    );
    unmount();
    renderPage();
    expect(screen.getByLabelText("Start Quarter")).toHaveValue("20254");
    expect(screen.getByLabelText("End Quarter")).toHaveValue("20262");
  });
});
