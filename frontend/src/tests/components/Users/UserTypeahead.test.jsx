import { vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import UserTypeahead from "main/components/Users/UserTypeahead";
import {
  userDisplayName,
  userLabel,
} from "main/components/Users/userTypeaheadUtils";
import usersFixtures from "fixtures/usersFixtures";

const users = usersFixtures.threeUsers;

describe("UserTypeahead tests", () => {
  let onSearchChange;
  let onSelect;

  beforeEach(() => {
    onSearchChange = vi.fn();
    onSelect = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderTypeahead = (props = {}) =>
    render(
      <UserTypeahead
        users={users}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
        {...props}
      />,
    );

  const type = (text) =>
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: text },
    });

  const key = (k) =>
    fireEvent.keyDown(screen.getByRole("combobox"), { key: k });

  describe("helpers", () => {
    test("userDisplayName uses fullName, falling back to email", () => {
      expect(userDisplayName(users[0])).toBe("Phill Conrad");
      expect(userDisplayName({ fullName: null, email: "a@b.com" })).toBe(
        "a@b.com",
      );
    });

    test("userLabel combines name and email", () => {
      expect(userLabel(users[0])).toBe("Phill Conrad (phtcon@ucsb.edu)");
    });
  });

  describe("rendering", () => {
    test("renders default label, placeholder and input attributes", () => {
      render(
        <UserTypeahead onSearchChange={onSearchChange} onSelect={onSelect} />,
      );
      const input = screen.getByLabelText("User");
      expect(input).toHaveAttribute("id", "UserTypeahead");
      expect(input).toHaveAttribute("role", "combobox");
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("autocomplete", "off");
      expect(input).toHaveAttribute("aria-autocomplete", "list");
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(input).toHaveAttribute("aria-controls", "UserTypeahead-listbox");
      expect(input).not.toHaveAttribute("aria-activedescendant");
      expect(input).toHaveAttribute("placeholder", "Search by name or email");
      expect(input).toHaveValue("");
      expect(input.closest(".position-relative")).not.toBeNull();
      expect(screen.queryByTestId("UserTypeahead-clear")).toBeNull();
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    test("renders custom label, placeholder and controlId", () => {
      renderTypeahead({
        controlId: "Instructor",
        label: "Instructor",
        placeholder: "Find instructor",
      });
      const input = screen.getByLabelText("Instructor");
      expect(input).toHaveAttribute("id", "Instructor");
      expect(input).toHaveAttribute("placeholder", "Find instructor");
      expect(input).toHaveAttribute("aria-controls", "Instructor-listbox");
      type("con");
      expect(screen.getByTestId("Instructor-listbox")).toBeInTheDocument();
      expect(screen.getByTestId("Instructor-option-0")).toBeInTheDocument();
      expect(screen.getByTestId("Instructor-clear")).toBeInTheDocument();
    });

    test("shows suggestions with name and email when text is typed", () => {
      renderTypeahead();
      type("con");
      const input = screen.getByRole("combobox");
      expect(input).toHaveValue("con");
      expect(input).toHaveAttribute("aria-expanded", "true");

      const listbox = screen.getByRole("listbox");
      expect(listbox).toHaveAttribute("id", "UserTypeahead-listbox");
      expect(listbox).toHaveClass("position-absolute", "w-100", "shadow-sm");
      expect(listbox).toHaveStyle({
        zIndex: "1000",
        maxHeight: "300px",
        overflowY: "auto",
      });

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
      users.forEach((user, i) => {
        const option = screen.getByTestId(`UserTypeahead-option-${i}`);
        expect(option).toHaveAttribute("id", `UserTypeahead-option-${i}`);
        expect(option).toHaveAttribute("aria-selected", "false");
        expect(option).not.toHaveClass("active");
        expect(option).toHaveTextContent(user.fullName);
        expect(screen.getByText(user.email)).toHaveClass("text-muted");
      });
    });

    test("does not show menu for whitespace-only input", () => {
      renderTypeahead();
      type("   ");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    test("shows 'No matching users' when there are no users", () => {
      render(
        <UserTypeahead onSearchChange={onSearchChange} onSelect={onSelect} />,
      );
      type("zzz");
      expect(screen.getByTestId("UserTypeahead-no-results")).toHaveTextContent(
        "No matching users",
      );
      expect(screen.queryByTestId("UserTypeahead-loading")).toBeNull();
    });

    test("shows 'Searching...' when loading", () => {
      renderTypeahead({ isLoading: true });
      type("con");
      expect(screen.getByTestId("UserTypeahead-loading")).toHaveTextContent(
        "Searching...",
      );
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    test("clear button has accessible label and styling", () => {
      renderTypeahead();
      type("con");
      const clear = screen.getByTestId("UserTypeahead-clear");
      expect(clear).toHaveAttribute("aria-label", "Clear");
      expect(clear).toHaveClass("btn-outline-secondary");
      expect(clear).toHaveTextContent("×");
    });
  });

  describe("debounced onSearchChange", () => {
    test("is not called on mount", () => {
      vi.useFakeTimers();
      renderTypeahead();
      act(() => vi.advanceTimersByTime(1000));
      expect(onSearchChange).not.toHaveBeenCalled();
    });

    test("is called once with trimmed text after default 300ms", () => {
      vi.useFakeTimers();
      renderTypeahead();
      type(" c");
      type(" co ");
      act(() => vi.advanceTimersByTime(299));
      expect(onSearchChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onSearchChange).toHaveBeenCalledTimes(1);
      expect(onSearchChange).toHaveBeenCalledWith("co");
    });

    test("respects a custom debounceMs", () => {
      vi.useFakeTimers();
      renderTypeahead({ debounceMs: 50 });
      type("con");
      act(() => vi.advanceTimersByTime(49));
      expect(onSearchChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onSearchChange).toHaveBeenCalledWith("con");
    });

    test("uses the latest onSearchChange prop", () => {
      vi.useFakeTimers();
      const { rerender } = renderTypeahead();
      type("con");
      const newOnSearchChange = vi.fn();
      rerender(
        <UserTypeahead
          users={users}
          onSearchChange={newOnSearchChange}
          onSelect={onSelect}
        />,
      );
      act(() => vi.advanceTimersByTime(300));
      expect(onSearchChange).not.toHaveBeenCalled();
      expect(newOnSearchChange).toHaveBeenCalledWith("con");
    });
  });

  describe("selection", () => {
    test("clicking an option selects it", () => {
      renderTypeahead();
      type("con");
      const option = screen.getByTestId("UserTypeahead-option-1");
      expect(fireEvent.mouseDown(option)).toBe(false);
      fireEvent.click(option);
      expect(onSelect).toHaveBeenCalledWith(users[1]);
      expect(screen.getByRole("combobox")).toHaveValue(
        "Phillip Conrad (pconrad.cis@gmail.com)",
      );
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    test("menu does not reopen on focus after a selection", () => {
      renderTypeahead();
      type("con");
      fireEvent.click(screen.getByTestId("UserTypeahead-option-0"));
      fireEvent.focus(screen.getByRole("combobox"));
      expect(screen.queryByRole("listbox")).toBeNull();
      key("ArrowDown");
      expect(screen.queryByRole("listbox")).toBeNull();
      key("Enter");
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    test("typing after a selection clears the selection", () => {
      renderTypeahead();
      type("con");
      fireEvent.click(screen.getByTestId("UserTypeahead-option-0"));
      onSelect.mockClear();
      type("cra");
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(null);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      type("craig");
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    test("clear button resets input, selection, and search", () => {
      vi.useFakeTimers();
      renderTypeahead();
      type("con");
      fireEvent.click(screen.getByTestId("UserTypeahead-option-0"));
      act(() => vi.advanceTimersByTime(300));
      onSearchChange.mockClear();
      onSelect.mockClear();

      fireEvent.click(screen.getByTestId("UserTypeahead-clear"));
      expect(screen.getByRole("combobox")).toHaveValue("");
      expect(onSelect).toHaveBeenCalledWith(null);
      expect(screen.queryByTestId("UserTypeahead-clear")).toBeNull();
      act(() => vi.advanceTimersByTime(300));
      expect(onSearchChange).toHaveBeenCalledWith("");
    });

    test("clear button without a selection does not call onSelect", () => {
      renderTypeahead();
      type("con");
      fireEvent.click(screen.getByTestId("UserTypeahead-clear"));
      expect(screen.getByRole("combobox")).toHaveValue("");
      expect(onSelect).not.toHaveBeenCalled();
      type("c");
      expect(onSelect).not.toHaveBeenCalled();
    });

    test("typing without a selection does not call onSelect", () => {
      renderTypeahead();
      type("con");
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("focus and blur", () => {
    test("blur closes the menu and focus reopens it", () => {
      renderTypeahead();
      type("con");
      const input = screen.getByRole("combobox");
      fireEvent.blur(input);
      expect(screen.queryByRole("listbox")).toBeNull();
      fireEvent.focus(input);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    const expectHighlighted = (index) => {
      const input = screen.getByRole("combobox");
      if (index < 0) {
        expect(input).not.toHaveAttribute("aria-activedescendant");
      } else {
        expect(input).toHaveAttribute(
          "aria-activedescendant",
          `UserTypeahead-option-${index}`,
        );
      }
      screen.getAllByRole("option").forEach((option, i) => {
        expect(option).toHaveAttribute(
          "aria-selected",
          i === index ? "true" : "false",
        );
        if (i === index) {
          expect(option).toHaveClass("active");
          expect(screen.getByText(users[i].email)).not.toHaveClass(
            "text-muted",
          );
        } else {
          expect(option).not.toHaveClass("active");
        }
      });
    };

    test("ArrowDown/ArrowUp move highlight and clamp at the ends", () => {
      renderTypeahead();
      type("con");
      expectHighlighted(-1);
      expect(key("ArrowDown")).toBe(false);
      expectHighlighted(0);
      key("ArrowDown");
      expectHighlighted(1);
      key("ArrowDown");
      key("ArrowDown");
      expectHighlighted(2);
      expect(key("ArrowUp")).toBe(false);
      expectHighlighted(1);
      key("ArrowUp");
      key("ArrowUp");
      expectHighlighted(0);
    });

    test("ArrowUp with nothing highlighted highlights the first option", () => {
      renderTypeahead();
      type("con");
      key("ArrowUp");
      expectHighlighted(0);
    });

    test("typing resets the highlight", () => {
      renderTypeahead();
      type("con");
      key("ArrowDown");
      key("ArrowDown");
      type("conr");
      expectHighlighted(-1);
    });

    test("Enter selects highlighted option", () => {
      renderTypeahead();
      type("con");
      key("ArrowDown");
      expect(key("Enter")).toBe(false);
      expect(onSelect).toHaveBeenCalledWith(users[0]);
      expect(screen.getByRole("combobox")).toHaveValue(userLabel(users[0]));
    });

    test("Enter with nothing highlighted does nothing", () => {
      renderTypeahead();
      type("con");
      expect(key("Enter")).toBe(false);
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("Enter while menu is closed does nothing", () => {
      renderTypeahead();
      type("con");
      key("ArrowDown");
      fireEvent.blur(screen.getByRole("combobox"));
      key("Enter");
      expect(onSelect).not.toHaveBeenCalled();
    });

    test("Escape closes the menu and resets the highlight", () => {
      renderTypeahead();
      type("con");
      key("ArrowDown");
      key("ArrowDown");
      expect(key("Escape")).toBe(true);
      expect(screen.queryByRole("listbox")).toBeNull();
      key("ArrowDown");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expectHighlighted(0);
    });

    test("typing reopens a menu closed with Escape", () => {
      renderTypeahead();
      type("con");
      key("Escape");
      type("conr");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("other keys are ignored", () => {
      renderTypeahead();
      type("con");
      key("ArrowDown");
      expect(key("Shift")).toBe(true);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expectHighlighted(0);
      expect(onSelect).not.toHaveBeenCalled();
    });

    test("highlight is dropped when the users list shrinks", () => {
      const { rerender } = renderTypeahead();
      type("con");
      key("ArrowDown");
      key("ArrowDown");
      expectHighlighted(1);
      rerender(
        <UserTypeahead
          users={[users[0]]}
          onSearchChange={onSearchChange}
          onSelect={onSelect}
        />,
      );
      expect(screen.getByRole("combobox")).not.toHaveAttribute(
        "aria-activedescendant",
      );
      expect(screen.getByTestId("UserTypeahead-option-0")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      key("Enter");
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
