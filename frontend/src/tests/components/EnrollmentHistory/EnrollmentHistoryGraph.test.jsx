import { vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { enrollmentDataPointFixtures } from "fixtures/enrollmentDataPointFixtures";
import EnrollmentHistoryGraph from "main/components/EnrollmentHistory/EnrollmentHistoryGraph";
import {
  calculateTotalEnrollmentHistory,
  createEnrollmentHistoryChartData,
  formatDateCreated,
  formatEnrollmentTooltip,
  getEnrollmentSeriesKey,
  getEnrollmentSeriesLabel,
} from "main/components/EnrollmentHistory/EnrollmentHistoryHelper";

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

global.ResizeObserver = ResizeObserver;

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

describe("EnrollmentHistoryGraph tests", () => {
  test("formats data point series details", () => {
    const dataPoint = enrollmentDataPointFixtures.cmpsc130aLectureOverTime[0];

    expect(getEnrollmentSeriesKey(dataPoint)).toBe("07609-0100");
    expect(getEnrollmentSeriesLabel(dataPoint)).toBe("07609 - Section 0100");
    const [total] = calculateTotalEnrollmentHistory([dataPoint]);
    expect(getEnrollmentSeriesKey(total)).toBe("Total-All");
    expect(getEnrollmentSeriesLabel(total)).toBe("Total - Section All");
  });

  test("formats chart labels and tooltip values", () => {
    expect(formatDateCreated("2026-04-06T08:15:00.000000")).toBe("2026-04-06");
    expect(formatEnrollmentTooltip(32, "07609 - Section 0100")).toEqual([
      "Enrollment: 32",
      "07609 - Section 0100",
    ]);
    expect(formatEnrollmentTooltip(41, "Total - Section All")).toEqual([
      "Enrollment: 41",
      "Total - Section All",
    ]);
  });

  test("creates empty chart data when called with no argument", () => {
    expect(calculateTotalEnrollmentHistory()).toEqual([]);
    expect(calculateTotalEnrollmentHistory([])).toEqual([]);
    const expectedEmptyChartData = {
      chartData: [],
      series: [],
    };

    expect(createEnrollmentHistoryChartData()).toEqual(expectedEmptyChartData);
    expect(createEnrollmentHistoryChartData()).toEqual(
      createEnrollmentHistoryChartData([]),
    );
  });

  test("creates chart data for multiple sections over time", () => {
    const { chartData, series } = createEnrollmentHistoryChartData(
      enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime,
    );

    expect(series).toEqual([
      { dataKey: "series0", name: "07609 - Section 0100" },
      { dataKey: "series1", name: "07617 - Section 0101" },
      { dataKey: "series2", name: "07625 - Section 0102" },
      { dataKey: "series3", name: "Total - Section All" },
    ]);
    expect(chartData.filter((point) => point.series0 !== undefined)).toEqual([
      {
        dateCreated: "2026-04-13T08:15:00.000000",
        series0: 41,
        series1: 18,
        series2: 21,
      },
      {
        dateCreated: "2026-05-26T19:58:14.226209",
        series0: 48,
        series1: 24,
        series2: 27,
      },
    ]);

    const dataWithTotals = createEnrollmentHistoryChartData(
      enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime,
    );
    const totalSeries = dataWithTotals.series.find(
      (line) => line.name === "Total - Section All",
    );
    expect(totalSeries).toBeDefined();
    expect(dataWithTotals.series).toHaveLength(4);
    expect(
      dataWithTotals.chartData
        .filter((point) => point[totalSeries.dataKey] !== undefined)
        .map((point) => point[totalSeries.dataKey]),
    ).toEqual([41, 48]);
  });

  test("sorts chart data chronologically by date created", () => {
    const unsortedEnrollmentData = [
      {
        id: 1,
        yyyyq: "20262",
        enrollCd: "07609",
        courseId: "CMPSC   130A -1",
        section: "0100",
        enrollment: 30,
        dateCreated: "2026-05-03T08:15:00.000000",
      },
      {
        id: 2,
        yyyyq: "20262",
        enrollCd: "07609",
        courseId: "CMPSC   130A -1",
        section: "0100",
        enrollment: 10,
        dateCreated: "2026-05-01T08:15:00.000000",
      },
      {
        id: 3,
        yyyyq: "20262",
        enrollCd: "07609",
        courseId: "CMPSC   130A -1",
        section: "0100",
        enrollment: 20,
        dateCreated: "2026-05-02T08:15:00.000000",
      },
      {
        id: 4,
        yyyyq: "20262",
        enrollCd: "07609",
        courseId: "CMPSC   130A -1",
        section: "0100",
        enrollment: 15,
        dateCreated: "2026-05-01T06:00:00.000000",
      },
    ];

    const { chartData } = createEnrollmentHistoryChartData(
      unsortedEnrollmentData,
    );

    // Check full timestamps, including the order of snapshots on the same day.
    expect(chartData.map((point) => point.dateCreated)).toEqual([
      "2026-05-01",
      "2026-05-01T06:00:00.000000",
      "2026-05-01T08:15:00.000000",
      "2026-05-02",
      "2026-05-02T08:15:00.000000",
      "2026-05-03",
      "2026-05-03T08:15:00.000000",
    ]);
    expect(
      chartData
        .filter((point) => point.series0 !== undefined)
        .map((dataPoint) => dataPoint.series0),
    ).toEqual([15, 10, 20, 30]);

    const dataWithTotals = createEnrollmentHistoryChartData(
      unsortedEnrollmentData,
    );
    const totalSeries = dataWithTotals.series.find(
      (line) => line.name === "Total - Section All",
    );
    expect(totalSeries).toBeDefined();
    expect(dataWithTotals.series).toHaveLength(2);
    expect(
      dataWithTotals.chartData
        .filter((point) => point[totalSeries.dataKey] !== undefined)
        .map((point) => point[totalSeries.dataKey]),
    ).toEqual([10, 20, 30]);

    expect(
      calculateTotalEnrollmentHistory(unsortedEnrollmentData).map((point) => ({
        dateCreated: point.dateCreated,
        enrollment: point.enrollment,
      })),
    ).toEqual([
      { dateCreated: "2026-05-01", enrollment: 10 },
      { dateCreated: "2026-05-02", enrollment: 20 },
      { dateCreated: "2026-05-03", enrollment: 30 },
    ]);
  });

  test("creates section and total series across multiple quarters", () => {
    const { chartData, series } = createEnrollmentHistoryChartData(
      enrollmentDataPointFixtures.cmpsc130aMultipleQuarters,
    );

    expect(series).toEqual([
      { dataKey: "series0", name: "07609 - Section 0100" },
      { dataKey: "series1", name: "Total - Section All" },
    ]);
    expect(
      chartData
        .filter((point) => point.series0 !== undefined)
        .map((dataPoint) => dataPoint.series0),
    ).toEqual([62, 54, 48]);

    const dataWithTotals = createEnrollmentHistoryChartData(
      enrollmentDataPointFixtures.cmpsc130aMultipleQuarters,
    );
    const totalSeries = dataWithTotals.series.find(
      (line) => line.name === "Total - Section All",
    );
    expect(totalSeries).toBeDefined();
    expect(dataWithTotals.series).toHaveLength(2);
    expect(
      dataWithTotals.chartData
        .filter((point) => point[totalSeries.dataKey] !== undefined)
        .map((point) => point[totalSeries.dataKey]),
    ).toEqual([62, 54, 48]);
  });

  test("calculates total values for multiple sections over time", () => {
    const totals = calculateTotalEnrollmentHistory(
      enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime,
    );

    // Only lecture 0100 contributes; discussions 0101 and 0102 are excluded.
    expect(totals).toEqual([
      {
        dateCreated: "2026-04-13",
        enrollCd: "Total",
        section: "All",
        enrollment: 41,
      },
      {
        dateCreated: "2026-05-26",
        enrollCd: "Total",
        section: "All",
        enrollment: 48,
      },
    ]);
  });

  test("totals multiple lectures on the same day using their latest snapshots", () => {
    const data = enrollmentDataPointFixtures.cmpsc130aMultipleLecturesSameDay;

    // Use the latest 0100 snapshot (48), add lecture 0200 (30), and skip discussion 0101.
    expect(calculateTotalEnrollmentHistory(data)).toEqual([
      {
        dateCreated: "2026-04-13",
        enrollCd: "Total",
        section: "All",
        enrollment: 78,
      },
    ]);

    const { chartData, series } = createEnrollmentHistoryChartData(data);
    const totalSeries = series.find(
      (line) => line.name === "Total - Section All",
    );
    expect(totalSeries).toBeDefined();
    expect(
      chartData
        .filter((point) => point[totalSeries.dataKey] !== undefined)
        .map((point) => point[totalSeries.dataKey]),
    ).toEqual([78]);
  });

  test("renders the latest daily snapshots even when input timestamps are out of order", () => {
    const base = enrollmentDataPointFixtures.cmpsc130aLectureOverTime[0];
    const latest = {
      ...base,
      enrollment: 48,
      dateCreated: "2026-04-13T12:00:00.000000",
    };
    const earlier = {
      ...base,
      enrollment: 10,
      dateCreated: "2026-04-13T08:00:00.000000",
    };
    const nextDay = {
      ...base,
      enrollment: 30,
      dateCreated: "2026-04-14T08:00:00.000000",
    };
    const lastDay = {
      ...base,
      enrollment: 70,
      dateCreated: "2026-04-15T08:00:00.000000",
    };
    // Put the older snapshot after the newer one to expose missing sorting.
    const { container } = render(
      <EnrollmentHistoryGraph data={[lastDay, latest, earlier, nextDay]} />,
    );

    // Navigate the rendered chart and check the section and total tooltip values.
    const chart = screen.getByRole("application");
    fireEvent.focus(chart);
    expect(
      container.querySelector(".recharts-tooltip-label"),
    ).toHaveTextContent("2026-04-13");
    expect(screen.getAllByText("Enrollment: 48")).toHaveLength(2);
    fireEvent.keyDown(chart, { key: "ArrowRight", code: "ArrowRight" });
    expect(
      container.querySelector(".recharts-tooltip-label"),
    ).toHaveTextContent("2026-04-14");
    expect(screen.getAllByText("Enrollment: 30")).toHaveLength(2);
    fireEvent.keyDown(chart, { key: "ArrowRight", code: "ArrowRight" });
    expect(
      container.querySelector(".recharts-tooltip-label"),
    ).toHaveTextContent("2026-04-15");
    expect(screen.getAllByText("Enrollment: 70")).toHaveLength(2);

    expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2);
  });

  test("renders with the default title and no data", () => {
    const { container } = render(<EnrollmentHistoryGraph />);

    expect(screen.getByTestId("enrollment-history-graph")).toBeInTheDocument();
    expect(screen.getByText("Enrollment History")).toBeInTheDocument();
    expect(
      screen.queryByText("undefined - Section undefined"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Total - Section All")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(0);
  });

  test("renders multiple section lines and legend labels", () => {
    const sections =
      enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime;

    const { container } = render(
      <EnrollmentHistoryGraph
        data={sections}
        title="CMPSC 130A Section Enrollment Over Time"
      />,
    );

    expect(
      screen.getByText("CMPSC 130A Section Enrollment Over Time"),
    ).toBeInTheDocument();

    expect(screen.getByText("07609 - Section 0100")).toBeInTheDocument();
    expect(screen.getByText("07617 - Section 0101")).toBeInTheDocument();
    expect(screen.getByText("07625 - Section 0102")).toBeInTheDocument();
    expect(screen.getByText("Total - Section All")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(4);
    const totalCurve = container.querySelector(
      '.recharts-line-curve[stroke="#000000"]',
    );
    expect(totalCurve).toBeInTheDocument();
    const sectionCurves = Array.from(
      container.querySelectorAll(
        '.recharts-line-curve:not([stroke="#000000"])',
      ),
    );
    expect(sectionCurves).toHaveLength(3);
    sectionCurves.forEach((curve) => {
      expect(Number(totalCurve.getAttribute("stroke-width"))).toBeGreaterThan(
        Number(curve.getAttribute("stroke-width")),
      );
    });
  });
});
