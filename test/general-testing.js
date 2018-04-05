"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// GENERAL TESTING IMPORTS
var general_repo_test_fixture_1 = require("version-repo/test/general-repo-test-fixture");
var chai = require("chai");
var should = chai.should(), expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var Promise = require("bluebird");
// REPO SPECIFIC IMPORTS
var temp = require('temp').track();
var mongodb_1 = require("mongodb");
var version_repo_1 = require("version-repo");
var child_process_1 = require("child_process");
var index_1 = require("../index");
var __collection__;
var __client__;
var __db__;
var __proc__;
var __repo__;
general_repo_test_fixture_1.generate_tests(build_hooks("Mongo Repo"));
general_repo_test_fixture_1.generate_tests(build_hooks("Mongo Repo with trivial asynt wrapper", function (x) { return new version_repo_1.dTransform(x, function (x) { return x; }, function (x) { return x; }); }));
function build_hooks(name, wrapper) {
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
                            if (wrapper) {
                                hooks.repo = wrapper(__repo__);
                            }
                            else {
                                hooks.repo = __repo__;
                            }
                            resolve();
                        });
                    });
                }, 500);
            }).timeout(1950, "Instantiation of MongoClient timed out.");
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
//# sourceMappingURL=general-testing.js.map