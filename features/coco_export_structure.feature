# SPEC-05: Valid COCO JSON with images/annotations/categories and consistent IDs

Feature: COCO export structure and ID consistency
  As a portal user
  I want to export the annotated dataset in COCO format
  So that I can use it to train a model

  Scenario: The exported JSON has a valid COCO structure
    Given there are annotated images with at least one category
    When I export the dataset in COCO format
    Then the JSON file contains the "images", "annotations" and "categories" sections
    And each annotation references an "image_id" that exists in "images"
    And each annotation references a "category_id" that exists in "categories"

  Scenario: An image without annotations is included in the dataset
    Given there is an uploaded image with no bounding boxes
    When I export the dataset in COCO format
    Then the image appears in the "images" section
    And no annotation in "annotations" references it
