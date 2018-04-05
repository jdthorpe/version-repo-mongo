// GENERAL TESTING IMPORTS
import { generate_tests, test_instance } from "version-repo/test/general-repo-test-fixture"
import chai = require('chai');
const should = chai.should(),
      expect = chai.expect;
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
import * as Promise from "bluebird"


// REPO SPECIFIC IMPORTS
var temp = require('temp').track();
import { MongoClient,  Collection, Db } from 'mongodb';
import { repository } from   "version-repo/src/typings";
import { dTransform } from   "version-repo";
import { spawn, ChildProcess} from "child_process"
import { MongoRepo } from "../index";


var __collection__: Collection;
var __client__: MongoClient;
var __db__: Db;
var __proc__: ChildProcess ;
var __repo__: MongoRepo<any> ;

generate_tests(build_hooks( "Mongo Repo",))
generate_tests(build_hooks( "Mongo Repo with trivial asynt wrapper",
                                (x:MongoRepo<any>) => new dTransform(x,(x)=>x,(x)=>x)  ))

function build_hooks(
    name: string, 
    wrapper?: ((x:MongoRepo<any>)=>  repository<any>)): test_instance {

    var __collection__: Collection;
    var __client__: MongoClient;
    var __db__: Db;
    var __proc__: ChildProcess ;
    var __repo__: MongoRepo<any> ;

    const hooks:test_instance = { 
        name: name,
        repo: undefined,
        before:() => {

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
                            if(wrapper){
                                hooks.repo = wrapper(__repo__);
                            }else{
                                hooks.repo = __repo__;
                            }

                            resolve();
                        });
                    })
                },500)
            }).timeout(1950,"Instantiation of MongoClient timed out.")
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




