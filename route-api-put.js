/*\
title: $:/plugins/rimir/realms/route-api-put.js
type: application/javascript
module-type: route

PUT /api/realms — merges updates into realms.json.

Body: JSON object like {"private": {"active": false}}
Only the "active" field is merged per realm; unknown realms are ignored.

\*/

"use strict";

var fs = require("fs");
var path = require("path");

exports.method = "PUT";
exports.path = /^\/api\/realms$/;
exports.bodyFormat = "string";

exports.handler = function(request, response, state) {
	var realmsPath = path.resolve($tw.boot.wikiPath, "realms.json");
	var body;
	try {
		body = JSON.parse(state.data);
	} catch(e) {
		response.writeHead(400, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		});
		response.end(JSON.stringify({error: "Invalid JSON body"}));
		return;
	}
	try {
		var realms = JSON.parse(fs.readFileSync(realmsPath, "utf8"));
		// Merge updates — only touch existing realms, only update "active"
		var keys = Object.keys(body);
		for(var i = 0; i < keys.length; i++) {
			var realmName = keys[i];
			if(realms[realmName] && body[realmName] !== null && typeof body[realmName] === "object") {
				var active = body[realmName].active;
				if(typeof active === "boolean") {
					realms[realmName].active = active;
				} else if(active === "true" || active === "false") {
					realms[realmName].active = (active === "true");
				}
			}
		}
		fs.writeFileSync(realmsPath, JSON.stringify(realms, null, 4) + "\n", "utf8");
		response.writeHead(200, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		});
		response.end(JSON.stringify(realms));
	} catch(e) {
		response.writeHead(500, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		});
		response.end(JSON.stringify({error: "Failed to update realms.json: " + e.message}));
	}
};
