/*\
title: $:/plugins/rimir/realms/route-api-get.js
type: application/javascript
module-type: route

GET /api/realms — returns the current realm configuration.

\*/

"use strict";

var fs = require("fs");
var path = require("path");

exports.method = "GET";
exports.path = /^\/api\/realms$/;

exports.handler = function(request, response, state) {
	var realmsPath = path.resolve($tw.boot.wikiPath, "realms.json");
	try {
		var data = fs.readFileSync(realmsPath, "utf8");
		response.writeHead(200, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		});
		response.end(data);
	} catch(e) {
		response.writeHead(500, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		});
		response.end(JSON.stringify({error: "Failed to read realms.json: " + e.message}));
	}
};
