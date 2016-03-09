function getLocale() {
    'use strict';

    var lang;

    if (navigator.languages) {
        // chrome does not currently set navigator.language correctly https://code.google.com/p/chromium/issues/detail?id=101138
        // but it does set the first element of navigator.languages correctly
        lang = navigator.languages[0];
    } else if (navigator.userLanguage) {
        // IE only
        lang = navigator.userLanguage;
    } else {
        // as of this writing the latest version of firefox + safari set this correctly
        lang = navigator.language;
    }
    return lang;
}

angular.module('bankroll', [])

    .provider('bankrollProvider', [function () {
        var locale = getLocale();
        var banknote = window.banknote;
        var note = banknote.formattingForLocale(locale);
        var options = {
            currency: {
                symbol : "$",       // default currency symbol is '$'
                format : "%s%v",    // controls output: %s = symbol, %v = value (can be object, see docs)
                decimal : ".",      // decimal point separator
                thousand : ",",     // thousands separator
                precision : 2,      // decimal places
                grouping : 3        // digit grouping (not implemented yet)
            },
            number: {
                precision : 0,      // default precision on numbers is 0
                grouping : 3,       // digit grouping (not implemented yet)
                thousand : ",",
                decimal : "."
            }
        }
        console.log(locale, note, options);
        this.$get = [function() {
            return {

            };
        }];
    }])
    .directive('check', [function () {
        return {
            restrict: 'EA',
            template: "<span> {{2 + 5 }} </span>",
            link: function (scope, ele, attrs) {

            }
        };
    }]);