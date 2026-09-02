# SPEC-03: No box can be saved without a valid category assigned

Feature: Bounding box category validation
  As an annotator
  I want every bounding box to require a valid category
  So that the dataset never contains unlabeled objects

  Background:
    Given I have an image loaded on the annotation canvas

  Scenario: A box cannot be saved without a category
    When I draw a box on the image
    And I do not select any category
    Then the box cannot be saved
    And I see a message indicating that a valid class must be assigned

  Scenario: A box is saved once a valid category is assigned
    Given I have drawn a box without a category
    When I select the category "person"
    Then the box is saved successfully
