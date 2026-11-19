package edu.ucsb.cs156.courses.controllers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs156.courses.entities.User;
import edu.ucsb.cs156.courses.errors.EntityNotFoundException;
import edu.ucsb.cs156.courses.repositories.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "User information (admin only)")
@RequestMapping("/api/admin/users")
@RestController
public class UsersController extends ApiController {
  @Autowired UserRepository userRepository;

  @Autowired ObjectMapper mapper;

  @Operation(summary = "Get a list of all users")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public ResponseEntity<String> users() throws JsonProcessingException {
    Iterable<User> users = userRepository.findAll();
    String body = mapper.writeValueAsString(users);
    return ResponseEntity.ok().body(body);
  }

  @Operation(summary = "Get a list of all users with pages")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(params = {"page", "pageSize", "sortField", "sortDirection"})
  public Iterable<User> usersPaged(
      @Parameter(
              name = "page",
              description = "what page of the data",
              example = "0",
              required = true)
          @RequestParam
          int page,
      @Parameter(
              name = "pageSize",
              description = "size of each page",
              example = "5",
              required = true)
          @RequestParam
          int pageSize,
      @Parameter(
              name = "sortField",
              description = "field to sort by",
              example = "email",
              required = true)
          @RequestParam
          String sortField,
      @Parameter(
              name = "sortDirection",
              description = "sort direction",
              example = "ASC",
              required = true)
          @RequestParam
          String sortDirection)
      throws JsonProcessingException {
    List<String> allowedSortFields = Arrays.asList("givenName", "familyName", "email");
    if (!allowedSortFields.contains(sortField)) {
      throw new IllegalArgumentException(
          String.format(
              "%s is not a valid sort field.  Valid values are %s", sortField, allowedSortFields));
    }

    List<String> allowedSortDirections = Arrays.asList("ASC", "DESC");
    if (!allowedSortDirections.contains(sortDirection)) {
      throw new IllegalArgumentException(
          String.format(
              "%s is not a valid sort direction.  Valid values are %s",
              sortDirection, allowedSortDirections));
    }

    Direction sortDirectionObject = Direction.ASC;
    if (sortDirection.equals("DESC")) {
      sortDirectionObject = Direction.DESC;
    }

    PageRequest pageRequest = PageRequest.of(page, pageSize, sortDirectionObject, sortField);

    Iterable<User> users = userRepository.findAll(pageRequest);
    return users;
  }

  public static final int DEFAULT_SEARCH_LIMIT = 10;
  public static final int MAX_SEARCH_LIMIT = 50;

  @Operation(
      summary = "Search users by name or email (for type-ahead / autocomplete)",
      description =
          "Case-insensitive substring match on fullName, givenName, familyName and email. "
              + "Users with a field starting with the query are listed first. "
              + "A blank query returns an empty list.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/search")
  public List<User> searchUsers(
      @Parameter(
              name = "query",
              description = "text to match against name or email",
              example = "con",
              required = true)
          @RequestParam
          String query,
      @Parameter(
              name = "limit",
              description = "maximum number of results (1-" + MAX_SEARCH_LIMIT + ")",
              example = "10")
          @RequestParam(defaultValue = "" + DEFAULT_SEARCH_LIMIT)
          int limit) {
    if (limit < 1 || limit > MAX_SEARCH_LIMIT) {
      throw new IllegalArgumentException(
          String.format("limit must be between 1 and %d, but was %d", MAX_SEARCH_LIMIT, limit));
    }
    String trimmed = query.trim();
    if (trimmed.isEmpty()) {
      return List.of();
    }
    String pattern = escapeLikePattern(trimmed.toLowerCase(Locale.ROOT));
    return userRepository.searchByNameOrEmail(pattern, PageRequest.of(0, limit));
  }

  @Operation(summary = "Get a single user by id")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(params = {"id"})
  public User getUserById(
      @Parameter(name = "id", description = "id of the user", example = "1", required = true)
          @RequestParam
          long id) {
    return userRepository
        .findById(id)
        .orElseThrow(() -> new EntityNotFoundException(User.class, id));
  }

  /** Escape the LIKE wildcards so user input is matched literally (escape char is backslash). */
  static String escapeLikePattern(String text) {
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }
}
