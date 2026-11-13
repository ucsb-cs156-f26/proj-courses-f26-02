import React, { useRef, useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import UserTypeahead from "main/components/Users/UserTypeahead";
import usersFixtures from "fixtures/usersFixtures";

export default {
  title: "components/Users/UserTypeahead",
  component: UserTypeahead,
  parameters: {
    docs: {
      description: {
        component:
          "Type-ahead for picking a single user by name or email. " +
          "The component does no matching itself: it calls `onSearchChange(text)` " +
          "(debounced) and renders whatever `users` the parent passes back. " +
          "In these stories the parent filters `usersFixtures.tenUsers` with a " +
          "case-insensitive substring match on fullName, givenName, familyName and email. " +
          "Try typing `con`, `ucsb`, or `gmail`; use the arrow keys and Enter to pick, Escape to close.",
      },
    },
  },
  argTypes: {
    onSearchChange: { control: false },
    onSelect: { control: false },
    users: { control: false },
    isLoading: { control: false },
  },
};

// Stand-in for the backend search: case-insensitive substring match
const matchUsers = (allUsers, text) => {
  const needle = text.toLowerCase();
  if (needle === "") {
    return [];
  }
  return allUsers.filter((u) =>
    [u.fullName, u.givenName, u.familyName, u.email].some((field) =>
      (field ?? "").toLowerCase().includes(needle),
    ),
  );
};

// Story harness that plays the role of the parent component
const Harness = ({ allUsers, latencyMs = 0, maxSuggestions, ...args }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lastSearch, setLastSearch] = useState("");
  const requestId = useRef(0);

  const onSearchChange = (text) => {
    setLastSearch(text);
    if (latencyMs === 0) {
      setUsers(matchUsers(allUsers, text));
      return;
    }
    const id = ++requestId.current;
    setIsLoading(true);
    setTimeout(() => {
      // ignore stale responses, as a real parent should
      if (id === requestId.current) {
        setUsers(matchUsers(allUsers, text));
        setIsLoading(false);
      }
    }, latencyMs);
  };

  return (
    <div style={{ maxWidth: 480, minHeight: 380 }}>
      <UserTypeahead
        {...args}
        users={
          maxSuggestions !== undefined && users.length > maxSuggestions
            ? []
            : users
        }
        isLoading={isLoading}
        message={
          maxSuggestions !== undefined && users.length > maxSuggestions
            ? `More than ${maxSuggestions} matches — keep typing to narrow it down`
            : undefined
        }
        onSearchChange={onSearchChange}
        onSelect={setSelected}
      />
      <div className="mt-3 small text-muted" data-testid="harness-state">
        <div>
          Last <code>onSearchChange</code>: &quot;{lastSearch}&quot;
        </div>
        <div>
          Selected:{" "}
          {selected ? `${selected.fullName} <${selected.email}>` : "(none)"}
        </div>
      </div>
    </div>
  );
};

const Template = (args) => <Harness {...args} />;

export const Default = Template.bind({});
Default.args = {
  allUsers: usersFixtures.tenUsers,
};

export const SimulatedServerLatency = Template.bind({});
SimulatedServerLatency.args = {
  allUsers: usersFixtures.tenUsers,
  latencyMs: 800,
};
SimulatedServerLatency.parameters = {
  docs: {
    description: {
      story:
        'Parent takes 800ms to respond, showing the `isLoading` state ("Searching...").',
    },
  },
};

export const TypingShowsSuggestions = Template.bind({});
TypingShowsSuggestions.args = {
  allUsers: usersFixtures.tenUsers,
};
TypingShowsSuggestions.parameters = {
  docs: {
    description: {
      story:
        'Automatically types "con" and arrows down to highlight the second match.',
    },
  },
};
TypingShowsSuggestions.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const input = canvas.getByRole("combobox");
  await userEvent.type(input, "con");
  await expect(
    await canvas.findByTestId("UserTypeahead-option-0"),
  ).toBeInTheDocument();
  await userEvent.keyboard("{ArrowDown}{ArrowDown}");
};

export const SelectedUser = Template.bind({});
SelectedUser.args = {
  allUsers: usersFixtures.tenUsers,
};
SelectedUser.parameters = {
  docs: {
    description: {
      story:
        'Types "chen" and clicks the result; the input shows the chosen user and onSelect is called.',
    },
  },
};
SelectedUser.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("combobox"), "chen");
  await userEvent.click(await canvas.findByText("Emily Chen"));
  await expect(canvas.getByRole("combobox")).toHaveValue(
    "Emily Chen (emilychen@gmail.com)",
  );
};

export const NoMatches = Template.bind({});
NoMatches.args = {
  allUsers: usersFixtures.tenUsers,
};
NoMatches.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("combobox"), "nobody-here");
  await expect(
    await canvas.findByText("No matching users"),
  ).toBeInTheDocument();
};

export const CustomLabelAndPlaceholder = Template.bind({});
CustomLabelAndPlaceholder.args = {
  allUsers: usersFixtures.tenUsers,
  controlId: "InstructorTypeahead",
  label: "Instructor",
  placeholder: "Start typing an instructor's name or email",
};

export const TooManyMatches = Template.bind({});
TooManyMatches.args = {
  allUsers: usersFixtures.tenUsers,
  maxSuggestions: 3,
};
TooManyMatches.parameters = {
  docs: {
    description: {
      story:
        "The parent passes a `message` when there are too many matches to list (here, more than 3). " +
        'Typing "ucsb" shows the message (6 matches); keep typing, e.g. "fkhan", to narrow it down.',
    },
  },
};
TooManyMatches.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("combobox"), "ucsb");
  await expect(
    await canvas.findByText(
      "More than 3 matches — keep typing to narrow it down",
    ),
  ).toBeInTheDocument();
};
