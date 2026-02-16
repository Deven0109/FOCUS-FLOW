app.controller('DocumentsController', function ($scope, HttpService, $http, $window, SweetAlertService) {
  const BASE_URL = $window.location.origin;
  $scope.documents = [];
  $scope.isLoading = false;
  $scope.isAdmin = false;
  $scope.isUploading = false;
  $scope.userWorkType = null;
  $scope.uploadForm = { title: '', description: '', category: 'SOP', workType: 'onsite', file: null };
  $scope.categories = [{ value: 'SOP', label: 'SOP' }, { value: 'Others', label: 'Others' }];
  $scope.workTypes = [{ value: 'onsite', label: 'Onsite' }, { value: 'remote', label: 'Remote' }];

  $scope.loadProfile = function () {
    const user = HttpService.getUserData();
    if (user) {
      const role = (user.role || '').toLowerCase();
      $scope.isAdmin = ['superadmin', 'hr', 'admin', 'human resource'].includes(role);
      $scope.userWorkType = user.workType || null;
      // Documents section bypass for administrative roles
      if ($scope.userWorkType === 'remote' && !$scope.isAdmin) {
        $window.location.href = '/app/dashboard';
        return;
      }
    }
  };

  $scope.workTypeLabel = function () {
    if (!$scope.userWorkType) return '';
    return $scope.userWorkType === 'remote' ? 'Remote' : 'Onsite';
  };

  $scope.loadDocuments = function () {
    $scope.isLoading = true;
    HttpService.post(endpoints.DOCUMENTS_LIST, {})
      .then(function (res) {
        $scope.documents = (res && res.data) ? res.data : [];
      })
      .catch(function () {
        $scope.documents = [];
      })
      .finally(function () {
        $scope.isLoading = false;
      });
  };

  $scope.viewDocument = function (doc) {
    const token = $window.localStorage.getItem('token');
    const url = BASE_URL + '/users/documents/download/' + doc._id;
    const config = {
      responseType: 'blob',
      headers: { Authorization: 'Bearer ' + token }
    };
    $http.get(url, config).then(function (response) {
      const blob = response.data;
      const blobUrl = $window.URL.createObjectURL(blob);
      $window.open(blobUrl, '_blank');
      setTimeout(function () { $window.URL.revokeObjectURL(blobUrl); }, 60000);
    }).catch(function (err) {
      SweetAlertService.error('Could not open document', err.data && err.data.message ? err.data.message : 'Please try again.');
    });
  };

  $scope.downloadDocument = function (doc) {
    const token = $window.localStorage.getItem('token');
    const url = `${BASE_URL}/users/documents/download/${doc._id}`;
    const config = {
      responseType: 'blob',
      headers: { Authorization: 'Bearer ' + token }
    };
    $http.get(url, config).then(function (response) {
      const blob = response.data;
      const disp = response.headers('Content-Disposition');
      let filename = (doc.fileName || doc.title || 'document') + '.pdf';
      if (disp) {
        const match = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i) || disp.match(/filename=["']?([^"';\n]+)["']?/i);
        if (match && match[1]) filename = decodeURIComponent(match[1].replace(/^["']|["']$/g, ''));
      }
      const a = document.createElement('a');
      a.href = $window.URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      $window.URL.revokeObjectURL(a.href);
    }).catch(function (err) {
      SweetAlertService.error('Download failed', err.data && err.data.message ? err.data.message : 'Could not download document');
    });
  };

  $scope.openUploadModal = function () {
    $scope.uploadForm = { title: '', description: '', category: 'SOP', workType: 'onsite', file: null };
    $scope.uploadError = '';
    var fileEl = document.getElementById('documentFileInput');
    if (fileEl) fileEl.value = '';
    $('#documentUploadModal').modal('show');
  };

  $scope.setUploadFile = function (input) {
    if (!input || !input.files || !input.files[0]) return;
    var f = input.files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      SweetAlertService.toast('Only PDF files are allowed', 'error');
      input.value = '';
      return;
    }
    $scope.uploadForm.file = f;
    $scope.$applyAsync();
  };

  $scope.$watch('uploadForm.file', function (file) {
    if (file && file.name && !file.name.toLowerCase().endsWith('.pdf')) {
      SweetAlertService.toast('Only PDF files are allowed', 'error');
      $scope.uploadForm.file = null;
    }
  });

  $scope.uploadDocument = function () {
    if (!$scope.uploadForm.title || !$scope.uploadForm.title.trim()) {
      SweetAlertService.toast('Title is required', 'error');
      return;
    }
    if (!$scope.uploadForm.file) {
      SweetAlertService.toast('Please select a PDF file', 'error');
      return;
    }
    $scope.isUploading = true;
    $scope.uploadError = '';
    const formData = new FormData();
    formData.append('title', $scope.uploadForm.title.trim());
    formData.append('description', ($scope.uploadForm.description || '').trim());
    formData.append('category', $scope.uploadForm.category || 'Others');
    formData.append('workType', $scope.uploadForm.workType || 'onsite');
    formData.append('file', $scope.uploadForm.file, $scope.uploadForm.file.name);

    HttpService.upload(endpoints.DOCUMENTS_UPLOAD, formData)
      .then(function (res) {
        if (res && res.data) {
          SweetAlertService.toast('Document uploaded successfully', 'success');
          $('#documentUploadModal').modal('hide');
          $scope.loadDocuments();
        } else {
          SweetAlertService.toast(res.message || 'Upload failed', 'error');
        }
      })
      .catch(function (err) {
        SweetAlertService.toast(err.data && err.data.message ? err.data.message : 'Upload failed', 'error');
      })
      .finally(function () {
        $scope.isUploading = false;
      });
  };

  $scope.deleteDocument = function (doc) {
    SweetAlertService.confirm('Delete Document', 'Are you sure you want to delete "' + (doc.title || 'this document') + '"?').
      then(function (result) {
        if (!result.isConfirmed) return;
        HttpService.post(endpoints.DOCUMENTS_DELETE, { id: doc._id })
          .then(function (res) {
            if (res && res.data) {
              SweetAlertService.toast('Document deleted', 'success');
              $scope.loadDocuments();
            } else {
              SweetAlertService.toast(res.message || 'Delete failed', 'error');
            }
          })
          .catch(function () {
            SweetAlertService.toast('Delete failed', 'error');
          });
      });
  };

  $scope.formatDate = function (dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  $scope.loadProfile();
  $scope.loadDocuments();
});
