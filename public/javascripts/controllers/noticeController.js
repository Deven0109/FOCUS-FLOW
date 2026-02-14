app.controller('NoticeController', ['$scope', '$http', '$window', 'HttpService', function ($scope, $http, $window, HttpService) {
    $scope.notices = [];
    $scope.isHR = false;
    $scope.formData = {};
    $scope.viewData = {};
    $scope.modalTitle = '';
    $scope.employees = [];
    $scope.selectedEmployees = [];

    // Initialize
    $scope.init = function () {
        console.log('=== Notice Controller Init ===');
        const user = HttpService.getUserData();
        console.log('User data:', user);

        if (user) {
            $scope.isHR = user.role === 'hr';
            $scope.userWorkType = user.workType || 'onsite';
            console.log('Is HR:', $scope.isHR);
            console.log('User Work Type:', $scope.userWorkType);

            // Block Admin and Super Admin
            if (['admin', 'superAdmin'].includes(user.role)) {
                console.log('Admin/SuperAdmin detected, redirecting...');
                $window.location.href = '/app/dashboard';
                return;
            }
        }
        $scope.loadNotices();
    };

    // Load all notices
    $scope.loadNotices = function () {
        console.log('=== Loading Notices ===');
        console.log('Endpoint:', endpoints.NOTICES_LIST);

        HttpService.post(endpoints.NOTICES_LIST, { workType: $scope.userWorkType })
            .then(function (response) {
                console.log('Response received:', response);
                if (response.status === 200) {
                    $scope.notices = response.data;
                    console.log('Notices loaded:', $scope.notices.length);
                } else {
                    console.error('Unexpected status:', response.status);
                }
            })
            .catch(function (error) {
                console.error('Error loading notices:', error);
            });
    };

    // Load employees by work type
    $scope.loadEmployees = function (workType) {
        if (!workType) return Promise.resolve();

        return HttpService.post(endpoints.NOTICE_EMPLOYEES, { workType: workType })
            .then(function (response) {
                if (response.status === 200) {
                    $scope.employees = response.data.map(function (emp) {
                        emp.selected = false; // Add selected property
                        return emp;
                    });
                }
                return response;
            })
            .catch(function (error) {
                console.error('Error loading employees:', error);
            });
    };

    // Toggle all employees selection
    $scope.toggleAllEmployees = function () {
        if ($scope.allEmployeesSelected) {
            // Deselect all individual employees
            $scope.employees.forEach(function (emp) {
                emp.selected = false;
            });
            $scope.selectedEmployees = [];
        }
    };

    // Update employee selection
    $scope.updateEmployeeSelection = function () {
        // If any employee is selected, uncheck 'All Employees'
        var anySelected = $scope.employees.some(function (emp) { return emp.selected; });
        if (anySelected) {
            $scope.allEmployeesSelected = false;
        }

        // Update selectedEmployees array
        $scope.selectedEmployees = $scope.employees
            .filter(function (emp) { return emp.selected; })
            .map(function (emp) { return emp._id; });
    };

    // Handle work type change
    $scope.onWorkTypeChange = function () {
        $scope.selectedEmployees = [];
        $scope.allEmployeesSelected = false;
        // Load employees for all work types
        $scope.loadEmployees($scope.formData.workTypeFilter);
    };



    // Open Add Modal
    $scope.openAddModal = function () {
        console.log('=== Opening Add Modal ===');
        $scope.modalTitle = 'Add New Notice';
        $scope.formData = {
            title: '',
            content: '',
            workTypeFilter: 'all',
            targetEmployees: []
        };
        $scope.selectedEmployees = [];
        $scope.allEmployeesSelected = false;
        $scope.employeeSearch = '';
        $scope.employees = [];

        // Load all employees by default
        $scope.loadEmployees('all');

        // Clear file input safely
        var fileInput = document.getElementById('noticeFile');
        if (fileInput) {
            fileInput.value = '';
        }

        // Open modal using jQuery
        $('#noticeModal').modal('show');
    };

    // Edit Notice
    $scope.editNotice = function (notice) {
        console.log('=== Opening Edit Modal ===', notice);
        $scope.modalTitle = 'Edit Notice';
        $scope.formData = {
            _id: notice._id,
            title: notice.title,
            content: notice.content,
            workTypeFilter: notice.workTypeFilter,
            targetEmployees: notice.targetEmployees ? notice.targetEmployees.map(e => e._id) : [],
            existingFile: notice.fileUrl ? notice.fileType.toUpperCase() : null
        };

        var targetIds = notice.targetEmployees ? notice.targetEmployees.map(e => e._id) : [];
        $scope.selectedEmployees = targetIds;
        $scope.allEmployeesSelected = targetIds.length === 0;

        $scope.loadEmployees(notice.workTypeFilter).then(function () {
            // Mark employees as selected
            $scope.employees.forEach(function (emp) {
                emp.selected = targetIds.indexOf(emp._id) !== -1;
            });
        });

        var fileInput = document.getElementById('noticeFile');
        if (fileInput) {
            fileInput.value = '';
        }

        // Open modal using jQuery
        $('#noticeModal').modal('show');
    };

    // Handle file selection
    $scope.handleFileSelect = function (input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                Swal.fire({
                    icon: 'error',
                    title: 'File Too Large',
                    text: 'File size must not exceed 10MB',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                input.value = '';
                return;
            }
        }
    };

    // Submit Notice (Create or Update)
    $scope.submitNotice = function () {
        if (!$scope.formData.title || !$scope.formData.content) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Fields',
                text: 'Please fill in all required fields',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        const formData = new FormData();
        formData.append('title', $scope.formData.title);
        formData.append('content', $scope.formData.content);
        formData.append('workTypeFilter', $scope.formData.workTypeFilter);

        // Handle multi-select employees
        formData.append('targetEmployees', JSON.stringify($scope.selectedEmployees));

        if ($scope.formData._id) {
            formData.append('_id', $scope.formData._id);
        }

        const fileInput = document.getElementById('noticeFile');
        if (fileInput.files.length > 0) {
            formData.append('file', fileInput.files[0]);
        }

        const endpoint = $scope.formData._id ? endpoints.NOTICE_UPDATE : endpoints.NOTICE_CREATE;

        HttpService.upload(endpoint, formData)
            .then(function (response) {
                if (response.status === 200 || response.message === 'Notice created successfully' || response.message === 'Notice updated successfully') {
                    toastr.success(response.message || 'Saved successfully');
                    $('#noticeModal').modal('hide');
                    $scope.loadNotices();
                } else {
                    toastr.error(response.message || 'Failed to save notice');
                }
            })
            .catch(function (error) {
                console.error('Error saving notice:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while saving the notice',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            });
    };

    // View Notice
    $scope.viewNotice = function (notice) {
        HttpService.post(endpoints.NOTICE_VIEW, { _id: notice._id })
            .then(function (response) {
                if (response.status === 200) {
                    $scope.viewData = response.data;
                    $('#viewModal').modal('show');
                }
            })
            .catch(function (error) {
                console.error('Error viewing notice:', error);
            });
    };

    // Delete Notice
    $scope.deleteNotice = function (notice) {
        Swal.fire({
            title: 'Delete Notice?',
            text: 'Are you sure you want to delete this notice? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                HttpService.post(endpoints.NOTICE_DELETE, { _id: notice._id })
                    .then(function (response) {
                        if (response.status === 200 || response.message === 'Notice deleted successfully') {
                            toastr.success(response.message || 'Notice deleted successfully');
                            $scope.loadNotices();
                        } else {
                            toastr.error(response.message || 'Failed to delete notice');
                        }
                    })
                    .catch(function (error) {
                        console.error('Error deleting notice:', error);
                    });
            }
        });
    };

    $scope.init();
}]);
