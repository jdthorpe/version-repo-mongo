
import {ConfigOptions, 
    deferred_repository,
    package_loc,
    resource_data,
    fetch_opts,
    bare_deferred_readable_repository} from "version-repo/src/typings"

import {calculate_dependencies, isPackageLoc, validate_options} from "version-repo"
import semver = require('semver');
import { Collection } from 'mongodb';
import * as Promise from "bluebird";

interface resource {
    name:string;
    version:string;
    value:any;
    depends?:{[i:string]:string};
}

interface resource_doc<T> extends resource_data<T> {
    $currentDate?:any;
}

export class MongoRepo<T> implements deferred_repository<T> {


    constructor(public coll:Collection<resource>,private config:ConfigOptions = {}){
        // this is required for consistency during updates
        coll.createIndex({name:1,timestamp:1})
    }


    // ------------------------------
    // CRUD
    // ------------------------------
    create(options:resource_data<T>):Promise<boolean>{

        //console.log('**************************** received :  '+pkg)
        //console.log('**************************** at :  ',options)


        var loc:package_loc;
        try{ 
            loc = validate_options(options);
        }catch(e){ 
            return Promise.reject(e) 
        }



       return this.latest_version(options.name) 
                .catch(err => undefined)
                .then( (latest_version:string) => {

                    //console.log("latest_version: ", latest_version)
                    if(latest_version){
                        if(options.upsert){
                            if(latest_version && semver.gt(latest_version, loc.version)){
                                var err = new Error(`Version (${loc.version}) preceeds the latest version (${latest_version})`)
                                return Promise.reject(err)
                            }
                        }else{
                            if(latest_version && semver.gte(latest_version, loc.version)){
                                var err = new Error(`Version (${loc.version}) does not exceed the latest version (${latest_version})`)
                                return Promise.reject(err)
                            }
                        }
                    }

                    const doc: resource_doc<T> = {
                        name: options.name,
                        version: loc.version,
                        value:options.value,
                        //$currentDate: { lastModified: true, },
                    };

                    if(options.depends)
                        doc.depends = options.depends

                    // insert and check that there wasn't a later version inserted previously; if so, roll back the upsert and fail
                    return Promise.fromCallback((cb) => { this.coll.insertOne(doc, cb) }).then(x => true);
                })

/*
       
       return this.latest_version(options.name) 
*/
    }

    fetchOne(options:package_loc,opts?:fetch_opts):Promise<resource_data<T>>{

        var versionPromise: Promise<string>;
        if(options.version){
            versionPromise = this.versions(options.name)
                .then((versions:string[]) => {
                    //console.log('versions: '+JSON.stringify(versions))
                    var version =  semver.maxSatisfying(versions,options.version);
                    if(!version){
                        throw new Error("No such version: " +options.version);
                    }
                    return version;
                })
        }else{
            versionPromise =  this.latest_version(options.name)
        }

        return  versionPromise.then( (version: string) => {
            var _optsions:any = {_id:0};
            if(!!opts && opts.novalue){
                _optsions.value = 0
            }

            return new Promise( (resolve,reject) => {
                this.coll.findOne({name:options.name, version:version}, 
                    _optsions,
                    (err,doc)=>{
                        if(err)
                            reject(err)
                        resolve(doc)
                    })
            })
        })

    }


    fetch(query:package_loc|package_loc[],opts?:fetch_opts):Promise<resource_data<T>[]>{
       
        if(Array.isArray(query)){
            const names = query.map(x => x.name);
            return this.depends(query)
                    .then(pkgs => 
                            Promise.all(pkgs
                                        .filter(x => (opts && opts.dependencies) || names.indexOf(x.name) != -1)
                                        .map(pkg => this.fetchOne(pkg,opts)))
                    )

        }else if(opts && opts.dependencies){
            return this.depends([query])
                    .then(pkgs => Promise.all(pkgs.map(x => this.fetchOne(x,opts))));
        }else{
            return this.fetchOne(query,opts).then(x => [x]);
        }
        
    }




    update(options:resource_data<T>):Promise<boolean>{

        if(this.config.update == "none"){
            return Promise.reject( new Error("updates are disableed in this repository"));
        }

        // VALIDATE THE NAME AND VERSION
        var loc:package_loc;
        try{ 
            loc = validate_options(options);
        }catch(e){ 
            return Promise.reject(e) 
        }

        // VERIFY THE VERSION IS deleteable
        var out:Promise<boolean>;
        if(this.config.update === undefined || this.config.update == "latest"){
            out = this.latest_version(loc.name)
                    .then((latest_version:string )=>{
                        if(semver.neq(latest_version, loc.version))
                            throw new Error("Only the most recent version of a package may be updated");
                        return true;
                    })
        }else{ 
            out = Promise.resolve(true);
        }

        return out.then(x => {
            return new Promise( (resolve,reject) => {

                const doc: resource_doc<T> = {
                    name: options.name,
                    version: loc.version,
                    value:options.value,
                    //$currentDate: { lastModified: true, },
                };

                if(options.depends)
                    doc.depends = options.depends

                this.coll.findOneAndUpdate(loc,doc,
                    function(err){
                        if(err) 
                            reject(new Error('No such pacakge or version'));
                        else
                            resolve(true);
                    });
            })
        })
     }

