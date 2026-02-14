app.controller('DashboardController', ($scope, HttpService, SweetAlertService) => {
  $scope.dashboard = null;
  $scope.isLoading = false;
  $scope.isAdmin = false;

  // Load user profile to check if admin
  $scope.loadProfile = function () {
    let localProfile = HttpService.getUserData();
    if (localProfile != null) {
      $scope.isAdmin = localProfile.role === 'admin';
    }
  };

  $scope.loadDashboard = function () {
    $scope.isLoading = true;

    HttpService.post(endpoints.GET_DASHBOARD).then(function (response) {
      $scope.dashboard = response.data;
    }).catch(function (error) {
      SweetAlertService.error("Dashboard Error", error.message || "Failed to load dashboard data");
      $scope.dashboard = null;
    })
      .finally(function () {
        $scope.isLoading = false;
      });
  };

  $scope.developers = [];
  $scope.workType = "onsite";
  $scope.reportDate = "";
  $scope.isDeveloperTableLoading = false;
  $scope.getDeveloperReport = function () {
    $scope.isDeveloperTableLoading = true;
    HttpService.post(endpoints.GET_DEVELOPER_REPORT, { workType: $scope.workType, reportDate: $scope.reportDate }).then((response) => {
      $scope.isDeveloperTableLoading = false;
      if (response && response.data) {
        $scope.developers = response.data;
      }
    }).catch((error) => {
      SweetAlertService.error("Error", error.message || "Failed to developers tasks!");
    }).finally(() => {
      $scope.isDeveloperTableLoading = false;
    });
  }

  $scope.onRefresh = () => {
    $scope.reportDate = "";
    $scope.getDeveloperReport();
  }

  $scope.tasksList = [];
  $scope.loadTask = (tasks) => {
    if (tasks.length != 0) {
      $scope.tasksList = tasks;
      $('#taskListModal').modal('show');
    }
  }

  // Function to initiate call
  $scope.initiateCall = function (mobile) {
    if (mobile) {
      // Remove any non-digit characters and format for tel: protocol
      const phoneNumber = mobile.replace(/\D/g, '');
      if (phoneNumber) {
        window.location.href = `tel:${phoneNumber}`;
      } else {
        SweetAlertService.toast("Invalid phone number", "error");
      }
    } else {
      SweetAlertService.toast("Phone number not available", "error");
    }
  };

  $scope.loadProfile();
  $scope.getDeveloperReport();
  $scope.loadDashboard();
}
);