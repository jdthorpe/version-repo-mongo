An extention to the [version-repo](https://www.npmjs.com/package/version-repo)
package with a backend provided by MongoDB.

See [version-repo](https://www.npmjs.com/package/version-repo) for the general version-repo API.

<!-- =============================================== -->
# Repositories Classes
<!-- =============================================== -->

### MongoRepo *(API: Asynchronous, Stored Types: Any)*

A synchronous repository which keeps resources in memory.

##### Constructor parameters

- collection:  A MongoDB Collection object.
- config?:  {
		update: "latest" (default) | "any" | "none";
		delete: "latest" (default) | "any" | "none";
	}

Example: 

```javascript
var MongoClient = require("mongodb").MongoClient;
var MongoRepo = require("version-repo-node").MongoRepo;

MongoClient.connect(
	"mongodb://localhost:27017",
	(err, client) => {
		if (err) 
			throw err;

		var DBO = client.db("mydb");

		DBO.createCollection(
			"customers", 
			function(err, collection) {

				if (err) 
					throw err;

				my_repo = new MongoRepo(collection);
			});
	});
```

