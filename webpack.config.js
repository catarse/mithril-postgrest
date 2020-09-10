const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
    entry: './src/postgrest.ts',
    mode: !isProd && 'development',
    module: {
        rules: [
            { test: /\.[tj]s$/, exclude: /node_modules/, loader: "babel-loader" }
        ]
    },
    devServer: {
        contentBase: './dist'
    },
    devtool: isProd ? false : 'source-map',
    output: {
        filename: isProd ? 'mithril-postgrest.min.js' : 'mithril-postgrest.umd.js',
        path: isProd ? path.resolve(__dirname, 'dist') : path.resolve(__dirname),
        libraryTarget: 'umd',
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    plugins: !isProd ? [] : [new UglifyJsPlugin()],
    externals: (isProd ? {
        mithril: 'mithril',
        'mithril/stream': 'mithril/stream'
    } : {})
};
