app.controller('CalendarController', function ($scope, HttpService, $timeout) {
    let calendar;
    $scope.leaveForm = {
        duration: 'single',
        fromDate: '',
        toDate: '',
        leaveType: 'casual',
        reason: ''
    };
    $scope.myLeaves = [];
    $scope.calendarLoading = true;

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
                console.log('Date clicked:', info.dateStr);
                $timeout(function () {
                    $scope.leaveForm.fromDate = info.dateStr;
                    $scope.leaveForm.toDate = info.dateStr; // Default to same day
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
                HttpService.get('/api/leaves')
                    .then(function (response) {
                        if (response.status === 200) {
                            successCallback(response.data);
                            // Update icons after events are loaded
                            $timeout(() => {
                                updateViewIcons(response.data);
                            }, 100);
                        } else {
                            failureCallback();
                        }
                    })
                    .catch(function (error) {
                        console.error('Error loading leaves:', error);
                        failureCallback();
                    });
            },

            // Re-render icons when view or dates change
            datesSet: function () {
                $timeout(() => {
                    updateViewIcons();
                }, 100);
            },

            // Custom rendering to support Tooltips and Labels
            eventDidMount: function (info) {
                // Initialize Bootstrap Tooltip
                const props = info.event.extendedProps;
                const tooltipContent = `
                    <div class="text-start">
                        <strong>${props.userName}</strong><br>
                        Type: ${props.leaveType}<br>
                        Reason: ${props.reason}
                    </div>
                `;

                // Safe check for Bootstrap
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
                        info.el.setAttribute('title', `${props.userName} - ${props.leaveType} - ${props.reason}`);
                    }
                } catch (e) {
                    console.warn('Bootstrap tooltip error:', e);
                }

                // Ensure text color contrast logic
                if (props.leaveType === 'casual' || props.leaveType === 'personal') {
                    // For lighter backgrounds, use black text
                    info.el.style.color = '#000';
                    const titleEl = info.el.querySelector('.fc-event-title');
                    if (titleEl) titleEl.style.color = '#000';
                }
            },

            // Event click - show details for that day
            eventClick: function (info) {
                if (info.event && info.event.start) {
                    showLeavesForDate(info.event.start);
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
        if (!$scope.leaveForm.fromDate || (!$scope.leaveForm.toDate && $scope.leaveForm.duration === 'multiple') || !$scope.leaveForm.reason) {
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
            reason: $scope.leaveForm.reason
        };

        HttpService.post('/api/leaves', leaveData)
            .then(function (response) {
                if (response && response.leave) {
                    toastr.success('Leave request submitted successfully');

                    // Add event to calendar
                    if (calendar && response.leave) {
                        calendar.addEvent(response.leave);
                        // Refresh icons
                        $timeout(() => updateViewIcons(), 100);
                    }

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
                        reason: ''
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
                if (response.status === 200) {
                    $scope.myLeaves = response.data;
                    const modalEl = document.getElementById('myLeavesModal');
                    if (typeof bootstrap !== 'undefined') {
                        new bootstrap.Modal(modalEl).show();
                    } else {
                        $(modalEl).modal('show');
                    }
                } else {
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
        if (!confirm('Are you sure you want to delete this leave request?')) {
            return;
        }

        HttpService.delete('/api/leaves/' + leaveId)
            .then(function (response) {
                if (response.status === 200) {
                    toastr.success('Leave deleted successfully');

                    // Remove from list
                    $scope.myLeaves = $scope.myLeaves.filter(l => l._id !== leaveId);

                    // Reload calendar
                    if (calendar) {
                        calendar.refetchEvents();
                        $timeout(() => updateViewIcons(), 100);
                    }
                } else {
                    toastr.error(response.data.message || 'Error deleting leave');
                }
            })
            .catch(function (error) {
                console.error('Error deleting leave:', error);
                toastr.error('Error deleting leave');
            });
    };

    // Helper function for leave color
    $scope.getLeaveColor = function (leaveType) {
        const colors = {
            sick: '#dc3545',
            casual: '#0dcaf0',
            vacation: '#198754',
            personal: '#ffc107'
        };
        return colors[leaveType] || '#0dcaf0';
    };

    // --- Helper Functions for View Icons ---

    function updateViewIcons(eventsData) {
        // Clear existing icons
        document.querySelectorAll('.day-view-icon').forEach(el => el.remove());

        // Always prioritize calendar events for accuracy
        let eventsSource = [];
        if (calendar) {
            eventsSource = calendar.getEvents().map(e => ({
                start: e.start,
                end: e.end,
                allDay: e.allDay
            }));
        } else if (eventsData) {
            // Fallback to raw data if calendar somehow not ready
            eventsSource = eventsData;
        }

        // Identify all dates that have at least one leave
        const activeDates = new Set();

        eventsSource.forEach(event => {
            let current = new Date(event.start);
            let end;

            if (event.end) {
                end = new Date(event.end);
            } else {
                // If no end date, assume 1 day duration
                end = new Date(current.getTime() + 86400000);
            }

            // Loop through each day of the leave
            // IMPORTANT: Use local dates because FullCalendar renders in local time by default
            while (current < end) {
                // Get YYYY-MM-DD in local time
                const offset = current.getTimezoneOffset();
                const localDate = new Date(current.getTime() - (offset * 60 * 1000));
                const dateStr = localDate.toISOString().split('T')[0];

                activeDates.add(dateStr);
                current.setDate(current.getDate() + 1);
            }
        });

        // Inject icon for each active date
        activeDates.forEach(dateStr => {
            // FullCalendar uses data-date in local format (YYYY-MM-DD)
            const dayCell = document.querySelector(`.fc-daygrid-day[data-date="${dateStr}"] .fc-daygrid-day-top`);
            if (dayCell && !dayCell.querySelector('.day-view-icon')) {
                const icon = document.createElement('div');
                icon.className = 'day-view-icon text-primary position-absolute start-0 top-0 m-1';
                icon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                         <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>
                         <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>
                    </svg>
                `;
                icon.style.zIndex = "10";
                icon.style.cursor = "pointer";
                icon.title = "View Leaves";

                // Click handler
                icon.onclick = function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    // Pass the local date string to avoid timezone shifts when creating back a Date object
                    showLeavesForDate(dateStr);
                };

                dayCell.style.position = 'relative';
                dayCell.appendChild(icon);
            }
        });
    }

    // Function to show modal with leaves for a specific date
    function showLeavesForDate(dateInput) {
        if (!dateInput) return;

        // Ensure we are working with the date purely as a date (YYYY-MM-DD)
        // If passed as string, create date in local time (append T00:00:00)
        let checkDate;
        if (typeof dateInput === 'string') {
            checkDate = new Date(dateInput + 'T00:00:00');
        } else {
            checkDate = new Date(dateInput);
            checkDate.setHours(0, 0, 0, 0);
        }

        const displayDate = checkDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Filter events that happen on this date
        const allEvents = calendar ? calendar.getEvents() : [];
        const daysLeaves = allEvents.filter(event => {
            let start = new Date(event.start);
            let end = event.end ? new Date(event.end) : new Date(start.getTime() + 86400000);

            // Normalize start/end into local dates for comparison
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            // Exclusive end logic: checkDate >= start AND checkDate < end
            return checkDate.getTime() >= start.getTime() && checkDate.getTime() < end.getTime();
        });

        if (daysLeaves.length === 0) {
            toastr.info('No leaves found for this date.');
            return;
        }

        // Populate Modal
        const dateEl = document.getElementById('viewLeaveDate');
        if (dateEl) dateEl.textContent = displayDate;

        const listContainer = document.getElementById('dayLeavesList');
        if (listContainer) {
            listContainer.innerHTML = '';

            daysLeaves.forEach(event => {
                const props = event.extendedProps;
                const startDate = new Date(event.start).toLocaleDateString();
                // Fix visual end date (exclusive end - 1 day)
                let endDateStr = startDate;
                if (event.end) {
                    const endDateObj = new Date(event.end.getTime() - 86400000); // Subtract 1 day
                    endDateStr = endDateObj.toLocaleDateString();
                }

                const badgeColor = event.backgroundColor || '#0dcaf0';

                // Text color
                const textColor = (badgeColor === '#0dcaf0' || badgeColor === '#ffc107') ? '#000' : '#fff';

                const itemHTML = `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h5 class="mb-0 fw-bold text-dark">${props.userName || 'Unknown'}</h5>
                            <span class="badge" style="background-color: ${badgeColor}; color: ${textColor}">${(props.leaveType || 'LEAVE').toUpperCase()}</span>
                        </div>
                        <div class="small text-muted mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            ${startDate} - ${endDateStr}
                        </div>
                        <div class="p-2 bg-light rounded border text-secondary small">
                            <strong>Reason:</strong> ${props.reason || '-'}
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', itemHTML);
            });

            // Show Modal
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
