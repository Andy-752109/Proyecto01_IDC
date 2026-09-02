# SPEC-07: The full annotated dataset can be exported as a downloadable file, with nothing excluded

Feature: Downloadable full dataset export
  As a portal user
  I want to download the complete annotated dataset
  So that I can use it outside the portal for training

  Scenario: Downloading the full dataset
    Given the dataset has images and annotations saved
    When I request to export the full dataset
    Then a downloadable file is generated with all annotated images
    And no image or annotation is excluded from the export
