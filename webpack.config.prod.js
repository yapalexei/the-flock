const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'out.bundle.js'
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
        use: [
          'file-loader',
        ],
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({template: './src/index.html'}),
    new Dotenv({
      path: './process.env',
      expand: true,
      systemvars: true,
      defaults: true, // load .env.defaults
    })
  ]
}