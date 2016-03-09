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
/*!
 * accounting.js v0.4.1
 * Copyright 2014 Open Exchange Rates
 *
 * Freely distributable under the MIT license.
 * Portions of accounting.js are inspired or borrowed from underscore.js
 *
 * Full details and documentation:
 * http://openexchangerates.github.io/accounting.js/
 */

(function(root, undefined) {

	/* --- Setup --- */

	// Create the local library object, to be exported or referenced globally later
	var lib = {};

	// Current version
	lib.version = '0.4.1';


	/* --- Exposed settings --- */

	// The library's settings configuration object. Contains default parameters for
	// currency and number formatting
	lib.settings = {
		currency: {
			symbol : "$",		// default currency symbol is '$'
			format : "%s%v",	// controls output: %s = symbol, %v = value (can be object, see docs)
			decimal : ".",		// decimal point separator
			thousand : ",",		// thousands separator
			precision : 2,		// decimal places
			grouping : 3		// digit grouping (not implemented yet)
		},
		number: {
			precision : 0,		// default precision on numbers is 0
			grouping : 3,		// digit grouping (not implemented yet)
			thousand : ",",
			decimal : "."
		}
	};


	/* --- Internal Helper Methods --- */

	// Store reference to possibly-available ECMAScript 5 methods for later
	var nativeMap = Array.prototype.map,
		nativeIsArray = Array.isArray,
		toString = Object.prototype.toString;

	/**
	 * Tests whether supplied parameter is a string
	 * from underscore.js
	 */
	function isString(obj) {
		return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
	}

	/**
	 * Tests whether supplied parameter is a string
	 * from underscore.js, delegates to ECMA5's native Array.isArray
	 */
	function isArray(obj) {
		return nativeIsArray ? nativeIsArray(obj) : toString.call(obj) === '[object Array]';
	}

	/**
	 * Tests whether supplied parameter is a true object
	 */
	function isObject(obj) {
		return obj && toString.call(obj) === '[object Object]';
	}

	/**
	 * Extends an object with a defaults object, similar to underscore's _.defaults
	 *
	 * Used for abstracting parameter handling from API methods
	 */
	function defaults(object, defs) {
		var key;
		object = object || {};
		defs = defs || {};
		// Iterate over object non-prototype properties:
		for (key in defs) {
			if (defs.hasOwnProperty(key)) {
				// Replace values with defaults only if undefined (allow empty/zero values):
				if (object[key] == null) object[key] = defs[key];
			}
		}
		return object;
	}

	/**
	 * Implementation of `Array.map()` for iteration loops
	 *
	 * Returns a new Array as a result of calling `iterator` on each array value.
	 * Defers to native Array.map if available
	 */
	function map(obj, iterator, context) {
		var results = [], i, j;

		if (!obj) return results;

		// Use native .map method if it exists:
		if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);

		// Fallback for native .map:
		for (i = 0, j = obj.length; i < j; i++ ) {
			results[i] = iterator.call(context, obj[i], i, obj);
		}
		return results;
	}

	/**
	 * Check and normalise the value of precision (must be positive integer)
	 */
	function checkPrecision(val, base) {
		val = Math.round(Math.abs(val));
		return isNaN(val)? base : val;
	}


	/**
	 * Parses a format string or object and returns format obj for use in rendering
	 *
	 * `format` is either a string with the default (positive) format, or object
	 * containing `pos` (required), `neg` and `zero` values (or a function returning
	 * either a string or object)
	 *
	 * Either string or format.pos must contain "%v" (value) to be valid
	 */
	function checkCurrencyFormat(format) {
		var defaults = lib.settings.currency.format;

		// Allow function as format parameter (should return string or object):
		if ( typeof format === "function" ) format = format();

		// Format can be a string, in which case `value` ("%v") must be present:
		if ( isString( format ) && format.match("%v") ) {

			// Create and return positive, negative and zero formats:
			return {
				pos : format,
				neg : format.replace("-", "").replace("%v", "-%v"),
				zero : format
			};

		// If no format, or object is missing valid positive value, use defaults:
		} else if ( !format || !format.pos || !format.pos.match("%v") ) {

			// If defaults is a string, casts it to an object for faster checking next time:
			return ( !isString( defaults ) ) ? defaults : lib.settings.currency.format = {
				pos : defaults,
				neg : defaults.replace("%v", "-%v"),
				zero : defaults
			};

		}
		// Otherwise, assume format was fine:
		return format;
	}


	/* --- API Methods --- */

	/**
	 * Takes a string/array of strings, removes all formatting/cruft and returns the raw float value
	 * Alias: `accounting.parse(string)`
	 *
	 * Decimal must be included in the regular expression to match floats (defaults to
	 * accounting.settings.number.decimal), so if the number uses a non-standard decimal
	 * separator, provide it as the second argument.
	 *
	 * Also matches bracketed negatives (eg. "$ (1.99)" => -1.99)
	 *
	 * Doesn't throw any errors (`NaN`s become 0) but this may change in future
	 */
	var unformat = lib.unformat = lib.parse = function(value, decimal) {
		// Recursively unformat arrays:
		if (isArray(value)) {
			return map(value, function(val) {
				return unformat(val, decimal);
			});
		}

		// Fails silently (need decent errors):
		value = value || 0;

		// Return the value as-is if it's already a number:
		if (typeof value === "number") return value;

		// Default decimal point comes from settings, but could be set to eg. "," in opts:
		decimal = decimal || lib.settings.number.decimal;

		 // Build regex to strip out everything except digits, decimal point and minus sign:
		var regex = new RegExp("[^0-9-" + decimal + "]", ["g"]),
			unformatted = parseFloat(
				("" + value)
				.replace(/\((.*)\)/, "-$1") // replace bracketed values with negatives
				.replace(regex, '')         // strip out any cruft
				.replace(decimal, '.')      // make sure decimal point is standard
			);

		// This will fail silently which may cause trouble, let's wait and see:
		return !isNaN(unformatted) ? unformatted : 0;
	};


	/**
	 * Implementation of toFixed() that treats floats more like decimals
	 *
	 * Fixes binary rounding issues (eg. (0.615).toFixed(2) === "0.61") that present
	 * problems for accounting- and finance-related software.
	 */
	var toFixed = lib.toFixed = function(value, precision) {
		precision = checkPrecision(precision, lib.settings.number.precision);
		var power = Math.pow(10, precision);

		// Multiply up by precision, round accurately, then divide and use native toFixed():
		return (Math.round(lib.unformat(value) * power) / power).toFixed(precision);
	};


	/**
	 * Format a number, with comma-separated thousands and custom precision/decimal places
	 * Alias: `accounting.format()`
	 *
	 * Localise by overriding the precision and thousand / decimal separators
	 * 2nd parameter `precision` can be an object matching `settings.number`
	 */
	var formatNumber = lib.formatNumber = lib.format = function(number, precision, thousand, decimal) {
		// Resursively format arrays:
		if (isArray(number)) {
			return map(number, function(val) {
				return formatNumber(val, precision, thousand, decimal);
			});
		}

		// Clean up number:
		number = unformat(number);

		// Build options object from second param (if object) or all params, extending defaults:
		var opts = defaults(
				(isObject(precision) ? precision : {
					precision : precision,
					thousand : thousand,
					decimal : decimal
				}),
				lib.settings.number
			),

			// Clean up precision
			usePrecision = checkPrecision(opts.precision),

			// Do some calc:
			negative = number < 0 ? "-" : "",
			base = parseInt(toFixed(Math.abs(number || 0), usePrecision), 10) + "",
			mod = base.length > 3 ? base.length % 3 : 0;

		// Format the number:
		return negative + (mod ? base.substr(0, mod) + opts.thousand : "") + base.substr(mod).replace(/(\d{3})(?=\d)/g, "$1" + opts.thousand) + (usePrecision ? opts.decimal + toFixed(Math.abs(number), usePrecision).split('.')[1] : "");
	};


	/**
	 * Format a number into currency
	 *
	 * Usage: accounting.formatMoney(number, symbol, precision, thousandsSep, decimalSep, format)
	 * defaults: (0, "$", 2, ",", ".", "%s%v")
	 *
	 * Localise by overriding the symbol, precision, thousand / decimal separators and format
	 * Second param can be an object matching `settings.currency` which is the easiest way.
	 *
	 * To do: tidy up the parameters
	 */
	var formatMoney = lib.formatMoney = function(number, symbol, precision, thousand, decimal, format) {
		// Resursively format arrays:
		if (isArray(number)) {
			return map(number, function(val){
				return formatMoney(val, symbol, precision, thousand, decimal, format);
			});
		}

		// Clean up number:
		number = unformat(number);

		// Build options object from second param (if object) or all params, extending defaults:
		var opts = defaults(
				(isObject(symbol) ? symbol : {
					symbol : symbol,
					precision : precision,
					thousand : thousand,
					decimal : decimal,
					format : format
				}),
				lib.settings.currency
			),

			// Check format (returns object with pos, neg and zero):
			formats = checkCurrencyFormat(opts.format),

			// Choose which format to use for this value:
			useFormat = number > 0 ? formats.pos : number < 0 ? formats.neg : formats.zero;

		// Return with currency symbol added:
		return useFormat.replace('%s', opts.symbol).replace('%v', formatNumber(Math.abs(number), checkPrecision(opts.precision), opts.thousand, opts.decimal));
	};


	/**
	 * Format a list of numbers into an accounting column, padding with whitespace
	 * to line up currency symbols, thousand separators and decimals places
	 *
	 * List should be an array of numbers
	 * Second parameter can be an object containing keys that match the params
	 *
	 * Returns array of accouting-formatted number strings of same length
	 *
	 * NB: `white-space:pre` CSS rule is required on the list container to prevent
	 * browsers from collapsing the whitespace in the output strings.
	 */
	lib.formatColumn = function(list, symbol, precision, thousand, decimal, format) {
		if (!list) return [];

		// Build options object from second param (if object) or all params, extending defaults:
		var opts = defaults(
				(isObject(symbol) ? symbol : {
					symbol : symbol,
					precision : precision,
					thousand : thousand,
					decimal : decimal,
					format : format
				}),
				lib.settings.currency
			),

			// Check format (returns object with pos, neg and zero), only need pos for now:
			formats = checkCurrencyFormat(opts.format),

			// Whether to pad at start of string or after currency symbol:
			padAfterSymbol = formats.pos.indexOf("%s") < formats.pos.indexOf("%v") ? true : false,

			// Store value for the length of the longest string in the column:
			maxLength = 0,

			// Format the list according to options, store the length of the longest string:
			formatted = map(list, function(val, i) {
				if (isArray(val)) {
					// Recursively format columns if list is a multi-dimensional array:
					return lib.formatColumn(val, opts);
				} else {
					// Clean up the value
					val = unformat(val);

					// Choose which format to use for this value (pos, neg or zero):
					var useFormat = val > 0 ? formats.pos : val < 0 ? formats.neg : formats.zero,

						// Format this value, push into formatted list and save the length:
						fVal = useFormat.replace('%s', opts.symbol).replace('%v', formatNumber(Math.abs(val), checkPrecision(opts.precision), opts.thousand, opts.decimal));

					if (fVal.length > maxLength) maxLength = fVal.length;
					return fVal;
				}
			});

		// Pad each number in the list and send back the column of numbers:
		return map(formatted, function(val, i) {
			// Only if this is a string (not a nested array, which would have already been padded):
			if (isString(val) && val.length < maxLength) {
				// Depending on symbol position, pad after symbol or at index 0:
				return padAfterSymbol ? val.replace(opts.symbol, opts.symbol+(new Array(maxLength - val.length + 1).join(" "))) : (new Array(maxLength - val.length + 1).join(" ")) + val;
			}
			return val;
		});
	};


	/* --- Module Definition --- */

	// Export accounting for CommonJS. If being loaded as an AMD module, define it as such.
	// Otherwise, just add `accounting` to the global object
	if (typeof exports !== 'undefined') {
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = lib;
		}
		exports.accounting = lib;
	} else if (typeof define === 'function' && define.amd) {
		// Return the library as an AMD module:
		define([], function() {
			return lib;
		});
	} else {
		// Use accounting.noConflict to restore `accounting` back to its original value.
		// Returns a reference to the library's `accounting` object;
		// e.g. `var numbers = accounting.noConflict();`
		lib.noConflict = (function(oldAccounting) {
			return function() {
				// Reset the value of the root's `accounting` variable:
				root.accounting = oldAccounting;
				// Delete the noConflict method:
				lib.noConflict = undefined;
				// Return reference to the library to re-assign it:
				return lib;
			};
		})(root.accounting);

		// Declare `fx` on the root (global/window) object:
		root['accounting'] = lib;
	}

	// Root will be `window` in browser or `global` on the server:
})(this);

/**
 Copyright (c) 2015 Zalando SE

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
(function  (root) {

    'use strict';

    var lib = {} // local object for export

    var localeSeparatorsMap = separators;
    var localePositionersMap = positions;

    var THOUSAND_MATCHER = /\B(?=(\d{3})+(?!\d))/g;
    var LOCALE_MATCHER = /^\s*([a-zA-Z]{2,4})(?:[-_][a-zA-Z]{4})?(?:[-_]([a-zA-Z]{2}|\d{3}))?\s*(?:$|[-_])/;
    var LOCALE_LANGUAGE = 1;
    var LOCALE_REGION = 2;

    function error(message) {
        throw new Error(message);
    }

    /**
     * @param {Object} map
     * @param {string} locale
     * @param {Array<string>} localeParts
     * @throws {Error}
     * @returns {string}
     */
    function findWithFallback(map, locale, localeParts) {
        var result = map[locale] ||
                     map[localeParts[LOCALE_LANGUAGE] + '-' + localeParts[LOCALE_REGION]] ||
                     map[localeParts[LOCALE_LANGUAGE]];
        if (!result) {
            error('Could not find info for locale "' + locale + '"');
        }

        return result;
    }

    /**
     * @param {string} region
     * @returns {string}
     */
    function getCurrencyFromRegion(region) {
        var currencyCode = countryCurrencyMap[region];
        if (!currencyCode) {
            error('Could not find default currency for locale region "' + region + '". Please provide explicit currency.');
        }
        return currencyCode;
    }

    /**
     * @typedef {{
     *     showDecimalIfWhole: boolean,
     *     subunitsPerUnit: number,
     *     effectiveLocale: string,
     *     currencyCode: string,
     *     currencySymbol: string,
     *     currencyFormatter: function,
     *     thousandSeparator: string,
     *     decimalSeparator: string
     * }} BanknoteFormatting
     */

    /**
     * This function tries hard to figure out full set formatting options necessary to format money.
     * If the locale is valid and contains are territory that is also a valid ISO3166-1-Alpha-2 country
     * code (e.g. en-US), then the default currency for that country is taken. Otherwise you have to
     * provide an explicit currency code.
     * @throws Error thrown if the lookup of formatting rules has failed.
     * @param {string} locale a BCP47 locale string
     * @param {string=} currencyCode explicit currency code for for the currency symbol lookup
     * @returns {BanknoteFormatting}
     */
    lib.formattingForLocale = function (locale, currencyCode) {
        var localeParts = locale.match(LOCALE_MATCHER);
        print(localeParts);
        if (!localeParts) {
            error('Locale provided does not conform to BCP47.');
        }

        currencyCode = currencyCode || getCurrencyFromRegion(localeParts[LOCALE_REGION]);
        print(currencyCode);
        var separators = findWithFallback(localeSeparatorsMap, locale, localeParts);

        return {
            showDecimalIfWhole: true,
            subunitsPerUnit: 100, // TODO change 100 with real information
            currencyCode: currencyCode,
            currencySymbol: currencySymbolMap[currencyCode] || currencyCode,
            currencyFormatter: findWithFallback(localePositionersMap, locale, localeParts),
            decimalSeparator: separators.charAt(0),
            thousandSeparator: separators.charAt(1)
        };
    };

    /**
     * Returns a currency code for the given country or `undefined` if nothing found.
     * @param {string} twoCharacterCountryCode
     * @returns {string|undefined}
     */
    lib.currencyForCountry = function (twoCharacterCountryCode) {
        return countryCurrencyMap[twoCharacterCountryCode];
    };

    /**
     * This function accepts an amount in subunits (which are called "cents" in currencies like EUR or USD),
     * and also a formatting options object, that can be either constructed manually or created from locale
     * using `banknote.formattingForLocale()` method. This function doesn't provide any defaults for formatting.
     * @param {Number} subunitAmount
     * @param {BanknoteFormatting} formatting
     * @returns {string}
     */
    lib.formatSubunitAmount = function (subunitAmount, formatting) {
        var minus = subunitAmount < 0 ? '-' : '';
        var mainPart = Math.abs(subunitAmount / formatting.subunitsPerUnit) | 0; // | 0 cuts of the decimal part
        var decimalPart = String(Math.abs(subunitAmount % formatting.subunitsPerUnit) | 0);
        var formattedAmount = String(mainPart);

        if (formatting.thousandSeparator) {
            formattedAmount = formattedAmount.replace(THOUSAND_MATCHER, formatting.thousandSeparator);
        }

        if (!(!formatting.showDecimalIfWhole && decimalPart === '0')) {
            var centsZeroFill = String(formatting.subunitsPerUnit).length - 1;
            while (decimalPart.length < centsZeroFill) {
                decimalPart = '0' + decimalPart;
            }
            formattedAmount += formatting.decimalSeparator + decimalPart;
        }

        return formatting.currencyFormatter(formatting.currencySymbol, formattedAmount, minus);
    };
    root['banknote'] = lib;
})(this);
'use strict';

