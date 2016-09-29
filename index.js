/* jshint node: true */
"use strict";
let path = require('path');
let uglify = require('uglify-js');
let DeployPluginBase = require('ember-cli-deploy-plugin');
let fs = require('fs');
let minimatch = require('minimatch');

module.exports = {
  name: 'ember-cli-deploy-appshell',

  included(app) {
    this.app = app;
  },

  contentFor(type, config) {
    if (type === 'head') {
      let loader = fs.readFileSync(require.resolve('loader.js'), 'utf8');
      let src = fs.readFileSync(path.join(__dirname, 'lib', 'bootloader.js'), 'utf8').replace(/MODULE_PREFIX/g, config.modulePrefix);
      let bootloader = uglify.minify(loader + src, { fromString: true, mangle:true, compress: true}).code;
      this.rootURL = config.rootURL;
      return `<script type="text/javascript">${ bootloader }</script>`;
    }
  },

  createDeployPlugin: function(options) {
    let rootURL = () => this.rootURL;
    let DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      didBuild: function(context) {
        let distDir = context.distDir;
        let files = context.distFiles;
        fs.writeFileSync(path.join(distDir, 'manifest.appcache'), this.renderManifest(files));
        let indexHTML = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
        fs.writeFileSync(path.join(distDir, 'appshell.html'), indexHTML);
        fs.writeFileSync(path.join(distDir, 'index.html'), indexHTML.replace(/<html>/i, `<html manifest=${rootURL()}manifest.appcache>`));
        context.distFiles.push('appshell.html');
      },
      renderManifest: function(paths) {
        let excludePattern = this.readConfig('excludePattern');
        let prefixDomains = this.readConfig('prefixDomains');
        let outputPaths = paths.filter(function(p){ return !minimatch(p, excludePattern); })
            .map(function(p) {
              let domain = Object.keys(prefixDomains).find(function(domain) {
                return minimatch(p, prefixDomains[domain]);
              });
              if (domain) {
                return domain + p;
              } else {
                return p;
              }
            });
        outputPaths = outputPaths.concat(this.readConfig('externalDependencies'));

        return `CACHE MANIFEST
# ${new Date()}
${ outputPaths.join("\n") }
NETWORK:
*`;
      }
    });
    return new DeployPlugin();
  }

};
