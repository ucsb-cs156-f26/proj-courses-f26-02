import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  createEnrollmentHistoryChartData,
  formatDateCreated,
  formatEnrollmentTooltip,
  lineColors as defaultLineColors,
} from "main/components/EnrollmentHistory/EnrollmentHistoryHelper";

const EnrollmentHistoryGraph = ({
  data = [],
  lineColors = defaultLineColors,
  title = "Enrollment History",
}) => {
  // Group a copy by day for display, preserving the timestamps in the source data.
  // Sort first so the latest snapshot wins when a section appears twice in a day.
  const dailyDisplayData = [...data]
    .sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))
    .map((point) => ({
      ...point,
      dateCreated: formatDateCreated(point.dateCreated),
    }));
  const { chartData, series } = createEnrollmentHistoryChartData(dailyDisplayData);

  return (
    <div data-testid="enrollment-history-graph">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          // Stryker disable all
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <XAxis dataKey="dateCreated" tickFormatter={formatDateCreated} />
          <YAxis allowDecimals={false} />
          <Legend />
          <Tooltip
            formatter={formatEnrollmentTooltip}
            labelFormatter={formatDateCreated}
          />
          {series.map((line, index) => (
            <Line
              key={line.dataKey}
              dataKey={line.dataKey}
              name={line.name}
              stroke={
                line.name === "Total - Section All"
                  ? "#000000"
                  : lineColors[index % lineColors.length]
              }
              strokeWidth={line.name === "Total - Section All" ? 3 : 2}
              dot
              connectNulls
              // Stryker restore all
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EnrollmentHistoryGraph;
