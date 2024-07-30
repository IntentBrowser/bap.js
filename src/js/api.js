import axios from "axios";
import * as Lockr from "lockr";

function api() {
    var _url;
    var _parameter;
    var _headers;
    var _responseType;

    return {
        url: function (url) {
            if (arguments.length == 0) {
                return _url;
            }
            _url = url.replaceAll(" ", "%20");
            return this;
        },
        parameters: function (p) {
            if (!_parameter) {
                _parameter = {};
            }
            if (arguments.length > 0) {
                _parameter = p;
            }
            return this;
        },
        headers: function (additional_headers) {
            let defaultOptions = {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            };
            if (typeof Lockr !== "undefined") {
                let location = Lockr.get("Location");
                if (location && location.latitude && location.longitude) {
                    defaultOptions["X-Lat"] = location.latitude;
                    defaultOptions["X-Lng"] = location.longitude;
                }
            }
            if (!_headers) {
                _headers = {};
                _headers = Object.assign({}, _headers, defaultOptions); //{ ..._headers ,  ...defaultOptions}
            }
            if (arguments.length > 0) {
                _headers = Object.assign({}, _headers, additional_headers); //{ ..._headers, ...additional_headers } ;
                return this;
            }
            return _headers;
        },
        http: function () {
            return axios.create({
                baseURL: "/",
                timeout: 120000,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
                withCredentials: false,
            });
        },
        get: function (qryJson) {
            let self = this;
            let params = qryJson ? qryJson : {};
            let config = { data: {}, params: params, headers: self.headers() };
            if (_responseType) {
                config.responseType = _responseType;
            }
            return self
                .http()
                .get(self.url(), config)
                .then(function (response) {
                    return response.data;
                });
        },
        post: function () {
            let self = this;

            let config = { headers: self.headers() };
            if (_responseType) {
                config.responseType = _responseType;
            }

            return self
                .http()
                .post(self.url(), _parameter, config)
                .then(function (response) {
                    return response.data;
                });
        },
        responseType: function (type) {
            _responseType = type;
            return this;
        },
    };
}

function loadLocation(enableHighAccuracy) {
    return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                let location = {};
                location.accuracy = position.coords.accuracy;
                location.altitude = position.coords.altitude;
                location.altitudeAccuracy = position.coords.altitudeAccuracy;
                location.heading = position.coords.heading;
                location.latitude = position.coords.latitude;
                location.longitude = position.coords.longitude;
                location.speed = position.coords.speed;
                Lockr.set("Location", location);
                resolve(location);
            },
            function (error) {
                if (!Lockr.get("Location")) {
                    Lockr.set("Location", {});
                }
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        console.error(
                            "User denied the request for Geolocation."
                        );
                        break;
                    case error.POSITION_UNAVAILABLE:
                        console.error("Location information is unavailable.");
                        break;
                    case error.TIMEOUT:
                        console.error(
                            "The request to get user location timed out."
                        );
                        break;
                    case error.UNKNOWN_ERROR:
                        console.error("An unknown error occurred.");
                        break;
                }
                resolve(null);
            },
            {
                enableHighAccuracy: enableHighAccuracy,
                timeout: 2000,
                maximumAge: 5 * 60 * 1000,
            }
        ); // five minutes.
    });
}

export { api, loadLocation };
