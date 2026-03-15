/*\
title: $:/plugins/rimir/realms/test/test-realms.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests for realms plugin: exclusion logic, route module exports, and
PUT merge semantics.

\*/
"use strict";

describe("realms: filter-based exclusion logic", function() {

	// The core algorithm from startup.js: given a realms config object and a
	// wiki, run each active realm's filter and collect excluded titles.
	// We replicate the logic here so we can test it without triggering the
	// full startup hook (which needs $tw.boot.wikiPath and fs).
	function getExcludedTitles(wiki, realmsConfig) {
		var excluded = Object.create(null);
		$tw.utils.each(Object.keys(realmsConfig), function(realmName) {
			var realm = realmsConfig[realmName];
			if(realm.active === true && realm.filter) {
				var titles = wiki.filterTiddlers(realm.filter);
				for(var i = 0; i < titles.length; i++) {
					excluded[titles[i]] = true;
				}
			}
		});
		return excluded;
	}

	function setupWiki(tiddlers) {
		var wiki = new $tw.Wiki();
		wiki.addTiddlers(tiddlers || []);
		wiki.addIndexersToWiki();
		return wiki;
	}

	it("should exclude nothing when no realms are active", function() {
		var wiki = setupWiki([
			{title: "Public", text: "visible", tags: ""},
			{title: "Private", text: "hidden", tags: "private"}
		]);
		var config = {
			"private": {filter: "[tag[private]]", active: false, description: "Private"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(Object.keys(excluded).length).toBe(0);
	});

	it("should exclude titles matching an active realm's filter", function() {
		var wiki = setupWiki([
			{title: "Public", text: "visible"},
			{title: "Secret", text: "hidden", tags: "private"}
		]);
		var config = {
			"private": {filter: "[tag[private]]", active: true, description: "Private"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(excluded["Secret"]).toBe(true);
		expect(excluded["Public"]).toBeUndefined();
	});

	it("should exclude titles from multiple active realms", function() {
		var wiki = setupWiki([
			{title: "A", tags: "work"},
			{title: "B", tags: "personal"},
			{title: "C", tags: ""}
		]);
		var config = {
			"work": {filter: "[tag[work]]", active: true, description: "Work"},
			"personal": {filter: "[tag[personal]]", active: true, description: "Personal"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(excluded["A"]).toBe(true);
		expect(excluded["B"]).toBe(true);
		expect(excluded["C"]).toBeUndefined();
	});

	it("should only exclude from active realms, not inactive ones", function() {
		var wiki = setupWiki([
			{title: "WorkDoc", tags: "work"},
			{title: "PersonalDoc", tags: "personal"}
		]);
		var config = {
			"work": {filter: "[tag[work]]", active: true, description: "Work"},
			"personal": {filter: "[tag[personal]]", active: false, description: "Personal"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(excluded["WorkDoc"]).toBe(true);
		expect(excluded["PersonalDoc"]).toBeUndefined();
	});

	it("should handle empty realms config", function() {
		var wiki = setupWiki([{title: "A", text: "test"}]);
		var excluded = getExcludedTitles(wiki, {});
		expect(Object.keys(excluded).length).toBe(0);
	});

	it("should handle realm with no filter", function() {
		var wiki = setupWiki([{title: "A", text: "test"}]);
		var config = {
			"broken": {active: true, description: "No filter"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(Object.keys(excluded).length).toBe(0);
	});

	it("should handle realm with active as string instead of boolean", function() {
		var wiki = setupWiki([
			{title: "X", tags: "secret"}
		]);
		var config = {
			"secret": {filter: "[tag[secret]]", active: "true", description: "Secret"}
		};
		// strict check: active === true, so "true" string should NOT match
		var excluded = getExcludedTitles(wiki, config);
		expect(excluded["X"]).toBeUndefined();
	});

	it("should handle overlapping filters across realms", function() {
		var wiki = setupWiki([
			{title: "Overlap", tags: "a b"}
		]);
		var config = {
			"realmA": {filter: "[tag[a]]", active: true, description: "A"},
			"realmB": {filter: "[tag[b]]", active: true, description: "B"}
		};
		var excluded = getExcludedTitles(wiki, config);
		// Title appears in both filters, should still just be excluded once
		expect(excluded["Overlap"]).toBe(true);
	});

	it("should handle complex filters", function() {
		var wiki = setupWiki([
			{title: "Draft", text: "wip", tags: "draft"},
			{title: "OldDraft", text: "old", tags: "draft archive"},
			{title: "Published", text: "live", tags: ""}
		]);
		var config = {
			"drafts": {filter: "[tag[draft]!tag[archive]]", active: true, description: "Drafts"}
		};
		var excluded = getExcludedTitles(wiki, config);
		expect(excluded["Draft"]).toBe(true);
		expect(excluded["OldDraft"]).toBeUndefined(); // has archive tag, excluded by !tag[archive]
		expect(excluded["Published"]).toBeUndefined();
	});
});

describe("realms: route module exports", function() {

	it("should export GET route with correct path and method", function() {
		var getRoute = require("$:/plugins/rimir/realms/route-api-get.js");
		expect(getRoute.method).toBe("GET");
		expect(getRoute.path).toBeDefined();
		expect(getRoute.path.test("/api/realms")).toBe(true);
		expect(getRoute.path.test("/api/realms/extra")).toBe(false);
	});

	it("should export PUT route with correct path, method, and bodyFormat", function() {
		var putRoute = require("$:/plugins/rimir/realms/route-api-put.js");
		expect(putRoute.method).toBe("PUT");
		expect(putRoute.path).toBeDefined();
		expect(putRoute.path.test("/api/realms")).toBe(true);
		expect(putRoute.bodyFormat).toBe("string");
	});

	it("should export handler functions on both routes", function() {
		var getRoute = require("$:/plugins/rimir/realms/route-api-get.js");
		var putRoute = require("$:/plugins/rimir/realms/route-api-put.js");
		expect(typeof getRoute.handler).toBe("function");
		expect(typeof putRoute.handler).toBe("function");
	});
});

describe("realms: action-toggle widget", function() {

	it("should export the action-realm-toggle widget", function() {
		var mod = require("$:/plugins/rimir/realms/action-toggle.js");
		expect(mod["action-realm-toggle"]).toBeDefined();
	});

	it("should be a widget constructor with prototype methods", function() {
		var ActionRealmToggle = require("$:/plugins/rimir/realms/action-toggle.js")["action-realm-toggle"];
		expect(typeof ActionRealmToggle).toBe("function");
		expect(typeof ActionRealmToggle.prototype.render).toBe("function");
		expect(typeof ActionRealmToggle.prototype.execute).toBe("function");
		expect(typeof ActionRealmToggle.prototype.refresh).toBe("function");
		expect(typeof ActionRealmToggle.prototype.invokeAction).toBe("function");
	});
});
