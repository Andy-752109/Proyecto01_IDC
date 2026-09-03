# SPEC-10: Dashboard metrics are calculated from the database; none of them is a fixed value.
#
# All counts/groupings are resolved in SQL (COUNT, GROUP BY) via Drizzle over the tables from
# T-03 — never by fetching rows and counting in JS. See features/SPECS.md for traceability.

Feature: Dashboard metrics from real data
  As a dashboard user
  I want the metrics and charts to reflect the actual data in the database
  So that I can trust the numbers instead of seeing placeholder values

  Scenario: Objects per class matches real counts in the database
    Given a dataset with 3 annotations for category "car" and 2 annotations for category "person"
    When I open the dashboard
    Then the objects-per-class count for "car" is 3
    And the objects-per-class count for "person" is 2

  Scenario: Annotation progress shows how many images are annotated out of the total
    Given 5 new images are added, 2 of which are already annotated
    When I open the dashboard
    Then the total images count increased by 5
    And the annotated images count increased by 2

  Scenario: Metrics change when the underlying data changes (anti-hardcode)
    Given the dashboard is loaded with the current totals
    When a new annotation is added and I reload the dashboard
    Then the total bounding boxes count increased by 1
