import React, { useState } from "react";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import UsersTable from "main/components/Users/UsersTable";
import UsersSearchForm from "main/components/Users/UsersSearchForm";
import UserTypeahead from "main/components/Users/UserTypeahead";

import { useBackend } from "main/utils/useBackend";
import OurPagination from "main/components/Utils/OurPagination";
import useLocalStorage from "main/utils/useLocalStorage";

// Suggestions are only listed when there are at most this many matches;
// otherwise the user is asked to keep typing.
const MAX_SUGGESTIONS = 10;

const AdminUsersPage = () => {
  const [selectedPage, setSelectedPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorage("UsersSearch.PageSize", "10");
  const [sortField, setSortField] = useLocalStorage(
    "UsersSearch.SortField",
    "email",
  );
  const [sortDirection, setSortDirection] = useLocalStorage(
    "UsersSearch.SortDirection",
    "ASC",
  );
  const [searchText, setSearchText] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const {
    data: page,
    error: _error,
    status: _status,
  } = useBackend(
    // Stryker disable next-line all : don't test internal caching of React Query
    ["/api/admin/users", selectedPage, pageSize, sortField, sortDirection],
    {
      // Stryker disable next-line StringLiteral : GET is default, so replacing with "" is an equivalent mutation
      method: "GET",
      url: "/api/admin/users",
      params: {
        page: selectedPage - 1,
        pageSize,
        sortField,
        sortDirection,
      },
    },
    { content: [], totalPages: 0 },
  );

  const { data: matches, isFetching: isSearching } = useBackend(
    // Stryker disable next-line all : don't test internal caching of React Query
    ["/api/admin/users/search", searchText],
    {
      // Stryker disable next-line StringLiteral : GET is default, so replacing with "" is an equivalent mutation
      method: "GET",
      url: "/api/admin/users/search",
      // ask for one extra so we can tell when there are too many to list
      params: { query: searchText, limit: MAX_SUGGESTIONS + 1 },
    },
    // Stryker disable next-line ArrayDeclaration : equivalent; initial data is only used while disabled (menu hidden) or fetching ("Searching...")
    [],
    { enabled: searchText !== "" },
  );

  const tooManyMatches = matches.length > MAX_SUGGESTIONS;

  return (
    <BasicLayout>
      <h2>Users</h2>
      <div className="mb-3" style={{ maxWidth: "480px" }}>
        <UserTypeahead
          controlId="AdminUsersPage.UserSearch"
          label="Find a user"
          users={matches}
          isLoading={isSearching}
          message={
            tooManyMatches
              ? `More than ${MAX_SUGGESTIONS} matches — keep typing to narrow it down`
              : undefined
          }
          onSearchChange={setSearchText}
          onSelect={setSelectedUser}
        />
      </div>
      {selectedUser && (
        <div data-testid="AdminUsersPage-selectedUser">
          <UsersTable users={[selectedUser]} />
        </div>
      )}
      {/* hidden rather than unmounted so pagination keeps its active page */}
      <div data-testid="AdminUsersPage-allUsers" hidden={!!selectedUser}>
        <UsersSearchForm
          updateSortField={setSortField}
          updateSortDirection={setSortDirection}
          updatePageSize={setPageSize}
        />
        <OurPagination
          updateActivePage={setSelectedPage}
          totalPages={page.totalPages}
        />
        <UsersTable users={page.content} />
      </div>
    </BasicLayout>
  );
};

export default AdminUsersPage;
