package edu.ucsb.cs156.courses.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs156.courses.collections.ConvertedSectionCollection;
import edu.ucsb.cs156.courses.documents.ConvertedSection;
import edu.ucsb.cs156.courses.documents.CoursePage;
import edu.ucsb.cs156.courses.documents.CoursePageFixtures;
import java.util.Optional;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConvertedSectionUpsertServiceTests {

  @Mock ConvertedSectionCollection collection;
  @InjectMocks ConvertedSectionUpsertService service;

  @Test
  void insertsSectionWhenMissing() {
    ConvertedSection incoming =
        CoursePage.fromJSON(CoursePageFixtures.COURSE_PAGE_JSON_MATH3B).convertedSections().get(0);

    String quarter = incoming.getCourseInfo().getQuarter();
    String enrollCode = incoming.getSection().getEnrollCode();

    when(collection.findOneByQuarterAndEnrollCode(quarter, enrollCode))
        .thenReturn(Optional.empty());

    service.upsert(incoming);

    verify(collection).save(incoming);
  }

  @Test
  void updatesExistingSectionWithoutChangingMongoId() throws Exception {
    ConvertedSection incoming =
        CoursePage.fromJSON(CoursePageFixtures.COURSE_PAGE_JSON_MATH3B).convertedSections().get(0);

    ConvertedSection existing = (ConvertedSection) incoming.clone();
    ObjectId originalId = new ObjectId();
    existing.set_id(originalId);
    existing.getCourseInfo().setTitle("Old Title");
    existing.getSection().setEnrolledTotal(0);

    String quarter = incoming.getCourseInfo().getQuarter();
    String enrollCode = incoming.getSection().getEnrollCode();
    when(collection.findOneByQuarterAndEnrollCode(quarter, enrollCode))
        .thenReturn(Optional.of(existing));

    service.upsert(incoming);

    assertEquals(incoming.getCourseInfo().getTitle(), existing.getCourseInfo().getTitle());
    assertEquals(
        incoming.getSection().getEnrolledTotal(), existing.getSection().getEnrolledTotal());
    assertEquals(originalId, existing.get_id());
    verify(collection).save(existing);
  }
}