var countryCurrencyMap = {
    'AC': 'USD',
    'AD': 'EUR',
    'AE': 'AED',
    'AF': 'AFN',
    'AG': 'XCD',
    'AI': 'XCD',
    'AL': 'ALL',
    'AM': 'AMD',
    'AO': 'AOA',
    'AR': 'ARS',
    'AS': 'USD',
    'AT': 'EUR',
    'AU': 'AUD',
    'AW': 'AWG',
    'AX': 'EUR',
    'AZ': 'AZN',
    'BA': 'BAM',
    'BB': 'BBD',
    'BD': 'BDT',
    'BE': 'EUR',
    'BF': 'XOF',
    'BG': 'BGN',
    'BH': 'BHD',
    'BI': 'BIF',
    'BJ': 'XOF',
    'BL': 'EUR',
    'BM': 'BMD',
    'BN': 'BND',
    'BO': 'BOB',
    'BQ': 'USD',
    'BR': 'BRL',
    'BS': 'BSD',
    'BT': 'INR',
    'BV': 'NOK',
    'BW': 'BWP',
    'BY': 'BYR',
    'BZ': 'BZD',
    'CA': 'CAD',
    'CC': 'AUD',
    'CD': 'CDF',
    'CF': 'XAF',
    'CG': 'XAF',
    'CH': 'CHF',
    'CI': 'XOF',
    'CK': 'NZD',
    'CL': 'CLP',
    'CM': 'XAF',
    'CN': 'CNY',
    'CO': 'COP',
    'CP': 'EUR',
    'CR': 'CRC',
    'CU': 'CUP',
    'CV': 'CVE',
    'CW': 'ANG',
    'CX': 'AUD',
    'CY': 'EUR',
    'CZ': 'CZK',
    'DE': 'EUR',
    'DG': 'USD',
    'DJ': 'DJF',
    'DK': 'DKK',
    'DM': 'XCD',
    'DO': 'DOP',
    'DZ': 'DZD',
    'EA': 'EUR',
    'EC': 'USD',
    'EE': 'EUR',
    'EG': 'EGP',
    'EH': 'MAD',
    'ER': 'ERN',
    'ES': 'EUR',
    'ET': 'ETB',
    'EU': 'EUR',
    'FI': 'EUR',
    'FJ': 'FJD',
    'FK': 'FKP',
    'FM': 'USD',
    'FO': 'DKK',
    'FR': 'EUR',
    'FX': 'EUR',
    'GA': 'XAF',
    'GB': 'GBP',
    'GD': 'XCD',
    'GE': 'GEL',
    'GF': 'EUR',
    'GG': 'GBP',
    'GH': 'GHS',
    'GI': 'GIP',
    'GL': 'DKK',
    'GM': 'GMD',
    'GN': 'GNF',
    'GP': 'EUR',
    'GQ': 'XAF',
    'GR': 'EUR',
    'GS': 'GBP',
    'GT': 'GTQ',
    'GU': 'USD',
    'GW': 'XOF',
    'GY': 'GYD',
    'HK': 'HKD',
    'HM': 'AUD',
    'HN': 'HNL',
    'HR': 'HRK',
    'HT': 'HTG',
    'HU': 'HUF',
    'IC': 'EUR',
    'ID': 'IDR',
    'IE': 'EUR',
    'IL': 'ILS',
    'IM': 'GBP',
    'IN': 'INR',
    'IO': 'USD',
    'IQ': 'IQD',
    'IR': 'IRR',
    'IS': 'ISK',
    'IT': 'EUR',
    'JE': 'GBP',
    'JM': 'JMD',
    'JO': 'JOD',
    'JP': 'JPY',
    'KE': 'KES',
    'KG': 'KGS',
    'KH': 'KHR',
    'KI': 'AUD',
    'KM': 'KMF',
    'KN': 'XCD',
    'KP': 'KPW',
    'KR': 'KRW',
    'KW': 'KWD',
    'KY': 'KYD',
    'KZ': 'KZT',
    'LA': 'LAK',
    'LB': 'LBP',
    'LC': 'XCD',
    'LI': 'CHF',
    'LK': 'LKR',
    'LR': 'LRD',
    'LS': 'LSL',
    'LT': 'EUR',
    'LU': 'EUR',
    'LV': 'EUR',
    'LY': 'LYD',
    'MA': 'MAD',
    'MC': 'EUR',
    'MD': 'MDL',
    'ME': 'EUR',
    'MF': 'EUR',
    'MG': 'MGA',
    'MH': 'USD',
    'MK': 'MKD',
    'ML': 'XOF',
    'MM': 'MMK',
    'MN': 'MNT',
    'MO': 'MOP',
    'MP': 'USD',
    'MQ': 'EUR',
    'MR': 'MRO',
    'MS': 'XCD',
    'MT': 'EUR',
    'MU': 'MUR',
    'MV': 'MVR',
    'MW': 'MWK',
    'MX': 'MXN',
    'MY': 'MYR',
    'MZ': 'MZN',
    'NA': 'NAD',
    'NC': 'XPF',
    'NE': 'XOF',
    'NF': 'AUD',
    'NG': 'NGN',
    'NI': 'NIO',
    'NL': 'EUR',
    'NO': 'NOK',
    'NP': 'NPR',
    'NR': 'AUD',
    'NU': 'NZD',
    'NZ': 'NZD',
    'OM': 'OMR',
    'PA': 'PAB',
    'PE': 'PEN',
    'PF': 'XPF',
    'PG': 'PGK',
    'PH': 'PHP',
    'PK': 'PKR',
    'PL': 'PLN',
    'PM': 'EUR',
    'PN': 'NZD',
    'PR': 'USD',
    'PS': 'JOD',
    'PT': 'EUR',
    'PW': 'USD',
    'PY': 'PYG',
    'QA': 'QAR',
    'RE': 'EUR',
    'RO': 'RON',
    'RS': 'RSD',
    'RU': 'RUB',
    'RW': 'RWF',
    'SA': 'SAR',
    'SB': 'SBD',
    'SC': 'SCR',
    'SD': 'SDG',
    'SE': 'SEK',
    'SG': 'SGD',
    'SH': 'SHP',
    'SI': 'EUR',
    'SJ': 'NOK',
    'SK': 'EUR',
    'SL': 'SLL',
    'SM': 'EUR',
    'SN': 'XOF',
    'SO': 'SOS',
    'SR': 'SRD',
    'SS': 'SSP',
    'ST': 'STD',
    'SU': 'RUB',
    'SV': 'USD',
    'SX': 'ANG',
    'SY': 'SYP',
    'SZ': 'SZL',
    'TA': 'GBP',
    'TC': 'USD',
    'TD': 'XAF',
    'TF': 'EUR',
    'TG': 'XOF',
    'TH': 'THB',
    'TJ': 'TJS',
    'TK': 'NZD',
    'TL': 'USD',
    'TM': 'TMT',
    'TN': 'TND',
    'TO': 'TOP',
    'TR': 'TRY',
    'TT': 'TTD',
    'TV': 'AUD',
    'TW': 'TWD',
    'TZ': 'TZS',
    'UA': 'UAH',
    'UG': 'UGX',
    'UK': 'GBP',
    'UM': 'USD',
    'US': 'USD',
    'UY': 'UYU',
    'UZ': 'UZS',
    'VA': 'EUR',
    'VC': 'XCD',
    'VE': 'VEF',
    'VG': 'USD',
    'VI': 'USD',
    'VN': 'VND',
    'VU': 'VUV',
    'WF': 'XPF',
    'WS': 'WST',
    'XK': 'EUR',
    'YE': 'YER',
    'YT': 'EUR',
    'ZA': 'ZAR',
    'ZM': 'ZMW',
    'ZW': 'USD'
};

