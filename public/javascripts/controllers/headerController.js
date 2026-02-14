const showTutorialModal = () => {
  $('#videoModal').modal('show');
}

app.controller('HeaderController', ['$scope', 'HttpService', '$window', 'SweetAlertService', '$timeout', function ($scope, HttpService, $window, SweetAlertService, $timeout) {
  $scope.profile = null;
  $scope.currentPath = $window.location.pathname || '';
  $scope.isDocumentsPage = ($scope.currentPath === '/app/documents' || $scope.currentPath.indexOf('/app/documents') === 0);
  $scope.isNoticePage = ($scope.currentPath === '/app/notice' || $scope.currentPath.indexOf('/app/notice') === 0);

  $scope.loadProfile = function () {
    let localProfile = HttpService.getUserData();
    if (localProfile != null) {
      localProfile.profileImage = `${imageURL}${localProfile.profileImage}`;
    }
    $scope.profile = localProfile;

    // Show Documents info modal once for onsite users who haven't acknowledged
    if (localProfile && localProfile.workType === 'onsite') {
      var storageKey = 'documentsModalAcknowledged_' + (localProfile._id || 'user');
      if (!$window.localStorage.getItem(storageKey)) {
        $timeout(function () {
          var $modal = $('#documentsInfoModal');
          if ($modal.length) $modal.modal('show');
        }, 500);
      }
    }
  };

  $scope.acknowledgeDocumentsModal = function () {
    if ($scope.profile && $scope.profile._id) {
      $window.localStorage.setItem('documentsModalAcknowledged_' + $scope.profile._id, 'true');
    } else {
      $window.localStorage.setItem('documentsModalAcknowledged_user', 'true');
    }
    var $modal = $('#documentsInfoModal');
    if ($modal.length) $modal.modal('hide');
  };

  $scope.logout = function () {
    SweetAlertService.confirm("Logout", "Do you really want to logout?").then(function (result) {
      if (result.isConfirmed) {
        HttpService.clearStorage();
        redirectToLogin();
      }
    });
  };

  function redirectToLogin() {
    $window.location.href = "/";
  }

  $scope.loadProfile();
}]);
