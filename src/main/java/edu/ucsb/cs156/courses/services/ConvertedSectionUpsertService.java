package edu.ucsb.cs156.courses.services;

import edu.ucsb.cs156.courses.collections.ConvertedSectionCollection;
import edu.ucsb.cs156.courses.documents.ConvertedSection;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ConvertedSectionUpsertService {

  private final ConvertedSectionCollection collection;

  public ConvertedSectionUpsertService(ConvertedSectionCollection collection) {
    this.collection = collection;
  }

  public void upsert(ConvertedSection incoming) {
    String quarter = incoming.getCourseInfo().getQuarter();
    String enrollCode = incoming.getSection().getEnrollCode();

    Optional<ConvertedSection> existing =
        collection.findOneByQuarterAndEnrollCode(quarter, enrollCode);

    if (existing.isPresent()) {
      ConvertedSection stored = existing.get();
      stored.setCourseInfo(incoming.getCourseInfo());
      stored.setSection(incoming.getSection());
      collection.save(stored);
    } else {
      collection.save(incoming);
    }
  }
}
