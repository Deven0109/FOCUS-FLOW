app.controller("AttendanceController", ($scope, HttpService, SweetAlertService) => {
    $scope.attendanceList = [];
    $scope.allUsers = [];
    $scope.isLoading = false;
    $scope.isSaving = false;

    // Filters matching the UI
    const today = new Date();
    $scope.filters = {
        workType: 'onsite',
        userId: '',
        startDate: today,
        endDate: today
    };

    // Manual Entry model
    $scope.manualEntry = {
        userId: '',
        date: today,
        startTime: null,
        endTime: null
    };

    $scope.init = function () {
        $scope.getAllUsers();
        $scope.getAttendanceList();
    };

    $scope.getAllUsers = function () {
        HttpService.post(endpoints.GET_ALL_USERS, {})
            .then(function (response) {
                if (response.data) {
                    $scope.allUsers = response.data.filter(u => u.role !== 'admin');
                }
            })
            .catch(error => {
                console.error("Error fetching users:", error);
            });
    };

    $scope.onWorkTypeChange = function () {
        $scope.filters.userId = '';
        $scope.getAttendanceList();
    };

    $scope.getAttendanceList = function () {
        $scope.isLoading = true;

        // Format dates for API
        const request = {
            startDate: moment($scope.filters.startDate).format('YYYY-MM-DD'),
            endDate: moment($scope.filters.endDate).format('YYYY-MM-DD'),
            workType: $scope.filters.workType,
            userId: $scope.filters.userId
        };

        HttpService.post(endpoints.GET_ATTENDANCE_LIST, request)
            .then(function (response) {
                if (response.data) {
                    $scope.attendanceList = response.data;
                }
            })
            .catch(error => {
                SweetAlertService.toast(error.message || "Failed to fetch attendance", "error");
            })
            .finally(() => {
                $scope.isLoading = false;
            });
    };

    $scope.viewTasks = function (tasks) {
        $scope.currentTasks = tasks || [];
        $('#tasksModal').modal('show');
    };

    $scope.openManualModal = function () {
        $scope.manualEntry = {
            userId: '',
            date: new Date(),
            startTime: null,
            endTime: null
        };
        $('#manualModal').modal('show');
    };

    $scope.submitManualEntry = function () {
        if (!$scope.manualEntry.userId || !$scope.manualEntry.date || !$scope.manualEntry.startTime) {
            return SweetAlertService.toast("Please fill all required fields", "warning");
        }

        $scope.isSaving = true;

        const payload = {
            userId: $scope.manualEntry.userId,
            date: moment($scope.manualEntry.date).format('YYYY-MM-DD'),
            startTime: moment($scope.manualEntry.startTime).format('HH:mm'),
            endTime: $scope.manualEntry.endTime ? moment($scope.manualEntry.endTime).format('HH:mm') : null
        };

        HttpService.post(endpoints.MARK_MANUAL_ATTENDANCE, payload)
            .then(function (response) {
                SweetAlertService.toast("Attendance marked successfully", "success");
                $('#manualModal').modal('hide');
                $scope.getAttendanceList();
            })
            .catch(error => {
                SweetAlertService.toast(error.message || "Failed to mark attendance", "error");
            })
            .finally(() => {
                $scope.isSaving = false;
            });
    };

    $scope.init();
});
