import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import * as useBackend from "main/utils/useBackend.jsx";

import CourseOverTimeDescriptionIndexPage from "main/pages/CourseOverTime/CourseOverTimeDescriptionIndexPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { threeSections } from "fixtures/sectionFixtures";
import userEvent from "@testing-library/user-event";

const mockToast = vi.fn();
vi.mock("react-toastify", async () => {
  const originalModule = await vi.importActual("react-toastify");
  return {
    __esModule: true,
    ...originalModule,
    toast: (x) => mockToast(x),
  };
});

describe("CourseOverTimeDescriptionIndexPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);

  beforeEach(() => {
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  const queryClient = new QueryClient();
  test("renders without crashing", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  test("calls UCSB Course description search api correctly with 3 section response", async () => {
    const useBackendMutationSpy = vi.spyOn(useBackend, "useBackendMutation");
    axiosMock.onGet("/api/public/description/search").reply(200, threeSections);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const selectStartQuarter = screen.getByLabelText("Start Quarter");
    await userEvent.selectOptions(selectStartQuarter, "20222");
    const selectEndQuarter = screen.getByLabelText("End Quarter");
    await userEvent.selectOptions(selectEndQuarter, "20222");
    const enterSearchTerms = screen.getByLabelText("Search Terms");
    await userEvent.type(enterSearchTerms, "data");
    const selectCheckbox = screen.getByTestId(
      "CourseOverTimeDescriptionSearchForm-checkbox",
    );
    await userEvent.click(selectCheckbox);

    const submitButton = screen.getByText("Submit");
    expect(submitButton).toBeInTheDocument();
    axiosMock.resetHistory();

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });

    expect(axiosMock.history.get[0].params).toEqual({
      startQtr: "20222",
      endQtr: "20222",
      searchTerms: "data",
      lectureOnly: true,
    });
    expect(axiosMock.history.get[0].url).toBe("/api/public/description/search");

    expect(useBackendMutationSpy).toHaveBeenCalledWith(
      expect.any(Function),
      { onSuccess: expect.any(Function) },
      [],
    );

    expect(screen.getByText("COMP ENGR SEMINAR")).toBeInTheDocument();
  });

  test("displays 'No courses found' message when search returns empty results", async () => {
    axiosMock.onGet("/api/public/description/search").reply(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([200, []]), 100);
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const selectStartQuarter = screen.getByLabelText("Start Quarter");
    await userEvent.selectOptions(selectStartQuarter, "20222");
    const selectEndQuarter = screen.getByLabelText("End Quarter");
    await userEvent.selectOptions(selectEndQuarter, "20222");
    const enterSearchTerms = screen.getByLabelText("Search Terms");
    await userEvent.type(enterSearchTerms, "test");
    const selectCheckbox = screen.getByTestId(
      "CourseOverTimeDescriptionSearchForm-checkbox",
    );
    await userEvent.click(selectCheckbox);

    const submitButton = screen.getByText("Submit");
    expect(submitButton).toBeInTheDocument();
    axiosMock.resetHistory();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Loading courses.../i)).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/No courses were found with the specified criteria./i),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/No courses were found with the specified criteria./i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("CMPSC")).not.toBeInTheDocument();
  });

  test("does not display 'No courses found' before search", async () => {
    axiosMock.onGet("/api/public/description/search").reply(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([200, []]), 100);
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Start Quarter")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("End Quarter")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search Terms")).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/No courses were found with the specified criteria./i),
    ).not.toBeInTheDocument();

    expect(screen.queryByText(/Loading courses.../i)).not.toBeInTheDocument();
  });

  test("does not display 'No courses found' while loading", async () => {
    axiosMock.onGet("/api/public/description/search").reply(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([200, []]), 100);
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const submitButton = screen.getByText("Submit");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Loading courses.../i)).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/No courses were found with the specified criteria./i),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/No courses were found with the specified criteria./i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading courses.../i)).not.toBeInTheDocument();
  });

  test("displays 'loading' while search is in progress", async () => {
    axiosMock.onGet("/api/public/description/search").reply(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([200, threeSections]), 100);
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const selectStartQuarter = screen.getByLabelText("Start Quarter");
    await userEvent.selectOptions(selectStartQuarter, "20222");
    const selectEndQuarter = screen.getByLabelText("End Quarter");
    await userEvent.selectOptions(selectEndQuarter, "20222");
    const enterSearchTerms = screen.getByLabelText("Search Terms");
    await userEvent.type(enterSearchTerms, "test");
    const selectCheckbox = screen.getByTestId(
      "CourseOverTimeDescriptionSearchForm-checkbox",
    );
    await userEvent.click(selectCheckbox);

    const submitButton = screen.getByText("Submit");
    expect(submitButton).toBeInTheDocument();
    axiosMock.resetHistory();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Loading courses.../i)).toBeInTheDocument();
    });

    expect(screen.queryByText("COMP ENGR SEMINAR")).not.toBeInTheDocument();
    expect(screen.queryByText("Enrolled")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("COMP ENGR SEMINAR")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading courses.../i)).not.toBeInTheDocument();
    expect(screen.queryByText("Enrolled")).toBeInTheDocument();
  });

  test("does not display ConvertedSectionTable when no results", async () => {
    axiosMock.onGet("/api/public/description/search").reply(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([200, []]), 100);
        }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CourseOverTimeDescriptionIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Submit");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/No courses were found with the specified criteria./i),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Quarter")).not.toBeInTheDocument();
    expect(screen.queryByText("CourseId")).not.toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Enrolled")).not.toBeInTheDocument();
    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.queryByText("Time")).not.toBeInTheDocument();
    expect(screen.queryByText("Locations")).not.toBeInTheDocument();
    expect(screen.queryByText("Instructors")).not.toBeInTheDocument();
    expect(screen.queryByText("Section")).not.toBeInTheDocument();
  });
});
