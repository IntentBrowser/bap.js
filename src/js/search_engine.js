import { api } from "./api";
function search_engine(network) {
    network.ensure();
    let n = network.get();
    return {
        list: function (refresh) {
            if (refresh) {
                delete n.search_providers;
            }

            if (n.search_providers) {
                return new Promise((resolve, reject) => {
                    resolve(n.search_providers);
                });
            } else {
                return api()
                    .url(`${network.registry_url()}/lookup`)
                    .parameters({ type: "BG" })
                    .post()
                    .then(function (response) {
                        n.search_providers = response;
                        network.persist();
                        return response;
                    });
            }
        },
        choose: function (subscriber) {
            return this.list().then(function (subscribers) {
                let subscriber_id = subscriber.subscriber_id || subscriber;

                let search_provider = subscribers.find((subscriber) => {
                    return subscriber.subscriber_id == subscriber_id;
                });

                if (!search_provider) {
                    throw new Error("Invalid subscriber :" + subscriber_id);
                }
                n.search_provider = search_provider;
                network.persist();
                return search_provider;
            });
        },
        ensure: function () {
            let search_provider = n.search_provider;
            if (!search_provider) {
                throw new Error("No search provider selected");
            }
        },
        isSet: function () {
            return n.search_provider;
        },
        get: function () {
            this.ensure();
            return n.search_provider;
        },
        categories: function () {
            this.ensure();
            if (n.categories) {
                return new Promise((resolve, reject) => {
                    resolve(n.categories);
                });
            } else {
                return api()
                    .url(`${this.get().subscriber_url}/categories`)
                    .headers({
                        ApiKeyCase: "SNAKE",
                        ApiRootRequired: "N",
                    })
                    .get()
                    .then(function (response) {
                        n.categories = response;
                        network.persist();
                    });
            }
        },
    };
}
export { search_engine };
