import { api } from "./api";
import * as Lockr from "lockr";
import { search_engine } from "./search_engine";
import { transactions } from "./transactions";

const networks = {
    hbo: {
        name: "hbo",
        version: "1.2",
        registry_id: "id.humbhionline.in",
        base_url: "https://id.humbhionline.in",
        registry_url: "https://id.humbhionline.in/subscribers",
    },
    beckn_open: {
        name: "beckn_open",
        registry_id: "registry.becknprotocol.io..LREG",
        base_url: "https://registry.becknprotocol.io",
        registry_url: "https://registry.becknprotocol.io/subscribers",
        version: "1.0",
    },
};
const domain_category_descriptor = {
    BUY_TRANSPORT_VEHICLE: {
        resource_category: "GOODS",
        used_for_transport: true,
        transportable: true,
        usage: "CONTINUOUS",
    },
    RENT_TRANSPORT_VEHICLE: {
        resource_category: "GOODS",
        used_for_transport: true,
        transportable: true,
        usage: "SCHEDULE",
    },

    HIRE_TRANSPORT_SERVICE: {
        resource_category: "SERVICES",
        used_for_transport: true,
        transportable: true,
        usage: "SCHEDULE",
    },

    BUY_MOVABLE_GOODS: {
        resource_category: "GOODS",
        used_for_transport: false,
        transportable: true,
        usage: "CONTINUOUS",
    },
    RENT_MOVABLE_GOODS: {
        resource_category: "GOODS",
        used_for_transport: false,
        transportable: true,
        usage: "SCHEDULE",
    },

    HIRE_MOVABLE_SERVICE: {
        resource_category: "SERVICE",
        used_for_transport: false,
        transportable: true,
        usage: "SCHEDULE",
    },

    BUY_IMMOVABLE_GOODS: {
        resource_category: "GOODS",
        used_for_transport: false,
        transportable: false,
        usage: "CONTINUOUS",
    },
    RENT_IMOVABLE_GOODS: {
        resource_category: "GOODS",
        used_for_transport: false,
        transportable: false,
        usage: "SCHEDULE",
    },

    HIRE_IMMOVABLE_SERVICE: {
        resource_category: "SERVICES",
        used_for_transport: false,
        transportable: false,
        usage: "SCHEDULE",
    },
};

function network() {
    let current = Lockr.get("current");

    return {
        persist() {
            Lockr.set("current", current);
        },
        list() {
            return Object.keys(networks);
        },
        isSet() {
            return current && current.network;
        },
        choose(name) {
            current ||= {};
            current.network = networks[name];
            this.ensure();
            this.persist();
            return this;
        },
        ensure() {
            if (!current || !current.network) {
                throw new Error("Unknown Network!");
            }
        },
        get() {
            this.ensure();
            return current.network;
        },
        registry_url() {
            this.ensure();
            return current.network.registry_url;
        },
        base_url() {
            this.ensure();
            return current.network.base_url;
        },
        domains() {
            let self = this;
            self.ensure();
            current.network.domains ||= [];
            let domains = current.network.domains;
            if (domains && domains.length > 0) {
                return new Promise((resolve, reject) => {
                    resolve(domains);
                });
            } else {
                return api()
                    .url(`${this.base_url()}/network_domains`)
                    .headers({ ApiKeyCase: "SNAKE", ApiRootRequired: "N" })
                    .get()
                    .then(function (response) {
                        current.network.domains = response;
                        console.log("Response found " + JSON.stringify(response));
                        return current.network.domains;
                    })
                    .catch((err) => {
                        current.network.domains = [];
                        return current.network.domains;
                    })
                    .finally(() => {
                        self.persist();
                    });
            }
        },
        domain(d) {
            let self = this;

            self.ensure();
            return self.domains().then((domains) => {
                if (domains.length == 0) {
                    current.network.domain = undefined;
                } else if (d) {
                    let found = domains.find((domain) => {
                        return domain.code == d || domain.code == d.code;
                    });
                    if (found) {
                        found.meta =
                            domain_category_descriptor[found.domain_category];
                    }
                    current.network.domain = found;
                }
                self.persist();

                return current.network.domain;
            });
        },
        _search_provider: undefined,
        search_provider() {
            return (this._search_provider ||= search_engine(this));
        },
        _transactions: undefined,
        transactions() {
            return (this._transactions ||= transactions(this));
        },
    };
}

export { network };
