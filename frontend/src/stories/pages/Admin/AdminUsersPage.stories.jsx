import React from "react";

import AdminUsersPage from "main/pages/Admin/AdminUsersPage";

import { toast } from "react-toastify";
import { http, HttpResponse } from "msw";
import usersFixtures from "fixtures/usersFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";

export default {
  title: "pages/Admin/AdminUsersPage",
  component: AdminUsersPage,
};

// 10 fixture users plus 20 generated students, so that broad searches
// (e.g. "student") return more than 10 matches
const allUsers = [
  ...usersFixtures.tenUsers,
  ...Array.from({ length: 20 }, (_, i) => ({
    ...usersFixtures.tenUsers[3],
    id: 100 + i,
    fullName: `Student ${i + 1}`,
    givenName: "Student",
    familyName: `${i + 1}`,
    email: `student${i + 1}@ucsb.edu`,
  })),
];

// Stand-in for GET /api/admin/users/search (case-insensitive substring match)
const searchHandler = http.get("/api/admin/users/search", ({ request }) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").toLowerCase();
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const matches = allUsers
    .filter((u) =>
      [u.fullName, u.givenName, u.familyName, u.email].some((field) =>
        field.toLowerCase().includes(query),
      ),
    )
    .slice(0, limit);
  return HttpResponse.json(matches, { status: 200 });
});

const Template = () => <AdminUsersPage />;

export const Default = Template.bind({});
Default.parameters = {
  docs: {
    description: {
      story:
        'Use "Find a user" to search. Try "con" (a short list), "student" (more than 10 matches, so ' +
        'you are asked to keep typing), then "student 2" (narrowed down). Picking a user shows just ' +
        "that user; the × button returns to the full list.",
    },
  },
  msw: [
    searchHandler,
    http.get("/api/admin/users", () => {
      return HttpResponse.json(
        {
          content: usersFixtures.threeUsers,
          totalPages: 2,
        },
        {
          status: 200,
        },
      );
    }),
    http.get("/api/systemInfo", () => {
      return HttpResponse.json(systemInfoFixtures.showingBoth, {
        status: 200,
      });
    }),
    http.get("/api/currentUser", () => {
      return HttpResponse.json(apiCurrentUserFixtures.adminUser, {
        status: 200,
      });
    }),
    http.post("/logout", ({ request }) => {
      toast(`Generated: ${request.method} ${request.url}`);
      return HttpResponse.json(
        {},
        {
          status: 200,
        },
      );
    }),
  ],
};
