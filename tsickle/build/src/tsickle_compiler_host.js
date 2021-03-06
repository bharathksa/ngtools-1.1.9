"use strict";
var path = require('path');
var source_map_1 = require('source-map');
var ts = require('typescript');
var decorator_annotator_1 = require('./decorator-annotator');
var es5processor_1 = require('./es5processor');
var modules_manifest_1 = require('./modules_manifest');
var tsickle_1 = require('./tsickle');
/**
 * Tsickle can perform 2 different precompilation transforms - decorator downleveling
 * and closurization.  Both require tsc to have already type checked their
 * input, so they can't both be run in one call to tsc. If you only want one of
 * the transforms, you can specify it in the constructor, if you want both, you'll
 * have to specify it by calling reconfigureForRun() with the appropriate Pass.
 */
(function (Pass) {
    Pass[Pass["NONE"] = 0] = "NONE";
    Pass[Pass["DECORATOR_DOWNLEVEL"] = 1] = "DECORATOR_DOWNLEVEL";
    Pass[Pass["CLOSURIZE"] = 2] = "CLOSURIZE";
})(exports.Pass || (exports.Pass = {}));
var Pass = exports.Pass;
var ANNOTATION_SUPPORT = "\ninterface DecoratorInvocation {\n  type: Function;\n  args?: any[];\n}\n";
/**
 * TsickleCompilerHost does tsickle processing of input files, including
 * closure type annotation processing, decorator downleveling and
 * require -> googmodule rewriting.
 */
