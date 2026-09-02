# SPEC-01: Only images of valid type and size are accepted, with feedback to the user

Feature: Image upload validation
  As an annotator
  I want to upload images to the portal
  So that I can label them with bounding boxes

  Background:
    Given I am logged into the portal
    And the maximum allowed image size is 10MB

  Scenario: Successful upload of a valid image
    Given I select a file "cat.jpg" of 2MB
    When I upload the image to the portal
    Then the image is stored in MinIO
    And a metadata record is created in MariaDB
    And I see a success message "Image uploaded successfully"

  Scenario: Reject file with unsupported type
    Given I select a file "document.pdf"
    When I try to upload the file to the portal
    Then the upload is rejected
    And no record is created in MariaDB or MinIO
    And I see an error message indicating the file type is not valid

  Scenario: Reject file exceeding the maximum size
    Given I select a file "panorama.png" of 25MB
    When I try to upload the file to the portal
    Then the upload is rejected
    And I see an error message indicating the file exceeds the maximum size

  Scenario Outline: Supported image formats
    Given I select a file "image.<extension>" of 1MB
    When I upload the image to the portal
    Then the upload is accepted

    Examples:
      | extension |
      | jpg       |
      | jpeg      |
      | png       |
