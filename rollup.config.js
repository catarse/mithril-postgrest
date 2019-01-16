import babel from 'rollup-plugin-babel';

export default {
  input: 'src/postgrest.js',
  output: {
    file: 'mithril-postgrest.umd.js',
    format: 'umd'
  },
  plugins: [ babel() ],
  name: 'Postgrest',
  external: ['mithril', 'underscore', 'mithril/stream'],
  globals: {
    mithril: 'm',
    'mithril/stream': 'prop',
    underscore: '_'
  }
};
