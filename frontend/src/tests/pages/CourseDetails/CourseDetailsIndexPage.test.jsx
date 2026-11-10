import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import CourseDetailsIndexPage from "main/pages/CourseDetails/CourseDetailsIndexPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { personalSectionsFixtures } from "fixtures/personalSectionsFixtures";
import { oneQuarterCourse } from "fixtures/gradeHistoryFixtures";
import { enrollmentDataPointFixtures } from "fixtures/enrollmentDataPointFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async () => {
  const originalModule = await vi.importActual("react-toastify");
  return {
    __esModule: true,
    ...originalModule,
    toast: (x) => mockToast(x),
  };
});
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const originalModule = await vi.importActual("react-router-dom");
  return {
    __esModule: true,
    ...originalModule,
    useParams: () => ({
      qtr: "20221",
      enrollCode: "06619",
    }),
    Navigate: (x) => {
      mockNavigate(x);
      return null;
    },
  };
});

class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // Mock implementation of the observe method
  }
  unobserve() {
    // Mock implementation of the unobserve method
  }
  disconnect() {
    // Mock implementation of the disconnect method
  }
}

window.ResizeObserver = ResizeObserver;

vi.mock("recharts", async () => {
  const OriginalModule = await vi.importActual("recharts");

  return {
    ...OriginalModule,
    ResponsiveContainer: ({ height, children }) => (
      <OriginalModule.ResponsiveContainer width={800} height={height}>
        {children}
      </OriginalModule.ResponsiveContainer>
    ),
  };
});

describe("CourseDetailsIndexPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  const enrollmentHistoryWithOtherSections =
    enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime.map(
      (dataPoint) =>
        dataPoint.enrollCd === "07609"
          ? { ...dataPoint, enrollCd: "06619" }
          : dataPoint,
    );
  let queryClient;
  let enrollmentHistoryResponse;

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseDetailsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.spyOn(console, "error");
    console.error.mockImplementation(() => null);
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    enrollmentHistoryResponse = enrollmentHistoryWithOtherSections;
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/sections/sectionsearch", {
        params: { qtr: "20221", enrollCode: "06619" },
      })
      .reply(200, personalSectionsFixtures.singleSection);
    axiosMock
      .onGet("/api/public/finalsInfo", {
        params: { quarterYYYYQ: "20221", enrollCd: "06619" },
      })
      .reply(200, null);
    axiosMock
      .onGet("/api/gradehistory/search", {
        params: { subjectArea: "", courseNumber: "" },
      })
      .reply(200, []);
    axiosMock
      .onGet("/api/gradehistory/search", {
        params: { subjectArea: "CHEM", courseNumber: "184" },
      })
      .reply(200, oneQuarterCourse);
    axiosMock
      .onGet("/api/enrollment/search", {
        params: {
          startQtr: "20221",
          endQtr: "20221",
          subjectArea: "CHEM",
          courseNumber: "184",
        },
      })
      .reply(() => [200, enrollmentHistoryResponse]);
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  test("renders without crashing", () => {
    renderPage();
  });

  test("Calls UCSB Section Search api correctly and displays correct information", async () => {
    renderPage();

    expect(
      await screen.findByText("Course Details for CHEM 184 W22"),
    ).toBeInTheDocument();

    expect(screen.getByText("Enroll Code")).toBeInTheDocument();
    expect(screen.getByText("06619")).toBeInTheDocument();
    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("0100")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("CHEM LITERATURE")).toBeInTheDocument();
    expect(screen.getByText("Enrolled")).toBeInTheDocument();
    expect(screen.getByText("19/24")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("LIB 1312")).toBeInTheDocument();
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.getByText("T R")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM - 3:15 PM")).toBeInTheDocument();
  });

  test("Calls grade history api correctly and displays correct information", async () => {
    renderPage();

    expect(
      await screen.findByText("Fall 2009 - GONZALEZ T F"),
    ).toBeInTheDocument();
  });

  test("Calls enrollment history api correctly", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        axiosMock.history.get.some(
          (request) => request.url === "/api/enrollment/search",
        ),
      ).toBe(true);
    });

    const enrollmentHistoryRequest = axiosMock.history.get.find(
      (request) => request.url === "/api/enrollment/search",
    );

    expect(enrollmentHistoryRequest.params).toEqual({
      startQtr: "20221",
      endQtr: "20221",
      subjectArea: "CHEM",
      courseNumber: "184",
    });
  });

  test("passes returned enrollment history data to the graph", async () => {
    renderPage();

    expect(await screen.findByText("06619 - Section 0100")).toBeInTheDocument();
    expect(screen.getByText("Total - Section All")).toBeInTheDocument();
  });

  test("renders all returned sections alongside the total enrollment", async () => {
    renderPage();

    expect(await screen.findByText("06619 - Section 0100")).toBeInTheDocument();
    expect(screen.getByText("07617 - Section 0101")).toBeInTheDocument();
    expect(screen.getByText("07625 - Section 0102")).toBeInTheDocument();
    expect(screen.getByText("Total - Section All")).toBeInTheDocument();
  });

  test("renders every section in its palette color and the total in bold black", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("06619 - Section 0100")).toBeInTheDocument();
    expect(screen.getByText("Total - Section All")).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-line")).toHaveLength(4);
      const expectedLines = [
        { label: "06619 - Section 0100", color: "#8884d8", width: "2" },
        { label: "07617 - Section 0101", color: "#82ca9d", width: "2" },
        { label: "07625 - Section 0102", color: "#ffc658", width: "2" },
        { label: "Total - Section All", color: "#000000", width: "3" },
      ];
      const curves = container.querySelectorAll(".recharts-line-curve");
      expect(curves).toHaveLength(expectedLines.length);
      expectedLines.forEach(({ label, color, width }, index) => {
        expect(curves[index]).toHaveAttribute("stroke", color);
        expect(curves[index]).toHaveAttribute("stroke-width", width);
        expect(screen.getByText(label)).toHaveStyle({ color });
      });
      const totalCurve = container.querySelector(
        '.recharts-line-curve[stroke="#000000"]',
      );
      expect(totalCurve).toBeInTheDocument();
      const sectionCurves = container.querySelectorAll(
        '.recharts-line-curve:not([stroke="#000000"])',
      );
      expect(sectionCurves).toHaveLength(3);
      sectionCurves.forEach((curve) => {
        expect(Number(totalCurve.getAttribute("stroke-width"))).toBeGreaterThan(
          Number(curve.getAttribute("stroke-width")),
        );
      });
    });
  });

  test("renders enrollment history graph between course description and grade history", async () => {
    renderPage();

    const courseDescription = await screen.findByText("Course Description");
    const enrollmentHistoryGraph = await screen.findByTestId(
      "enrollment-history-graph",
    );
    const gradeHistoryGraphs = await screen.findByTestId(
      "grade-history-graphs",
    );

    expect(enrollmentHistoryGraph).toBeInTheDocument();
    expect(screen.getByText("Enrollment History")).toBeInTheDocument();
    expect(
      courseDescription.compareDocumentPosition(enrollmentHistoryGraph) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      enrollmentHistoryGraph.compareDocumentPosition(gradeHistoryGraphs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
