import babel from 'rollup-plugin-babel';

export default {
  input: 'src/postgrest.js',
  output: {
    file: 'mithril-postgrest.umd.js',
    format: 'umd'
  },
  plugins: [ babel() ],
  name: 'Postgrest',
  external: ['mithril', 'underscore'],
  globals: {
    mithril: 'm',
    underscore: '_'
  }
};
