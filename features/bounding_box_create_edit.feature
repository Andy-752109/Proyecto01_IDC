# SPEC-02: A bounding box can be created, moved, resized and deleted, and persists on reload

Feature: Bounding box create, move, resize and delete
  As an annotator
  I want to create, move, resize and delete bounding boxes
  So that I can label objects within an image

  Background:
    Given I have an image loaded on the annotation canvas
    And the category "person" exists with color "#FF0000"

  Scenario: Create a bounding box with a valid category
    When I draw a box on the image
    And I select the category "person"
    Then the box is saved with the drawn coordinates
    And the box is displayed with the color of the "person" category

  Scenario: Move an existing box
    Given a box with category "person" exists at position (100, 100)
    When I drag the box to position (150, 120)
    Then the box is updated to position (150, 120)
    And the change is persisted in the database

  Scenario: Resize an existing box
    Given a box with width 50 and height 50 exists
    When I drag the bottom-right corner of the box to a new point
    Then the width and height of the box are updated
    And the change is persisted in the database

  Scenario: Delete a box
    Given a box with category "person" exists
    When I delete the box
    Then the box no longer appears on the canvas
    And the annotation record is removed from the database

  @wip
  # Deferred to T-06: requires GET /api/annotations?imageId=, out of scope for T-05.
  Scenario: Annotations persist after reloading the image
    Given I have created and saved a box with category "person"
    When I reload the annotation page
    Then the saved box is displayed at its original position and size