'use strict';

var positions = {};

positions['af'] =
positions['am'] =
positions['cy'] =
positions['en'] =
positions['es-419'] =
positions['es-BO'] =
positions['es-CR'] =
positions['es-CU'] =
positions['es-DO'] =
positions['es-GQ'] =
positions['es-GT'] =
positions['es-HN'] =
positions['es-MX'] =
positions['es-NI'] =
positions['es-PA'] =
positions['es-PE'] =
positions['es-PR'] =
positions['es-SV'] =
positions['es-US'] =
positions['fil'] =
positions['ga'] =
positions['gl'] =
positions['gu'] =
positions['hi'] =
positions['id'] =
positions['ja'] =
positions['km'] =
positions['kn'] =
positions['ko'] =
positions['ml'] =
positions['mr'] =
positions['ms'] =
positions['pt'] =
positions['si'] =
positions['sw'] =
positions['te'] =
positions['th'] =
positions['zh'] =
positions['zu'] = function (symbol, amount, minus) {
    return minus + symbol + amount;
};

positions['ar'] =
positions['az'] =
positions['de-AT'] =
positions['de-LI'] =
positions['en-AT'] =
positions['en-IN'] =
positions['en-US-POSIX'] =
positions['es-AR'] =
positions['es-CO'] =
positions['es-UY'] =
positions['hy'] =
positions['mk'] =
positions['mn'] =
positions['ms-BN'] =
positions['my'] =
positions['nb'] =
positions['ne'] =
positions['pa'] =
positions['root'] =
positions['ta'] =
positions['to'] =
positions['ur'] =
positions['vi'] = function (symbol, amount, minus) {
    return minus + symbol + ' ' + amount;
};

