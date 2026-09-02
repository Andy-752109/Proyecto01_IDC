# SPEC-08: Search supports the AND operator (e.g. "car AND person") over annotated categories
#
# RESOLVED (2026-09-02, PM decision): only AND is in scope. The rubric example only shows
# "car AND person" — OR and NOT were an earlier assumption pending confirmation and have been
# dropped to avoid rework, since they were not actually required.

Feature: Search with the AND operator over categories
  As a dashboard user
  I want to search annotated images using the AND operator between categories
  So that I can quickly find images that match a combination of categories

  Scenario: Search with AND operator
    Given there are annotated images with categories "car" and "person"
    When I search "car AND person"
    Then I get only the images that contain both categories

  Scenario: Search with no results
    Given no image has both categories "bicycle" and "boat" at the same time
    When I search "bicycle AND boat"
    Then I get an empty list of results
