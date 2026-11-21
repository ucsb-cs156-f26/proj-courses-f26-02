import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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
  lectureCapacity,
}) => {
  // Group a copy by day for display, preserving the timestamps in the source data.
  // Sort first so the latest snapshot wins when a section appears twice in a day.
  const dailyDisplayData = [...data]
    .sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))
    .map((point) => ({
      ...point,
      dateCreated: formatDateCreated(point.dateCreated),
    }));
  const { chartData, series } =
    createEnrollmentHistoryChartData(dailyDisplayData);
  const showCapacity = Number.isFinite(lectureCapacity) && chartData.length > 0;

  return (
    <div data-testid="enrollment-history-graph">
      <h3 className="h5">{title}</h3>
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
          <YAxis
            allowDecimals={false}
            padding={showCapacity ? { top: 24 } : undefined}
          />
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
          {showCapacity && (
            <ReferenceLine
              y={lectureCapacity}
              stroke="#808080"
              strokeWidth={2}
              ifOverflow="extendDomain"
              label={{
                value: `Lecture capacity: ${lectureCapacity}`,
                position: "insideBottomRight",
                fill: "#595959",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EnrollmentHistoryGraph;
