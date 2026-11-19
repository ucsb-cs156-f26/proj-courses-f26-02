package edu.ucsb.cs156.courses.controllers;

// Tests for UsersController, including paged endpoints with sortField support

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs156.courses.ControllerTestCase;
import edu.ucsb.cs156.courses.entities.User;
import edu.ucsb.cs156.courses.repositories.UserRepository;
import edu.ucsb.cs156.courses.testconfig.TestConfig;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = UsersController.class)
@Import(TestConfig.class)
public class UsersControllerTests extends ControllerTestCase {

  @MockBean UserRepository userRepository;

  @Autowired private ObjectMapper objectMapper;

  PageRequest pageRequest_0_5_ASC = PageRequest.of(0, 5, Direction.ASC, "email");
  PageRequest pageRequest_0_5_DESC = PageRequest.of(0, 5, Direction.DESC, "email");

  @Test
  public void users__logged_out() throws Exception {
    mockMvc.perform(get("/api/admin/users")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void users__user_logged_in() throws Exception {
    mockMvc.perform(get("/api/admin/users")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void users__admin_logged_in() throws Exception {

    // arrange

    User u1 = User.builder().id(1L).build();
    User u2 = User.builder().id(2L).build();
    User u = currentUserService.getCurrentUser().getUser();

    ArrayList<User> expectedUsers = new ArrayList<>();
    expectedUsers.addAll(Arrays.asList(u1, u2, u));

    when(userRepository.findAll()).thenReturn(expectedUsers);
    String expectedJson = mapper.writeValueAsString(expectedUsers);

    // act

    MvcResult response =
        mockMvc.perform(get("/api/admin/users")).andExpect(status().isOk()).andReturn();

    // assert

    verify(userRepository, times(1)).findAll();
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void usersPaged__admin_logged_in_asc() throws Exception {
    // arrange

    User u1 = User.builder().id(1L).build();
    User u2 = User.builder().id(2L).build();
    User u = currentUserService.getCurrentUser().getUser();

    ArrayList<User> expectedUsers = new ArrayList<>();
    expectedUsers.addAll(Arrays.asList(u1, u2, u));

    Page<User> testPage_0_5_ASC = new PageImpl<User>(expectedUsers, pageRequest_0_5_ASC, 3);

    when(userRepository.findAll(pageRequest_0_5_ASC)).thenReturn(testPage_0_5_ASC);
    String expectedJson = objectMapper.writeValueAsString(testPage_0_5_ASC);

    // act

    MvcResult response =
        mockMvc
            .perform(
                get("/api/admin/users")
                    .param("page", "0")
                    .param("pageSize", "5")
                    .param("sortField", "email")
                    .param("sortDirection", "ASC"))
            .andExpect(status().isOk())
            .andReturn();

    // assert

    verify(userRepository, times(1))
        .findAll(
            org.springframework.data.domain.PageRequest.of(
                0, 5, org.springframework.data.domain.Sort.Direction.ASC, "email"));
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void usersPaged__admin_logged_in_desc() throws Exception {
    // arrange

    User u1 = User.builder().id(1L).build();
    User u2 = User.builder().id(2L).build();
    User u = currentUserService.getCurrentUser().getUser();

    ArrayList<User> expectedUsers = new ArrayList<>();
    expectedUsers.addAll(Arrays.asList(u1, u2, u));

    Page<User> testPage_0_5_DESC = new PageImpl<User>(expectedUsers, pageRequest_0_5_DESC, 3);

    when(userRepository.findAll(pageRequest_0_5_DESC)).thenReturn(testPage_0_5_DESC);
    String expectedJson = objectMapper.writeValueAsString(testPage_0_5_DESC);
    // act

    MvcResult response =
        mockMvc
            .perform(
                get("/api/admin/users")
                    .param("page", "0")
                    .param("pageSize", "5")
                    .param("sortField", "email")
                    .param("sortDirection", "DESC"))
            .andExpect(status().isOk())
            .andReturn();

    // assert

    verify(userRepository, times(1))
        .findAll(
            org.springframework.data.domain.PageRequest.of(
                0, 5, org.springframework.data.domain.Sort.Direction.DESC, "email"));
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void usersPaged__fails_when_invalid_sortField() throws Exception {

    MvcResult response =
        mockMvc
            .perform(
                get("/api/admin/users")
                    .param("page", "0")
                    .param("pageSize", "5")
                    .param("sortField", "INVALID")
                    .param("sortDirection", "ASC"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, String> expectedResponse =
        Map.of(
            "message",
            "INVALID is not a valid sort field.  Valid values are [givenName, familyName, email]",
            "type",
            "IllegalArgumentException");

    // assert

    String expectedResponseAsJson = objectMapper.writeValueAsString(expectedResponse);
    String actualResponse = response.getResponse().getContentAsString();
    assertEquals(expectedResponseAsJson, actualResponse);
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void usersPaged__fails_when_invalid_sortDirection() throws Exception {

    MvcResult response =
        mockMvc
            .perform(
                get("/api/admin/users")
                    .param("page", "0")
                    .param("pageSize", "5")
                    .param("sortField", "email")
                    .param("sortDirection", "INVALID"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, String> expectedResponse =
        Map.of(
            "message",
            "INVALID is not a valid sort direction.  Valid values are [ASC, DESC]",
            "type",
            "IllegalArgumentException");

    // assert

    String expectedResponseAsJson = objectMapper.writeValueAsString(expectedResponse);
    String actualResponse = response.getResponse().getContentAsString();
    assertEquals(expectedResponseAsJson, actualResponse);
  }

  // Tests for GET /api/admin/users/search

  private User searchUser(long id, String fullName, String email) {
    String[] parts = fullName.split(" ");
    return User.builder()
        .id(id)
        .fullName(fullName)
        .givenName(parts[0])
        .familyName(parts[1])
        .email(email)
        .build();
  }

  private void assertBadRequest(MvcResult response, String message) throws Exception {
    Map<String, String> expectedResponse =
        Map.of("message", message, "type", "IllegalArgumentException");
    assertEquals(
        objectMapper.writeValueAsString(expectedResponse),
        response.getResponse().getContentAsString());
  }

  @Test
  public void searchUsers__logged_out() throws Exception {
    mockMvc
        .perform(get("/api/admin/users/search").param("query", "con"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void searchUsers__user_logged_in() throws Exception {
    mockMvc
        .perform(get("/api/admin/users/search").param("query", "con"))
        .andExpect(status().is(403));
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_trims_lowercases_and_uses_default_limit() throws Exception {
    List<User> expectedUsers =
        List.of(
            searchUser(1L, "Phill Conrad", "phtcon@ucsb.edu"),
            searchUser(2L, "Chloe Connors", "cconnors@example.org"));
    when(userRepository.searchByNameOrEmail("con", PageRequest.of(0, 10)))
        .thenReturn(expectedUsers);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "  CoN  "))
            .andExpect(status().isOk())
            .andReturn();

    verify(userRepository, times(1)).searchByNameOrEmail("con", PageRequest.of(0, 10));
    assertEquals(
        objectMapper.writeValueAsString(expectedUsers),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_with_min_limit() throws Exception {
    List<User> expectedUsers = List.of(searchUser(1L, "Phill Conrad", "phtcon@ucsb.edu"));
    when(userRepository.searchByNameOrEmail("phill", PageRequest.of(0, 1)))
        .thenReturn(expectedUsers);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "phill").param("limit", "1"))
            .andExpect(status().isOk())
            .andReturn();

    verify(userRepository, times(1)).searchByNameOrEmail("phill", PageRequest.of(0, 1));
    assertEquals(
        objectMapper.writeValueAsString(expectedUsers),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_with_max_limit() throws Exception {
    when(userRepository.searchByNameOrEmail("ucsb", PageRequest.of(0, 50))).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "ucsb").param("limit", "50"))
            .andExpect(status().isOk())
            .andReturn();

    verify(userRepository, times(1)).searchByNameOrEmail("ucsb", PageRequest.of(0, 50));
    assertEquals("[]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_escapes_like_wildcards() throws Exception {
    when(userRepository.searchByNameOrEmail(anyString(), any(Pageable.class)))
        .thenReturn(List.of());

    mockMvc
        .perform(get("/api/admin/users/search").param("query", "A_b%c\\d"))
        .andExpect(status().isOk());

    verify(userRepository, times(1)).searchByNameOrEmail("a\\_b\\%c\\\\d", PageRequest.of(0, 10));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_blank_query_returns_empty_list_without_querying()
      throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "   "))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_empty_query_returns_empty_list_without_querying()
      throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", ""))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_missing_query_is_bad_request() throws Exception {
    mockMvc.perform(get("/api/admin/users/search")).andExpect(status().isBadRequest());
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_limit_too_small_is_bad_request() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "con").param("limit", "0"))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertBadRequest(response, "limit must be between 1 and 50, but was 0");
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void searchUsers__admin_limit_too_large_is_bad_request() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users/search").param("query", "con").param("limit", "51"))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertBadRequest(response, "limit must be between 1 and 50, but was 51");
    verify(userRepository, never()).searchByNameOrEmail(anyString(), any(Pageable.class));
  }

  // Tests for GET /api/admin/users?id=...

  @Test
  public void getUserById__logged_out() throws Exception {
    mockMvc.perform(get("/api/admin/users").param("id", "1")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void getUserById__user_logged_in() throws Exception {
    mockMvc.perform(get("/api/admin/users").param("id", "1")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void getUserById__admin_found() throws Exception {
    User user = searchUser(7L, "Emily Chen", "emilychen@gmail.com");
    when(userRepository.findById(7L)).thenReturn(Optional.of(user));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users").param("id", "7"))
            .andExpect(status().isOk())
            .andReturn();

    verify(userRepository, times(1)).findById(7L);
    assertEquals(
        objectMapper.writeValueAsString(user), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN", "USER"})
  @Test
  public void getUserById__admin_not_found() throws Exception {
    when(userRepository.findById(7L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/users").param("id", "7"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, String> expectedResponse =
        Map.of("message", "User with id 7 not found", "type", "EntityNotFoundException");
    assertEquals(
        objectMapper.writeValueAsString(expectedResponse),
        response.getResponse().getContentAsString());
  }
}