positions['be'] =
positions['bg'] =
positions['bs'] =
positions['ca'] =
positions['cs'] =
positions['da'] =
positions['de'] =
positions['el'] =
positions['en-150'] =
positions['en-BE'] =
positions['en-DE'] =
positions['en-DK'] =
positions['en-FI'] =
positions['en-SE'] =
positions['en-SI'] =
positions['es'] =
positions['et'] =
positions['eu'] =
positions['fi'] =
positions['fo'] =
positions['fr'] =
positions['he'] =
positions['hr'] =
positions['hu'] =
positions['is'] =
positions['it'] =
positions['ka'] =
positions['kk'] =
positions['ky'] =
positions['lt'] =
positions['lv'] =
positions['nl-BE'] =
positions['pl'] =
positions['pt-AO'] =
positions['pt-CV'] =
positions['pt-GW'] =
positions['pt-MO'] =
positions['pt-MZ'] =
positions['pt-PT'] =
positions['pt-ST'] =
positions['pt-TL'] =
positions['ro'] =
positions['ru'] =
positions['sk'] =
positions['sl'] =
positions['sq'] =
positions['sr'] =
positions['sv'] =
positions['tr'] =
positions['uk'] =
positions['uz'] = function (symbol, amount, minus) {
    return minus + amount + ' ' + symbol;
};

