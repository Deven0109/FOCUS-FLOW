app.controller('TaskController', ($scope, HttpService, $window, SweetAlertService) => {

  // Initialize controller state
  $scope.todaysDataResult = null;
  $scope.currentUserDetails = null;
  $scope.isLoading = false;
  $scope.tasks = [];

  // Default task template
  const defaultTask = {
    task: "",
    assignedTo: "",
    assignedBy: "",
    status: "not-started",
    isTrackerStarted: false,
    initalStartedTime: "",
    lastStartedTime: "",
    endedTime: "",
    totalSeconds: 0,
    countView: "00:00:00",
    estimatedTime: { hour: "0", minutes: "15" },
    priority: "high",
    carriedOver: false
  };

  // Load current user from localStorage
  function loadCurrentUser() {
    const user = $window.localStorage.getItem('user');
    if (user) {
      $scope.currentUserDetails = JSON.parse(user);
      $scope.getTodaysData();
    }
  }

  $scope.getTimeDifferenceFormatted = (initialDateStr, lastDateStr) => {
    const initialDate = new Date(initialDateStr);
    const currentDate = lastDateStr != null ? new Date(lastDateStr) : new Date();

    let diffInSeconds = Math.floor((currentDate - initialDate) / 1000);

    const hours = String(Math.floor(diffInSeconds / 3600)).padStart(2, '0');
    diffInSeconds %= 3600;
    const minutes = String(Math.floor(diffInSeconds / 60)).padStart(2, '0');
    const seconds = String(diffInSeconds % 60).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  }

  // Get today's data
  $scope.getTodaysData = function () {
    $scope.isLoading = true;

    HttpService.post(endpoints.GET_TODAYS_DATA, {})
      .then(function (response) {
        if (Array.isArray(response.data) && response.data.length > 0) {
          $scope.todaysDataResult = response.data[0];
          let tasks = angular.copy($scope.todaysDataResult.tasks) || [angular.copy(defaultTask)];
          tasks = tasks.map((v) => {
            if (v.estimatedTime == null || v.estimatedTime == "") { v.estimatedTime = { hour: "0", minutes: "15" } }
            if (v.isTrackerStarted == null) { v.isTrackerStarted = false; }
            if (v.initalStartedTime == null) { v.initalStartedTime = ""; }
            if (v.lastStartedTime == null) { v.lastStartedTime = ""; }
            if (v.endedTime == null) { v.endedTime = ""; }
            if (v.totalSeconds == null) { v.totalSeconds = 0; }
            if (v.countView == null) { v.countView = "00:00:00"; }
            else {
              if (v.isTrackerStarted) {
                v.countView = $scope.getTimeDifferenceFormatted(v.lastStartedTime, null)
              } else {
                v.countView = v.lastStartedTime == "" ? "00:00:00" : $scope.getTimeDifferenceFormatted(v.lastStartedTime, v.endedTime)
              }
            }

            return v;
          });
          $scope.tasks = tasks;

          setInterval(() => {
            for (let i = 0; i < $scope.tasks.length; i++) {
              if ($scope.tasks[i]._id != null && $scope.tasks[i].isTrackerStarted) {
                $scope.tasks[i].countView = $scope.getTimeDifferenceFormatted($scope.tasks[i].lastStartedTime, null);
                $scope.$apply(() => { });
              }
            }
          }, 1000);

        } else {
          $scope.tasks = [angular.copy(defaultTask)];
        }
      })
      .catch(function (error) {
        SweetAlertService.error("Error", error.message || "Failed to load today's data");
      })
      .finally(function () {
        $scope.isLoading = false;
      });
  };

  // Add new task
  $scope.addTask = function () { $scope.tasks.push(angular.copy(defaultTask)); };

  // Delete task
  $scope.deleteTask = function (index) {
    if ($scope.tasks.length <= 1) {
      SweetAlertService.toast("You must have at least one task!", "warning");
      return;
    }

    SweetAlertService.confirm("Delete", "Do you really want to delete this task?").then(function (result) {
      if (result.isConfirmed) {
        $scope.$apply(() => { $scope.tasks.splice(index, 1); })
      }
    });
  };

  // Validate tasks
  function validateTasks() {
    if (!$scope.tasks || $scope.tasks.length === 0) {
      SweetAlertService.toast("Please add at least one task!", "warning");
      return false;
    }

    const hasEmptyTasks = $scope.tasks.some(t => !t.task.trim());
    if (hasEmptyTasks) {
      SweetAlertService.toast("Task descriptions cannot be empty!", "warning");
      return false;
    }

    return true;
  }

  // Prepare tasks for submission
  function prepareTasks() {
    return $scope.tasks.map(task => ({
      ...task,
      assignedTo: task.assignedTo || $scope.currentUserDetails.id,
      assignedBy: task.assignedBy || $scope.currentUserDetails.id
    }));
  }

  // Update tasks
  $scope.updateTasks = function () {
    if (!validateTasks() || !$scope.todaysDataResult) return;

    const request = {
      id: $scope.todaysDataResult._id,
      tasks: prepareTasks()
    };

    HttpService.post(endpoints.UPDATE_TASKS, request)
      .then(function () {
        $scope.getTodaysData();
        SweetAlertService.toast("Tasks updated successfully!", "success");
      })
      .catch(function (error) {
        SweetAlertService.error("Error", error.message || "Failed to update tasks");
      });
  };

  // Start timer
  $scope.startTimer = function () {
    if (!validateTasks()) return;

    const request = {
      user: $scope.currentUserDetails.id,
      tasks: prepareTasks()
    };

    HttpService.post(endpoints.START_TIMER, request)
      .then(function () {
        $scope.getTodaysData();
        SweetAlertService.toast("Day Started", "success");
      })
      .catch(function (error) {
        SweetAlertService.error("Error", error.message || "Failed to start timer");
      });
  };

  // Stop timer
  $scope.stopTimer = function () {
    if (!$scope.todaysDataResult) return;

    SweetAlertService.confirm('Stop Timer', 'Do you really want to stop timer?')
      .then(function (result) {
        if (result.isConfirmed) {
          const request = { id: $scope.todaysDataResult._id };
          return HttpService.post(endpoints.STOP_TIMER, request);
        }
        return Promise.reject('cancelled');
      })
      .then(function (response) {
        $scope.$apply(() => { });
        $scope.getTodaysData();

        const message = (response && response.data && response.data.lateMarkingMessage)
          ? response.data.lateMarkingMessage
          : "Timer stopped successfully!";

        if (response && response.data && response.data.isLateMarking) {
          SweetAlertService.success("Session Closed (Late Marking)", message);
        } else {
          SweetAlertService.toast(message, "success");
        }
      })
      .catch(function (error) {
        if (error !== 'cancelled') {
          SweetAlertService.error("Error", error.message || "Failed to stop timer");
        }
      });
  };

  // Format time
  $scope.formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let result = '';
    if (hours > 0) {
      result += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) {
      result += `${minutes}m `;
    }
    result += `${secs}s`;
    return result.trim();
  };

  $scope.updateTaskTimer = function (task, index) {
    const dailyStatusId = $scope.todaysDataResult._id;
    const localTask = task;
    HttpService.post(endpoints.UPDATE_TASK_TIMER, { id: dailyStatusId, task: localTask }).then(function (response) {
      if (response.data != null) { $scope.tasks[index] = response.data; }
      SweetAlertService.toast("Tasks updated successfully!", "success");
    }).catch(function (error) {
      SweetAlertService.error("Error", error.message || "Failed to update tasks");
    });
  }

  // Toogle time tracker
  $scope.toggleTimer = function (index) {
    if (($scope.todaysDataResult == null || ($scope.todaysDataResult != null && $scope.todaysDataResult.endTime != null))) {
      return;
    } else {
      if ($scope.tasks[index]._id == null) {
        SweetAlertService.toast("Your task must be saved before starting tracker!", "warning");
      } else {

        let test = $scope.tasks.filter((v) => v.isTrackerStarted && v._id != $scope.tasks[index]._id);
        if (test.length > 0) {
          SweetAlertService.toast("A tracker is already running in another task. Please stop it before starting a new one.", "warning");
          return;
        } else {
          $scope.tasks[index].isTrackerStarted = !$scope.tasks[index].isTrackerStarted
          if ($scope.tasks[index].isTrackerStarted) {
            let time = Date.now();
            if ($scope.tasks[index].initalStartedTime == "") {
              $scope.tasks[index].initalStartedTime = time;
            }
            $scope.tasks[index].lastStartedTime = time;
            $scope.tasks[index].endedTime = "";
          } else {
            $scope.tasks[index].endedTime = Date.now();
            const startTime = new Date($scope.tasks[index].lastStartedTime);
            const endTime = $scope.tasks[index].endedTime;
            const diffInSeconds = Math.floor((endTime - startTime.getTime()) / 1000);
            $scope.tasks[index].totalSeconds += diffInSeconds;
          }
          $scope.updateTaskTimer($scope.tasks[index], index);
        }
      }
    }
  }
  loadCurrentUser();

});