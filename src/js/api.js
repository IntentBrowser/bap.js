import axios from "axios";
import * as Lockr from "lockr";

function api() {
    var _url;
    var _parameter;
    var _headers;
    var _responseType;
    var _method;

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
                _parameter = Object.assign(_parameter, p);
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
        get: async function (qryJson) {
            let self = this;
            this.parameters(qryJson);
            //let params = qryJson ? qryJson : {};
            let config = { data: {}, params: _parameter, headers: self.headers() };
            if (_responseType) {
                config.responseType = _responseType;
            }
            if (_method) {
                config.method = _method;
            }
            const response = await self
                .http()
                .get(self.url(), config);
            return response.data;
        },
        method: function method(method) {
            _method = method;
            return this;
        },
        post: async function () {
            let self = this;

            let config = { headers: self.headers() };
            if (_responseType) {
                config.responseType = _responseType;
            }
            if (_method == 'put') {
                const response = await self
                    .http()
                    .put(self.url(), _parameter, config);

                return response.data;
            } else if (_method == 'delete') {
                const response = await self
                    .http()
                    .delete(self.url(), { headers: self.headers(), "data": _parameter });

                return response.data;
            } else {
                const response = await self
                    .http()
                    .post(self.url(), _parameter, config);

                return response.data;

            }
        },
        responseType: function (type) {
            _responseType = type;
            return this;
        },
    };
}
function watchLocation(enableHighAccuracy, onSuccess) {
    var id = null;
    id = navigator.geolocation.watchPosition(function (pos) {
        let location = {};
        copyLocation(pos, location);
        onSuccess(location);
        if (id) {
            navigator.geolocation.clearWatch(id);
            id = null;
        }
    }, function (error) {
        console.error(`ERROR(${error.code}) : ${error.message}`);
        onSuccess(null, error);
    }, {
        enableHighAccuracy: enableHighAccuracy,
        timeout: 2000,
        maximumAge: 60 * 60 * 1000,
    });

}
function copyLocation(position, location) {
    location.accuracy = position.coords.accuracy;
    location.altitude = position.coords.altitude;
    location.altitudeAccuracy = position.coords.altitudeAccuracy;
    location.heading = position.coords.heading;
    location.latitude = position.coords.latitude;
    location.longitude = position.coords.longitude;
    location.speed = position.coords.speed;
    Lockr.set("Location", location);
}

function isCrawler() {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('googlebot') || userAgent.includes('bingbot') || userAgent.includes('slurp');
}
function isUserLocationAvailable() {
    let l = Lockr.get("Location");
    return l && l.latitude && l.longitude;

}
function loadLocation(enableHighAccuracy, ensureLocationPermission = true) {
    let _location = Lockr.get("Location");
    if (_location && _location.latitude) {
        _location.cached = true;
        return new Promise(function (resolve, reject) {
            resolve(_location);
        });
    }
    if (!ensureLocationPermission) {
        return new Promise(function (resolve, reject) {
            resolve(null);
        });
    }

    return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                let location = {};
                copyLocation(position, location)
                resolve(location);
            },
            function (error) {
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
                resolve(null, error);
            },
            {
                enableHighAccuracy: enableHighAccuracy,
                timeout: 2000,
                maximumAge: 60 * 60 * 1000,
            }
        ); // 60 minutes.
    });
}


export { api, loadLocation, watchLocation, isCrawler, isUserLocationAvailable };
