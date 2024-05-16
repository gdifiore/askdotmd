const path = require('path');

module.exports = {
    entry: './src/extension.ts', // main file of your extension
    target: 'node', // extensions run in a Node.js-context
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2', // extensions should use CommonJS
    },
    devtool: 'source-map', // generate source maps
    externals: {
        vscode: 'commonjs vscode', // vscode-api has to be excluded from the bundle
    },
    resolve: {
        extensions: ['.ts', '.js'], // recognize .ts files
    },
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [{
                loader: 'ts-loader',
            }],
        }],
    },
};