"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var version_repo_1 = require("version-repo");
var semver = require("semver");
var Promise = require("bluebird");
var MongoRepo = /** @class */ (function () {
    function MongoRepo(coll, config) {
        if (config === void 0) { config = {}; }
        this.coll = coll;
        this.config = config;
        // this is required for consistency during updates
        coll.createIndex({ name: 1, timestamp: 1 });
    }
    // ------------------------------
    // CRUD
    // ------------------------------
    MongoRepo.prototype.create = function (options) {
        //console.log('**************************** received :  '+pkg)
        //console.log('**************************** at :  ',options)
        var _this = this;
        var loc;
        try {
            loc = version_repo_1.validate_options(options);
        }
        catch (e) {
            return Promise.reject(e);
        }
        return this.latest_version(options.name)
            .catch(function (err) { return undefined; })
            .then(function (latest_version) {
            //console.log("latest_version: ", latest_version)
            if (latest_version) {
                if (options.upsert) {
                    if (latest_version && semver.gt(latest_version, loc.version)) {
                        var err = new Error("Version (" + loc.version + ") preceeds the latest version (" + latest_version + ")");
                        return Promise.reject(err);
                    }
                }
                else {
                    if (latest_version && semver.gte(latest_version, loc.version)) {
                        var err = new Error("Version (" + loc.version + ") does not exceed the latest version (" + latest_version + ")");
                        return Promise.reject(err);
                    }
                }
            }
            var doc = {
                name: options.name,
                version: loc.version,
                value: options.value,
            };
            if (options.depends)
                doc.depends = options.depends;
            // insert and check that there wasn't a later version inserted previously; if so, roll back the upsert and fail
            return Promise.fromCallback(function (cb) { _this.coll.insertOne(doc, cb); }).then(function (x) { return true; });
        });
        /*
               
               return this.latest_version(options.name)
        */
    };
    MongoRepo.prototype.fetchOne = function (options, opts) {
        var _this = this;
        var versionPromise;
        if (options.version) {
            versionPromise = this.versions(options.name)
                .then(function (versions) {
                //console.log('versions: '+JSON.stringify(versions))
                var version = semver.maxSatisfying(versions, options.version);
                if (!version) {
                    throw new Error("No such version: " + options.version);
                }
                return version;
            });
        }
        else {
            versionPromise = this.latest_version(options.name);
        }
        return versionPromise.then(function (version) {
            var _optsions = { _id: 0 };
            if (!!opts && opts.novalue) {
                _optsions.value = 0;
            }
            return new Promise(function (resolve, reject) {
                _this.coll.findOne({ name: options.name, version: version }, _optsions, function (err, doc) {
                    if (err)
                        reject(err);
                    resolve(doc);
                });
            });
        });
    };
    MongoRepo.prototype.fetch = function (query, opts) {
        var _this = this;
        if (Array.isArray(query)) {
            var names_1 = query.map(function (x) { return x.name; });
            return this.depends(query)
                .then(function (pkgs) {
                return Promise.all(pkgs
                    .filter(function (x) { return (opts && opts.dependencies) || names_1.indexOf(x.name) != -1; })
                    .map(function (pkg) { return _this.fetchOne(pkg, opts); }));
            });
        }
        else if (opts && opts.dependencies) {
            return this.depends([query])
                .then(function (pkgs) { return Promise.all(pkgs.map(function (x) { return _this.fetchOne(x, opts); })); });
        }
        else {
            return this.fetchOne(query, opts).then(function (x) { return [x]; });
        }
    };
    MongoRepo.prototype.update = function (options) {
        var _this = this;
        if (this.config.update == "none") {
            return Promise.reject(new Error("updates are disableed in this repository"));
        }
        // VALIDATE THE NAME AND VERSION
        var loc;
        try {
            loc = version_repo_1.validate_options(options);
        }
        catch (e) {
            return Promise.reject(e);
        }
        // VERIFY THE VERSION IS deleteable
        var out;
        if (this.config.update === undefined || this.config.update == "latest") {
            out = this.latest_version(loc.name)
                .then(function (latest_version) {
                if (semver.neq(latest_version, loc.version))
                    throw new Error("Only the most recent version of a package may be updated");
                return true;
            });
        }
        else {
            out = Promise.resolve(true);
        }
        return out.then(function (x) {
            return new Promise(function (resolve, reject) {
                var doc = {
                    name: options.name,
                    version: loc.version,
                    value: options.value,
                };
                if (options.depends)
                    doc.depends = options.depends;
                _this.coll.findOneAndUpdate(loc, doc, function (err) {
                    if (err)
                        reject(new Error('No such pacakge or version'));
                    else
                        resolve(true);
                });
            });
        });
    };
    MongoRepo.prototype.del = function (options) {
        var _this = this;
        if (this.config.update == "none") {
            return Promise.reject(new Error("updates are disableed in this repository"));
        }
        // VALIDATE THE NAME AND VERSION
        var loc;
        try {
            loc = version_repo_1.validate_options(options);
        }
        catch (e) {
            return Promise.reject(e);
        }
        // VERIFY THE VERSION IS deleteable
        var out;
        if (this.config.update === undefined || this.config.update == "latest") {
            out = this.latest_version(loc.name)
                .then(function (latest_version) {
                if (semver.neq(latest_version, loc.version))
                    throw new Error("Only the most recent version of a package may be updated");
                return true;
            });
        }
        else {
            out = Promise.resolve(true);
        }
        return out.then(function (x) {
            return new Promise(function (resolve, reject) {
                _this.coll.findOneAndDelete(loc, function (err) {
                    if (err)
                        reject(new Error('No such pacakge or version'));
                    else
                        resolve(true);
                });
            });
        });
    };
    MongoRepo.prototype.depends = function (x) {
        var _this = this;
        var bare_repo = {
            fetchOne: function (request, opts) { return _this.fetchOne(request, { novalue: true }); },
            versions: function (name) { return _this.versions(name); }
        };
        if (Array.isArray(x)) {
            return version_repo_1.calculate_dependencies(x, bare_repo);
        }
        if (version_repo_1.isPackageLoc(x)) {
            return version_repo_1.calculate_dependencies([x], bare_repo);
        }
        else {
            var y = Object.keys(x)
                .filter(function (y) { return x.hasOwnProperty(y); })
                .map(function (y) { return { name: y, version: x[y] }; });
            return version_repo_1.calculate_dependencies(y, bare_repo);
        }
    };
    // ------------------------------
    // utilities
    // ------------------------------
    MongoRepo.prototype.latest_version = function (name, filter) {
        if (typeof name !== 'string')
            throw new Error("Missing or invalid name parameter");
        return this.versions(name)
            .then(function (versions) {
            return semver.maxSatisfying(versions, filter ? filter : '>=0.0.0');
        });
    };
    // return a list of available packages
    MongoRepo.prototype.packages = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.coll.aggregate([{ $group: { _id: "$name" } }], function (err, docs) {
                if (err)
                    return reject(err);
                return resolve(docs.map(function (x) { return x._id; }));
            });
        });
    };
    MongoRepo.prototype.versions = function (pkg) {
        var _this = this;
        if (typeof pkg === 'undefined') {
            return new Promise(function (resolve, reject) {
                _this.coll.aggregate([
                    { $group: { _id: "$name", versions: { $push: "$version" } } }
                ], function (err, docs) {
                    if (err)
                        return reject(err);
                    var out = {};
                    docs.map(function (x) { out[x._id] = x.versions; });
                    return resolve(out);
                });
            });
        }
        else if ((typeof pkg) === "string") { // pkg is a single package name
            return new Promise(function (resolve, reject) {
                _this.coll.aggregate([
                    { $match: { name: pkg } },
                    { $group: { _id: "$name", versions: { $push: "$version" } } }
                ], function (err, docs) {
                    if (err)
                        return reject(err);
                    if (!docs.length) {
                        reject(new Error('No such package: ' + pkg));
                        return;
                    }
                    var x = docs[0];
                    return resolve(x.versions);
                });
            });
        }
        else { // pkg is an array of package names
            return new Promise(function (resolve, reject) {
                _this.coll.aggregate([
                    { $match: { name: { $in: pkg } } },
                    { $group: { _id: "$name", versions: { $push: "$version" } } },
                ], function (err, docs) {
                    if (err)
                        return reject(err);
                    // construct the return value 
                    var out = {};
                    docs.map(function (x) { out[x._id] = x.versions; });
                    // verify that all the packages existed...
                    var missing_packages = [];
                    for (var i = 0; i < pkg.length; i++) {
                        if (docs.indexOf(pkg[i]))
                            missing_packages.push(pkg[i]);
                    }
                    if (missing_packages.length)
                        reject(new Error("No such package(s): " + JSON.stringify(missing_packages)));
                    return resolve(out);
                });
            });
        }
    };
    return MongoRepo;
}());
exports.MongoRepo = MongoRepo;
// for testing
//--             this.coll.insertMany([
//--                 {name:'a',version:"1.0.0"},
//--                 {name:'a',version:"1.1.0"},
//--                 {name:'a',version:"1.1.3"},
//--                 {name:'B',version:"1.0.0"},
//--                 {name:'B',version:"1.1.0"},
//--                 {name:'B',version:"1.1.3"},
//--             ])
//# sourceMappingURL=mongo_repo.js.map