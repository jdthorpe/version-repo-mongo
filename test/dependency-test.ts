//--------------------------------------------------
// General testing imports
//--------------------------------------------------
import { generate_version_resolution_tests, backend_test_instance } from "version-repo/test/version-resolution-test-fixture"
import { MemoryRepo, ReadonlyBuffer, dTransform } from "version-repo"
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();
import * as Promise from "bluebird"

//--------------------------------------------------
// repo specific imports
//--------------------------------------------------


import { spawn, ChildProcess} from "child_process"
var temp = require('temp').track();
import { MongoClient,  Collection, Db } from 'mongodb';
import { MongoRepo } from "../index";
import { 
//--     package_loc,
//--     sync_repository,
//--     deferred_repository,
    deferred_readable_repository,
    repository,
} from "version-repo/src/typings"



;
//--------------------------------------------------
// just making sure teh fixture works as expected
//--------------------------------------------------

generate_version_resolution_tests(build_hooks(
    "Unwrapped MongoRepo",
    "backend",
    (mongorepo ) => {
        return new dTransform(mongorepo, (x => x), (x => x))
    }
));


//--------------------------------------------------
// backends populated via the fronend
//--------------------------------------------------
(function(){

    const hooks = build_hooks( "MongoDB Repo with trivial transform", "repo")
    hooks.repo = hooks.backend;
    generate_version_resolution_tests(hooks);

})();

//--------------------------------------------------
// backends populated directly 
//--------------------------------------------------

generate_version_resolution_tests(build_hooks(
    "MongoDB Repo with trivial async-transform",
    "backend",
    (mongorepo ) => {
        return new dTransform(mongorepo, (x => x), (x => x))
    }
));

generate_version_resolution_tests(build_hooks(
    "MongoDB Repo with trivial async-transform and buffer", 
    "backend",
    (mongorepo ) => {
        return new ReadonlyBuffer(new dTransform(mongorepo, (x => x), (x => x)))
    }
));


    
function build_hooks(
    name: string, 
    hook_type: "backend"|"repo",
    build_frontend?: ((x:MongoRepo<any>)=> deferred_readable_repository<any>| repository<any>)): backend_test_instance {

    var __collection__: Collection;
    var __client__: MongoClient;
    var __db__: Db;
    var __proc__: ChildProcess ;
    var __repo__: MongoRepo<any> ;

    const hooks:backend_test_instance = { 
        name: name,
        repo: undefined,
        before:function(){

            return new Promise((resolve,reject)=>{

                // create a temporary directory and start a mongod instance in that directory
                var dir = temp.mkdirSync();
                __proc__ = spawn("mongod",["--dbpath",dir ,"--port","51423"])
                __proc__.on('exit', function (code, signal) {
                    console.log('Mongod process exited with ' + `code ${code} and signal ${signal}`); 
                });
                __proc__.stdout.on('data', (data) => { console.log(`mongod stdout:\n${data}`); });
                __proc__.stderr.on('data', (data) => { console.error(`mongod stderr:\n${data}`); });

                setTimeout(() => {

                    MongoClient.connect("mongodb://localhost:51423",(err, client) => {
                        if (err) throw err;

                        var __db__ = client.db("mydb");
                        __db__.createCollection("customers", function(err, collection) {
                            if (err) throw err;
                            __collection__ = collection;
                            __repo__ = new MongoRepo(__collection__);
                            hooks[hook_type] = __repo__;

                            if(build_frontend){
                                hooks.repo = build_frontend(__repo__);
                            }else{
                                hooks.repo = __repo__;
                            }
                            resolve();
                        });
                    })
                },500)
            }).timeout(2000,"Instantiation of MongoClient timed out.")
        },

        after:function(){
            if(__client__)
                __client__.close()
            if(__proc__)
                __proc__.kill('SIGINT');
        }
    }


    return hooks;
};



