import { useEffect, useRef, useState } from "react";
import { Button, Form, InputGroup, ListGroup } from "react-bootstrap";
import {
  userDisplayName,
  userLabel,
} from "main/components/Users/userTypeaheadUtils";

// A type-ahead for picking a single user by name or email.
//
// The component does not do any matching itself.  As the user types it
// calls onSearchChange(text) (debounced by debounceMs) and the parent is
// responsible for supplying the matching users via the `users` prop
// (e.g. from a backend search endpoint).  When a user is picked,
// onSelect(user) is called; when the selection is cleared,
// onSelect(null) is called.
const UserTypeahead = ({
  users = [],
  onSearchChange,
  onSelect,
  isLoading = false,
  debounceMs = 300,
  controlId = "UserTypeahead",
  label = "User",
  placeholder = "Search by name or email",
}) => {
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  // Stryker disable next-line BooleanLiteral : equivalent; menu needs non-empty query, and every edit sets isOpen
  const [isOpen, setIsOpen] = useState(false);
  // Stryker disable next-line UnaryOperator : equivalent; every edit resets activeIndex before menu can show
  const [activeIndex, setActiveIndex] = useState(-1);
  const onSearchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    if (searchText === null) {
      return undefined;
    }
    const timer = setTimeout(
      () => onSearchChangeRef.current(searchText),
      debounceMs,
    );
    return () => clearTimeout(timer);
  }, [searchText, debounceMs]);

  const listboxId = `${controlId}-listbox`;
  const optionId = (i) => `${controlId}-option-${i}`;
  const showMenu = isOpen && !selectedUser && query.trim() !== "";
  const highlighted = activeIndex < users.length ? activeIndex : -1;

  const select = (user) => {
    setSelectedUser(user);
    setQuery(userLabel(user));
    onSelect(user);
  };

  const clear = () => {
    setQuery("");
    setSearchText("");
    if (selectedUser) {
      setSelectedUser(null);
      onSelect(null);
    }
  };

  const handleChange = (event) => {
    const text = event.target.value;
    setQuery(text);
    setSearchText(text.trim());
    setIsOpen(true);
    setActiveIndex(-1);
    if (selectedUser) {
      setSelectedUser(null);
      onSelect(null);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(Math.min(highlighted + 1, users.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(highlighted - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (showMenu && highlighted >= 0) {
        select(users[highlighted]);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const renderMenuContents = () => {
    if (isLoading) {
      return (
        <ListGroup.Item data-testid={`${controlId}-loading`}>
          Searching...
        </ListGroup.Item>
      );
    }
    if (users.length === 0) {
      return (
        <ListGroup.Item data-testid={`${controlId}-no-results`}>
          No matching users
        </ListGroup.Item>
      );
    }
    return users.map((user, i) => (
      <ListGroup.Item
        key={user.id}
        id={optionId(i)}
        data-testid={optionId(i)}
        role="option"
        aria-selected={i === highlighted}
        active={i === highlighted}
        action
        // preventDefault keeps focus in the input so onBlur doesn't close the menu before the click lands
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => select(user)}
      >
        <div>{userDisplayName(user)}</div>
        <small className={i === highlighted ? undefined : "text-muted"}>
          {user.email}
        </small>
      </ListGroup.Item>
    ));
  };

  return (
    <Form.Group controlId={controlId} className="position-relative">
      <Form.Label>{label}</Form.Label>
      <InputGroup>
        <Form.Control
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          aria-autocomplete="list"
          aria-expanded={showMenu}
          aria-controls={listboxId}
          aria-activedescendant={
            showMenu && highlighted >= 0 ? optionId(highlighted) : undefined
          }
        />
        {query !== "" && (
          <Button
            variant="outline-secondary"
            onClick={clear}
            aria-label="Clear"
            data-testid={`${controlId}-clear`}
          >
            &times;
          </Button>
        )}
      </InputGroup>
      {showMenu && (
        <ListGroup
          id={listboxId}
          data-testid={listboxId}
          role="listbox"
          className="position-absolute w-100 shadow-sm"
          style={{ zIndex: 1000, maxHeight: "300px", overflowY: "auto" }}
        >
          {renderMenuContents()}
        </ListGroup>
      )}
    </Form.Group>
  );
};

export default UserTypeahead;
