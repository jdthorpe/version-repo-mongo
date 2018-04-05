"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var general_repo_test_fixture_1 = require("version-repo/test/general-repo-test-fixture");
var child_process_1 = require("child_process");
var chai = require("chai");
var temp = require("temp");
var mongodb_1 = require("mongodb");
var should = chai.should(), expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var index_1 = require("../index");
var __collection__;
var __client__;
var __db__;
var __proc__;
var __repo__;
var jig = {
    name: "Mongo Repo General Testing",
    before: function (done) {
        var dir = temp.mkdirSync();
        console.log("spawning!");
        __proc__ = child_process_1.spawn("mongod", ["--dbpath", dir, "--port", "51423"]);
        __proc__.on('exit', function (code, signal) {
            console.log('Mongod process exited with ' + ("code " + code + " and signal " + signal));
        });
        __proc__.stdout.on('data', function (data) { console.log("mongod stdout:\n" + data); });
        __proc__.stderr.on('data', function (data) { console.error("mongod stderr:\n" + data); });
        console.log("spawned!");
        setTimeout(function () {
            mongodb_1.MongoClient.connect("mongodb://localhost:51423", function (err, client) {
                console.log("client??!");
                if (err)
                    throw err;
                console.log("client??!");
                var __db__ = client.db("mydb");
                __db__.createCollection("customers", function (err, collection) {
                    if (err)
                        throw err;
                    console.log("Collection created!");
                    console.log("Collection created!");
                    console.log("Collection created!");
                    __collection__ = collection;
                    __repo__ = new index_1.MongoRepo(__collection__);
                    jig.repo = __repo__;
                    done();
                });
            });
        }, 500);
    },
    after: function () {
        if (__client__)
            __client__.close();
        if (__proc__)
            __proc__.kill('SIGINT');
    }
};
general_repo_test_fixture_1.generate_tests(jig);
//# sourceMappingURL=general-testing.js.map