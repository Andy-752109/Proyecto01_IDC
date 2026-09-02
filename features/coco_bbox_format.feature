# SPEC-06: bbox as [x, y, width, height] in absolute pixels, coherent area, iscrowd present

Feature: COCO bbox, area and iscrowd format
  As a portal user
  I want the exported bbox, area and iscrowd fields to follow the COCO spec
  So that the dataset is compatible with standard training pipelines

  Scenario: The bbox is exported in the correct format
    Given there is an annotation with a bounding box of 40x30 pixels at (10, 20)
    When I export the dataset in COCO format
    Then the "bbox" field of that annotation is "[10, 20, 40, 30]"
    And the "area" field equals 1200
    And the "iscrowd" field is present with value 0 or 1
