const imageURL = "https://itfuturz.s3.ap-south-1.amazonaws.com/";
let app = angular.module("timerApp", []).filter("uppercase", function () {
  return function (input) {
    return input ? input.toUpperCase() : "";
  };
}).directive('numbersOnly', function () {
  return {
    require: 'ngModel',
    link: function (scope, element, attrs, ngModelCtrl) {
      function fromUser(text) {
        if (text) {
          var transformedInput = text.replace(/[^0-9]/g, '');
          if (transformedInput !== text) {
            ngModelCtrl.$setViewValue(transformedInput);
            ngModelCtrl.$render();
          }
          return transformedInput;
        }
        return undefined;
      }
      ngModelCtrl.$parsers.push(fromUser);
    }
  };
}).directive('fileModel', ['$parse', function ($parse) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var model = $parse(attrs.fileModel);
      var modelSetter = model.assign;

      element.bind('change', function () {
        scope.$apply(function () {
          modelSetter(scope, element[0].files[0]);
        });
      });
    }
  };
}]);




