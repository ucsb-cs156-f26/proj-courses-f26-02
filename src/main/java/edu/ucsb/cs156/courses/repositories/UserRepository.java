package edu.ucsb.cs156.courses.repositories;

import edu.ucsb.cs156.courses.entities.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends CrudRepository<User, Long> {
  Optional<User> findByEmail(String email);

  Page<User> findAll(Pageable pageable);

  /**
   * Type-ahead search: users whose fullName, givenName, familyName or email contains {@code query}
   * (case-insensitive). Users with a field that starts with {@code query} are listed first, then
   * the rest; within each group, results are ordered by familyName, givenName, email.
   *
   * @param query search text, already lower-cased and with LIKE wildcards (\, %, _) escaped with a
   *     backslash
   * @param pageable used to cap the number of results
   */
  @Query(
      """
      SELECT u FROM users u
      WHERE LOWER(u.fullName) LIKE CONCAT('%', :query, '%') ESCAPE '\\'
         OR LOWER(u.givenName) LIKE CONCAT('%', :query, '%') ESCAPE '\\'
         OR LOWER(u.familyName) LIKE CONCAT('%', :query, '%') ESCAPE '\\'
         OR LOWER(u.email) LIKE CONCAT('%', :query, '%') ESCAPE '\\'
      ORDER BY
        CASE WHEN LOWER(u.fullName) LIKE CONCAT(:query, '%') ESCAPE '\\'
               OR LOWER(u.givenName) LIKE CONCAT(:query, '%') ESCAPE '\\'
               OR LOWER(u.familyName) LIKE CONCAT(:query, '%') ESCAPE '\\'
               OR LOWER(u.email) LIKE CONCAT(:query, '%') ESCAPE '\\'
             THEN 0 ELSE 1 END,
        LOWER(u.familyName), LOWER(u.givenName), LOWER(u.email)
      """)
  List<User> searchByNameOrEmail(@Param("query") String query, Pageable pageable);
}
