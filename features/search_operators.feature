# SPEC-08: Search supports boolean operators (e.g. "car AND person") over annotated categories
#
# OPEN QUESTION (needs team/professor confirmation): the rubric only shows "car AND person"
# as an example and says "operadores" in plural. We are assuming AND, OR and NOT are in scope
# until confirmed otherwise. If only AND is required, drop the OR/NOT scenarios below.

Feature: Search with boolean operators over categories
  As a dashboard user
  I want to search annotated images using boolean operators between categories
  So that I can quickly find images that match a combination of categories

  Scenario: Search with AND operator
    Given there are annotated images with categories "car" and "person"
    When I search "car AND person"
    Then I get only the images that contain both categories

  Scenario: Search with OR operator
    Given there are annotated images with category "car" or category "bicycle"
    When I search "car OR bicycle"
    Then I get the images that contain at least one of the two categories

  Scenario: Search with NOT operator
    Given there are annotated images with category "car", some of which also have "person"
    When I search "car NOT person"
    Then I get only the images that contain "car" and do not contain "person"

  Scenario: Search with no results
    Given no image has both categories "bicycle" and "boat" at the same time
    When I search "bicycle AND boat"
    Then I get an empty list of results
