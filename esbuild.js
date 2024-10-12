import * as esbuild from 'esbuild';

await esbuild.serve(
  {
    servedir: 'public',              // Directory to serve files from (e.g., an HTML file)
    port: 8000,                      // Specify the port for the server
  },
  {
    entryPoints: ['./src/index.js'], // Entry point of your application
    bundle: true,                    // Bundle all dependencies
    outfile: './public/bundle.js',   // Output file for the bundle
    sourcemap: true,                 // Generate source maps for debugging
    format: 'esm',                   // Output format (ESM for modules)
    target: 'esnext',                // Target environment (e.g., 'esnext' for modern browsers)
    platform: 'browser',             // Platform: browser
  }
);

console.log("HELLO");




const ctx = await esbuild.context({
    entryPoints: ['./src/**/*.js'], // files
    bundle: false,          // Bundle all dependencies into a single file
    minify: false,          // Minify the output file
    sourcemap: true,        // Generate a source map for easier debugging
    outdir: './dist',       // Specify the output file path
    format: 'esm',          // Output format (ESM for modules)
    target: 'esnext',       // Target environment (e.g., 'esnext' for modern browsers)
    platform: 'browser',      // Platform: browser
    //loader: { '.js': 'jsx' }, // Specify loaders if needed, e.g., for JSX or TSX
    define: {
      'process.env.NODE_ENV': '"production"' // Replace environment variables
    },
    plugins: [],            // Add any plugins here if needed
});

await ctx.watch();

console.log('Build completed!');
