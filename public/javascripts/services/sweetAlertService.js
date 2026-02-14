app.service("SweetAlertService", [
  function () {
    this.alert = function (title, message, icon) {
      return Swal.fire({
        title: title,
        text: message,
        icon: icon || "info",
        confirmButtonText: "OK",
      });
    };

    this.confirm = function (
      title,
      message,
      confirmButtonText,
      cancelButtonText
    ) {
      return Swal.fire({
        title: title,
        text: message,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: confirmButtonText || "Yes",
        cancelButtonText: cancelButtonText || "No",
      });
    };

    this.success = function (title, message) {
      return Swal.fire({
        title: title,
        text: message,
        icon: "success",
        confirmButtonText: "OK",
      });
    };

    this.error = function (title, message) {
      return Swal.fire({
        title: title,
        text: message,
        icon: "error",
        confirmButtonText: "OK",
      });
    };

    this.custom = function (options) {
      return Swal.fire(options);
    };

    this.toast = function (message, icon) {
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: icon || "success",
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    };
  },
]);
