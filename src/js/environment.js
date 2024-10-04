import * as Lockr from "lockr";
const environments = {
    production: {
        branch: "main",
        cdn_base:
            "https://raw.githubusercontent.com/IntentBrowser/bizlocal/",
    },
    staging: {
        branch: "staging",
        cdn_base:
            "https://raw.githubusercontent.com/IntentBrowser/bizlocal/",
    },
    dev: {
        branch: "",
        cdn_base: "./",
    },
};

function environment() {
    let current = Lockr.get("current");

    return {
        list: function () {
            return Object.keys(environments);
        },
        isSet() {
            return current && current.environment;
        },
        choose: function (name) {
            current ||= {};
            current.environment = environments[name];
            Lockr.set("current", current);
        },
        base_url: function () {
            if (!this.isSet()) {
                throw new Error("Environment not set");
            }
            let env = current.environment;
            return `${env.cdn_base}${env.branch}`;
        },
    };
}

export { environment };
