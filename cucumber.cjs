// Config de Cucumber.js. Los .feature y sus step definitions viven en features/
// (propiedad de SPECs/Gherkin del equipo). Este archivo solo cablea el runner.
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step-definitions/**/*.ts', 'features/support/**/*.ts'],
    requireModule: ['tsx/cjs'],
    format: ['progress-bar'],
    publishQuiet: true,
    tags: 'not @wip',
  },
};
