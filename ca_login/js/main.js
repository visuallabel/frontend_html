/**
 * Copyright 2015 Tampere University of Technology, Pori Department
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var DEBUG = true;
var googleAuth = new GoogleAuth();
var facebookAuth = new FacebookAuth();

function debug(obj) {
	if (DEBUG) {
		console.log((new Date()).toLocaleString()+" DEBUG: " + obj);
	}
}
function debugXML(xml) {
	if(DEBUG) {
		console.log("DEBUG: " + (new XMLSerializer()).serializeToString(xml));
	}
}

function onBodyLoad(){
	googleAuth.init(document.getElementById("container"));
	facebookAuth.init(document.getElementById("container"));
}
