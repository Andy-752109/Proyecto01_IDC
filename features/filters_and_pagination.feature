# SPEC-09: Filters by class, status and date range are combinable, with correct pagination
#
# Status values must match the enum defined in T-03's schema: pending, annotated, reviewed.

Feature: Combinable filters and pagination
  As a dashboard user
  I want to combine filters by class, status and date range
  So that I can narrow down results and browse them in pages

  Scenario Outline: Combinable filters by class, status and date
    Given there are images with different classes, statuses and upload dates
    When I apply a filter by class "<class>", status "<status>" and date range "<range>"
    Then only images matching all criteria are shown
    And the results are paginated correctly

    Examples:
      | class   | status    | range                    |
      | person  | pending   | 2026-08-01 to 2026-08-31 |
      | car     | reviewed  | 2026-07-01 to 2026-07-31 |

  Scenario: Paginating results
    Given there are 45 images matching a filter
    And the configured page size is 20
    When I request page 2 of results
    Then I receive 20 results corresponding to that page
    And the reported total number of results is 45
