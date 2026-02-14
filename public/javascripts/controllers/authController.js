app.controller("AuthController", ($scope, HttpService, $window, SweetAlertService) => {

  (() => {
    let token = $window.localStorage.getItem("token");
    if (token != null) {
      window.location.href = "/app/dashboard"
    }
  })();

  $scope.showPassword = false;
  $scope.form = { email: "", password: "" };

  $scope.isLoading = false;
  $scope.onSubmit = () => {
    if (!$scope.form.email || !$scope.form.password) {
      SweetAlertService.toast("Please fill in all fields", "error");
      return;
    }

    if (!$scope.form.email.includes('itfuturz.com')) {
      SweetAlertService.toast("Email must have itfuturz.com domain.", "error");
      return;
    }

    $scope.isLoading = true;
    HttpService.post(endpoints.LOGIN, $scope.form)
      .then(function (response) {
        if (response && response.data) {
          const token = response.data.token;
          delete response.data.token;
          setTimeout(() => {
            $scope.isLoading = false;
            HttpService.setToken(token);
            HttpService.setUserData(response.data);
            SweetAlertService.toast("Login successful", "success");
            $window.location.href = "/app/dashboard";
            $scope.$apply(() => { });
          }, 1500)
        } else {
          $scope.isLoading = false;
          SweetAlertService.toast(
            response.message || "Login failed",
            "warning"
          );
        }
      })
      .catch((error) => { $scope.isLoading = false; console.error("Login error:", error) });
  };

  $scope.clearForm = () => ($scope.form = { email: "", password: "" });
}
);
