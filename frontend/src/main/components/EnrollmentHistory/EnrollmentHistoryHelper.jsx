// Stryker disable all: color choices are visual styling for chart series
export const lineColors = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088fe",
  "#00c49f",
  "#d62728",
  "#e377c2",
  "#8c564b",
  "#7f7f7f",
];
// Stryker restore all

export const getEnrollmentSeriesKey = (dataPoint) =>
  `${dataPoint.enrollCd}-${dataPoint.section}`;

export const getEnrollmentSeriesLabel = (dataPoint) =>
  `${dataPoint.enrollCd} - Section ${dataPoint.section}`;

export const formatDateCreated = (dateCreated) => dateCreated.slice(0, 10);

export const calculateTotalEnrollmentHistory = (data = []) => {
  // Sort a copy so later snapshots replace earlier ones without changing API data.
  const sortedData = [...data].sort((a, b) =>
    a.dateCreated.localeCompare(b.dateCreated),
  );
  const lecturesByDate = new Map();

  sortedData.forEach((point) => {
    // Count lectures only; discussions can contain the same students.
    if (!point.section.endsWith("00")) return;

    const date = formatDateCreated(point.dateCreated);
    if (!lecturesByDate.has(date)) lecturesByDate.set(date, new Map());

    // Keep only the latest enrollment for each lecture on this calendar day.
    lecturesByDate
      .get(date)
      .set(getEnrollmentSeriesKey(point), point.enrollment);
  });

  // Sum each day's lecture snapshots into one graph-compatible total point.
  const totalsByDate = new Map();
  lecturesByDate.forEach((lectures, date) => {
    totalsByDate.set(date, {
      dateCreated: date,
      enrollCd: "Total",
      section: "All",
      enrollment: Array.from(lectures.values()).reduce(
        (total, enrollment) => total + enrollment,
        0,
      ),
    });
  });

  // Return the totals in chronological order for the enrollment history graph.
  return Array.from(totalsByDate.values()).sort((a, b) =>
    a.dateCreated.localeCompare(b.dateCreated),
  );
};

export const formatEnrollmentTooltip = (value, name) => [
  `Enrollment: ${value}`,
  name,
];

export const createEnrollmentHistoryChartData = (data = []) => {
  const sortedData = [...data].sort((a, b) =>
    a.dateCreated.localeCompare(b.dateCreated),
  );
  const seriesByKey = new Map();
  const chartDataByDate = new Map();

  // Add the lecture-only total here so callers only supply section snapshots.
  const totals = calculateTotalEnrollmentHistory(sortedData);
  [...sortedData, ...totals].forEach((dataPoint) => {
    const seriesKey = getEnrollmentSeriesKey(dataPoint);
    const date = dataPoint.dateCreated;

    if (!seriesByKey.has(seriesKey)) {
      seriesByKey.set(seriesKey, {
        dataKey: `series${seriesByKey.size}`,
        name: getEnrollmentSeriesLabel(dataPoint),
      });
    }

    if (!chartDataByDate.has(date)) {
      chartDataByDate.set(date, {
        dateCreated: date,
      });
    }

    // Points for the same section and timestamp share a chart value.
    const chartRow = chartDataByDate.get(date);
    chartRow[seriesByKey.get(seriesKey).dataKey] = dataPoint.enrollment;
  });

  return {
    chartData: Array.from(chartDataByDate.values()).sort((a, b) =>
      a.dateCreated.localeCompare(b.dateCreated),
    ),
    series: Array.from(seriesByKey.values()),
  };
};