positions['bn'] = function (symbol, amount, minus) {
    return minus + amount + symbol;
};

positions['de-CH'] =
positions['en-CH'] =
positions['fr-CH'] =
positions['it-CH'] = function (symbol, amount, minus) {
    return minus ? (symbol + minus + amount) : (symbol + ' ' + amount);
};

positions['en-NL'] =
positions['es-PY'] =
positions['nl'] = function (symbol, amount, minus) {
    return minus ? (symbol + ' ' + minus + amount) : (symbol + ' ' + amount);
};

positions['es-CL'] =
positions['es-EC'] =
positions['es-VE'] =
positions['lo'] = function (symbol, amount, minus) {
    return minus ? (symbol + minus + amount) : (symbol + amount);
};

positions['fa'] = function (symbol, amount, minus) {
    return '‎' + minus + symbol + amount;
};


'use strict';

var separators = {};

separators['af'] =
separators['be'] =
separators['bg'] =
separators['cs'] =
separators['de-AT'] =
separators['en-FI'] =
separators['en-SE'] =
separators['en-ZA'] =
separators['es-CR'] =
separators['et'] =
separators['fi'] =
separators['fr'] =
separators['hu'] =
separators['ka'] =
separators['kk'] =
separators['ky'] =
separators['lt'] =
separators['lv'] =
separators['nb'] =
separators['pl'] =
separators['pt-AO'] =
separators['pt-CV'] =
separators['pt-GW'] =
separators['pt-MO'] =
separators['pt-MZ'] =
separators['pt-PT'] =
separators['pt-ST'] =
separators['pt-TL'] =
separators['ru'] =
separators['sk'] =
separators['sq'] =
separators['sv'] =
separators['uk'] =
separators['uz'] = ', ';

