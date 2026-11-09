package edu.ucsb.cs156.courses.integration;

import static org.junit.jupiter.api.Assertions.assertThrows;

import edu.ucsb.cs156.courses.entities.User;
import edu.ucsb.cs156.courses.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = ClassMode.BEFORE_EACH_TEST_METHOD)
public class UserIT {

  @Autowired UserRepository userRepository;

  @Test
  public void test_that_duplicate_emails_are_not_allowed() throws Exception {

    // Create first user
    User user1 = User.builder().email("user@ucsb.edu").build();

    userRepository.save(user1);

    // Create second user with the same email
    User user2 = User.builder().email("user@ucsb.edu").build();

    // Assert saving user2 is not allowed
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          userRepository.save(user2);
        });
  }
}
