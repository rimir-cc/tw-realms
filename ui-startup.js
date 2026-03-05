/*\
title: $:/plugins/rimir/realms/ui-startup.js
type: application/javascript
module-type: startup

Browser-side startup: fetches realm state from the server and stores it
in a temp tiddler for the settings UI to read.

\*/

"use strict";

exports.name = "realms-ui-startup";
exports.after = ["render"];
exports.platforms = ["browser"];
exports.synchronous = false;

exports.startup = function(callback) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/api/realms", true);
	xhr.onreadystatechange = function() {
		if(xhr.readyState === 4) {
			if(xhr.status === 200) {
				$tw.wiki.addTiddler(new $tw.Tiddler({
					title: "$:/temp/rimir/realms",
					type: "application/json",
					text: xhr.responseText
				}));
			}
			callback();
		}
	};
	xhr.send();
};