separators['am'] =
separators['ar'] =
separators['bn'] =
separators['cy'] =
separators['en'] =
separators['es-419'] =
separators['es-CU'] =
separators['es-DO'] =
separators['es-GT'] =
separators['es-HN'] =
separators['es-MX'] =
separators['es-NI'] =
separators['es-PA'] =
separators['es-PE'] =
separators['es-PR'] =
separators['es-SV'] =
separators['es-US'] =
separators['fa'] =
separators['fil'] =
separators['ga'] =
separators['gu'] =
separators['he'] =
separators['hi'] =
separators['ja'] =
separators['kn'] =
separators['ko'] =
separators['ml'] =
separators['mn'] =
separators['mr'] =
separators['ms'] =
separators['my'] =
separators['ne'] =
separators['pa'] =
separators['root'] =
separators['si'] =
separators['sw'] =
separators['ta'] =
separators['te'] =
separators['th'] =
separators['to'] =
separators['ur'] =
separators['zh'] =
separators['zu'] = '.,';

separators['ar-DZ'] =
separators['ar-LB'] =
separators['ar-LY'] =
separators['ar-MA'] =
separators['ar-MR'] =
separators['ar-TN'] =
separators['az'] =
separators['bs'] =
separators['ca'] =
separators['da'] =
separators['de'] =
separators['el'] =
separators['en-150'] =
separators['en-AT'] =
separators['en-BE'] =
separators['en-CH'] =
separators['en-DE'] =
separators['en-DK'] =
separators['en-NL'] =
separators['en-SI'] =
separators['es'] =
separators['eu'] =
separators['fo'] =
separators['fr-BE'] =
separators['fr-LU'] =
separators['fr-MA'] =
separators['gl'] =
separators['hr'] =
separators['hy'] =
separators['id'] =
separators['is'] =
separators['it'] =
separators['km'] =
separators['lo'] =
separators['mk'] =
separators['ms-BN'] =
separators['nl'] =
separators['pt'] =
separators['ro'] =
separators['sl'] =
separators['sr'] =
separators['sw-CD'] =
separators['tr'] =
separators['vi'] = ',.';

