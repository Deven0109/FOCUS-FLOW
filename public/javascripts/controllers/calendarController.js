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
    $scope.allMyLeaves = []; // For validation (contains all future leaves)
    $scope.displayedMyLeaves = []; // For display (paginated)
    $scope.calendarLoading = true;
    $scope.filters = {
        workType: 'all' // Default
    };
    $scope.today = new Date();
    $scope.today.setHours(0, 0, 0, 0); // Normalize to start of day
    $scope.isAdmin = false;
    $scope.isHR = false;
    $scope.userWorkType = 'onsite';

    // Pagination for My Leaves
    $scope.myLeavesPage = 1;
    $scope.myLeavesLimit = 10;
    $scope.myLeavesTotalPages = 1;
    $scope.myLeavesTotalCount = 0;

    // View Management
    $scope.viewMode = 'all'; // Default
    $scope.leaveSummary = null;
    $scope.willBePaidLeave = false;
    $scope.paidLeaveReason = '';

    // Fetch Leave Summary
    $scope.loadLeaveSummary = function () {
        HttpService.get('/api/leaves/summary')
            .then(function (response) {
                const data = response.data || response;
                if (data) $scope.leaveSummary = data;
            })
            .catch(err => console.error('Error fetching summary', err));
    };

    // Team Stats
    $scope.teamStats = [];

    // Fetch Team Stats
    $scope.loadTeamStats = function () {
        if (!$scope.isAdmin) return;

        HttpService.get('/api/leaves/team-stats', { params: { workType: $scope.filters.workType } })
            .then(function (response) {
                const data = response.data || response;
                if (data && Array.isArray(data)) {
                    $scope.teamStats = data;
                }
            })
            .catch(err => console.error('Error fetching team stats', err));
    };

    // Show Team Stats Modal
    $scope.showTeamStatsModal = function () {
        $scope.loadTeamStats(); // Refresh data
        try {
            const modalEl = document.getElementById('teamStatsModal');
            if (typeof bootstrap !== 'undefined') {
                new bootstrap.Modal(modalEl).show();
            } else {
                $(modalEl).modal('show');
            }
        } catch (e) {
            console.error('Modal error:', e);
            $('#teamStatsModal').modal('show');
        }
    };

    // Set View Mode (Admin Toggle)
    $scope.setViewMode = function (mode) {
        $scope.viewMode = mode;
        if (calendar) calendar.refetchEvents();
        // Reload stats if switching to team view
        if (mode === 'all') {
            $scope.loadTeamStats();
        }
    };

    // Work Type change handler for Admin
    $scope.onWorkTypeChange = function () {
        if (calendar) calendar.refetchEvents();
        if ($scope.viewMode === 'all') {
            $scope.loadTeamStats();
        }
    };

    $scope.checkPaidStatus = function () {
        if (!$scope.leaveSummary || !$scope.leaveForm.fromDate) return;

        $scope.willBePaidLeave = false;
        $scope.paidLeaveReason = '';

        // Simple client-side check based on summary stats
        // If yearly limit reached OR monthly limit reached
        if ($scope.leaveSummary.freeUsed >= $scope.leaveSummary.totalAllowed) {
            $scope.willBePaidLeave = true;
            $scope.paidLeaveReason = 'Yearly free leave limit (12) reached.';
        } else if ($scope.leaveSummary.monthlyUsed >= 1) {
            // Note: Does this date fall in current month? 
            // If selecting future date, this check is approximate unless we fetch future month data.
            // For MVP, user usually applies for current/near future.
            // Better: Check if fromDate month == current month
            const selectedDate = new Date($scope.leaveForm.fromDate);
            const now = new Date();
            if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
                $scope.willBePaidLeave = true;
                $scope.paidLeaveReason = 'You already used your free leave for this month.';
            }
        }
    };

    // --- HR / ADMIN FUNCTIONS ---
    $scope.pendingLeaves = [];

    // Fetch Pending Leaves (HR Dashboard)
    $scope.getPendingLeaves = function () {
        if (!$scope.isHR) return;

        HttpService.get('/api/leaves/pending')
            .then(function (response) {
                if (response && response.data && Array.isArray(response.data)) {
                    $scope.pendingLeaves = response.data;
                } else if (Array.isArray(response)) {
                    $scope.pendingLeaves = response;
                } else {
                    $scope.pendingLeaves = [];
                }
            })
            .catch(function (error) {
                console.error('Error fetching pending leaves:', error);
            });
    };

    // Update Leave Status (Approve/Reject)
    $scope.updateLeaveStatus = function (leaveId, status) {
        const actionText = status === 'approved' ? 'Approve' : 'Cancel';

        Swal.fire({
            title: `${actionText} Leave?`,
            text: `Are you sure you want to ${actionText.toLowerCase()} this leave request?`,
            icon: status === 'approved' ? 'success' : 'warning',
            showCancelButton: true,
            confirmButtonColor: status === 'approved' ? '#198754' : '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: `Yes, ${actionText} it!`
        }).then((result) => {
            if (result.isConfirmed) {
                HttpService.put('/api/leaves/status', { leaveId: leaveId, status: status })
                    .then(function (response) {
                        toastr.success(`Leave request ${status} successfully`);
                        $scope.getPendingLeaves(); // Refresh pending list
                        if (calendar) {
                            calendar.refetchEvents(); // Refresh calendar
                        }
                    })
                    .catch(function (error) {
                        const msg = error.data && error.data.message ? error.data.message : 'Error updating status';
                        toastr.error(msg);
                    });
            }
        });
    };

    // Load User Profile to determine role and work type
    const loadUserProfile = function () {
        const user = JSON.parse(localStorage.getItem('user')) || {}; // Fallback if HttpService not ready, but relying on localStorage
        if (user) {
            const role = (user.role || '').toLowerCase();

            // General Admin access (for filters)
            $scope.isAdmin = ['superadmin', 'hr', 'admin', 'human resource'].includes(role);

            // HR Specific access (for Leave Requests module)
            $scope.isHR = ['hr', 'human resource'].includes(role);

            $scope.userWorkType = (user.workType || 'onsite').toLowerCase();

            // If not admin, force filters.workType to user's work type
            // If not admin, force filters.workType to user's work type
            if (!$scope.isAdmin) {
                $scope.filters.workType = $scope.userWorkType;
                // Use 'all' view mode to show Team Leaves (backend restricts to same workType)
                // "onsite user all onsite user leave show within calendar"
                $scope.viewMode = 'all';
            } else {
                $scope.viewMode = 'all';
            }

            // Load Summary
            $scope.loadLeaveSummary();

            // Load Team Stats for Admins
            if ($scope.isAdmin) {
                $scope.loadTeamStats();
            }

            // Only HR should fetch pending leaves
            if ($scope.isHR) {
                $scope.getPendingLeaves();
            }
        }
    };
    loadUserProfile();

    // Helper to refresh all my leave dates for validation
    $scope.syncMyLeaveDates = function () {
        // Fetch ALL leaves for validation (limit=1000)
        HttpService.get('/api/leaves/me', { params: { limit: 1000, page: 1 } })
            .then(function (response) {
                let data = [];
                // Handle new backend response structure { leaves: [], ... }
                if (response && response.data && Array.isArray(response.data.leaves)) {
                    data = response.data.leaves;
                } else if (response && response.leaves && Array.isArray(response.leaves)) {
                    data = response.leaves;
                } else if (Array.isArray(response)) {
                    data = response;
                } else if (response && Array.isArray(response.data)) {
                    data = response.data;
                }

                if (data) {
                    $scope.allMyLeaves = data; // Store in allMyLeaves for validation
                    console.log('Syncing user leaves for validation...', data.length);
                }
            })
            .catch(function (err) { console.error('Error syncing my leaves', err); });
    };

    // Load initial user leaves for validation
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
            buttonText: {
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day'
            },
            selectable: true,
            selectMirror: true,
            editable: false,
            height: 'auto',
            dayMaxEvents: false, // Allow stacking of multiple events
            // Date Click Handler
            dateClick: function (info) {
                // Robust check against allMyLeaves using STRING comparison to avoid Timezone issues
                const clickedDateStr = info.dateStr; // "YYYY-MM-DD"
                console.log('--- DATE CLICK CHECK ---');
                console.log('Clicked Date:', clickedDateStr);

                // Use allMyLeaves for validation
                const isBlocked = $scope.allMyLeaves.some(leave => {
                    if (leave.status === 'rejected') return false;

                    // Parse dates carefully
                    const startRaw = new Date(leave.fromDate);
                    const endRaw = new Date(leave.toDate);

                    const startStr = startRaw.toLocaleDateString('en-CA');
                    const endStr = endRaw.toLocaleDateString('en-CA');

                    return clickedDateStr >= startStr && clickedDateStr <= endStr;
                });

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
                    $scope.leaveForm.title = '';

                    // CHECK PAID STATUS
                    $scope.checkPaidStatus();

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
                const url = `/api/leaves?workType=${$scope.filters.workType}&view=${$scope.viewMode}`;
                console.log('Fetching leaves from:', url);

                HttpService.get(url)
                    .then(function (response) {
                        try {
                            let leaves = [];
                            if (Array.isArray(response)) leaves = response;
                            else if (response && Array.isArray(response.data)) leaves = response.data;

                            // Grouping Logic
                            const groups = {};
                            leaves.forEach((leave) => {
                                if (!leave || !leave.start || !leave.end) return;
                                const props = leave.extendedProps || {};
                                const leaveType = (props.leaveType || 'casual').toLowerCase();
                                const key = `${leave.start}_${leave.end}_${leaveType}`;

                                if (!groups[key]) {
                                    groups[key] = {
                                        start: leave.start, end: leave.end, type: leaveType, color: leave.backgroundColor, users: []
                                    };
                                }
                                groups[key].users.push({
                                    name: props.userName, email: props.userEmail, workType: props.userWorkType,
                                    type: props.leaveType, color: leave.backgroundColor, title: props.title,
                                    reason: props.reason, status: props.status, dateRange: props.displayDateRange,
                                    duration: props.duration
                                });
                            });

                            const calendarEvents = Object.values(groups).map(group => {
                                const distinctColors = [...new Set(group.users.map(u => u.color))];
                                const groupColor = distinctColors.length === 1 ? distinctColors[0] : '#3b82f6';
                                return {
                                    title: `View (${group.users.length})`,
                                    start: group.start, end: group.end, allDay: true,
                                    backgroundColor: groupColor, borderColor: groupColor, textColor: '#ffffff',
                                    extendedProps: { count: group.users.length, users: group.users }
                                };
                            });
                            successCallback(calendarEvents);
                        } catch (e) { failureCallback({ message: e.message }); }
                    })
                    .catch(e => failureCallback({ message: e.message }));
            },

            // Render Event Content
            eventContent: function (arg) {
                const props = arg.event.extendedProps;
                const count = props.count || 0;
                const users = props.users || [];

                const container = document.createElement('div');
                container.className = 'd-flex align-items-center w-100 h-100 px-1 py-1 overflow-hidden';
                container.style.cursor = 'pointer';
                container.style.backgroundColor = arg.event.backgroundColor;
                container.style.borderRadius = '4px';
                container.style.minHeight = '34px';

                const badge = document.createElement('div');
                badge.className = 'd-flex align-items-center justify-content-center text-white fw-bold px-1 rounded-1 me-1';
                badge.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                badge.style.height = '18px';
                badge.style.fontSize = '0.6rem';
                badge.style.minWidth = 'fit-content';
                badge.innerText = `View(${count})`;

                const textContainer = document.createElement('div');
                textContainer.className = 'd-flex flex-column justify-content-center overflow-hidden flex-grow-1';
                textContainer.style.lineHeight = '1.1';

                const names = users.map(u => (u.name || 'User').split(' ')[0]).join(', ');
                const reasons = users.map(u => u.reason || u.title || 'Leave').join(', ');

                const nameLine = document.createElement('div');
                nameLine.className = 'text-white fw-bold text-truncate';
                nameLine.style.fontSize = '0.7rem';
                nameLine.innerText = names;

                const reasonLine = document.createElement('div');
                reasonLine.className = 'text-white text-truncate';
                reasonLine.style.fontSize = '0.65rem';
                reasonLine.style.opacity = '0.9';
                reasonLine.innerText = reasons;

                textContainer.appendChild(nameLine);
                textContainer.appendChild(reasonLine);
                container.appendChild(badge);
                container.appendChild(textContainer);

                return { domNodes: [container] };
            },

            // Tooltips
            eventDidMount: function (info) {
                const props = info.event.extendedProps;
                const userNames = props.users.map(u => u.name).join(', ');
                const tooltipContent = `<div class="text-start"><strong>${props.count} Users on Leave</strong><br>${userNames}</div>`;
                try {
                    if (typeof bootstrap !== 'undefined') {
                        new bootstrap.Tooltip(info.el, {
                            title: tooltipContent, html: true, placement: 'top', trigger: 'hover', container: 'body'
                        });
                    } else {
                        info.el.setAttribute('title', `${props.count} Users`);
                    }
                } catch (e) { console.warn('Bootstrap tooltip error:', e); }
            },

            // Event Click (View Details)
            eventClick: function (info) {
                const props = info.event.extendedProps;
                const dateEl = document.getElementById('viewLeaveDate');
                if (dateEl && props.users.length > 0) {
                    dateEl.textContent = (props.users.length === 1 && props.users[0].title) ? props.users[0].title : props.users[0].dateRange;
                }
                const listContainer = document.getElementById('dayLeavesList');
                if (listContainer) {
                    listContainer.innerHTML = '';
                    props.users.forEach(user => {
                        const itemHTML = `
                            <div class="list-group-item border-0 border-bottom py-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <div class="fw-bold text-dark mb-1 d-flex align-items-center" style="font-size: 1.25rem;">
                                            ${user.name}
                                            <span class="badge ${(user.workType || 'onsite').toLowerCase() === 'onsite' ? 'bg-success' : 'bg-info'} text-white ms-2" style="font-size: 0.8rem; padding: 5px 10px; vertical-align: middle; letter-spacing: 0.5px;">${(user.workType || 'ONSITE').toUpperCase()}</span>
                                        </div>
                                        <div class="text-secondary mb-2" style="font-size: 1rem;">${user.email}</div>
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="fw-bold" style="color: #0d6efd !important; font-size: 1.1rem;">Date: ${user.dateRange.replace(' - ', ' To ')}</div>
                                            <span class="badge bg-light text-dark border">Duration: ${user.duration || 1} Days</span>
                                        </div>
                                    </div>
                                    <div class="text-end">
                                        <span class="badge text-white text-uppercase" style="font-size: 1rem; padding: 10px 15px; letter-spacing: 0.5px; background-color: ${user.color} !important;">${(user.type || 'LEAVE').toUpperCase()}</span>
                                        <div class="mt-2 text-uppercase fw-bold small ${user.status === 'approved' ? 'text-success' : 'text-warning'}">
                                            Status: ${user.status || 'Approved'}
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <div class="p-3 bg-light rounded text-dark border"><span class="fw-bold text-secondary text-uppercase me-2" style="font-size: 0.9rem;">Reason:</span><span class="text-dark" style="font-size: 1rem;">${user.reason || 'No reason provided.'}</span></div>
                                </div>
                            </div>`;
                        listContainer.insertAdjacentHTML('beforeend', itemHTML);
                    });
                    try {
                        const modalEl = document.getElementById('viewLeaveModal');
                        if (typeof bootstrap !== 'undefined') new bootstrap.Modal(modalEl).show();
                        else $(modalEl).modal('show');
                    } catch (e) { console.error('Modal error:', e); }
                }
            }
        });

        calendar.render();
        $scope.$apply(function () {
            $scope.calendarLoading = false;
        });
    }, 100);

    // Handle duration change
    $scope.onFromDateChange = function () {
        if ($scope.leaveForm.duration === 'single') {
            $scope.leaveForm.toDate = $scope.leaveForm.fromDate;
        }
        $scope.checkPaidStatus();
    };

    // Submit leave request
    $scope.submitLeave = function () {
        if ($scope.isSubmitting) return;

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

        $scope.isSubmitting = true;

        const leaveData = {
            fromDate: $scope.leaveForm.fromDate,
            toDate: $scope.leaveForm.toDate,
            leaveType: $scope.leaveForm.leaveType,
            reason: $scope.leaveForm.reason,
            title: $scope.leaveForm.title
        };

        HttpService.post('/api/leaves', leaveData)
            .then(function (response) {
                // Fix: Handle axios response wrapper. Data is in response.data
                const data = response.data || response;

                if (data && data.leave) {
                    if (data.autoApproved) {
                        toastr.success('Leave approved and added to calendar!');
                    } else {
                        toastr.success('Leave request submitted successfully. Waiting for approval.');
                    }

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
                    const errorMsg = data && data.message ? data.message : 'Error submitting leave request';
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
            })
            .finally(function () {
                $scope.isSubmitting = false;
            });
    };

    // Load My Leaves with Pagination variables
    $scope.loadMyLeavesPage = function (page) {
        $scope.myLeavesPage = page;

        HttpService.get('/api/leaves/me', { params: { page: page, limit: $scope.myLeavesLimit } })
            .then(function (response) {
                // Check response format
                // Backend returns { leaves: [], totalLeaves: X, totalPages: Y, currentPage: Z }
                // Angular http response wrapped in .data, then .data again (depending on interceptor)
                const payload = response.data || response;

                if (payload && payload.leaves) {
                    $scope.displayedMyLeaves = payload.leaves;
                    $scope.myLeavesTotalPages = payload.totalPages || 1;
                    $scope.myLeavesTotalCount = payload.totalLeaves || 0;
                    $scope.myLeavesPage = payload.currentPage || page;
                } else if (Array.isArray(payload)) {
                    // Fallback so it doesn't break if server behaves unexpectedly
                    $scope.displayedMyLeaves = payload;
                    $scope.myLeavesTotalPages = 1;
                }
            })
            .catch(function (error) {
                console.error('Error loading my leaves page:', error);
                toastr.error('Error loading leaves history');
            });
    };

    // Show my leaves Modal (open and load first page)
    $scope.showMyLeaves = function () {
        $scope.today = new Date();
        $scope.today.setHours(0, 0, 0, 0);

        // Load first page
        $scope.loadMyLeavesPage(1);

        // Open Modal
        try {
            const modalEl = document.getElementById('myLeavesModal');
            if (typeof bootstrap !== 'undefined') {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            } else {
                $(modalEl).modal('show');
            }
        } catch (e) {
            console.error('Modal error:', e);
            $('#myLeavesModal').modal('show');
        }
    };



    $scope.prevMyLeavesPage = function () {
        if ($scope.myLeavesPage > 1) {
            $scope.loadMyLeavesPage($scope.myLeavesPage - 1);
        }
    };

    $scope.nextMyLeavesPage = function () {
        if ($scope.myLeavesPage < $scope.myLeavesTotalPages) {
            $scope.loadMyLeavesPage($scope.myLeavesPage + 1);
        }
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
                            toastr.success('Leave is successfully deleted');

                            // Remove from displayed lists
                            $scope.displayedMyLeaves = $scope.displayedMyLeaves.filter(l => l._id !== leaveId);
                            $scope.allMyLeaves = $scope.allMyLeaves.filter(l => l._id !== leaveId);

                            // Refresh calendar
                            if (calendar) {
                                calendar.refetchEvents();
                            }

                            // Reload page if empty
                            if ($scope.displayedMyLeaves.length === 0 && $scope.myLeavesPage > 1) {
                                $scope.loadMyLeavesPage($scope.myLeavesPage - 1);
                            } else {
                                $scope.loadMyLeavesPage($scope.myLeavesPage);
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

    // Helper for delete permission (Only future leaves or today)
    $scope.canDeleteLeave = function (fromDate) {
        if (!fromDate) return false;
        const leaveDate = new Date(fromDate);
        leaveDate.setHours(0, 0, 0, 0);
        return leaveDate >= $scope.today;
    };

    // Helper function for leave color
    $scope.getLeaveColor = function (type) {
        switch (type ? type.toLowerCase() : "") {
            case "casual": return "rgba(13, 110, 253, 0.2)"; // Blue
            case "sick": return "rgba(220, 53, 69, 0.2)";   // Red
            case "vacation": return "rgba(25, 135, 84, 0.2)"; // Green
            case "personal": return "rgba(253, 126, 20, 0.2)"; // Orange
            default: return "rgba(59, 130, 246, 0.2)";       // Default Blue
        }
    };

});
