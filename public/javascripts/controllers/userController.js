app.controller("UsersController", [
  "$scope",
  "HttpService",
  "$window",
  "SweetAlertService",
  function ($scope, HttpService, $window, SweetAlertService) {
    // Initialize controller state
    $scope.users = [];
    $scope.search = "";
    $scope.selectedRole = "";
    $scope.isLoading = false;
    $scope.currentUserDetails = null;

    // User form model
    $scope.form = {
      _id: "",
      name: "",
      email: "",
      mobile: "",
      password: "",
      jobTitle: "",
      role: "admin",
    };

    $scope.pages = [];
    $scope.pagination = {
      hasNextPage: true,
      hasPrevPage: false,
      limit: 1,
      nextPage: 0,
      page: 10,
      pagingCounter: 0,
      prevPage: null,
      totalDocs: 0,
      totalPages: 0
    };

    $scope.changePage = function (page) {
      if (page && page >= 1 && page <= $scope.pagination.totalPages) {
        $scope.pagination.page = page;
        $scope.getUsers(page);
      }
    };


    // Load current user from localStorage
    const user = $window.localStorage.getItem("user");
    if (user) {
      $scope.currentUserDetails = JSON.parse(user);
    }

    // Check if current user has permission for an action on a target role
    $scope.checkPermission = function (action, targetRole) {
      if (!$scope.currentUserDetails || !$scope.currentUserDetails.role) return false;
      const rolePermissions = ROLE_PERMISSIONS[$scope.currentUserDetails.role];
      if (!rolePermissions || !rolePermissions[action]) return false;
      if (!targetRole) return true; // Just checking if they can perform the action in general
      return rolePermissions[action].includes(targetRole);
    };

    $scope.onSearch = () => $scope.getUsers(1);

    // Get all users
    $scope.getUsers = function (page) {
      $scope.isLoading = true;
      $scope.pages = [];
      $scope.pagination.page = page;
      HttpService.post(endpoints.GET_USERS, { page: page, limit: 10, search: $scope.search, workType: $scope.selectedRole })
        .then(function (response) {
          if (response.data != null && Array.isArray(response.data.docs)) {
            $scope.users = response.data.docs;
            delete response.data.docs;
            $scope.pagination = response.data;

            for (var i = 1; i <= $scope.pagination.totalPages; i++) {
              $scope.pages.push(i);
            }
          }
        })
        .catch(function (error) {
          SweetAlertService.error(
            "Error",
            error.message || "Failed to load users"
          );
        })
        .finally(function () {
          $scope.isLoading = false;
        });
    };

    // Save or update user
    $scope.onSubmit = function () {
      if (!$scope.validateUserForm()) return;
      const request = angular.copy($scope.form);
      HttpService.post(endpoints.SAVE_USER, request)
        .then((response) => {
          $scope.getUsers();
          SweetAlertService.toast(
            $scope.form._id
              ? "User updated successfully"
              : "User saved successfully",
            "success"
          );
          $scope.resetForm();
        })
        .catch((error) => {
          const errorMessage = (error.data && error.data.message) || error.message || "Failed to save user";
          SweetAlertService.toast(errorMessage, "error");
        });
    };

    // Edit user
    $scope.editUser = function (user) {
      $scope.form = {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        password: "",
        jobTitle: user.jobTitle || "",
        role: user.role,
        workType: user.workType || "onsite"
      };
    };

    // Validate user form
    $scope.validateUserForm = function () {
      if (!$scope.form.email || !$scope.form.role) {
        SweetAlertService.toast(
          "Email and role are required fields",
          "warning"
        );
        return false;
      }

      // For new users, password is required
      if (!$scope.form._id && !$scope.form.password) {
        SweetAlertService.toast(
          "Password is required for new users",
          "warning"
        );
        return false;
      }

      return true;
    };

    // Reset form
    $scope.resetForm = function () {
      $scope.form = {
        _id: "",
        name: "",
        email: "",
        mobile: "",
        password: "",
        jobTitle: "",
        role: "developer",
        workType: "onsite"
      };
    };

    // Filter roles available to the current user
    $scope.getAvailableRoles = function () {
      if (!$scope.currentUserDetails) return [];
      const rolePermissions = ROLE_PERMISSIONS[$scope.currentUserDetails.role];
      if (!rolePermissions) return [];
      return rolePermissions.canAdd;
    };

    $scope.updateWorkType = function () {
      if ($scope.form.role === "developer") {
        $scope.form.workType = "onsite";
      } else {
        $scope.form.workType = "";
      }
    };

    $scope.toggleAccountStatus = function (index) {
      let id = $scope.users[index]._id;
      let status = !$scope.users[index].isActive;
      HttpService.post(endpoints.TOGGLE_ACCOUNT_STATUS, { id, status }).then((response) => {
        if (response.data != null) { $scope.users[index] = response.data; }
        SweetAlertService.toast("Account status updated!", "success");
      }).catch((error) => SweetAlertService.toast(error.message || "Failed to save user", "error"));
    }

    $scope.deleteUserAccount = async function (index) {
      let result = await SweetAlertService.confirm("Delete", "Do you really want to delete this account?", null, null);
      if (result.isConfirmed) {
        let id = $scope.users[index]._id;
        HttpService.post(endpoints.DELETE_USER_ACCOUNT, { id }).then((response) => {
          if (response.data) { $scope.getUsers(); }
          SweetAlertService.toast(response.message, response.data ? "success" : "warning");
        }).catch((error) => SweetAlertService.toast(error.message || "Failed to save user", "error"));
      }
    }

    // Initialize controller
    $scope.getUsers(1);
  },
]);
