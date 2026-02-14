app.controller("AccountSettingsController", ($scope, HttpService, SweetAlertService) => {

    $scope.loadProfile = function () {
        let profile = HttpService.getUserData();
        if (profile != null) {
            $scope.personalForm.name = profile.name;
            $scope.personalForm.email = profile.email;
            $scope.personalForm.mobile = profile.mobile || '';
            $scope.personalForm.jobTitle = profile.jobTitle;
            $scope.personalForm.profileImage = profile.profileImage != null ? `${imageURL}${profile.profileImage}` : '';
        }
    };

    $scope.selectedItem = "Personal Information";
    $scope.lists = ["Personal Information", "Change Password"];
    $scope.showCameraModal = false;
    $scope.isUploading = false;

    $scope.onTabChange = (tab) => { $scope.selectedItem = tab; };

    $scope.openCamera = function () {
        if ($scope.isUploading) return;

        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function (stream) {
                $scope.cameraStream = stream; // Store stream for later cleanup
                const video = document.getElementById('cameraFeed');
                const preview = document.getElementById('cameraPreview');
                video.srcObject = stream;
                preview.srcObject = stream;
                video.play();
                $('#cameraModal').modal('show'); // Show modal using Bootstrap
                $scope.showCameraModal = true;
                $scope.$apply(); // Update AngularJS scope
            })
            .catch(function (error) {
                SweetAlertService.toast("Unable to access camera. Please ensure camera permissions are granted.", "error");
                console.error("Camera access error:", error);
            });
    };

    $scope.capturePhoto = function () {
        if ($scope.isUploading) return;

        const video = document.getElementById('cameraFeed');
        const canvas = document.getElementById('photoCanvas');
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob(function (blob) {
            if (!blob) {
                SweetAlertService.toast("Failed to capture image", "error");
                $scope.closeCameraModal();
                $scope.$apply();
                return;
            }

            if (blob.size > 2 * 1024 * 1024) {
                SweetAlertService.toast("Image size should be less than 2MB", "error");
                $scope.closeCameraModal();
                $scope.$apply();
                return;
            }

            if (!blob.type.match('image.*')) {
                SweetAlertService.toast("Invalid image format", "error");
                $scope.closeCameraModal();
                $scope.$apply();
                return;
            }

            const formData = new FormData();
            formData.append('file', blob, 'selfie.jpg');

            $scope.isUploading = true;
            $scope.$apply(); // Update AngularJS scope

            HttpService.upload(endpoints.UPLOAD_PROFILE_IMAGE, formData).then(function (response) {
                if (response.data != null) {
                    SweetAlertService.toast("Profile image updated successfully!", "success");
                    $scope.personalForm.profileImage = `${imageURL}${response.data.profileImage}`;
                    HttpService.setUserData(response.data);
                    setTimeout(() => window.location.reload(), 200);
                } else {
                    SweetAlertService.toast(response.message || "Failed to upload image", "error");
                }
                $scope.isUploading = false;
                $scope.closeCameraModal();
            }).catch((error) => {
                $scope.isUploading = false;
                SweetAlertService.toast("Upload failed", "error");
                $scope.closeCameraModal();
                console.error("Upload error:", error);
            });
        }, 'image/jpeg', 0.95);
    };

    $scope.closeCameraModal = function () {
        $('#cameraModal').modal('hide'); // Show modal using Bootstrap
        if ($scope.cameraStream) {
            $scope.cameraStream.getTracks().forEach(track => track.stop());
            $scope.cameraStream = null;
        }
        $scope.showCameraModal = false;
        $scope.isUploading = false;
    };

    $scope.personalForm = {
        name: "",
        email: "",
        mobile: "",
        jobTitle: "",
        profileImage: ""
    };

    $scope.form = {
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    };

    $scope.onSubmit = function () {
        if (
            !$scope.form.oldPassword ||
            !$scope.form.newPassword ||
            !$scope.form.confirmPassword
        ) {
            SweetAlertService.toast("Please fill in all fields", "error");
            return;
        }

        if ($scope.form.newPassword !== $scope.form.confirmPassword) {
            SweetAlertService.toast("New passwords don't match", "error");
            return;
        }

        HttpService.post(endpoints.CHANGE_PASSWORD, {
            oldPassword: $scope.form.oldPassword,
            newPassword: $scope.form.newPassword,
        })
            .then(function (response) {
                if (response.data) {
                    SweetAlertService.toast(
                        "Password changed successfully!",
                        "success"
                    );
                    $scope.resetForm();
                } else {
                    SweetAlertService.toast(response.message, "warning");
                }
            })
            .catch((error) => console.error("Password change error:", error));
    };

    $scope.resetForm = () => {
        $scope.form = { oldPassword: "", newPassword: "", confirmPassword: "" };
        if ($scope.changePasswordForm) {
            $scope.changePasswordForm.$setPristine();
            $scope.changePasswordForm.$setUntouched();
        }
    };

    $scope.loadProfile();
});