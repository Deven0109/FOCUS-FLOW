
# Implementation Plan - Leave Analytics Pie Chart

The user wants to visualize **Approved Leave Data** as a **Pie Chart** on the dashboard.
- **Data Scope**: Only `status: 'approved'`.
- **Dimensions**: Breakdown by **Leave Type** (Casual, Sick, Vacation, Personal).
- **Time Filter**: Last Week, Last Month, 3 Months, 6 Months, Last Year.
- **Admin View**:
    - Toggle between **Onsite** and **Remote** employees.
    - Buttons: "Onsite" (Dark Blue), "Remote" (Off Blue).
- **Employee View**:
    - Shows their own confirmed leaves.

## Steps

### 1. Backend: `controllers/web/leave.js`
Update `getLeaveAnalytics` to:
- Accept `timeRange` and `workType`.
- Filter `Leave` collection by:
    - `status: 'approved'` (Strictly).
    - `fromDate`: >= `startDate`.
    - `user`: Filter based on Admin's selected `workType` (Onsite/Remote) or the logged-in user's ID.
- Aggregate data by `leaveType` (Count occurrences of each type).
- Return standard Chart.js data structure:
    - `labels`: ['Casual', 'Sick', 'Vacation', 'Personal']
    - `datasets`: [{ data: [10, 5, 2, 1], backgroundColor: [...] }]

### 2. Frontend: `views/pages/users/dashboard.ejs`
- Update the **Leave Analytics** card.
- **Admin Controls**: Ensure "Onsite" and "Remote" buttons are visible and styled as requested.
    - Onsite: Dark Blue (`btn-primary` or custom).
    - Remote: Off Blue (`btn-info` or custom).
- **Chart Container**: Ensure standard responsive container for Pie/Doughnut chart.

### 3. Frontend: `public/javascripts/controllers/dashboardController.js`
- Update `getLeaveAnalytics` to pass standard payload.
- Update `renderLeaveChart`:
    - Change `type` to `'pie'`.
    - Map colors to Leave Types for consistency (e.g. Sick=Red, Casual=Blue).
    - Add logic to handle "No Data" gracefully. (Empty chart or message).

