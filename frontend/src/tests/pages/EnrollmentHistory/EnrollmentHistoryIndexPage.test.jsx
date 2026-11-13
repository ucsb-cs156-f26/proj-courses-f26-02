import { vi } from "vitest";
import * as systemInfoModule from "main/utils/systemInfo";
import { act, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import EnrollmentHistoryIndexPage from "main/pages/EnrollmentHistory/EnrollmentHistoryIndexPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { ucsbSubjectsFixtures } from "fixtures/ucsbSubjectsFixtures";

import userEvent from "@testing-library/user-event";

const mockToast = vi.fn();
vi.mock("react-toastify", async () => {
  const originalModule = await vi.importActual("react-toastify");
  return {
    __esModule: true,
    ...originalModule,
    toast: (x) => mockToast(x),
  };
});

describe("EnrollmentHistoryIndexPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  let queryClient;

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

  test("renders without crashing and displays the search form", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

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
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

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
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
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
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <EnrollmentHistoryIndexPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
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
    vi.spyOn(systemInfoModule, "useSystemInfo").mockReturnValue({
      data: { startQtrYYYYQ: "20254", endQtrYYYYQ: "20262" },
    });
    localStorage.setItem("EnrollmentHistorySearch.StartQuarter", "20261");
    localStorage.setItem("EnrollmentHistorySearch.EndQuarter", "20261");
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const start = screen.getByLabelText("Start Quarter");
    const end = screen.getByLabelText("End Quarter");
    expect(start).toHaveValue("20261");
    expect(end).toHaveValue("20261");
    await userEvent.selectOptions(start, "20254");
    await userEvent.selectOptions(end, "20262");
    expect(start).toHaveValue("20254");
    expect(end).toHaveValue("20262");
    expect(localStorage.getItem("EnrollmentHistorySearch.StartQuarter")).toBe(
      "20254",
    );
    expect(localStorage.getItem("EnrollmentHistorySearch.EndQuarter")).toBe(
      "20262",
    );
    unmount();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Start Quarter")).toHaveValue("20254");
    expect(screen.getByLabelText("End Quarter")).toHaveValue("20262");
  });
  test("displays no matching enrollment history message when search returns empty results", async () => {
    axiosMock.onGet("/api/enrollment/search").reply(200, []);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: "GEOG - Geography" });
    await userEvent.type(screen.getByLabelText("Course Number"), "16");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText(
        "No matching enrollment history is available for the selected criteria.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Enrollment history search results"),
    ).not.toBeInTheDocument();
  });

  test("displays an error message when search fails", async () => {
    axiosMock.onGet("/api/enrollment/search").reply(500, []);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: "GEOG - Geography" });
    await userEvent.type(screen.getByLabelText("Course Number"), "16");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText(
        "Unable to load enrollment history. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Enrollment history search results"),
    ).not.toBeInTheDocument();
  });

  test("calls enrollment search api correctly and displays the response", async () => {
    axiosMock.onGet("/api/enrollment/search").reply(200, [
      {
        id: 1,
        yyyyq: "20262",
        courseId: "GEOG 16A",
        enrollCd: "07609",
        section: "0100",
        enrollment: 32,
        dateCreated: "2026-04-06",
      },
    ]);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("option", { name: "GEOG - Geography" });
    expect(
      axiosMock.history.get.some(({ url }) => url === "/api/enrollment/search"),
    ).toBe(false);
    await userEvent.selectOptions(
      screen.getByLabelText("Subject Area"),
      "GEOG",
    );
    await userEvent.type(screen.getByLabelText("Course Number"), " 16a ");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const response = await screen.findByLabelText(
      "Enrollment history search results",
    );
    expect(
      screen.queryByText(/No matching enrollment history/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading enrollment history..."),
    ).not.toBeInTheDocument();
    expect(JSON.parse(response.textContent)).toEqual([
      {
        id: 1,
        yyyyq: "20262",
        courseId: "GEOG 16A",
        enrollCd: "07609",
        section: "0100",
        enrollment: 32,
        dateCreated: "2026-04-06",
      },
    ]);
    expect(
      axiosMock.history.get.find(({ url }) => url === "/api/enrollment/search")
        .params,
    ).toEqual({
      startQtr: screen.getByLabelText("Start Quarter").value,
      endQtr: screen.getByLabelText("End Quarter").value,
      subjectArea: "GEOG",
      courseNumber: "16A",
    });
  });
  test("does not display search feedback before submitting and disables submit without subjects", async () => {
    axiosMock.onGet("/api/UCSBSubjects/all").reply(200, []);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading enrollment history..."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No matching enrollment history/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Enrollment history search results"),
    ).not.toBeInTheDocument();
    expect(
      axiosMock.history.get.some(({ url }) => url === "/api/enrollment/search"),
    ).toBe(false);
  });

  test.each([[[]], [[{ id: 1, enrollment: 32 }]]])(
    "shows loading feedback until the response arrives: %j",
    async (results) => {
      let resolveSearch;
      axiosMock.onGet("/api/enrollment/search").reply(
        () =>
          new Promise((resolve) => {
            resolveSearch = resolve;
          }),
      );
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <EnrollmentHistoryIndexPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await screen.findByRole("option", { name: "GEOG - Geography" });
      const submitButton = screen.getByRole("button", { name: "Submit" });
      expect(submitButton).toBeEnabled();
      await userEvent.type(screen.getByLabelText("Course Number"), "16");
      await userEvent.click(submitButton);
      expect(
        await screen.findByText("Loading enrollment history..."),
      ).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(
        screen.queryByText(/No matching enrollment history/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Enrollment history search results"),
      ).not.toBeInTheDocument();
      await act(async () => {
        resolveSearch([200, results]);
      });
      if (results.length === 0) {
        expect(
          await screen.findByText(/No matching enrollment history/),
        ).toBeInTheDocument();
      } else {
        expect(
          await screen.findByLabelText("Enrollment history search results"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/No matching enrollment history/),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.queryByText("Loading enrollment history..."),
      ).not.toBeInTheDocument();
      expect(submitButton).toBeEnabled();
    },
  );

  test("rejects reversed quarter ranges and clears validation when corrected to the same quarter", async () => {
    axiosMock.onGet("/api/enrollment/search").reply(200, []);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("option", { name: "GEOG - Geography" });
    await userEvent.selectOptions(
      screen.getByLabelText("Start Quarter"),
      "20214",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("End Quarter"),
      "20211",
    );
    await userEvent.type(screen.getByLabelText("Course Number"), "16");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Start Quarter must be before or equal to End Quarter.",
    );
    expect(
      axiosMock.history.get.some(({ url }) => url === "/api/enrollment/search"),
    ).toBe(false);
    await userEvent.selectOptions(
      screen.getByLabelText("End Quarter"),
      "20214",
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText(/No matching enrollment history/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      axiosMock.history.get.find(({ url }) => url === "/api/enrollment/search")
        .params,
    ).toMatchObject({ startQtr: "20214", endQtr: "20214" });
  });

  test("rejects whitespace-only course numbers and clears validation after correction", async () => {
    axiosMock.onGet("/api/enrollment/search").reply(200, []);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EnrollmentHistoryIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("option", { name: "GEOG - Geography" });
    const enterCourseNumber = screen.getByLabelText("Course Number");
    await userEvent.type(enterCourseNumber, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a course number.",
    );
    expect(
      axiosMock.history.get.some(({ url }) => url === "/api/enrollment/search"),
    ).toBe(false);
    await userEvent.clear(enterCourseNumber);
    await userEvent.type(enterCourseNumber, "16");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText(/No matching enrollment history/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
