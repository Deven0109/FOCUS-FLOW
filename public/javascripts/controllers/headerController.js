const showTutorialModal = () => {
  $('#videoModal').modal('show');
}

app.controller('HeaderController', ['$scope', 'HttpService', '$window', 'SweetAlertService', '$timeout', function ($scope, HttpService, $window, SweetAlertService, $timeout) {
  $scope.profile = null;
  $scope.currentPath = $window.location.pathname || '';
  $scope.isDocumentsPage = ($scope.currentPath.indexOf('/app/documents') === 0);
  $scope.isNoticePage = ($scope.currentPath.indexOf('/app/notice') === 0);
  $scope.isMastersPage = ($scope.currentPath.indexOf('/admin/masters') === 0 || $scope.currentPath.indexOf('/admin/attendance') === 0);
  $scope.isTasksPage = ($scope.currentPath === '/app/task' || $scope.currentPath === '/app/task-history');
  $scope.isLeaveCalendarPage = ($scope.currentPath === '/app/calendar');
  $scope.isDashboardPage = ($scope.currentPath === '/app/dashboard');

  $scope.notifications = [];
  $scope.unreadNotificationsCount = 0;
  $scope.notificationPage = 1;
  $scope.totalPages = 1; // Track total pages for "View More"

  $scope.loadProfile = function () {
    let localProfile = HttpService.getUserData();
    if (localProfile != null) {
      localProfile.profileImage = `${imageURL}${localProfile.profileImage}`;
      $scope.initSocket(localProfile._id);
      $scope.loadNotifications();
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

  $scope.initSocket = function (userId) {
    if (typeof io !== 'undefined') {
      const socket = io();
      socket.emit('join', userId);

      socket.on('newNotification', function (data) {
        $scope.$apply(function () {
          $scope.notifications.unshift(data);
          $scope.unreadNotificationsCount++;
        });
      });
    }
  };

  $scope.loadNotifications = function (loadMore = false) {
    if (loadMore) $scope.notificationPage++;
    else $scope.notificationPage = 1;

    HttpService.get('/api/notifications', { params: { page: $scope.notificationPage, limit: 10 } }).then(function (res) {
      if (res && res.success) {
        if (loadMore) {
          $scope.notifications = $scope.notifications.concat(res.data);
        } else {
          $scope.notifications = res.data;
        }
        $scope.unreadNotificationsCount = res.unreadCount;
        $scope.totalPages = res.totalPages || 1;
      }
    });
  };

  $scope.markAllAsRead = function () {
    HttpService.put('/api/notifications/read-all', {}).then(function (res) {
      if (res.success) {
        $scope.notifications.forEach(n => n.isRead = true);
        $scope.unreadNotificationsCount = 0;
      }
    });
  };

  $scope.handleNotificationClick = function (noti) {
    if (!noti.isRead) {
      HttpService.put(`/api/notifications/${noti._id}/read`, {}).then(function (res) {
        if (res.success) {
          noti.isRead = true;
          $scope.unreadNotificationsCount = Math.max(0, $scope.unreadNotificationsCount - 1);
        }
      });
    }

    let url = '';
    switch (noti.module) {
      case 'work':
        url = '/app/documents';
        break;
      case 'notice-board':
        url = '/app/notice';
        break;
      case 'leave-calendar':
        url = '/app/calendar';
        break;
    }

    if (url) {
      $window.location.href = url;
    }
  };

  $scope.deleteNotification = function (event, noti) {
    if (event) event.stopPropagation();
    HttpService.delete(`/api/notifications/${noti._id}`).then(function (res) {
      if (res && res.success) {
        $timeout(function () {
          const index = $scope.notifications.indexOf(noti);
          if (index > -1) {
            if (!noti.isRead) {
              $scope.unreadNotificationsCount = Math.max(0, $scope.unreadNotificationsCount - 1);
            }
            $scope.notifications.splice(index, 1);
          }
          if ($scope.notifications.length === 0) {
            $scope.loadNotifications();
          }
        });
      }
    });
  };

  $scope.formatTime = function (date) {
    return moment(date).fromNow();
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
