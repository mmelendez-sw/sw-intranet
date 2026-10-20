const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

/**
 * Emits version.json ({ buildId, builtAt }) so open tabs can detect a newer deploy
 * (src/utils/versionCheck.ts polls it with cache: 'no-store').
 */
class BuildVersionPlugin {
  constructor(buildId) {
    this.buildId = buildId;
  }
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BuildVersionPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'BuildVersionPlugin', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          const json = JSON.stringify({ buildId: this.buildId, builtAt: new Date().toISOString() });
          compilation.emitAsset('version.json', new webpack.sources.RawSource(json));
        }
      );
    });
  }
}

module.exports = (_env, argv = {}) => {
  const isProduction = argv.mode === 'production';
  // One id per build: baked into the bundle and written to version.json.
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      // Content hashes let index.html (max-age=0, must-revalidate) pull fresh bundles after a
      // deploy; HtmlWebpackPlugin injects the hashed <script>. Dev keeps stable names for HMR.
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      publicPath: '/',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          // Production: real .css files the browser can cache and paint without waiting for JS.
          // Dev keeps style-loader for HMR.
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|ico)$/i,
          type: 'asset/resource',
          generator: {
            filename: isProduction ? 'assets/[name].[contenthash][ext]' : 'assets/[name][ext]',
          },
        },
        {
          test: /\.webmanifest$/,
          type: 'asset/resource',
          generator: {
            filename: '[name][ext]',
          },
        },
      ],
    },
    optimization: {
      // Vendor code (react, msal, router) changes far less often than app code, so it gets
      // its own content-hashed chunk that stays cached across most deploys. React.lazy routes
      // in src/App.tsx become their own chunks automatically.
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            // Only packages needed at startup: lazily imported ones (the Tiptap editor)
            // stay in their own async chunks instead of being merged into this one.
            chunks: 'initial',
            priority: -10,
          },
        },
      },
      runtimeChunk: 'single',
    },
    plugins: [
      new webpack.DefinePlugin({
        __BUILD_ID__: JSON.stringify(buildId),
      }),
      new BuildVersionPlugin(buildId),
      ...(isProduction
        ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })]
        : []),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        favicon: './public/favicon.ico',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'public',
            to: '',
            globOptions: {
              ignore: ['**/index.html', '**/favicon.ico', '**/version.json'],
            },
          },
        ],
      }),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      port: 3000,
      open: true,
      hot: true,
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      // Array form is more reliable on webpack-dev-server v4 than object-key paths.
      proxy: [
        {
          context: [
            '/api/tv-cards',
            '/api/images',
            '/api/salesforce',
            '/api/powerbi',
            '/api/iceman',
          ],
          target: 'http://localhost:3001',
          changeOrigin: true,
          onError: (err, _req, res) => {
            console.warn('[webpack] /api proxy error (is tv-api running?):', err.message);
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Intranet API unavailable. Run npm run tv-api.' }));
            }
          },
        },
      ],
    },
    mode: 'development',
  };
};