    del(options:package_loc):Promise<boolean>{

        if(this.config.update == "none"){
            return Promise.reject( new Error("updates are disableed in this repository"));
        }

        // VALIDATE THE NAME AND VERSION
        var loc:package_loc;
        try{ 
            loc = validate_options(options);
        }catch(e){ 
            return Promise.reject(e) 
        }

        // VERIFY THE VERSION IS deleteable
        var out:Promise<boolean>;
        if(this.config.update === undefined || this.config.update == "latest"){
            out = this.latest_version(loc.name)
                    .then((latest_version:string )=>{
                        if(semver.neq(latest_version, loc.version))
                            throw new Error("Only the most recent version of a package may be updated");
                        return true;
                    })
        }else{ 
            out = Promise.resolve(true);
        }

        return out.then(x => {
            return new Promise( (resolve,reject) => {
                this.coll.findOneAndDelete(loc,
                    function(err){
                        if(err) 
                            reject(new Error('No such pacakge or version'));
                        else
                            resolve(true);
                    });
            })
        })
    }

    depends(x:package_loc[]):Promise<package_loc[]>;
    depends(x:package_loc):Promise<package_loc[]>;
    depends(x:{[key: string]:string}):Promise<package_loc[]>;
    depends(x:package_loc|package_loc[]|{[key: string]:string}){

        var bare_repo:bare_deferred_readable_repository = {
            fetchOne: (request:package_loc,opts:fetch_opts) => this.fetchOne(request,{novalue:true}),
            versions: (name:string) => this.versions(name)
        }

        if(Array.isArray(x)){
            return calculate_dependencies(x,bare_repo);
        }if(isPackageLoc(x)){
            return calculate_dependencies([x],bare_repo);
        }else{
            var y:package_loc[] =  
                Object.keys(x) 
                        .filter(y => x.hasOwnProperty(y))
                        .map(y => { return {name:y,version:x[y]} })
            return calculate_dependencies(y,bare_repo);
        }
 
    }
    // ------------------------------
    // utilities
    // ------------------------------

    latest_version(name:string,filter?:string){
        if(typeof name !== 'string')
            throw new Error("Missing or invalid name parameter")
        return this.versions(name)
            .then(function(versions){
                return semver.maxSatisfying(versions,
                        filter?filter:'>=0.0.0');
            });
    }

    // return a list of available packages
    packages ():Promise<string[]>{

        return new Promise((resolve, reject) => {
            this.coll.aggregate([ { $group : { _id : "$name" } } ],(err,docs) => {
                if (err)
                    return reject(err);
                return resolve(docs.map((x:any) => x._id));
            });
        });

    }

    // return a list of available versions for a packages
    versions():Promise<{[x:string]:string[]}>;
    versions(name:string):Promise<string[]>;
    versions(name:string[]):Promise<string[]>;
    versions(pkg?:string|string[]):Promise<{[x:string]:string[]} | string[]>{ 
        if(typeof pkg === 'undefined'){

            return new Promise((resolve, reject)  => {

                this.coll.aggregate(
                    [
                        {$group:{_id:"$name",versions:{$push:"$version"}}} 
                    ],(err,docs) => {
                    if (err)
                        return reject(err);
                    const out:{[x:string]:string[]} = {};

                    docs.map((x:any) => {out[x._id] = x.versions});
                    return resolve(out);
                });
            });

        }else if((typeof pkg) === "string"){ // pkg is a single package name


            return new Promise((resolve, reject)  => {
                this.coll.aggregate(
                    [
                        {$match:{name:pkg}},
                        {$group:{_id:"$name",versions:{$push:"$version"}}} 
                    ],
                    (err,docs) => {
                        if (err)
                            return reject(err);
                        if (!docs.length){
                            reject(new Error('No such package: ' + pkg));
                            return
                        }
                        var x:any = docs[0]
                        return resolve(x.versions);
                    });
            });

        }else { // pkg is an array of package names

            return new Promise((resolve, reject)  => {
                this.coll.aggregate(
                    [
                        {$match:{name:{$in:pkg}}} ,
                        {$group:{_id:"$name",versions:{$push:"$version"}}} ,
                    ],
                    (err,docs:any[]) => {
                        if (err)
                            return reject(err);
                        // construct the return value 
                        const out:{[x:string]:string[]} = {};
                        docs.map((x:any) => {out[x._id] = x.versions});

                        // verify that all the packages existed...
                        const missing_packages:string[] = [];
                        for(let i =0;i <pkg.length; i++){
                            if(docs.indexOf(pkg[i]))
                                missing_packages.push(pkg[i])
                        }
                        if(missing_packages.length)
                            reject(new Error("No such package(s): " + JSON.stringify(missing_packages)))

                        return resolve(out);
                    });
            });

        }
    }

}

// for testing
//--             this.coll.insertMany([
//--                 {name:'a',version:"1.0.0"},
//--                 {name:'a',version:"1.1.0"},
//--                 {name:'a',version:"1.1.3"},
//--                 {name:'B',version:"1.0.0"},
//--                 {name:'B',version:"1.1.0"},
//--                 {name:'B',version:"1.1.3"},
//--             ])


