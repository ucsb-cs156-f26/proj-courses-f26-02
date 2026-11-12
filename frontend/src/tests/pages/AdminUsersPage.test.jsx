import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import mockConsole from "tests/testutils/mockConsole";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import usersFixtures from "fixtures/usersFixtures";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";

describe("AdminUsersPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);

  const testId = "UsersTable";

  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("renders without crashing on three users", async () => {
    const queryClient = new QueryClient();
    axiosMock.onGet("/api/admin/users").reply(200, {
      content: usersFixtures.threeUsers,
      totalPages: 2,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Users")).toBeInTheDocument();
    expect(
      await screen.findByTestId("UsersTable-cell-row-0-col-id"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId(`UsersTable-cell-row-0-col-id`),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId(`UsersTable-cell-row-0-col-givenName`),
    ).toHaveTextContent("Phill");
    expect(
      screen.getByTestId(`UsersTable-cell-row-0-col-familyName`),
    ).toHaveTextContent("Conrad");
    expect(
      screen.getByTestId(`UsersTable-cell-row-0-col-email`),
    ).toHaveTextContent("phtcon@ucsb.edu");
    expect(
      screen.getByTestId(`UsersTable-cell-row-0-col-admin`),
    ).toHaveTextContent("true");

    expect(screen.getByTestId("OurPagination-2")).toBeInTheDocument();

    const usersRequest = axiosMock.history.get.find(
      (request) => request.url === "/api/admin/users",
    );
    expect(usersRequest.params).toEqual({
      page: 0,
      pageSize: "10",
      sortField: "email",
      sortDirection: "ASC",
    });
  });

  test("clicking pagination requests the second page", async () => {
    const queryClient = new QueryClient();
    axiosMock.onGet("/api/admin/users").reply((config) => {
      if (config.params.page === 1) {
        return [
          200,
          {
            content: [usersFixtures.threeUsers[1]],
            totalPages: 2,
          },
        ];
      }

      return [
        200,
        {
          content: [usersFixtures.threeUsers[0]],
          totalPages: 2,
        },
      ];
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("UsersTable-cell-row-0-col-email"),
    ).toHaveTextContent("phtcon@ucsb.edu");

    fireEvent.click(screen.getByTestId("OurPagination-2"));

    await waitFor(() => {
      expect(
        screen.getByTestId("UsersTable-cell-row-0-col-email"),
      ).toHaveTextContent("pconrad.cis@gmail.com");
    });

    const usersRequests = axiosMock.history.get.filter(
      (request) => request.url === "/api/admin/users",
    );
    expect(usersRequests).toHaveLength(2);
    expect(usersRequests[1].params).toEqual({
      page: 1,
      pageSize: "10",
      sortField: "email",
      sortDirection: "ASC",
    });
  });

  test("reads pageSize, sortField, sortDirection from localStorage", async () => {
    const queryClient = new QueryClient();

    localStorage.setItem("UsersSearch.PageSize", "25");
    localStorage.setItem("UsersSearch.SortField", "familyName");
    localStorage.setItem("UsersSearch.SortDirection", "DESC");

    axiosMock.onGet("/api/admin/users").reply(200, {
      content: usersFixtures.threeUsers,
      totalPages: 2,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Users")).toBeInTheDocument();

    const usersRequest = axiosMock.history.get.find(
      (request) => request.url === "/api/admin/users",
    );
    expect(usersRequest.params).toEqual({
      page: 0,
      pageSize: "25",
      sortField: "familyName",
      sortDirection: "DESC",
    });

    localStorage.clear();
  });

  test("renders empty table when backend unavailable", async () => {
    const queryClient = new QueryClient();
    axiosMock.onGet("/api/admin/users").timeout();

    const restoreConsole = mockConsole();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });

    const errorMessage = console.error.mock.calls[0][0];
    expect(errorMessage).toMatch(
      "Error communicating with backend via GET on /api/admin/users",
    );
    restoreConsole();

    expect(
      screen.queryByTestId(`${testId}-cell-row-0-col-id`),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("OurPagination-1")).not.toBeInTheDocument();
  });

  describe("user search type-ahead", () => {
    const makeUsers = (n) =>
      Array.from({ length: n }, (_, i) => ({
        ...usersFixtures.threeUsers[0],
        id: 100 + i,
        fullName: `Student ${i}`,
        givenName: "Student",
        familyName: `${i}`,
        email: `student${i}@ucsb.edu`,
      }));

    const renderPage = async () => {
      axiosMock.onGet("/api/admin/users").reply((config) => [
        200,
        {
          content: [usersFixtures.threeUsers[config.params.page]],
          totalPages: 2,
        },
      ]);
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <AdminUsersPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByTestId("UsersTable-cell-row-0-col-email");
    };

    const searchRequests = () =>
      axiosMock.history.get.filter(
        (request) => request.url === "/api/admin/users/search",
      );

    const typeInSearch = (text) =>
      fireEvent.change(screen.getByLabelText("Find a user"), {
        target: { value: text },
      });

    test("does not call the search endpoint until something is typed", async () => {
      await renderPage();
      expect(screen.getByLabelText("Find a user")).toHaveAttribute(
        "placeholder",
        "Search by name or email",
      );
      expect(screen.getByLabelText("Find a user").closest(".mb-3")).toHaveStyle(
        { maxWidth: "480px" },
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(searchRequests()).toHaveLength(0);
    });

    test("typing searches, picking a user shows only that user, clearing restores the list", async () => {
      axiosMock
        .onGet("/api/admin/users/search")
        .reply(200, usersFixtures.threeUsers.slice(0, 2));
      await renderPage();

      typeInSearch("con");

      expect(
        await screen.findByTestId("AdminUsersPage.UserSearch-option-1"),
      ).toHaveTextContent("Phillip Conrad");
      expect(searchRequests()).toHaveLength(1);
      expect(searchRequests()[0].params).toEqual({ query: "con", limit: 11 });
      expect(
        screen.queryByTestId("AdminUsersPage.UserSearch-message"),
      ).toBeNull();
      expect(screen.queryByTestId("AdminUsersPage-selectedUser")).toBeNull();
      expect(screen.getByTestId("AdminUsersPage-allUsers")).toBeVisible();

      fireEvent.click(screen.getByTestId("AdminUsersPage.UserSearch-option-1"));

      const selected = screen.getByTestId("AdminUsersPage-selectedUser");
      expect(
        within(selected).getByTestId("UsersTable-cell-row-0-col-email"),
      ).toHaveTextContent("pconrad.cis@gmail.com");
      expect(
        within(selected).queryByTestId("UsersTable-cell-row-1-col-email"),
      ).toBeNull();
      expect(screen.getByTestId("AdminUsersPage-allUsers")).not.toBeVisible();

      fireEvent.click(screen.getByTestId("AdminUsersPage.UserSearch-clear"));

      expect(screen.queryByTestId("AdminUsersPage-selectedUser")).toBeNull();
      expect(screen.getByTestId("AdminUsersPage-allUsers")).toBeVisible();
    });

    test("lists suggestions when there are exactly 10 matches", async () => {
      axiosMock.onGet("/api/admin/users/search").reply(200, makeUsers(10));
      await renderPage();

      typeInSearch("student");

      expect(
        await screen.findByTestId("AdminUsersPage.UserSearch-option-9"),
      ).toHaveTextContent("student9@ucsb.edu");
      expect(
        screen.queryByTestId("AdminUsersPage.UserSearch-message"),
      ).toBeNull();
    });

    test("asks the user to keep typing when there are more than 10 matches", async () => {
      axiosMock.onGet("/api/admin/users/search").reply(200, makeUsers(11));
      await renderPage();

      typeInSearch("student");

      expect(
        await screen.findByTestId("AdminUsersPage.UserSearch-message"),
      ).toHaveTextContent(
        "More than 10 matches — keep typing to narrow it down",
      );
      expect(
        screen.queryByTestId("AdminUsersPage.UserSearch-option-0"),
      ).toBeNull();
    });

    test("shows 'Searching...' while the search request is in flight", async () => {
      axiosMock
        .onGet("/api/admin/users/search")
        .reply(() => new Promise(() => {}));
      await renderPage();

      typeInSearch("con");

      await waitFor(() => expect(searchRequests()).toHaveLength(1));
      expect(
        screen.getByTestId("AdminUsersPage.UserSearch-loading"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("AdminUsersPage.UserSearch-no-results"),
      ).toBeNull();
    });

    test("keeps the current page of the user list after a selection is cleared", async () => {
      axiosMock
        .onGet("/api/admin/users/search")
        .reply(200, usersFixtures.threeUsers.slice(0, 1));
      await renderPage();

      fireEvent.click(screen.getByTestId("OurPagination-2"));
      await waitFor(() =>
        expect(
          screen.getByTestId("UsersTable-cell-row-0-col-email"),
        ).toHaveTextContent("pconrad.cis@gmail.com"),
      );

      typeInSearch("phill");
      fireEvent.click(
        await screen.findByTestId("AdminUsersPage.UserSearch-option-0"),
      );
      fireEvent.click(screen.getByTestId("AdminUsersPage.UserSearch-clear"));

      expect(screen.getByTestId("OurPagination-2").closest("li")).toHaveClass(
        "active",
      );
      expect(
        screen.getByTestId("OurPagination-1").closest("li"),
      ).not.toHaveClass("active");
      expect(
        screen.getByTestId("UsersTable-cell-row-0-col-email"),
      ).toHaveTextContent("pconrad.cis@gmail.com");
    });
  });
});
