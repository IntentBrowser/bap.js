import { defineConfig } from "vite";

export default defineConfig({
    build: {
        minify: false,
        lib: {
            entry: "src/js/index.js",
            name: "bap",
            fileName: (format) => `bap.${format}.js`,
        },
        rollupOptions: {
            // Ensure external dependencies are not bundled into your library
            external: [],
            output: {
                globals: {},
            },
        },
    },
});
