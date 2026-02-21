app.controller('DashboardController', ($scope, HttpService, SweetAlertService) => {
  $scope.dashboard = null;
  $scope.isLoading = false;
  $scope.isAdmin = false;

  // Load user profile to check if admin
  $scope.loadProfile = function () {
    let localProfile = HttpService.getUserData();
    if (localProfile != null) {
      const role = (localProfile.role || '').toLowerCase();
      $scope.isAdmin = ['superadmin', 'hr', 'admin', 'human resource'].includes(role);
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

  // --- Leave Analytics ---
  $scope.analyticsTime = 'month';
  $scope.analyticsWorkType = 'onsite';
  $scope.hasAnalyticsData = false;
  $scope.analyticsLoading = false;
  let analyticsChartInstance = null;

  $scope.getLeaveAnalytics = function () {
    $scope.analyticsLoading = true;
    const scrollPos = window.scrollY; // Preserve scroll

    const payload = {
      timeRange: $scope.analyticsTime,
      workType: $scope.isAdmin ? $scope.analyticsWorkType : undefined
    };

    // Use specific endpoint or fallback
    const url = '/users/leaves/analytics';

    HttpService.post(url, payload).then(function (response) {
      if (response.data) {
        $scope.renderLeaveChart(response.data);
      } else if (response.labels) {
        // Handle unwrapped response if interceptor unwraps it
        $scope.renderLeaveChart(response);
      }
    }).catch(function (error) {
      console.error("Error loading leave analytics", error);
      $scope.hasAnalyticsData = false;
    }).finally(function () {
      $scope.analyticsLoading = false;
      // create slight delay to restore scroll if needed, though usually not needed for chart updates
    });
  };

  $scope.setAnalyticsWorkType = function (type) {
    if ($scope.analyticsWorkType === type) return;
    $scope.analyticsWorkType = type;
    $scope.getLeaveAnalytics();
  };

  $scope.setAnalyticsTime = function () {
    $scope.getLeaveAnalytics();
  };
  // -----------------------

  $scope.developers = [];
  $scope.workType = "onsite";
  $scope.reportDate = "";
  $scope.isDeveloperTableLoading = false;
  $scope.renderLeaveChart = function (data) {
    // Check if we have data points
    let totalPoints = 0;
    if (data.datasets) {
      data.datasets.forEach(ds => {
        if (ds.data) totalPoints += ds.data.reduce((a, b) => a + b, 0);
      });
    }

    $scope.hasAnalyticsData = totalPoints > 0;
    $scope.analyticsTotalLeaves = totalPoints;

    // Helper: Convert hex color to rgba with opacity
    function hexToRgba(hex, opacity) {
      hex = hex.replace('#', '');
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
    }

    // Build breakdown data for display
    $scope.analyticsBreakdown = [];
    if (data.labels && data.datasets && data.datasets[0]) {
      var ds = data.datasets[0];
      for (var i = 0; i < data.labels.length; i++) {
        var rawColor = ds.backgroundColor[i] || '#6c757d';
        var displayColor = rawColor.startsWith('#') ? hexToRgba(rawColor, 0.6) : rawColor;
        $scope.analyticsBreakdown.push({
          label: data.labels[i],
          color: displayColor,
          leaveCount: ds.data[i] || 0,
          userCount: (data.userCounts && data.userCounts[i]) ? data.userCounts[i] : 0
        });
      }
    }

    // Compute total users
    $scope.analyticsTotalUsers = 0;
    $scope.analyticsBreakdown.forEach(function (item) {
      $scope.analyticsTotalUsers += item.userCount;
    });

    // Force angular digest to show hide no data message
    if (!$scope.$$phase) $scope.$apply();

    const ctx = document.getElementById('leaveAnalyticsChart');
    if (!ctx) return;

    if (analyticsChartInstance) {
      analyticsChartInstance.destroy();
      analyticsChartInstance = null;
    }

    if (!$scope.hasAnalyticsData) return;

    // Custom Plugin: Draw Labels on Pie Slices
    const pieLabelsPlugin = {
      id: 'pieLabels',
      afterDraw: function (chart) {
        var ctx = chart.ctx;
        var meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        meta.data.forEach(function (arc, index) {
          var leaveCount = chart.data.datasets[0].data[index];
          var userCount = (data.userCounts && data.userCounts[index]) ? data.userCounts[index] : 0;

          // Calculate position at midpoint of the arc
          var startAngle = arc.startAngle;
          var endAngle = arc.endAngle;
          var midAngle = (startAngle + endAngle) / 2;
          var outerRadius = arc.outerRadius;
          var innerRadius = arc.innerRadius || 0;
          var midRadius = (outerRadius + innerRadius) / 2;

          var x = arc.x + Math.cos(midAngle) * midRadius;
          var y = arc.y + Math.sin(midAngle) * midRadius;

          // Only show labels if slice is big enough
          var sliceAngle = endAngle - startAngle;
          if (sliceAngle < 0.3) return; // Skip very small slices

          // Draw leave count label
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 13px sans-serif';
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 3;

          if ($scope.isAdmin) {
            ctx.fillText('Leave: ' + leaveCount, x, y - 8);
            // Draw user count label
            ctx.font = '11px sans-serif';
            ctx.fillText('User: ' + userCount, x, y + 10);
          } else {
            // Developer: only show leave count
            ctx.fillText('Leave: ' + leaveCount, x, y);
          }
          ctx.restore();
        });
      }
    };

    // Apply reduced opacity to chart colors
    var chartDatasets = JSON.parse(JSON.stringify(data.datasets));
    if (chartDatasets[0] && chartDatasets[0].backgroundColor) {
      chartDatasets[0].backgroundColor = chartDatasets[0].backgroundColor.map(function (color) {
        if (color.startsWith('#')) {
          return hexToRgba(color, 0.6);
        }
        return color;
      });
    }

    // Create Pie Chart
    analyticsChartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.labels,
        datasets: chartDatasets
      },
      plugins: [pieLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                let value = context.parsed;

                if ($scope.isAdmin) {
                  let userCount = 0;
                  if (data.userCounts && data.userCounts[context.dataIndex] !== undefined) {
                    userCount = data.userCounts[context.dataIndex];
                  }
                  return ` ${label}${value} Leaves (${userCount} Users)`;
                } else {
                  return ` ${label}${value} Leaves`;
                }
              }
            }
          }
        },
        layout: {
          padding: 20
        }
      }
    });
  };
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
  $scope.getLeaveAnalytics(); // Trigger initial load
}
);