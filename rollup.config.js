import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/postgrest.js',
  dest: 'mithril-postgrest.js',
  plugins: [ babel() ],
  format: 'umd',
  moduleName: 'postgrest'
};
