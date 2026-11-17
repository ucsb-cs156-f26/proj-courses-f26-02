package edu.ucsb.cs156.courses.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs156.courses.entities.User;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
public class UserRepositoryTests {

  @Autowired UserRepository userRepository;

  User phill;
  User phillip;
  User craig;
  User chloe;
  User gavin;
  User underscore;

  private User user(String givenName, String familyName, String email) {
    return User.builder()
        .givenName(givenName)
        .familyName(familyName)
        .fullName(givenName + " " + familyName)
        .email(email)
        .build();
  }

  private List<String> emails(List<User> users) {
    return users.stream().map(User::getEmail).toList();
  }

  private List<String> search(String query, int limit) {
    return emails(userRepository.searchByNameOrEmail(query, PageRequest.of(0, limit)));
  }

  @BeforeEach
  public void setup() {
    userRepository.deleteAll();
    phill = user("Phill", "Conrad", "phtcon@ucsb.edu");
    phillip = user("Phillip", "Conrad", "pconrad.cis@gmail.com");
    craig = user("Craig", "Zzyxx", "craig.zzyzx@example.org");
    chloe = user("Chloe", "Connors", "cconnors@example.org");
    gavin = user("Gavin", "O'Connell", "gavin.oconnell@ucsb.edu");
    underscore = user("Una", "Score", "una_score@ucsb.edu");
    userRepository.saveAll(List.of(gavin, craig, phillip, underscore, chloe, phill));
  }

  @Test
  public void matches_given_name_case_insensitively() {
    assertEquals(List.of("craig.zzyzx@example.org"), search("craig", 10));
  }

  @Test
  public void matches_family_name() {
    assertEquals(List.of("craig.zzyzx@example.org"), search("zzyxx", 10));
  }

  @Test
  public void matches_full_name_across_the_space() {
    assertEquals(List.of("phtcon@ucsb.edu"), search("phill con", 10));
  }

  @Test
  public void matches_email() {
    assertEquals(List.of("pconrad.cis@gmail.com"), search("gmail", 10));
  }

  @Test
  public void prefix_matches_come_first_then_ordered_by_family_given_email() {
    // "con" is a prefix of Conrad/Connors; it only appears mid-word for O'Connell and phtcon
    assertEquals(
        List.of(
            "cconnors@example.org", // prefix: Connors
            "phtcon@ucsb.edu", // prefix: Conrad, Phill
            "pconrad.cis@gmail.com", // prefix: Conrad, Phillip
            "gavin.oconnell@ucsb.edu" // contains only: O'Connell
            ),
        search("con", 10));
  }

  @Test
  public void respects_the_limit() {
    assertEquals(List.of("cconnors@example.org", "phtcon@ucsb.edu"), search("con", 2));
  }

  @Test
  public void returns_empty_list_when_nothing_matches() {
    assertEquals(List.of(), search("nobody", 10));
  }

  @Test
  public void escaped_underscore_matches_literal_underscore_only() {
    assertEquals(List.of("una_score@ucsb.edu"), search("\\_", 10));
  }

  @Test
  public void escaped_percent_matches_literal_percent_only() {
    assertEquals(List.of(), search("\\%", 10));
  }
}
