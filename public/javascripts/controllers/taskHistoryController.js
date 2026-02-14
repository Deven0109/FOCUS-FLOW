app.controller(
  "TaskHistoryController",
  ($scope, HttpService, $http, $window, SweetAlertService) => {
    // Initialize controller state
    $scope.histories = [];
    $scope.users = [];
    $scope.currentUserDetails = null;
    const currentDate = new Date();
    $scope.currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    $scope.selectedUserId = "";
    $scope.selectedDate = {};
    $scope.isLoading = false;
    $scope.backdatedForm = { date: null, startTime: null, endTime: null, tasksText: "", hasExistingDay: false };
    $scope.backdatedError = "";
    $scope.isSavingBackdatedTasks = false;
    $scope.todayDateString = currentDate.toISOString().split('T')[0];

    $scope.selectedMonth = (currentDate.getMonth() + 1).toString();
    $scope.selectedYear = currentDate.getFullYear().toString();
    $scope.years = [];
    $scope.months = [
      { name: 'January', month: 1, totalDays: 31 },
      { name: 'February', month: 2, totalDays: 28 },
      { name: 'March', month: 3, totalDays: 31 },
      { name: 'April', month: 4, totalDays: 30 },
      { name: 'May', month: 5, totalDays: 31 },
      { name: 'June', month: 6, totalDays: 30 },
      { name: 'July', month: 7, totalDays: 31 },
      { name: 'August', month: 8, totalDays: 31 },
      { name: 'September', month: 9, totalDays: 30 },
      { name: 'October', month: 10, totalDays: 31 },
      { name: 'November', month: 11, totalDays: 30 },
      { name: 'December', month: 12, totalDays: 31 }
    ];

    const initializeYears = () => {
      const startYear = currentDate.getFullYear() - 4;
      for (let year = currentDate.getFullYear(); year >= startYear; year--) {
        $scope.years.push(year.toString());
      }
    };

    function parseTimeString(timeStr) {
      if (!timeStr) {
        return null;
      }
      const [hours, minutes] = timeStr.split(':').map((value) => parseInt(value, 10));
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
      }
      const time = new Date();
      time.setHours(hours);
      time.setMinutes(minutes);
      time.setSeconds(0);
      time.setMilliseconds(0);
      return time;
    }

    function formatTimeValue(timeValue) {
      if (!(timeValue instanceof Date)) {
        return timeValue || "";
      }
      const hours = String(timeValue.getHours()).padStart(2, '0');
      const minutes = String(timeValue.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    function parseDateString(dateStr) {
      if (!dateStr) {
        return null;
      }
      const parsed = new Date(dateStr);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatDateValue(dateValue) {
      if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      if (typeof dateValue === 'string') {
        return dateValue;
      }
      return "";
    }

    const updateCurrentMonth = () => {
      const month = Number($scope.selectedMonth);
      const year = Number($scope.selectedYear) || currentDate.getFullYear();
      $scope.currentMonth = new Date(year, month - 1, 1);
      $scope.getTaskHistory();
    };

    $scope.onChangeMonth = () => {
      updateCurrentMonth();
    };

    $scope.onChangeYear = () => {
      updateCurrentMonth();
    };

    $scope.getUsers = function () {
      HttpService.post(endpoints.GET_ALL_USERS, {})
        .then(function (response) {
          if (Array.isArray(response.data)) {
            $scope.users = response.data;
          }
        })
        .catch((error) => {
          SweetAlertService.toast(error.message, "error");
        });
    };

    $scope.getTaskHistory = function () {
      $scope.isLoading = true;
      $scope.histories = [];
      const historyRequest = {
        selectedMonth: $scope.currentMonth,
        selectedUserId: $scope.selectedUserId,
      };

      HttpService.post(endpoints.TASK_HISTORY, historyRequest)
        .then(function (response) {
          if (Array.isArray(response.data)) {
            $scope.histories = response.data;
          }
        })
        .catch((error) => SweetAlertService.toast(error.message, "error"))
        .finally(() => {
          $scope.isLoading = false;

        });
    };

    function findHistoryByDate(dateValue) {
      const dateStr = formatDateValue(dateValue);
      if (!dateStr) {
        return null;
      }
      return $scope.histories.find((history) => history.rawDate === dateStr) || null;
    }

    $scope.onBackdatedDateChange = function () {
      if (!$scope.backdatedForm.date) {
        $scope.backdatedForm.hasExistingDay = false;
        return;
      }
      const history = findHistoryByDate($scope.backdatedForm.date);
      if (history) {
        $scope.backdatedForm.hasExistingDay = true;
        $scope.backdatedForm.startTime = history.startTimeValue ? parseTimeString(history.startTimeValue) : null;
        $scope.backdatedForm.endTime = history.endTimeValue ? parseTimeString(history.endTimeValue) : null;
      } else {
        $scope.backdatedForm.hasExistingDay = false;
      }
    };

    $scope.openBackdatedTaskModal = function (history = null) {
      $scope.backdatedError = "";
      if (['superAdmin', 'hr', 'admin'].includes($scope.currentUserDetails?.role) && !$scope.selectedUserId) {
        SweetAlertService.toast("Please select a user first", "warning");
        return;
      }
      const defaultStart = parseTimeString("09:00");
      const defaultEnd = parseTimeString("18:00");
      const hasExistingDay = Boolean(history);
      const modalDate = history?.rawDate ? parseDateString(history.rawDate) : parseDateString($scope.todayDateString);
      const modalStart = history?.startTimeValue ? parseTimeString(history.startTimeValue) : defaultStart;
      const modalEnd = history?.endTimeValue ? parseTimeString(history.endTimeValue) : defaultEnd;
      $scope.backdatedForm = { date: modalDate, startTime: modalStart, endTime: modalEnd, tasksText: "", hasExistingDay };
      $scope.onBackdatedDateChange();
      $('#backdatedTaskModal').modal('show');
    };

    $scope.saveBackdatedTasks = function () {
      $scope.backdatedError = "";
      if (!$scope.backdatedForm.date) {
        $scope.backdatedError = "Please select a date";
        return;
      }
      if (!$scope.backdatedForm.tasksText || !$scope.backdatedForm.tasksText.trim()) {
        $scope.backdatedError = "Enter at least one task";
        return;
      }
      if (!$scope.backdatedForm.hasExistingDay) {
        if (!$scope.backdatedForm.startTime || !$scope.backdatedForm.endTime) {
          $scope.backdatedError = "Provide both start and end time";
          return;
        }
        if ($scope.backdatedForm.endTime <= $scope.backdatedForm.startTime) {
          $scope.backdatedError = "End time must be after start time";
          return;
        }
      }
      const tasks = $scope.backdatedForm.tasksText.split('\n').map((task) => task.trim()).filter((task) => task.length > 0);
      if (tasks.length === 0) {
        $scope.backdatedError = "Enter at least one valid task";
        return;
      }

      let targetUserId = $scope.currentUserDetails?.id || null;
      if (['superAdmin', 'hr', 'admin'].includes($scope.currentUserDetails?.role)) {
        if (!$scope.selectedUserId) {
          $scope.backdatedError = "Please select a user";
          return;
        }
        targetUserId = $scope.selectedUserId;
      }

      if (!targetUserId) {
        $scope.backdatedError = "Unable to identify user";
        return;
      }

      const payload = {
        date: formatDateValue($scope.backdatedForm.date),
        startTime: formatTimeValue($scope.backdatedForm.startTime),
        endTime: formatTimeValue($scope.backdatedForm.endTime),
        tasks: tasks,
        userId: targetUserId
      };

      $scope.isSavingBackdatedTasks = true;
      HttpService.post(endpoints.ADD_BACKDATED_TASK, payload).then(() => {
        const addedDate = parseDateString($scope.backdatedForm.date);
        if (!isNaN(addedDate)) {
          $scope.selectedMonth = (addedDate.getMonth() + 1).toString();
          $scope.selectedYear = addedDate.getFullYear().toString();
          $scope.currentMonth = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }
        $('#backdatedTaskModal').modal('hide');
        SweetAlertService.toast("Backdated tasks added successfully", "success");
        $scope.getTaskHistory();
      }).catch((error) => {
        $scope.backdatedError = error?.message || "Failed to add tasks";
        SweetAlertService.toast($scope.backdatedError, "error");
      }).finally(() => {
        $scope.isSavingBackdatedTasks = false;
      });
    };

    $scope.showTasks = function (data) {
      $scope.selectedDate = data;
      $('#addTaskModal').modal('show');
    };

    $scope.reportForm = { month: 1, year: currentDate.getFullYear(), workType: 'remote' }
    $scope.showReportModal = function () {
      $scope.reportForm = { month: $scope.selectedMonth, year: Number($scope.selectedYear), workType: 'remote' }
      $('#generateReportModal').modal('show');
    }

    $scope.errorMessage = "";
    $scope.isDownloading = false;
    $scope.generateReport = function () {
      $scope.errorMessage = "";
      $scope.isDownloading = true;
      const request = { selectedMonth: $scope.reportForm.month, selectedYear: $scope.reportForm.year, workType: $scope.reportForm.workType };
      const token = $window.localStorage.getItem("token");
      $http({
        method: 'POST', url: `${endpoints.GENERATE_REPORT}`, data: request,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }, responseType: 'arraybuffer'
      }).then(function (response) {
        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const year = new Date().getFullYear();
        const fileName = `itf_work_status_${$scope.selectedMonth}_${year}.xlsx`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        $scope.isDownloading = false;
      })
        .catch(function (error, status) {
          console.error('Download failed:', error, status);
          $scope.errorMessage = 'Failed to download the report. Please try again.';
          $scope.isDownloading = false;
        });
    }

    const Initialize = () => {
      initializeYears();
      const user = $window.localStorage.getItem("user");
      $scope.currentUserDetails = JSON.parse(user);
      if ($scope.currentUserDetails != null && ["superAdmin", "hr", "admin"].includes($scope.currentUserDetails?.role)) {
        $scope.getUsers();
      }
      $scope.getTaskHistory();
    };
    Initialize();
  }
);
