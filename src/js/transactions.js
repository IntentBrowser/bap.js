import { api } from "./api.js";
function transactions(network) {
    network.ensure();
    let n = network.get();
    n.transactions = n.transactions || [];
    n.carts = n.carts || [];
    network.persist();

    let transactions = {}; // Both complete and incomplete transactions.
    n.transactions.forEach((element) => {
        transactions[element["search"].request.context.transaction_id] =
            element;
    });
    n.carts.forEach((element) => {
        transactions[element["search"].request.context.transaction_id] =
            element;
    })
    let evtSource = undefined;
    return {
        close_cart: function (transaction_id) {
            let cart = transactions[transaction_id];
            if (cart) {
                let index = n.carts.findIndex((c) => c.search.request.context.transaction_id == transaction_id);
                if (this.transaction(transaction_id).isPlaced()) {
                    n.transactions.splice(0, 0, cart); // Add lastest in the first.
                }
                n.carts.splice(index, 1);
                network.persist();
            }
        },
        new_cart: function () {
            let cart = {
                search: {
                    request: {
                        context: {
                            domain: n.domain.name,
                            transaction_id: crypto.randomUUID(),
                            message_id: crypto.randomUUID(),
                            action: "search",
                            ttl: "PT10S",
                        },
                        message: {
                            intent: {},
                        },
                    },
                    response: undefined,
                    depends: null,
                },
                select: {
                    request: undefined,
                    response: undefined,
                    depends: ["search"],
                },
                init: {
                    request: undefined,
                    response: undefined,
                    depends: ["select"],
                },
                confirm: {
                    request: undefined,
                    response: undefined,
                    depends: ["init"],
                },
                status: {
                    request: undefined,
                    response: undefined,
                    depends: ["confirm"],
                },
                cancel: {
                    request: undefined,
                    response: undefined,
                    depends: ["confirm"],
                },
            };
            n.carts.splice(0, 0, cart); //add first.
            transactions[cart.search.request.context.transaction_id] = cart;
            network.persist();
            return cart;
        },
        carts: function (reset = false) {
            if (reset) {
                n.carts.forEach((cart) => {
                    this.close_cart(cart.search.request.context.transaction_id);
                });
                n.carts = [];
            }
            return n.carts;
        },
        list: function () {
            return n.transactions;
        },
        transaction: function (transaction_id) {
            let txn = transaction_id ? transactions[transaction_id] : undefined;
            let network_transactions = this;
            if (!txn) {
                //Transaction id is generated internally. No control to set it.
                throw new Error("Invalid transaction_id!");
            }

            return {
                isPlaced: function () {
                    return txn.confirm.response || (txn.confirm.request && txn.confirm.request.message &&
                        txn.confirm.request.message.order &&
                        !txn.confirm.request.bpp_url);
                },
                dependent_actions: function (action) {
                    let actions = Object.keys(txn);
                    let dependent_actions = [];
                    actions.forEach((some_action) => {
                        let depends = txn[some_action].depends;
                        if (
                            depends &&
                            depends
                                .find((a) => {
                                    return a == action;
                                })
                        ) {
                            dependent_actions.push(some_action);
                        }
                    });
                    return dependent_actions;
                },
                payload: function (action) {
                    return txn[action];
                },
                request: function (action) {
                    return txn[action].request;
                },
                response: function (action) {
                    return txn[action].response;
                },

                search: function () {
                    return this.call("search", false);
                },
                select: function () {
                    return this.call("select", true);
                },
                init: function () {
                    return this.call("init", true);
                },
                confirm: function () {
                    return this.call("confirm", true);
                },
                status: function () {
                    return this.call("status", true);
                },
                cancel: function () {
                    return this.call("cancel", true);
                },
                read_events: function (message_id, on_event) {
                    if (!on_event) {
                        return;
                    }
                    if (evtSource) {
                        evtSource.close();
                        evtSource = undefined;
                    }
                    evtSource = new EventSource(
                        `${network.search_provider().get().subscriber_url
                        }/read_events/${message_id}`
                    );
                    evtSource.onmessage = (event) => {
                        let response = JSON.parse(event.data);
                        if (!response || response.done) {
                            evtSource.close();
                            evtSource = undefined;
                            on_event(undefined);
                        } else if (response.message) {
                            let action = response.context.action.substring(3); // strip the on_...
                            this.propagate_to_dependent_actions(action, response);
                            on_event(response);
                        }
                    };
                },
                propagate_to_dependent_actions(action, response) {
                    let self = this;
                    let action_payload = self.payload(action);
                    if (action == "search") {
                        (action_payload.response ||= []).push(response);
                    } else {
                        action_payload.response = response;
                    }

                    self.dependent_actions(action).forEach(
                        (dependent_action) => {
                            let next_request = JSON.parse(
                                JSON.stringify(response)
                            ); // clone
                            if (action == "search") {
                                delete next_request.message.catalog
                            }
                            next_request.context.action =
                                dependent_action;
                            delete next_request.context.message_id;
                            self.payload(dependent_action).request =
                                next_request;
                        }
                    );
                    network.persist();
                },
                call: function (action, sync = false) {
                    let self = this;
                    let action_payload = self.payload(action);
                    action_payload.request.context.message_id =
                        crypto.randomUUID();
                    if (action == "search" || action_payload.request.context.bpp_url) {
                        return api()
                            .url(
                                `${network.search_provider().get().subscriber_url
                                }/${action}`
                            )
                            .parameters(action_payload.request)
                            .headers({
                                "X-CallBackToBeSynchronized": sync ? "Y" : "N",
                            })
                            .post()
                            .then(function (response) {
                                if (sync == 'Y') {
                                    action_payload.response = response;
                                    self.propagate_to_dependent_actions(action, response);
                                }
                                if (action == "confirm") {
                                    network_transactions.close_cart(action_payload.request.context.transaction_id); // Reset Cart.
                                }
                                return response;
                            });
                    } else {
                        return new Promise((resolve, reject) => {
                            if (action == "confirm") {
                                network_transactions.close_cart(action_payload.request.context.transaction_id); // Reset Cart.
                            } else {
                                reject(new Error("Only confirm api can be called for non application bpps."));
                            }
                            resolve(undefined);
                        });
                    }
                },
            };
        },
    };
}
export { transactions };
