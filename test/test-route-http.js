/*\
title: $:/plugins/rimir/realms/test/test-route-http.js
type: application/javascript
tags: [[$:/tags/test-spec]]

HTTP-level tests for realms' /api/realms GET and PUT routes.
Uses the http-test-helper that's only present in the tw-tests umbrella.

\*/

"use strict";

var helperAvailable = !!$tw.wiki.getTiddler("$:/test-helpers/http-server");

if(!helperAvailable) {
    describe("realms: /api/realms (HTTP)", function() {
        it("requires the tw-tests umbrella suite (http-test-helper)", function() {
            pending("Run under tw-tests umbrella");
        });
    });
} else {

describe("realms: /api/realms (HTTP)", function() {
    var http = require("$:/test-helpers/http-server");
    var fs = require("fs");
    var path = require("path");
    var ctx;
    var realmsPath;
    var hadFileBefore;
    var savedRealms;

    var FIXTURE = {
        "demo": {"filter": "[tag[Demo]]", "active": true},
        "private": {"filter": "[prefix[private/]]", "active": false}
    };

    function writeFixture() {
        fs.writeFileSync(realmsPath, JSON.stringify(FIXTURE, null, 4) + "\n", "utf8");
    }

    beforeAll(function(done) {
        realmsPath = path.resolve($tw.boot.wikiPath, "realms.json");
        // Snapshot the existing realms.json (if any) so we can restore after the suite.
        try {
            savedRealms = fs.readFileSync(realmsPath, "utf8");
            hadFileBefore = true;
        } catch(e) {
            hadFileBefore = false;
        }
        http.start({wiki: $tw.wiki}).then(function(c) { ctx = c; done(); });
    });

    // Reset the fixture before every spec — Jasmine randomises order, and PUT
    // specs mutate the file, so without this the GET assertions are flaky.
    beforeEach(function() { writeFixture(); });

    afterAll(function(done) {
        // Restore: put back the prior content, or remove the file we created.
        try {
            if(hadFileBefore) {
                fs.writeFileSync(realmsPath, savedRealms, "utf8");
            } else {
                fs.unlinkSync(realmsPath);
            }
        } catch(_) { /* best effort */ }
        ctx.stop().then(done);
    });

    describe("GET /api/realms", function() {

        it("returns the current realms.json content as JSON", function(done) {
            http.request(ctx, "/api/realms").then(function(res) {
                expect(res.status).toBe(200);
                expect(res.headers["content-type"]).toMatch(/application\/json/);
                expect(res.headers["access-control-allow-origin"]).toBe("*");
                var body = res.json();
                expect(body.demo).toBeTruthy();
                expect(body.demo.active).toBe(true);
                expect(body.private.active).toBe(false);
                done();
            }).catch(done.fail);
        });

        it("returns 500 when realms.json is missing", function(done) {
            // Temporarily move the file aside, hit the route, restore.
            var bak = realmsPath + ".bak-test";
            fs.renameSync(realmsPath, bak);
            http.request(ctx, "/api/realms").then(function(res) {
                fs.renameSync(bak, realmsPath);
                expect(res.status).toBe(500);
                var body = res.json();
                expect(body && body.error).toMatch(/realms\.json/);
                done();
            }).catch(function(err) {
                try { fs.renameSync(bak, realmsPath); } catch(_) {}
                done.fail(err);
            });
        });

    });

    describe("PUT /api/realms", function() {

        function put(body, headers) {
            var h = {"X-Requested-With": "TiddlyWiki"};
            for(var k in (headers || {})) { h[k] = headers[k]; }
            return http.request(ctx, "/api/realms", {
                method: "PUT",
                headers: h,
                body: body
            });
        }

        it("merges {active} updates for existing realms and returns the merged set", function(done) {
            put({demo: {active: false}}).then(function(res) {
                expect(res.status).toBe(200);
                var body = res.json();
                expect(body.demo.active).toBe(false);
                // private was not in the update — unchanged
                expect(body.private.active).toBe(false);
                // Filter is preserved across the merge — only `active` is touched
                expect(body.demo.filter).toBe("[tag[Demo]]");
                done();
            }).catch(done.fail);
        });

        it("accepts string forms 'true' / 'false' for active", function(done) {
            put({demo: {active: "true"}}).then(function(res) {
                expect(res.status).toBe(200);
                expect(res.json().demo.active).toBe(true);
                done();
            }).catch(done.fail);
        });

        it("ignores unknown realm names instead of creating them", function(done) {
            put({nonexistent: {active: true}}).then(function(res) {
                expect(res.status).toBe(200);
                var body = res.json();
                expect(body.nonexistent).toBeUndefined();
                done();
            }).catch(done.fail);
        });

        it("ignores realm bodies that aren't plain objects", function(done) {
            // `null`, scalars, arrays — all silently skipped, route still 200s.
            put({demo: null}).then(function(res) {
                expect(res.status).toBe(200);
                // demo.active untouched from previous tests' final state
                expect(typeof res.json().demo.active).toBe("boolean");
                done();
            }).catch(done.fail);
        });

        it("rejects an invalid JSON body with 400", function(done) {
            http.request(ctx, "/api/realms", {
                method: "PUT",
                headers: {"X-Requested-With": "TiddlyWiki", "Content-Type": "application/json"},
                body: "{not-json"
            }).then(function(res) {
                expect(res.status).toBe(400);
                expect((res.json() || {}).error).toMatch(/Invalid JSON/);
                done();
            }).catch(done.fail);
        });

    });

});

}
