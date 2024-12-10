import { api } from "./api.js";
import { db } from "./orders.js";
async function transactions(network) {
    network.ensure();
    let n = network.get();

    let transactions = {}; // Both complete and incomplete transactions.
    let cartsDb = (await db()).carts;
    let ordersDb = (await db()).orders;

    let carts = [];
    let orders = [];
    let cartDbKeys = (await cartsDb.keys());
    for (const txnId of cartDbKeys) {
        let cart = await cartsDb.get(txnId);
        transactions[txnId] = cart;
        carts.push(cart);
    }
    let orderDbKeys = (await ordersDb.keys());
    for (const txnId of orderDbKeys) {
        let order = await ordersDb.get(txnId);
        orders.push(order);
        transactions[txnId] = order;
    }

    let evtSource = undefined;
    return {
        close_cart: async function (transaction_id) {
            let cart = transactions[transaction_id];
            if (cart) {
                if (this.transaction(transaction_id).isPlaced()) {
                    await ordersDb.set(transaction_id, JSON.parse(JSON.stringify(cart)));
                    orders.push(cart);
                }
                await cartsDb.rm(transaction_id);
                let index = carts.findIndex((c) => c.search.request.context.transaction_id == transaction_id);
                carts.splice(index, 1);
            }
        },
        new_cart: async function () {
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
            await cartsDb.set(cart.search.request.context.transaction_id, cart);
            transactions[cart.search.request.context.transaction_id] = cart;
            carts.push(cart);
            return cart;
        },
        carts: async function (reset = false) {
            if (reset) {
                for (let cart of carts) {
                    await this.close_cart(cart.search.request.context.transaction_id);
                };
                carts = [];
            }
            return carts;
        },
        list: function () {
            return transactions;
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
                    return (txn.confirm.response && txn.confirm.response.message && txn.confirm.response.message.order) ||
                        (txn.confirm.request && txn.confirm.request.message && txn.confirm.request.message.order &&
                            !txn.confirm.request.bpp_uri);
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
                    evtSource.onmessage = async (event) => {
                        let response = JSON.parse(event.data);
                        if (!response || response.done) {
                            evtSource.close();
                            evtSource = undefined;
                            on_event(undefined);
                        } else if (response.message) {
                            let action = response.context.action.substring(3); // strip the on_...
                            await this.propagate_to_dependent_actions(action, response);
                            on_event(response);
                        }
                    };
                },
                async propagate_to_dependent_actions(action, response) {
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
                    await this.update();
                },
                update: async function () {
                    if (this.isPlaced()) {
                        await ordersDb.set(transaction_id, JSON.parse(JSON.stringify(txn)));
                    } else {
                        await cartsDb.set(transaction_id, JSON.parse(JSON.stringify(txn)));
                    }
                },
                call: async function (action, sync = false) {
                    let self = this;
                    let action_payload = self.payload(action);
                    action_payload.request.context.message_id =
                        crypto.randomUUID();
                    if (action == "search" || action_payload.request.context.bpp_uri) {
                        let response = await api()
                            .url(
                                `${network.search_provider().get().subscriber_url
                                }/${action}`
                            )
                            .parameters(action_payload.request)
                            .headers({
                                "X-CallBackToBeSynchronized": sync ? "Y" : "N",
                            })
                            .post();
                        if (sync && action != "search") {
                            action_payload.response = response[0];
                            await self.propagate_to_dependent_actions(action, response[0]);
                        }
                        if (action == "confirm") {
                            await network_transactions.close_cart(action_payload.request.context.transaction_id); // Reset Cart.
                        }
                        return response;
                    } else {
                        if (action == "confirm") {
                            await network_transactions.close_cart(action_payload.request.context.transaction_id); // Reset Cart.
                        } else {
                            throw new Error("Only confirm api can be called for non application bpps.");
                        }
                        return undefined;
                    }
                },
            };
        },
    };
}
export { transactions };