var TsickleCompilerHost = (function () {
    function TsickleCompilerHost(delegate, tscOptions, options, environment, runConfiguration) {
        this.delegate = delegate;
        this.tscOptions = tscOptions;
        this.options = options;
        this.environment = environment;
        this.runConfiguration = runConfiguration;
        // The manifest of JS modules output by the compiler.
        this.modulesManifest = new modules_manifest_1.ModulesManifest();
        /** Error messages produced by tsickle, if any. */
        this.diagnostics = [];
        /** externs.js files produced by tsickle, if any. */
        this.externs = {};
        this.decoratorDownlevelSourceMaps = new Map();
        this.tsickleSourceMaps = new Map();
    }
    /**
     * Tsickle can perform 2 kinds of precompilation source transforms - decorator
     * downleveling and closurization.  They can't be run in the same run of the
     * typescript compiler, because they both depend on type information that comes
     * from running the compiler.  We need to use the same compiler host to run both
     * so we have all the source map data when finally write out.  Thus if we want
     * to run both transforms, we call reconfigureForRun() between the calls to
     * ts.createProgram().
     */
    TsickleCompilerHost.prototype.reconfigureForRun = function (oldProgram, pass) {
        this.runConfiguration = { oldProgram: oldProgram, pass: pass };
    };
    TsickleCompilerHost.prototype.getSourceFile = function (fileName, languageVersion, onError) {
        if (this.runConfiguration === undefined || this.runConfiguration.pass === Pass.NONE) {
            return this.delegate.getSourceFile(fileName, languageVersion, onError);
        }
        var sourceFile = this.runConfiguration.oldProgram.getSourceFile(fileName);
        switch (this.runConfiguration.pass) {
            case Pass.DECORATOR_DOWNLEVEL:
                return this.downlevelDecorators(sourceFile, this.runConfiguration.oldProgram, fileName, languageVersion);
            case Pass.CLOSURIZE:
                return this.closurize(sourceFile, this.runConfiguration.oldProgram, fileName, languageVersion);
            default:
                throw new Error('tried to use TsickleCompilerHost with unknown pass enum');
        }
    };
    TsickleCompilerHost.prototype.writeFile = function (fileName, content, writeByteOrderMark, onError, sourceFiles) {
        if (path.extname(fileName) !== '.map') {
            fileName = this.delegate.getCanonicalFileName(fileName);
            if (this.options.googmodule && !fileName.match(/\.d\.ts$/)) {
                content = this.convertCommonJsToGoogModule(fileName, content);
            }
        }
        else {
            content = this.combineSourceMaps(fileName, content);
        }
        this.delegate.writeFile(fileName, content, writeByteOrderMark, onError, sourceFiles);
    };
    TsickleCompilerHost.prototype.sourceMapConsumerToGenerator = function (sourceMapConsumer) {
        return source_map_1.SourceMapGenerator.fromSourceMap(sourceMapConsumer);
    };
    /**
     * Tsc identifies source files by their relative path to the output file.  Since
     * there's no easy way to identify these relative paths when tsickle generates its
     * own source maps, we patch them with the file name from the tsc source maps
     * before composing them.
     */
    TsickleCompilerHost.prototype.sourceMapGeneratorToConsumerWithFileName = function (sourceMapGenerator, fileName) {
        var rawSourceMap = sourceMapGenerator.toJSON();
        rawSourceMap.sources = [fileName];
        rawSourceMap.file = fileName;
        return new source_map_1.SourceMapConsumer(rawSourceMap);
    };
    TsickleCompilerHost.prototype.sourceMapTextToConsumer = function (sourceMapText) {
        var sourceMapJson = sourceMapText;
        return new source_map_1.SourceMapConsumer(sourceMapJson);
    };
    TsickleCompilerHost.prototype.getSourceMapKey = function (outputFilePath, sourceFileName) {
        var fileDir = path.dirname(outputFilePath);
        return this.getCanonicalFileName(path.resolve(fileDir, sourceFileName));
    };
    TsickleCompilerHost.prototype.combineSourceMaps = function (filePath, tscSourceMapText) {
        var tscSourceMapConsumer = this.sourceMapTextToConsumer(tscSourceMapText);
        var tscSourceMapGenerator = this.sourceMapConsumerToGenerator(tscSourceMapConsumer);
        if (this.tsickleSourceMaps.size > 0) {
            // TODO(lucassloan): remove when the .d.ts has the correct types
            for (var _i = 0, _a = tscSourceMapConsumer.sources; _i < _a.length; _i++) {
                var sourceFileName = _a[_i];
                var sourceMapKey = this.getSourceMapKey(filePath, sourceFileName);
                var tsickleSourceMapGenerator = this.tsickleSourceMaps.get(sourceMapKey);
                var tsickleSourceMapConsumer = this.sourceMapGeneratorToConsumerWithFileName(tsickleSourceMapGenerator, sourceFileName);
                tscSourceMapGenerator.applySourceMap(tsickleSourceMapConsumer);
            }
        }
        if (this.decoratorDownlevelSourceMaps.size > 0) {
            // TODO(lucassloan): remove when the .d.ts has the correct types
            for (var _b = 0, _c = tscSourceMapConsumer.sources; _b < _c.length; _b++) {
                var sourceFileName = _c[_b];
                var sourceMapKey = this.getSourceMapKey(filePath, sourceFileName);
                var decoratorDownlevelSourceMapGenerator = this.decoratorDownlevelSourceMaps.get(sourceMapKey);
                var decoratorDownlevelSourceMapConsumer = this.sourceMapGeneratorToConsumerWithFileName(decoratorDownlevelSourceMapGenerator, sourceFileName);
                tscSourceMapGenerator.applySourceMap(decoratorDownlevelSourceMapConsumer);
            }
        }
        return tscSourceMapGenerator.toString();
    };
    TsickleCompilerHost.prototype.convertCommonJsToGoogModule = function (fileName, content) {
        var moduleId = this.environment.fileNameToModuleId(fileName);
        var _a = es5processor_1.processES5(fileName, moduleId, content, this.environment.pathToModuleName.bind(this.environment), this.options.es5Mode, this.options.prelude), output = _a.output, referencedModules = _a.referencedModules;
        var moduleName = this.environment.pathToModuleName('', fileName);
        this.modulesManifest.addModule(fileName, moduleName);
        for (var _i = 0, referencedModules_1 = referencedModules; _i < referencedModules_1.length; _i++) {
            var referenced = referencedModules_1[_i];
            this.modulesManifest.addReferencedModule(fileName, referenced);
        }
        return output;
    };
    TsickleCompilerHost.prototype.downlevelDecorators = function (sourceFile, program, fileName, languageVersion) {
        this.decoratorDownlevelSourceMaps.set(this.getCanonicalFileName(sourceFile.path), new source_map_1.SourceMapGenerator());
        if (this.environment.shouldSkipTsickleProcessing(fileName))
            return sourceFile;
        var fileContent = sourceFile.text;
        var converted = decorator_annotator_1.convertDecorators(program.getTypeChecker(), sourceFile);
        if (converted.diagnostics) {
            (_a = this.diagnostics).push.apply(_a, converted.diagnostics);
        }
        if (converted.output === fileContent) {
            // No changes; reuse the existing parse.
            return sourceFile;
        }
        fileContent = converted.output + ANNOTATION_SUPPORT;
        this.decoratorDownlevelSourceMaps.set(this.getCanonicalFileName(sourceFile.path), converted.sourceMap);
        return ts.createSourceFile(fileName, fileContent, languageVersion, true);
        var _a;
    };
    TsickleCompilerHost.prototype.closurize = function (sourceFile, program, fileName, languageVersion) {
        this.tsickleSourceMaps.set(this.getCanonicalFileName(sourceFile.path), new source_map_1.SourceMapGenerator());
        var isDefinitions = /\.d\.ts$/.test(fileName);
        // Don't tsickle-process any d.ts that isn't a compilation target;
        // this means we don't process e.g. lib.d.ts.
        if (isDefinitions && this.environment.shouldSkipTsickleProcessing(fileName))
            return sourceFile;
        var _a = tsickle_1.annotate(program, sourceFile, this.options, this.delegate, this.tscOptions), output = _a.output, externs = _a.externs, diagnostics = _a.diagnostics, sourceMap = _a.sourceMap;
        if (externs) {
            this.externs[fileName] = externs;
        }
        if (this.environment.shouldIgnoreWarningsForPath(sourceFile.path)) {
            // All diagnostics (including warnings) are treated as errors.
            // If we've decided to ignore them, just discard them.
            // Warnings include stuff like "don't use @type in your jsdoc"; tsickle
            // warns and then fixes up the code to be Closure-compatible anyway.
            diagnostics = diagnostics.filter(function (d) { return d.category === ts.DiagnosticCategory.Error; });
        }
        this.diagnostics = diagnostics;
        this.tsickleSourceMaps.set(this.getCanonicalFileName(sourceFile.path), sourceMap);
        return ts.createSourceFile(fileName, output, languageVersion, true);
    };
    /** Concatenate all generated externs definitions together into a string. */
    TsickleCompilerHost.prototype.getGeneratedExterns = function () {
        var allExterns = '';
        for (var _i = 0, _a = Object.keys(this.externs); _i < _a.length; _i++) {
            var fileName = _a[_i];
            allExterns += "// externs from " + fileName + ":\n";
            allExterns += this.externs[fileName];
        }
        return allExterns;
    };
    // Delegate everything else to the original compiler host.
    TsickleCompilerHost.prototype.fileExists = function (fileName) {
        return this.delegate.fileExists(fileName);
    };
    TsickleCompilerHost.prototype.getCurrentDirectory = function () {
        return this.delegate.getCurrentDirectory();
    };
    ;
    TsickleCompilerHost.prototype.useCaseSensitiveFileNames = function () {
        return this.delegate.useCaseSensitiveFileNames();
    };
    TsickleCompilerHost.prototype.getNewLine = function () {
        return this.delegate.getNewLine();
    };
    TsickleCompilerHost.prototype.getDirectories = function (path) {
        return this.delegate.getDirectories(path);
    };
    TsickleCompilerHost.prototype.readFile = function (fileName) {
        return this.delegate.readFile(fileName);
    };
    TsickleCompilerHost.prototype.getDefaultLibFileName = function (options) {
        return this.delegate.getDefaultLibFileName(options);
    };
    TsickleCompilerHost.prototype.getCanonicalFileName = function (fileName) {
        return this.delegate.getCanonicalFileName(fileName);
    };
    return TsickleCompilerHost;
}());
exports.TsickleCompilerHost = TsickleCompilerHost;

//# sourceMappingURL=tsickle_compiler_host.js.map
