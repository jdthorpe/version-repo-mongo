
import { repository } from   "version-repo/src/typings";
import { generate_tests } from "version-repo/test/general-repo-test-fixture"

import { spawn, ChildProcess} from "child_process"

import chai = require('chai');
import temp = require('temp');
import { MongoClient,  Collection, Db } from 'mongodb';
const should = chai.should(),
      expect = chai.expect;
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

import { MongoRepo } from "../index";
import * as Promise from "bluebird"


var __collection__: Collection;
var __client__: MongoClient;
var __db__: Db;
var __proc__: ChildProcess ;
var __repo__: repository<any> ;

const jig:any = { 
    name:"Mongo Repo General Testing",

    before:function(done){

        var dir = temp.mkdirSync();
        console.log("spawning!");
        __proc__ = spawn("mongod",["--dbpath",dir ,"--port","51423"])

        __proc__.on('exit', function (code, signal) {
            console.log('Mongod process exited with ' + `code ${code} and signal ${signal}`); 
        });
        __proc__.stdout.on('data', (data) => { console.log(`mongod stdout:\n${data}`); });
        __proc__.stderr.on('data', (data) => { console.error(`mongod stderr:\n${data}`); });
        console.log("spawned!");
        setTimeout(() => {

            MongoClient.connect("mongodb://localhost:51423",(err, client) => {
                console.log("client??!");
                if (err) throw err;

                console.log("client??!");
                var __db__ = client.db("mydb");
                __db__.createCollection("customers", function(err, collection) {
                    if (err) throw err;
                    console.log("Collection created!");
                    console.log("Collection created!");
                    console.log("Collection created!");
                    __collection__ = collection;
                    __repo__ = new MongoRepo(__collection__);
                    jig.repo = __repo__;
                    done()
                });
            })
        },500)
    },

    after:function(){
        if(__client__)
            __client__.close()
        if(__proc__)
            __proc__.kill('SIGINT');
    }
}

generate_tests(jig)



