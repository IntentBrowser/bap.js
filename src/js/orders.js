import { openDB } from 'idb';

const dbPromise = openDB('transactions', 1, {
    upgrade(db) {
        db.createObjectStore('orders');
        db.createObjectStore('carts');
    },
});

async function db() {
    const db = await dbPromise;
    return {
        orders: {
            get: async function (key) {
                return await db.get('orders', key);
            },
            set: async function (key, val) {
                return await db.put('orders', val, key);
            },
            rm: async function (key) {
                return await db.delete('orders', key);
            },
            keys: async function () {
                return await db.getAllKeys('orders');
            },
            clear: async function () {
                return await db.clear('orders');
            }
        },
        carts: {
            get: async function (key) {
                return await db.get('carts', key);
            },
            set: async function (key, val) {
                return await db.put('carts', val, key);
            },
            rm: async function (key) {
                return await db.delete('carts', key);
            },
            keys: async function () {
                return await db.getAllKeys('carts');
            },
            clear: async function () {
                return await db.clear('carts');
            }
        },
    };
}

export { db };
