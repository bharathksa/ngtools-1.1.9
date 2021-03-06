"use strict";
var fs = require('fs');
var path_1 = require('path');
var ts = require('typescript');
var refactor_1 = require('./refactor');
function _recursiveSymbolExportLookup(refactor, symbolName, host, program) {
    // Check this file.
    var hasSymbol = refactor.findAstNodes(null, ts.SyntaxKind.ClassDeclaration)
        .some(function (cd) {
        return cd.name && cd.name.text == symbolName;
    });
    if (hasSymbol) {
        return refactor.fileName;
    }
    // We found the bootstrap variable, now we just need to get where it's imported.
    var exports = refactor.findAstNodes(null, ts.SyntaxKind.ExportDeclaration)
        .map(function (node) { return node; });
    for (var _i = 0, exports_1 = exports; _i < exports_1.length; _i++) {
        var decl = exports_1[_i];
        if (!decl.moduleSpecifier || decl.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) {
            continue;
        }
        var modulePath = decl.moduleSpecifier.text;
        var resolvedModule = ts.resolveModuleName(modulePath, refactor.fileName, program.getCompilerOptions(), host);
        if (!resolvedModule.resolvedModule || !resolvedModule.resolvedModule.resolvedFileName) {
            return null;
        }
        var module_1 = resolvedModule.resolvedModule.resolvedFileName;
        if (!decl.exportClause) {
            var moduleRefactor = new refactor_1.TypeScriptFileRefactor(module_1, host, program);
            var maybeModule = _recursiveSymbolExportLookup(moduleRefactor, symbolName, host, program);
            if (maybeModule) {
                return maybeModule;
            }
            continue;
        }
        var binding = decl.exportClause;
        for (var _a = 0, _b = binding.elements; _a < _b.length; _a++) {
            var specifier = _b[_a];
            if (specifier.name.text == symbolName) {
                // If it's a directory, load its index and recursively lookup.
                if (fs.statSync(module_1).isDirectory()) {
                    var indexModule = path_1.join(module_1, 'index.ts');
                    if (fs.existsSync(indexModule)) {
                        var indexRefactor = new refactor_1.TypeScriptFileRefactor(indexModule, host, program);
                        var maybeModule = _recursiveSymbolExportLookup(indexRefactor, symbolName, host, program);
                        if (maybeModule) {
                            return maybeModule;
                        }
                    }
                }
                // Create the source and verify that the symbol is at least a class.
                var source = new refactor_1.TypeScriptFileRefactor(module_1, host, program);
                var hasSymbol_1 = source.findAstNodes(null, ts.SyntaxKind.ClassDeclaration)
                    .some(function (cd) {
                    return cd.name && cd.name.text == symbolName;
                });
                if (hasSymbol_1) {
                    return module_1;
                }
            }
        }
    }
    return null;
}
function _symbolImportLookup(refactor, symbolName, host, program) {
    // We found the bootstrap variable, now we just need to get where it's imported.
    var imports = refactor.findAstNodes(null, ts.SyntaxKind.ImportDeclaration)
        .map(function (node) { return node; });
    for (var _i = 0, imports_1 = imports; _i < imports_1.length; _i++) {
        var decl = imports_1[_i];
        if (!decl.importClause || !decl.moduleSpecifier) {
            continue;
        }
        if (decl.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) {
            continue;
        }
        var resolvedModule = ts.resolveModuleName(decl.moduleSpecifier.text, refactor.fileName, program.getCompilerOptions(), host);
        if (!resolvedModule.resolvedModule || !resolvedModule.resolvedModule.resolvedFileName) {
            return null;
        }
        var module_2 = resolvedModule.resolvedModule.resolvedFileName;
        if (decl.importClause.namedBindings.kind == ts.SyntaxKind.NamespaceImport) {
            var binding = decl.importClause.namedBindings;
            if (binding.name.text == symbolName) {
                // This is a default export.
                return module_2;
            }
        }
        else if (decl.importClause.namedBindings.kind == ts.SyntaxKind.NamedImports) {
            var binding = decl.importClause.namedBindings;
            for (var _a = 0, _b = binding.elements; _a < _b.length; _a++) {
                var specifier = _b[_a];
                if (specifier.name.text == symbolName) {
                    // Create the source and recursively lookup the import.
                    var source = new refactor_1.TypeScriptFileRefactor(module_2, host, program);
                    var maybeModule = _recursiveSymbolExportLookup(source, symbolName, host, program);
                    if (maybeModule) {
                        return maybeModule;
                    }
                }
            }
        }
    }
    return null;
}
function resolveEntryModuleFromMain(mainPath, host, program) {
    var source = new refactor_1.TypeScriptFileRefactor(mainPath, host, program);
    var bootstrap = source.findAstNodes(source.sourceFile, ts.SyntaxKind.CallExpression, false)
        .map(function (node) { return node; })
        .filter(function (call) {
        var access = call.expression;
        return access.kind == ts.SyntaxKind.PropertyAccessExpression
            && access.name.kind == ts.SyntaxKind.Identifier
            && (access.name.text == 'bootstrapModule'
                || access.name.text == 'bootstrapModuleFactory');
    })
        .map(function (node) { return node.arguments[0]; })
        .filter(function (node) { return node.kind == ts.SyntaxKind.Identifier; });
    if (bootstrap.length != 1) {
        throw new Error('Tried to find bootstrap code, but could not. Specify either '
            + 'statically analyzable bootstrap code or pass in an entryModule '
            + 'to the plugins options.');
    }
    var bootstrapSymbolName = bootstrap[0].text;
    var module = _symbolImportLookup(source, bootstrapSymbolName, host, program);
    if (module) {
        return module.replace(/\.ts$/, '') + "#" + bootstrapSymbolName;
    }
    // shrug... something bad happened and we couldn't find the import statement.
    throw new Error('Tried to find bootstrap code, but could not. Specify either '
        + 'statically analyzable bootstrap code or pass in an entryModule '
        + 'to the plugins options.');
}
exports.resolveEntryModuleFromMain = resolveEntryModuleFromMain;
//# sourceMappingURL=/Users/hansl/Sources/angular-cli/packages/webpack/src/entry_resolver.js.map