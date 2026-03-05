/*\
title: $:/plugins/rimir/realms/startup.js
type: application/javascript
module-type: startup

Server-side startup module that hooks into the TiddlyWiki server to filter
tiddlers by realm. Replaces the skinny-list and fat-tiddler routes to subtract
tiddlers from active (ticked) realms.

\*/

"use strict";

exports.name = "realms-startup";
exports.after = ["load-modules"];
exports.before = ["commands"];
exports.platforms = ["node"];
exports.synchronous = true;

exports.startup = function() {
	var fs = require("fs"),
		path = require("path");

	var logger = new $tw.utils.Logger("realms", {colour: "cyan"});
	var realmsPath = path.resolve($tw.boot.wikiPath, "realms.json");

	// Read realms config from disk (called per-request for live updates)
	function readRealms() {
		try {
			return JSON.parse(fs.readFileSync(realmsPath, "utf8"));
		} catch(e) {
			logger.log("Error reading realms.json:", e.message);
			return {};
		}
	}

	// Build a set of tiddler titles to exclude (active/ticked realms are subtracted)
	function getExcludedTitles() {
		var realms = readRealms();
		var excluded = Object.create(null);
		$tw.utils.each(Object.keys(realms), function(realmName) {
			var realm = realms[realmName];
			if(realm.active === true && realm.filter) {
				var titles = $tw.wiki.filterTiddlers(realm.filter);
				for(var i = 0; i < titles.length; i++) {
					excluded[titles[i]] = true;
				}
			}
		});
		return excluded;
	}

	// Expose on $tw for use by other modules
	$tw.realms = {
		getExcludedTitles: getExcludedTitles,
		readRealms: readRealms
	};

	// Hook into server post-start to replace routes
	$tw.hooks.addHook("th-server-command-post-start", function(server, nodeServer) {
		logger.log("Hooking into server routes for realm filtering");

		// Find and replace routes by matching path regex source
		var routes = server.routes;
		for(var i = 0; i < routes.length; i++) {
			var route = routes[i];
			if(route.method === "GET" && route.path.test("/recipes/default/tiddlers.json")) {
				routes[i] = {
					method: "GET",
					path: route.path,
					handler: createFilteredSkinnyHandler()
				};
				logger.log("Replaced skinny-list route (get-tiddlers-json)");
			} else if(route.method === "GET" && route.path.test("/recipes/default/tiddlers/SomeTitle")) {
				routes[i] = {
					method: "GET",
					path: route.path,
					handler: createFilteredFatHandler()
				};
				logger.log("Replaced fat-tiddler route (get-tiddler)");
			}
		}

		return server;
	});

	// Replacement for GET /recipes/default/tiddlers.json
	function createFilteredSkinnyHandler() {
		var DEFAULT_FILTER = "[all[tiddlers]!is[system]sort[title]]";
		return function(request, response, state) {
			var filter = state.queryParameters.filter || DEFAULT_FILTER;
			if(state.wiki.getTiddlerText("$:/config/Server/AllowAllExternalFilters") !== "yes") {
				if(state.wiki.getTiddlerText("$:/config/Server/ExternalFilters/" + filter) !== "yes") {
					console.log("Blocked attempt to GET /recipes/default/tiddlers.json with filter: " + filter);
					response.writeHead(403);
					response.end();
					return;
				}
			}
			if(state.wiki.getTiddlerText("$:/config/SyncSystemTiddlersFromServer") === "no") {
				filter += "+[!is[system]]";
			}
			var excludeFields = (state.queryParameters.exclude || "text").split(","),
				titles = state.wiki.filterTiddlers(filter);
			// --- Realm filtering (subtract: active realms are hidden) ---
			var excluded = getExcludedTitles();
			var tiddlers = [];
			$tw.utils.each(titles, function(title) {
				if(excluded[title]) {
					return; // skip tiddlers in active (ticked) realms
				}
				var tiddler = state.wiki.getTiddler(title);
				if(tiddler) {
					var tiddlerFields = tiddler.getFieldStrings({exclude: excludeFields});
					tiddlerFields.revision = state.wiki.getChangeCount(title);
					tiddlerFields.type = tiddlerFields.type || "text/vnd.tiddlywiki";
					tiddlers.push(tiddlerFields);
				}
			});
			var text = JSON.stringify(tiddlers);
			state.sendResponse(200, {"Content-Type": "application/json"}, text, "utf8");
		};
	}

	// Replacement for GET /recipes/default/tiddlers/:title
	function createFilteredFatHandler() {
		var knownFields = [
			"bag", "created", "creator", "modified", "modifier", "permissions", "recipe", "revision", "tags", "text", "title", "type", "uri"
		];
		return function(request, response, state) {
			var title = $tw.utils.decodeURIComponentSafe(state.params[0]);
			// --- Realm filtering (subtract: active realms are hidden) ---
			var excluded = getExcludedTitles();
			if(excluded[title]) {
				response.writeHead(404);
				response.end();
				return;
			}
			var tiddler = state.wiki.getTiddler(title),
				tiddlerFields = {};
			if(tiddler) {
				$tw.utils.each(tiddler.fields, function(field, name) {
					var value = tiddler.getFieldString(name);
					if(knownFields.indexOf(name) !== -1) {
						tiddlerFields[name] = value;
					} else {
						tiddlerFields.fields = tiddlerFields.fields || {};
						tiddlerFields.fields[name] = value;
					}
				});
				tiddlerFields.revision = state.wiki.getChangeCount(title);
				tiddlerFields.bag = "default";
				tiddlerFields.type = tiddlerFields.type || "text/vnd.tiddlywiki";
				state.sendResponse(200, {"Content-Type": "application/json"}, JSON.stringify(tiddlerFields), "utf8");
			} else {
				response.writeHead(404);
				response.end();
			}
		};
	}

	logger.log("Realms plugin initialized, config:", realmsPath);
};
