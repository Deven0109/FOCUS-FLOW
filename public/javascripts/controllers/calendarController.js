app.controller('CalendarController', function ($scope, HttpService, $timeout) {
    let calendar;
    $scope.leaveForm = {
        duration: 'single',
        fromDate: '',
        toDate: '',
        leaveType: 'casual',
        reason: '',
        title: ''
    };
    $scope.myLeaves = [];
    $scope.calendarLoading = true;
    $scope.selectedWorkType = 'all'; // Default to show all
    $scope.today = new Date();
    $scope.today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Helper to refresh my leave dates for validation
    $scope.syncMyLeaveDates = function () {
        HttpService.get('/api/leaves/me')
            .then(function (response) {
                let data = [];
                // Check if response is the array (unwrapped) or wrapped in .data
                if (Array.isArray(response)) {
                    data = response;
                } else if (response && Array.isArray(response.data)) {
                    data = response.data;
                }

                if (data) {
                    $scope.myLeaves = data;
                    console.log('Syncing user leaves for validation...', data.length);
                }
            })
            .catch(function (err) { console.error('Error syncing my leaves', err); });
    };

    // Load initial user leaves
    $scope.syncMyLeaveDates();

    // Initialize FullCalendar
    $timeout(function () {
        const calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek'
            },
            selectable: true,
            selectMirror: true,
            editable: false,
            height: 'auto',
            dayMaxEvents: false, // Allow stacking of multiple events

            // Date click handler - open leave form
            dateClick: function (info) {
                // Robust check against myLeaves using STRING comparison to avoid Timezone issues
                const clickedDateStr = info.dateStr; // "YYYY-MM-DD"
                console.log('--- DATE CLICK CHECK ---');
                console.log('Clicked Date:', clickedDateStr);

                const isBlocked = $scope.myLeaves.some(leave => {
                    if (leave.status === 'rejected') return false;

                    // Parse dates carefully
                    // Ensure we are working with just the date part YYYY-MM-DD
                    const startRaw = new Date(leave.fromDate);
                    const endRaw = new Date(leave.toDate);

                    // If the date string in DB is "2026-02-15T00:00:00.000Z", we want "2026-02-15"
                    const startStr = startRaw.toISOString().split('T')[0];
                    const endStr = endRaw.toISOString().split('T')[0];

                    console.log(`Checking Leave: ${startStr} to ${endStr}`, leave);

                    return clickedDateStr >= startStr && clickedDateStr <= endStr;
                });

                console.log('Is Blocked?', isBlocked);

                if (isBlocked) {
                    toastr.error('You already have a leave request for this date.');
                    return;
                }

                $timeout(function () {
                    // Use Date object for better compatibility with input[type="date"]
                    const clickedDate = new Date(info.dateStr);
                    $scope.leaveForm.fromDate = clickedDate;
                    $scope.leaveForm.toDate = clickedDate; // Default to same day
                    $scope.leaveForm.duration = 'single'; // Default to single day
                    $scope.leaveForm.reason = '';
                    $scope.leaveForm.leaveType = 'casual';

                    // Try to show modal using Bootstrap 5 JS
                    try {
                        const modalEl = document.getElementById('leaveModal');
                        if (typeof bootstrap !== 'undefined') {
                            const modal = new bootstrap.Modal(modalEl);
                            modal.show();
                        } else {
                            $(modalEl).modal('show');
                        }
                    } catch (e) {
                        console.error('Bootstrap modal error:', e);
                        // Fallback to jQuery if available
                        $('#leaveModal').modal('show');
                    }
                });
            },

            // Load events from server
            events: function (info, successCallback, failureCallback) {
                console.log('--- START events function ---');
                const url = `/api/leaves?workType=${$scope.selectedWorkType || 'all'}`;
                HttpService.get(url)
                    .then(function (response) {
                        try {
                            let leaves = [];

                            // Determine if response is the data array directly or wrapped
                            if (Array.isArray(response)) {
                                leaves = response;
                            } else if (response && Array.isArray(response.data)) {
                                leaves = response.data;
                            } else {
                                console.error('Unexpected response format:', response);
                                failureCallback({ message: 'Invalid data format from server' });
                                return;
                            }

                            // Grouping Logic
                            const groups = {};

                            leaves.forEach((leave, index) => {
                                try {
                                    if (!leave || !leave.start || !leave.end) return;

                                    // Create a unique key for the start-end range
                                    // Use simple string comparison of the ISO strings
                                    const key = `${leave.start}_${leave.end}`;

                                    if (!groups[key]) {
                                        groups[key] = {
                                            start: leave.start,
                                            end: leave.end,
                                            users: []
                                        };
                                    }

                                    // Add user details to the group
                                    const props = leave.extendedProps || {};
                                    groups[key].users.push({
                                        name: props.userName || 'Unknown User',
                                        email: props.userEmail || '',
                                        workType: props.userWorkType || 'onsite',
                                        type: props.leaveType || 'LEAVE',
                                        color: leave.backgroundColor || '#3b82f6',
                                        title: props.title || 'No Title', // Include Title
                                        reason: props.reason || '',
                                        status: props.status || 'unknown',
                                        dateRange: props.displayDateRange || 'Date not available'
                                    });

                                } catch (loopErr) {
                                    console.error('Error in leaves loop for index ' + index + ':', loopErr);
                                }
                            });

                            // Convert groups to FullCalendar events
                            const calendarEvents = Object.values(groups).map(group => {
                                // Determine the color of the group
                                // If all users have the same color, use it. Otherwise use the default blue.
                                const distinctColors = [...new Set(group.users.map(u => u.color))];
                                const groupColor = distinctColors.length === 1 ? distinctColors[0] : '#3b82f6';

                                return {
                                    title: `View (${group.users.length})`,
                                    start: group.start,
                                    end: group.end,
                                    allDay: true,
                                    backgroundColor: groupColor,
                                    borderColor: groupColor,
                                    textColor: '#ffffff',
                                    extendedProps: {
                                        count: group.users.length,
                                        users: group.users,
                                        isAggregated: true
                                    }
                                };
                            });

                            console.log('Final Grouped Calendar Events:', calendarEvents);
                            successCallback(calendarEvents);

                        } catch (innerErr) {
                            console.error('Error inside .then callback:', innerErr);
                            failureCallback({ message: innerErr.message });
                        }
                    })
                    .catch(function (error) {
                        console.error('HttpService Promise Rejected:', error);
                        failureCallback({ message: error ? error.message : 'Unknown error' });
                    });
            },

            // Custom rendering for the Event Bar content
            eventContent: function (arg) {
                const props = arg.event.extendedProps;
                const count = props.count || 0;

                // Container
                const container = document.createElement('div');
                container.className = 'd-flex align-items-center w-100 h-100 px-1 overflow-hidden';
                container.style.cursor = 'pointer';
                container.style.backgroundColor = arg.event.backgroundColor;
                container.style.borderRadius = '3px';

                // Left Badge "View (N)"
                const badge = document.createElement('div');
                badge.className = 'd-flex align-items-center justify-content-center text-white fw-bold px-2 rounded-1 me-2';
                badge.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                badge.style.height = '20px';
                badge.style.fontSize = '0.70rem';
                badge.style.minWidth = 'fit-content';
                badge.innerText = `View (${count})`;

                // Right Text (User Count)
                const text = document.createElement('div');
                text.className = 'text-white fw-medium text-truncate';
                text.style.fontSize = '0.8rem';
                text.innerText = `${count} Users`;

                container.appendChild(badge);
                container.appendChild(text);

                return { domNodes: [container] };
            },

            // Custom rendering to support Tooltips
            eventDidMount: function (info) {
                const props = info.event.extendedProps;
                const userNames = props.users.map(u => u.name).join(', ');
                const tooltipContent = `
                    <div class="text-start">
                        <strong>${props.count} Users on Leave</strong><br>
                        ${userNames}
                    </div>
                `;

                try {
                    if (typeof bootstrap !== 'undefined') {
                        new bootstrap.Tooltip(info.el, {
                            title: tooltipContent,
                            html: true,
                            placement: 'top',
                            trigger: 'hover',
                            container: 'body'
                        });
                    } else {
                        info.el.setAttribute('title', `${props.count} Users`);
                    }
                } catch (e) {
                    console.warn('Bootstrap tooltip error:', e);
                }
            },

            // Event click - show details for that specific date range
            eventClick: function (info) {
                const props = info.event.extendedProps;

                // Populate Modal Header with Range
                const dateEl = document.getElementById('viewLeaveDate');
                if (dateEl && props.users.length > 0) {
                    // Use the title of the first leave if available, otherwise date range
                    // User asked "view show leave for title show".
                    // We will prioritize Title. If multiple users/titles, maybe showing distinct text is weird.
                    // But for a single user (most commmon), showing title is good.
                    // If aggregated, showing "Leaves for [Date]" is safer, and title in list.
                    // Let's stick to the Date Range in Header (as per previous success) and emphasize Title in the list.
                    // Wait, user said "view show leave for title show".

                    // Let's try: "Leaves for [Title]" (if 1 user) or "Leaves for [Date Range]" (if >1)
                    if (props.users.length === 1 && props.users[0].title) {
                        dateEl.textContent = props.users[0].title;
                    } else {
                        dateEl.textContent = props.users[0].dateRange;
                    }
                }

                const listContainer = document.getElementById('dayLeavesList');
                if (listContainer) {
                    listContainer.innerHTML = '';

                    props.users.forEach(user => {
                        const itemHTML = `
                            <div class="list-group-item border-0 border-bottom py-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <div class="fw-bold text-dark mb-1" style="font-size: 1.25rem;">
                                            ${user.name}
                                            <span class="badge ${(user.workType || 'onsite').toLowerCase() === 'onsite' ? 'bg-success' : 'bg-info'} text-white ms-2" 
                                                  style="font-size: 0.8rem; padding: 5px 10px; vertical-align: middle; letter-spacing: 0.5px;">
                                                ${(user.workType || 'ONSITE').toUpperCase()}
                                            </span>
                                        </div>
                                        <div class="text-secondary mb-2" style="font-size: 1rem;">${user.email}</div>
                                        <div class="fw-bold" style="color: #0d6efd !important; font-size: 1.1rem;">Date : ${user.dateRange.replace(' - ', ' To ')}</div>
                                    </div>
                                    <span class="badge text-white text-uppercase" 
                                          style="font-size: 1rem; padding: 10px 15px; letter-spacing: 0.5px; background-color: ${user.color} !important;">
                                        ${(user.type || 'LEAVE').toUpperCase()}
                                    </span>
                                </div>
                                
                                <div class="mt-3">
                                    <div class="p-3 bg-light rounded text-dark border">
                                        <span class="fw-bold text-secondary text-uppercase me-2" style="font-size: 0.9rem;">Reason:</span>
                                        <span class="text-dark" style="font-size: 1rem;">${user.reason || 'No reason provided.'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        listContainer.insertAdjacentHTML('beforeend', itemHTML);
                    });

                    try {
                        const modalEl = document.getElementById('viewLeaveModal');
                        if (typeof bootstrap !== 'undefined') {
                            new bootstrap.Modal(modalEl).show();
                        } else {
                            $(modalEl).modal('show');
                        }
                    } catch (e) {
                        console.error('Modal error:', e);
                    }
                }
            }
        });

        calendar.render();
        $scope.$apply(function () {
            $scope.calendarLoading = false;
        });
    }, 100);

    // Handle duration change
    $scope.onDurationChange = function () {
        if ($scope.leaveForm.duration === 'single') {
            $scope.leaveForm.toDate = $scope.leaveForm.fromDate;
        }
    };

    // Handle from date change
    $scope.onFromDateChange = function () {
        if ($scope.leaveForm.duration === 'single') {
            $scope.leaveForm.toDate = $scope.leaveForm.fromDate;
        }
    };

    // Submit leave request
    $scope.submitLeave = function () {
        // Validation
        if (!$scope.leaveForm.fromDate || (!$scope.leaveForm.toDate && $scope.leaveForm.duration === 'multiple') || !$scope.leaveForm.reason || !$scope.leaveForm.title) {
            toastr.error('Please fill all required fields');
            return;
        }

        // Auto-set To Date for single day
        if ($scope.leaveForm.duration === 'single') {
            $scope.leaveForm.toDate = $scope.leaveForm.fromDate;
        }

        if ($scope.leaveForm.duration === 'multiple' && new Date($scope.leaveForm.fromDate) > new Date($scope.leaveForm.toDate)) {
            toastr.error('From date must be before or equal to To date');
            return;
        }

        const leaveData = {
            fromDate: $scope.leaveForm.fromDate,
            toDate: $scope.leaveForm.toDate,
            leaveType: $scope.leaveForm.leaveType,
            reason: $scope.leaveForm.reason,
            title: $scope.leaveForm.title
        };

        HttpService.post('/api/leaves', leaveData)
            .then(function (response) {
                if (response && response.leave) {
                    toastr.success('Leave request submitted successfully');

                    // Reload calendar to refresh aggregated events
                    if (calendar) {
                        calendar.refetchEvents();
                    }

                    // Refresh my leaves for validation
                    $scope.syncMyLeaveDates();

                    // Close modal safely
                    try {
                        const modalEl = document.getElementById('leaveModal');
                        if (typeof bootstrap !== 'undefined') {
                            const modal = bootstrap.Modal.getInstance(modalEl);
                            if (modal) modal.hide();
                            else $(modalEl).modal('hide');
                        } else {
                            $('#leaveModal').modal('hide');
                        }
                    } catch (e) {
                        console.error('Error closing modal:', e);
                        $('#leaveModal').modal('hide'); // Fallback
                    }

                    // Reset form
                    $scope.leaveForm = {
                        fromDate: '',
                        toDate: '',
                        leaveType: 'casual',
                        reason: '',
                        title: ''
                    };
                } else {
                    const errorMsg = response && response.message ? response.message : 'Error submitting leave request';
                    toastr.error(errorMsg);
                }
            })
            .catch(function (error) {
                console.error('Error submitting leave:', error);
                let errorMsg = 'Error submitting leave request';
                if (error.data && error.data.message) {
                    errorMsg = error.data.message;
                } else if (error.message) {
                    errorMsg = error.message;
                }
                toastr.error(errorMsg);
            });
    };

    // Show my leaves
    $scope.showMyLeaves = function () {
        HttpService.get('/api/leaves/me')
            .then(function (response) {
                let data = null;
                // Handle unwrapped or wrapped response
                if (Array.isArray(response)) {
                    data = response;
                } else if (response && Array.isArray(response.data)) {
                    data = response.data;
                }

                if (data) {
                    $scope.today = new Date();
                    $scope.today.setHours(0, 0, 0, 0);
                    $scope.myLeaves = data;
                    const modalEl = document.getElementById('myLeavesModal');
                    if (typeof bootstrap !== 'undefined') {
                        new bootstrap.Modal(modalEl).show();
                    } else {
                        $(modalEl).modal('show');
                    }
                } else {
                    console.error('Invalid my leaves response:', response);
                    toastr.error('Error loading your leaves');
                }
            })
            .catch(function (error) {
                console.error('Error loading user leaves:', error);
                toastr.error('Error loading your leaves');
            });
    };

    // Delete leave
    $scope.deleteLeave = function (leaveId) {
        Swal.fire({
            title: 'Delete Leave?',
            text: 'Are you sure you want to delete this leave request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                HttpService.delete('/api/leaves/' + leaveId)
                    .then(function (response) {
                        // Check for success in both wrapped and unwrapped response formats
                        if (response && (response.status === 200 || response.message === 'Leave deleted successfully')) {
                            toastr.success('leave is sucessfully deleted');
                            $scope.myLeaves = $scope.myLeaves.filter(l => l._id !== leaveId);
                            if (calendar) {
                                calendar.refetchEvents();
                            }
                        } else {
                            const errorMsg = (response && response.data && response.data.message) || (response && response.message) || 'Error deleting leave';
                            toastr.error(errorMsg);
                        }
                    })
                    .catch(function (error) {
                        console.error('Error deleting leave:', error);
                        toastr.error('Internal server error');
                    });
            }
        });
    };

    // Handle Work Type Filter Change
    $scope.onWorkTypeChange = function () {
        if (calendar) {
            calendar.refetchEvents();
        }
    };

    // Helper for delete permission (Only future leaves)
    $scope.canDeleteLeave = function (fromDate) {
        if (!fromDate) return false;
        const leaveDate = new Date(fromDate);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate > $scope.today;
    };

    // Helper function for leave color
    $scope.getLeaveColor = function (type) {
        switch (type ? type.toLowerCase() : "") {
            case "casual": return "#0d6efd"; // Blue
            case "sick": return "#dc3545";   // Red
            case "vacation": return "#198754"; // Green
            case "personal": return "#fd7e14"; // Orange
            default: return "#3b82f6";       // Default Blue
        }
    };

});
