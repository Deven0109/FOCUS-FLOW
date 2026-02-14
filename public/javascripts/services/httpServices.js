app.service("HttpService", [
  "$http",
  "SweetAlertService",
  "$window",
  function ($http, SweetAlertService, $window) {
    // Base configuration
    const getBaseConfig = function () {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      // Add Authorization header if token exists
      const token = $window.localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = "Bearer " + token;
      }

      return config;
    };

    const getFileBaseConfig = function () {
      const config = {
        transformRequest: angular.identity,
        headers: { 'Content-Type': undefined }
      };

      // Add Authorization header if token exists
      const token = $window.localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = "Bearer " + token;
      }

      return config;
    };

    // Common error handler
    this.handleError = function (error) {
      // Handle 401 Unauthorized
      if (error.status === 401) {
        $window.localStorage.clear();
        $window.location.href = "/app/login";
        return Promise.reject(error);
      }

      let errorMessage = "Something went wrong";

      if (error.data) {
        errorMessage =
          error.data.message || error.data.error || JSON.stringify(error.data);
      } else if (error.status) {
        errorMessage = `Request failed with status: ${error.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      SweetAlertService.error("Error", errorMessage);
      return Promise.reject(error);
    };

    // Extract data from response
    this.extractResponse = function (response) {
      return response.data || response;
    };

    // GET method
    this.get = function (url, config = {}) {
      return $http
        .get(url, { ...getBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    };

    // POST method
    this.post = function (url, data, config = {}) {
      return $http
        .post(url, data, { ...getBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    };

    // PUT method
    this.put = function (url, data, config = {}) {
      return $http
        .put(url, data, { ...getBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    };

    // DELETE method
    this.delete = function (url, config = {}) {
      return $http
        .delete(url, { ...getBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    };

    // PATCH method
    this.patch = function (url, data, config = {}) {
      return $http
        .patch(url, data, { ...getBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    };

    this.upload = function (url, formData, config = {}) {
      return $http.post(url, formData, { ...getFileBaseConfig(), ...config })
        .then(this.extractResponse)
        .catch(this.handleError);
    }

    this.setToken = function (token) {
      $window.localStorage.setItem("token", token);
    };

    this.clearStorage = function () {
      $window.localStorage.clear();
    };

    this.setUserData = function (user) {
      $window.localStorage.setItem("user", JSON.stringify(user));
    };

    this.getUserData = function () {
      let data = $window.localStorage.getItem("user");
      return data != null ? JSON.parse(data) : null;
    };
  },
]);
