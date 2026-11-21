import { vi } from "vitest";
import * as systemInfoModule from "main/utils/systemInfo";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import EnrollmentHistoryIndexPage from "main/pages/EnrollmentHistory/EnrollmentHistoryIndexPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { ucsbSubjectsFixtures } from "fixtures/ucsbSubjectsFixtures";

import userEvent from "@testing-library/user-event";

vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ height, children }) => (
      <original.ResponsiveContainer width={800} height={height}>
        {children}
      </original.ResponsiveContainer>
    ),
  };
});

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
    mockToast.mockClear();
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
    axiosMock.onGet("/api/public/courseovertime/search").reply(200, []);
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
      screen.queryByTestId("enrollment-history-graph"),
    ).not.toBeInTheDocument();
    expect(axiosMock.history.get.map(({ url }) => url)).not.toContain(
      "/api/public/courseovertime/search",
    );
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
      screen.queryByTestId("enrollment-history-graph"),
    ).not.toBeInTheDocument();
  });

  test.each([
    ["empty", 200],
    ["failed", 500],
  ])(
    "keeps the enrollment graph visible while instructor lookup is pending and after an %s result",
    async (_result, status) => {
      const courseHistoryUrl = "/api/public/courseovertime/search";
      let resolveCourseHistory;
      axiosMock.onGet(courseHistoryUrl).reply(
        () =>
          new Promise((resolve) => {
            resolveCourseHistory = resolve;
          }),
      );
      axiosMock.onGet("/api/enrollment/search").reply(200, [
        {
          yyyyq: "20262",
          courseId: "GEOG 16",
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
      await userEvent.type(screen.getByLabelText("Course Number"), "16");
      await userEvent.click(screen.getByRole("button", { name: "Submit" }));

      const graph = await screen.findByTestId("enrollment-history-graph");
      await waitFor(() => expect(resolveCourseHistory).toBeDefined());
      expect(queryClient.isFetching([courseHistoryUrl])).toBe(1);
      expect(
        within(graph).getByRole("heading", { name: "SPRING 2026" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Loading enrollment history..."),
      ).not.toBeInTheDocument();

      await act(async () => {
        resolveCourseHistory([status, []]);
      });
      await waitFor(() =>
        expect(queryClient.isFetching([courseHistoryUrl])).toBe(0),
      );
      expect(
        within(graph).getByRole("heading", { name: "SPRING 2026" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/No matching enrollment history/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Unable to load enrollment history/),
      ).not.toBeInTheDocument();
      if (status === 500) {
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining(courseHistoryUrl),
        );
      } else {
        expect(mockToast).not.toHaveBeenCalled();
      }
    },
  );

  test("graphs each lecture and its discussion sections with the lecture instructor", async () => {
    axiosMock.onGet("/api/public/courseovertime/search").reply(200, [
      {
        quarter: "20262",
        courseId: "GEOG 16A ",
        primary: {
          section: "0100",
          instructors: [{ instructor: "LEE A" }],
          maxEnroll: 120,
        },
      },
      {
        quarter: "20262",
        courseId: "GEOG 16A",
        primary: {
          section: "0200",
          instructors: [{ instructor: "PATEL B" }],
          maxEnroll: 80,
        },
      },
      {
        quarter: "20262",
        courseId: "GEOG 16A",
        primary: {
          section: "0101",
          instructors: [{ instructor: "DISCUSSION TA" }],
          maxEnroll: 25,
        },
      },
      { quarter: "20262", courseId: "GEOG 16A", primary: null },
      { quarter: "20262", courseId: "GEOG 16A", primary: {} },
    ]);
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
      {
        id: 2,
        yyyyq: "20261",
        courseId: "GEOG 16A",
        enrollCd: "07608",
        section: "0100",
        enrollment: 28,
        dateCreated: "2026-01-05",
      },
      {
        id: 3,
        yyyyq: "20262",
        courseId: "GEOG 16A",
        enrollCd: "07610",
        section: "0101",
        enrollment: 35,
        dateCreated: "2026-04-07",
      },
      {
        id: 4,
        yyyyq: "20262",
        courseId: "GEOG 16A",
        enrollCd: "07611",
        section: "0200",
        enrollment: 20,
        dateCreated: "2026-04-07",
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
    const graphs = await screen.findAllByTestId("enrollment-history-graph");
    expect(graphs).toHaveLength(3);
    expect(
      within(graphs[0]).getByRole("heading", {
        name: "WINTER 2026",
      }),
    ).toBeInTheDocument();
    expect(
      await within(graphs[1]).findByRole("heading", {
        name: "SPRING 2026 - LEE A",
      }),
    ).toBeInTheDocument();
    expect(
      within(graphs[2]).getByRole("heading", {
        name: "SPRING 2026 - PATEL B",
      }),
    ).toBeInTheDocument();
    expect(
      within(graphs[0]).queryByText(/Lecture capacity/),
    ).not.toBeInTheDocument();
    expect(
      await within(graphs[1]).findByText("Lecture capacity: 120"),
    ).toBeInTheDocument();
    expect(
      await within(graphs[2]).findByText("Lecture capacity: 80"),
    ).toBeInTheDocument();
    expect(
      within(graphs[1]).getByText("07609 - Section 0100"),
    ).toBeInTheDocument();
    expect(
      within(graphs[1]).getByText("07610 - Section 0101"),
    ).toBeInTheDocument();
    expect(
      within(graphs[1]).queryByText("07611 - Section 0200"),
    ).not.toBeInTheDocument();
    expect(
      within(graphs[2]).getByText("07611 - Section 0200"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No matching enrollment history/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading enrollment history..."),
    ).not.toBeInTheDocument();
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
      screen.queryByTestId("enrollment-history-graph"),
    ).not.toBeInTheDocument();
    expect(
      axiosMock.history.get.some(({ url }) => url === "/api/enrollment/search"),
    ).toBe(false);
  });

  test.each([
    [[]],
    [
      [
        {
          yyyyq: "20262",
          section: "0100",
          enrollment: 32,
          dateCreated: "2026-04-06",
        },
      ],
    ],
  ])(
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
        screen.queryByTestId("enrollment-history-graph"),
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
          await screen.findByTestId("enrollment-history-graph"),
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

  test.each(["CS130A", "ABC", "1234", "16ABC", "16 A", "16!", "-16", "1.5"])(
    "rejects invalid course number %s before requesting enrollment history",
    async (courseNumber) => {
      axiosMock.onGet("/api/enrollment/search").reply(200, []);
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <EnrollmentHistoryIndexPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByRole("option", { name: "GEOG - Geography" });
      const input = screen.getByLabelText("Course Number");
      await userEvent.type(input, courseNumber);
      await userEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveClass("is-invalid");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Course number should be a 1 to 3 digit number, optionally followed by up to two letters.",
      );
      expect(
        axiosMock.history.get.some(
          ({ url }) => url === "/api/enrollment/search",
        ),
      ).toBe(false);

      await userEvent.clear(input);
      await userEvent.type(input, " 130ab ");
      await userEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(
        await screen.findByText(/No matching enrollment history/),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(input).not.toHaveClass("is-invalid");
      expect(
        axiosMock.history.get.find(
          ({ url }) => url === "/api/enrollment/search",
        ).params.courseNumber,
      ).toBe("130AB");
    },
  );

  test.each(["", "   "])(
    "rejects empty or whitespace-only course number %j and clears validation after correction",
    async (courseNumber) => {
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
      if (courseNumber) await userEvent.type(enterCourseNumber, courseNumber);
      await userEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Course Number is required.",
      );
      expect(
        axiosMock.history.get.some(
          ({ url }) => url === "/api/enrollment/search",
        ),
      ).toBe(false);
      await userEvent.clear(enterCourseNumber);
      await userEvent.type(enterCourseNumber, "16");
      await userEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(
        await screen.findByText(/No matching enrollment history/),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );
});
