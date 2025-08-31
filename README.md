# Job Posting Board Project

This repository contains the front-end code for a Job Posting Board application. The application is designed to help streamline the process of posting job vacancies to various social media platforms, specifically Telegram.

The front end is built with a combination of HTML, CSS, and Vue.js. It features a responsive table-based layout to display job listings with sorting and filtering capabilities.

---

## **1. Back-end Integration**

The primary goal for the next phase is to connect this front end to the back end. The back end will be responsible for:

* Retrieving job data from the SharePoint Excel file.
* Serving the data to the front end.
* Handling the scheduling and posting of jobs to Telegram.
* After posting or archiving a job, it should go to the same excel file ut a different sheet (The marketing sheet).

---

## **2. Excel File Structure**

The front end is configured to work with the following columns from the Excel file. Please ensure the column headers in the Excel sheet exactly match the names below.

| Column Name | Description |
| :--- | :--- |
| **`Name of Company/Organization`** | The company that is hiring. |
| **`Position`** | The title of the job. |
| **`City`** | The location of the job. |
| **`Kurdish`** | The Kurdish translation of the job title. |
| **`Posted on Social Media`** | A flag (`Yes` or `No`) indicating if the job has been posted. |
| **`Design completed?`** | A flag indicating if the design for the post is ready. |

---

## **3. New Headers to Add**

The current system has a `Status` and a `Posted` header. To make this work seamlessly with the existing front end, we need to add two new headers to the Excel sheet that you'll manage in the backend.

1.  **`Arabic` (New column):** This column should be added to contain the Arabic translation of the job title. The front end will use this to generate the correct message template for the Telegram post.
2.  **`Link` (New Column):** This column should be Have the link of the job vacancy and act as a trigger, so when there's data in it the system should retrive that row of data.


---

## **4. Data Flow and API Endpoints**

The front end expects the back end to provide data via the following API endpoints. Please make sure the data returned from the backend's API matches the front end's expected data format.

## **5. Issue**
This update addresses two critical issues with the scheduled job queue functionality for Telegram Posting. The original implementation had a bug where jobs were not correctly managed upon removal, leading to an inconsistent state or multiple jobs being posted in one hour thus creating duplicate posts.

The issues were:
Duplicate Job Entries: It was possible to add the same job to the Telegram posting queue multiple times.
Incorrect Job Removal: When a job was removed from the queue, it did not return to the "Jobs To Be Posted" list. Instead, it was effectively lost from the active job pool.



* `GET /jobs`: Fetches a list of jobs based on the current filter, search query, pagination, and sorting. The front end will send these parameters in the request.
* `POST /jobs/{job_id}/post_to_telegram`: Initiates the process of posting a specific job to Telegram.
* `POST /jobs/{job_id}/mark_as_posted`: Updates the job's status to `Posted` in your database (Excel file).
* `POST /jobs/{job_id}/archive`: Moves a job to the `Archived` status.

Feel free to ask if you need any clarification on the front-end code or the expected data structures. Good luck!
