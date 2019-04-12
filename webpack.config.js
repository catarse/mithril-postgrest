const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
    entry: './src/postgrest.js',
    mode: !isProd && 'development',
    module: {
        rules: [
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
        ]
    },
    devServer: {
        contentBase: './dist'
    },
    devtool: isProd ? false : 'source-map',
    output: {
        filename: isProd ? 'mithril-postgrest.min.js' : 'mithril-postgrest.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'umd',
    },
    plugins: !isProd ? [] : [new UglifyJsPlugin()],
};
