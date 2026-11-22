const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.js',
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? false : 'inline-source-map',
    devServer: {
      static: path.join(__dirname, 'dist'),
      compress: true,
      port: process.env.CLIENT_PORT || 9000,
      host: process.env.CLIENT_HOST || '0.0.0.0',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'out.bundle.js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.(png|svg|jpg|gif|mp3)$/,
          type: 'asset/resource',
        },
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({template: './src/index.html'}),
      new Dotenv({
        expand: true,
        systemvars: true,
        defaults: true, // load .env.defaults
      })
    ]
  };
};