separators['de-CH'] =
separators['de-LI'] =
separators['it-CH'] = '.\'';

separators['fr-CH'] = '. ';


'use strict';

var currencySymbolMap = {
    'AOA': 'Kz',
    'ARS': '$',
    'AUD': '$',
    'BAM': 'KM',
    'BBD': '$',
    'BDT': '৳',
    'BMD': '$',
    'BND': '$',
    'BOB': 'Bs',
    'BRL': 'R$',
    'BSD': '$',
    'BWP': 'P',
    'BYR': 'р.',
    'BZD': '$',
    'CAD': '$',
    'CLP': '$',
    'CNY': '¥',
    'COP': '$',
    'CRC': '₡',
    'CUC': '$',
    'CUP': '$',
    'CZK': 'Kč',
    'DKK': 'kr',
    'DOP': '$',
    'EGP': 'E£',
    'ESP': '₧',
    'EUR': '€',
    'FJD': '$',
    'FKP': '£',
    'GBP': '£',
    'GIP': '£',
    'GNF': 'FG',
    'GTQ': 'Q',
    'GYD': '$',
    'HKD': '$',
    'HNL': 'L',
    'HRK': 'kn',
    'HUF': 'Ft',
    'IDR': 'Rp',
    'ILS': '₪',
    'INR': '₹',
    'ISK': 'kr',
    'JMD': '$',
    'JPY': '¥',
    'KHR': '៛',
    'KMF': 'CF',
    'KPW': '₩',
    'KRW': '₩',
    'KYD': '$',
    'KZT': '₸',
    'LAK': '₭',
    'LBP': 'L£',
    'LKR': 'Rs',
    'LRD': '$',
    'LTL': 'Lt',
    'LVL': 'Ls',
    'MGA': 'Ar',
    'MMK': 'K',
    'MNT': '₮',
    'MUR': 'Rs',
    'MXN': '$',
    'MYR': 'RM',
    'NAD': '$',
    'NGN': '₦',
    'NIO': 'C$',
    'NOK': 'kr',
    'NPR': 'Rs',
    'NZD': '$',
    'PHP': '₱',
    'PKR': 'Rs',
    'PLN': 'zł',
    'PYG': '₲',
    'RUB': '₽',
    'RUR': 'р.',
    'RWF': 'RF',
    'SBD': '$',
    'SEK': 'kr',
    'SGD': '$',
    'SHP': '£',
    'SRD': '$',
    'SSP': '£',
    'STD': 'Db',
    'SYP': '£',
    'THB': '฿',
    'TOP': 'T$',
    'TRY': '₺',
    'TTD': '$',
    'TWD': '$',
    'UAH': '₴',
    'USD': '$',
    'UYU': '$',
    'VEF': 'Bs',
    'VND': '₫',
    'XCD': '$',
    'ZAR': 'R',
    'ZMW': 'ZK'
};