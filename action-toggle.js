/*\
title: $:/plugins/rimir/realms/action-toggle.js
type: application/javascript
module-type: widget

Action widget that toggles a realm's active state via PUT /api/realms
and updates the temp tiddler with the response.

Usage: <$action-realm-toggle realm="realmName"/>

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var ActionRealmToggle = function(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
};

ActionRealmToggle.prototype = new Widget();

ActionRealmToggle.prototype.render = function(parent, nextSibling) {
	this.computeAttributes();
	this.execute();
};

ActionRealmToggle.prototype.execute = function() {
	this.realmName = this.getAttribute("realm");
};

ActionRealmToggle.prototype.refresh = function(changedTiddlers) {
	return this.refreshSelf();
};

ActionRealmToggle.prototype.invokeAction = function(triggeringWidget, event) {
	var self = this;
	var realmName = this.realmName;
	if(!realmName) return true;

	// Read current state
	var tempTiddler = this.wiki.getTiddler("$:/temp/rimir/realms");
	var realms = {};
	if(tempTiddler) {
		try { realms = JSON.parse(tempTiddler.fields.text); } catch(e) {}
	}
	var currentActive = realms[realmName] ? realms[realmName].active : true;
	var newActive = !currentActive;

	// Send PUT request
	var xhr = new XMLHttpRequest();
	xhr.open("PUT", "/api/realms", true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.setRequestHeader("X-Requested-With", "TiddlyWiki");
	xhr.onreadystatechange = function() {
		if(xhr.readyState === 4 && xhr.status === 200) {
			self.wiki.addTiddler(new $tw.Tiddler({
				title: "$:/temp/rimir/realms",
				type: "application/json",
				text: xhr.responseText
			}));
			self.wiki.addTiddler(new $tw.Tiddler({
				title: "$:/temp/rimir/realms-changed",
				text: "yes"
			}));
		}
	};
	var body = {};
	body[realmName] = {active: newActive};
	xhr.send(JSON.stringify(body));
	return true;
};

exports["action-realm-toggle"] = ActionRealmToggle;
