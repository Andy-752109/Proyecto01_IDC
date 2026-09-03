# SPEC-04: Zoom, undo, navigation between images and save-and-next

Feature: Canvas navigation and annotation tools
  As an annotator
  I want to zoom, undo changes and navigate between images
  So that I can annotate efficiently

  Scenario: Apply zoom on the image
    Given I have an image loaded on the annotation canvas
    When I increase the zoom level
    Then the image is displayed enlarged
    And existing boxes keep their correct relative position

  Scenario: Undo the last action
    Given I have just created a bounding box
    When I press undo
    Then the created box disappears from the canvas
    And the previous state is restored

  Scenario: Save and move to the next image
    Given I have annotated all necessary boxes on the current image
    When I press "Save and next"
    Then the annotations are saved to the database
    And the current image is marked as annotated
    And the next pending image is displayed

  Scenario: Navigate between images without losing changes
    Given I have unsaved changes on the current image
    When I navigate to the previous image
    Then I am prompted to confirm whether I want to save the changes

  Scenario: Confirm saving before navigating away
    Given I have unsaved changes on the current image
    And I navigate to the previous image
    When I confirm that I want to save the changes
    Then the changes are saved to the database
    And I am taken to the previous image

  Scenario: Discard changes before navigating away
    Given I have unsaved changes on the current image
    And I navigate to the previous image
    When I choose to discard the changes
    Then the unsaved changes are not persisted
    And I am taken to the previous image
