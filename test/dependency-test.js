"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//--------------------------------------------------
// General testing imports
//--------------------------------------------------
var version_resolution_test_fixture_1 = require("version-repo/test/version-resolution-test-fixture");
var version_repo_1 = require("version-repo");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();
var Promise = require("bluebird");
//--------------------------------------------------
// repo specific imports
//--------------------------------------------------
var child_process_1 = require("child_process");
var temp = require('temp').track();
var mongodb_1 = require("mongodb");
var index_1 = require("../index");
//--------------------------------------------------
// just making sure teh fixture works as expected
//--------------------------------------------------
version_resolution_test_fixture_1.generate_version_resolution_tests(build_hooks("Unwrapped MongoRepo", "backend", function (mongorepo) {
    return new version_repo_1.dTransform(mongorepo, (function (x) { return x; }), (function (x) { return x; }));
}));
//--------------------------------------------------
// backends populated via the fronend
//--------------------------------------------------
(function () {
    var hooks = build_hooks("MongoDB Repo with trivial transform", "repo");
    hooks.repo = hooks.backend;
    version_resolution_test_fixture_1.generate_version_resolution_tests(hooks);
})();
//--------------------------------------------------
// backends populated directly 
//--------------------------------------------------
version_resolution_test_fixture_1.generate_version_resolution_tests(build_hooks("MongoDB Repo with trivial async-transform", "backend", function (mongorepo) {
    return new version_repo_1.dTransform(mongorepo, (function (x) { return x; }), (function (x) { return x; }));
}));
version_resolution_test_fixture_1.generate_version_resolution_tests(build_hooks("MongoDB Repo with trivial async-transform and buffer", "backend", function (mongorepo) {
    return new version_repo_1.ReadonlyBuffer(new version_repo_1.dTransform(mongorepo, (function (x) { return x; }), (function (x) { return x; })));
}));
function build_hooks(name, hook_type, build_frontend) {
    var __collection__;
    var __client__;
    var __db__;
    var __proc__;
    var __repo__;
    var hooks = {
        name: name,
        repo: undefined,
        before: function () {
            return new Promise(function (resolve, reject) {
                // create a temporary directory and start a mongod instance in that directory
                var dir = temp.mkdirSync();
                __proc__ = child_process_1.spawn("mongod", ["--dbpath", dir, "--port", "51423"]);
                __proc__.on('exit', function (code, signal) {
                    console.log('Mongod process exited with ' + ("code " + code + " and signal " + signal));
                });
                __proc__.stdout.on('data', function (data) { console.log("mongod stdout:\n" + data); });
                __proc__.stderr.on('data', function (data) { console.error("mongod stderr:\n" + data); });
                setTimeout(function () {
                    mongodb_1.MongoClient.connect("mongodb://localhost:51423", function (err, client) {
                        if (err)
                            throw err;
                        var __db__ = client.db("mydb");
                        __db__.createCollection("customers", function (err, collection) {
                            if (err)
                                throw err;
                            __collection__ = collection;
                            __repo__ = new index_1.MongoRepo(__collection__);
                            hooks[hook_type] = __repo__;
                            if (build_frontend) {
                                hooks.repo = build_frontend(__repo__);
                            }
                            else {
                                hooks.repo = __repo__;
                            }
                            resolve();
                        });
                    });
                }, 500);
            }).timeout(2000, "Instantiation of MongoClient timed out.");
        },
        after: function () {
            if (__client__)
                __client__.close();
            if (__proc__)
                __proc__.kill('SIGINT');
        }
    };
    return hooks;
}
;
//# sourceMappingURL=dependency-test.js.map