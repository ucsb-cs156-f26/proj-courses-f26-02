import React from "react";

import EnrollmentHistoryGraph from "main/components/EnrollmentHistory/EnrollmentHistoryGraph";
import { enrollmentDataPointFixtures } from "fixtures/enrollmentDataPointFixtures";

export default {
  title: "components/EnrollmentHistory/EnrollmentHistoryGraph",
  component: EnrollmentHistoryGraph,
};

const Template = (args) => {
  return <EnrollmentHistoryGraph {...args} />;
};

export const OneLectureOverTime = Template.bind({});
OneLectureOverTime.args = {
  data: enrollmentDataPointFixtures.cmpsc130aLectureOverTime,
  title: "CMPSC 130A Lecture Enrollment Over Time",
};

export const MultipleSectionsOverTime = Template.bind({});
MultipleSectionsOverTime.args = {
  data: enrollmentDataPointFixtures.cmpsc130aMultipleSectionsOverTime,
  title: "CMPSC 130A Section Enrollment Over Time",
};

export const MultipleQuarters = Template.bind({});
MultipleQuarters.args = {
  data: enrollmentDataPointFixtures.cmpsc130aMultipleQuarters,
  title: "CMPSC 130A Enrollment Across Quarters",
};

export const MultipleLecturesSameDay = Template.bind({});
MultipleLecturesSameDay.args = {
  data: enrollmentDataPointFixtures.cmpsc130aMultipleLecturesSameDay,
  title: "CMPSC 130A Multiple Lectures on the Same Day",
};

export const MultipleLecturesOverTime = Template.bind({});
MultipleLecturesOverTime.args = {
  data: enrollmentDataPointFixtures.cmpsc130aMultipleLecturesOverTime,
  title: "CMPSC 130A Multiple Lectures Over Time",
};
