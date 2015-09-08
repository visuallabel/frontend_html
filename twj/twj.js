/**
Copyright (c) 2014 Tampere University of Technology (TUT)		

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

"use strict";

var DEBUG = true;

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

var serviceTags = "/CAFrontEnd/rest/tj/";
var methodGetTags = "getTags";
var methodSetRank = "setRank";
var methodSynchronizeTw = "summarize";

var serviceTwitter = "/CAFrontEnd/rest/twitter/";
var methodAuthorize = "authorize";

var bubbleNodes = null;
var tagsElement = null;
var popup_authorize_service = null;
var refreshTimer = null;
var retryCount = 0;

var facebookAuth = new FacebookAuth();

function onBodyLoad(){
	facebookAuth.init(document.getElementById("login-form"));
	
	facebookAuth.callBackOnLogin = loggedIn;
	facebookAuth.callBackOnRegister = userRegistered;
	facebookAuth.callBackOnError = errorHandler;
	
	tagsElement = document.getElementById('tags-svg');
	var proceed = checkParameters();
	
	if((localStorage.invokeSync || localStorage.authorize) && proceed){
		loggedIn();
	}
}

function checkParameters(){
	var error = getUrlParameter('error');
	if(error == null){
		delete localStorage.error;
	}else{
		localStorage.error = error;
	}
	
	var authorize = getUrlParameter('authorize');
	if(authorize === "true"){
		localStorage.invokeSync = true;
		localStorage.authorize = true;
		location.replace(location.pathname);	//this call is not synchronous thus we need to hack with return false and stuff like that
		return false;
	}
	
	var synchronize = getUrlParameter('synchronize');
	if(synchronize === "true"){
		localStorage.invokeSync = true;
		delete localStorage.authorize;
		location.replace(location.pathname);	//this call is not synchronous thus we need to hack with return false and stuff like that
		return false;
	}
	return true;
}

/**
 * Callback function for user logged in state
 */
function loggedIn(){
	if(localStorage.authorize && localStorage.error === undefined){
		authorizeAccount();
	}else if(localStorage.error){
		window.alert("Authorization to use Facebook account was not given: " + localStorage.error);
		userRegistered();
		location.replace(location.pathname);
		return;
	}else if(localStorage.invokeSync){
		syncAccount();
	}else{
		getTagCloud();
	}
	document.getElementById('login-div').className = "hidden";
	document.getElementById('tags-div').className = "";
}

/**
 * Callback function for error handler
 * @param statusCode
 * @param statusString
 * @param statusMessage
 */
function errorHandler(statusCode, statusString, statusMessage){
	if(statusCode === 400 && statusMessage === "Already logged in. Please logout first."){
		//just ignore this case and show the "logged in" situation anyway
		loggedIn();
	}
}

/**
 * Function to be executed when changes are submitted
 */
function loggedOut(){
	empty(tagsElement);
	document.getElementById('login-div').className = "";
	document.getElementById('tags-div').className = "hidden";
	document.getElementById('overlay').className = "hidden";
	document.getElementById('login-form').className = "hidden";
	facebookAuth.logout();	//logout from front end
}

/**
 * Callback function to set the flag for invoking sync and authorization
 */
function userRegistered(){
	localStorage.invokeSync = true;
	localStorage.authorize = true;
}

/**
 * Function to invoke Account authorization
 */
function authorizeAccount(){
	debug('Authorize Service (twitter)');
	delete localStorage.authorize;
	var redirectUri = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port:"") + window.location.pathname;  
	var params = "?redirect_uri="+(redirectUri);
	var queryURL = serviceTwitter + methodAuthorize + params;
	if(popup_authorize_service === null){
		popup_authorize_service = window.open(queryURL, '_self');
	}else{
		window.alert("Error while authorizing your account. Please try again and reload the page");
	}
}

function syncAgain(){
	document.getElementById('div-sync-again').className = 'hidden';
	localStorage.invokeSync = true;
	localStorage.authorize = true;
	authorizeAccount();
}

function syncAccount(){
	if(localStorage.invokeSync){	
		document.getElementById('overlay').className = "";
		synchronizeAccount();
	}
}

/**
 * Function to invoke Account synchronization
 */
function synchronizeAccount(){
	debug('Synchronizing your account, please wait');
	var queryURL = serviceTags + methodSynchronizeTw;
	var xmlhttp=new XMLHttpRequest();
	xmlhttp.open("POST", queryURL, true);
	xmlhttp.setRequestHeader('Cache-Control', 'no-cache'); //setting headers must be after OPEN but before SEND
	xmlhttp.setRequestHeader("If-Modified-Since", new Date(0)); // January 1, 1970
	xmlhttp.onreadystatechange=httpRequestReady;
	xmlhttp.send();	
}

function getTagCloud(){
	empty(tagsElement);
	bubbleNodes = null;
	getTags();
}

/**
 * Function to get tags from the server
 */
function getTags(){
	var params = "?data_groups=all&limits=0-30&sort=>rank,>confidence";
	var queryURL = serviceTags + methodGetTags + params;
	var xmlhttp=new XMLHttpRequest();
	xmlhttp.open("GET", queryURL, true);
	xmlhttp.setRequestHeader('Cache-Control', 'no-cache'); //setting headers must be after OPEN but before SEND
	xmlhttp.onreadystatechange=httpRequestReady;
	xmlhttp.send();	
}

/**
 * Function to update tag ranks
 * user_id=ID
 * rank=guid:value,guid:value...
 */
function setRank(){
	var rank = "";
	//check for modified tags and build a query string
	for(var i=0; i<bubbleNodes.length; ++i){
		if(bubbleNodes[i].modified){
			rank += bubbleNodes[i].mediaObjectId + ";" + bubbleNodes[i].rank + ",";
		}
	}
	if(rank === null || rank === undefined || rank === ""){
		//no changes
		return;
	}else{
		//remove the last "," of the string
		rank = rank.substring(0, rank.length-1);
	}
	var params = "?rank=" + encodeURI(rank);
	debug(params);
	var queryURL = serviceTags + methodSetRank + params;
	var xmlhttp=new XMLHttpRequest();
	xmlhttp.open("POST", queryURL, true);
	xmlhttp.onreadystatechange=httpRequestReady;
	xmlhttp.send();
}

/**
 * Function to perform FB and application disconnection, if needed really
 * 
 */
function disconnectFB(){
	//facebookAuth.disconnectFB();
	debug('Authorization revoked (just kidding ;)');
	document.getElementById('thankyou-div').className = "";
}

function resetModifiedFlag(){
	document.getElementById('btn-commit').className = 'highlighted hidden';	//hide commit button
	for(var i=0; i<bubbleNodes.length; ++i){
		if(bubbleNodes[i].modified){
			bubbleNodes[i].modified = false;
		}
	}
}

function httpRequestReady(event){
	var xmlHttpRequest = event.target;
	if(!(xmlHttpRequest.readyState == 4) || !(xmlHttpRequest.responseXML)){
		return;
	}

	if(xmlHttpRequest.status === 401){	//state UNAUTHORIZED
		alert("An authentication error occurred.");
		return;
	}else if(xmlHttpRequest.status !== 200){
		alert("Network error\nError status: '"+xmlHttpRequest.statusText+"' ("+xmlHttpRequest.status+")");
		return;
	}else{
	}
	
	var methodName = xmlHttpRequest.responseXML.documentElement.getAttribute("method");
	
	switch(methodName){
		case methodGetTags:
			displayTags(xmlHttpRequest.responseXML.documentElement);
			break;
		case methodSetRank:
			resetModifiedFlag();
			//automatically logout and disconnect after giving the feedback
			logoutAndDisconnect();
			break;
		case methodSynchronizeTw:
			debug("Synchronizing, please wait...");
			delete localStorage.invokeSync; //sync has now been invoked, do remove the variable from local storage
			clearTimeout(refreshTimer);
			//start a new timer to refresh the page automatically after sync
			refreshTimer = setTimeout(getTagCloud, 10000);
			//the timer will be cancelled on displayTags function when the results have appeared
			break;
		default:
			break;
	}
}

function logoutAndDisconnect(){
	disconnectFB();
	loggedOut();
}

/**
 * Tag specific functions
 */
function tagClicked(object, index){
	document.getElementById('btn-commit').className = 'highlighted'; //show commit button
	var tag = this;
	var circleClass = "node";
	if(object.rank == 0){
		object.rank = 1;
		circleClass += " accepted";
	}else if(object.rank > 0){
		object.rank = -1;
		circleClass += " rejected";
	}else{
		object.rank = 0;
		//circleClass += "";
	}
	if(object.ngrams > 1){
		circleClass += " ngram";
	}
	tag.setAttribute('class', circleClass);
	object.modified = true;
	return false;
}

function parseBubbleChart(tagList){	
	var tags = tagList.getElementsByTagName('object');
	
	if(bubbleNodes == null){
		bubbleNodes = [];
	}	
	for(var i=0; i<tags.length; ++i){
		var tag = tags[i];
		bubbleNodes.push({
			"objectId": tag.getElementsByTagName('objectId')[0].textContent,
			"status": tag.getElementsByTagName('status')[0].textContent,
			"backendId": tag.getElementsByTagName('backendId')[0].textContent,
			"className": tag.getElementsByTagName('value')[0].textContent,
			"value": Number(tag.getElementsByTagName('confidence')[0].textContent),		//must be value for the d3-bubble
			"rank": Number(tag.getElementsByTagName('rank')[0].textContent),
			"mediaObjectId": tag.getElementsByTagName('mediaObjectId')[0].textContent,
			"userId": tag.getElementsByTagName('userId')[0].textContent,
			"nGrams": tag.getElementsByTagName('value')[0].textContent.split(" ").length,	//number of grams
			"modified": false
		});
	}
	
	var svg = d3.select("#tags-svg");
	var width = svg.style('width').replace('px','');
	var height = svg.style('height').replace('px','');
    var color = d3.scale.category20c();
	var bubble = d3.layout.pack().sort(null).size([width, height]).padding(2);
	
	var node = svg.selectAll(".node")
    	.data(bubble.nodes({"children": bubbleNodes})
    	.filter(function(d) { return !d.children; }))
    	.enter().append("g")
		.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
		//define fill colors and such based on ngram, accepted & rejected
		.style("fill", function(d) { return color(d.nGrams); })
		.attr("class", function(d){
			var circleClass = "node";
			if(d.rank > 0){
				circleClass += " accepted";
			}else if(d.rank < 0){
				circleClass += " rejected";
			}
			if(d.ngrams > 1){
				circleClass += " ngram";
			}
			return circleClass;
		})
		.on("click", tagClicked);	//set click listener

	node.append("title")	//define tooltip
		.text(function(d) { return d.className + "\tscore: " + d.value.toFixed(3); });

	node.append("circle")	//define shape
		.attr("r", function(d) { return d.r; });

	node.append("text")	//define text to be placed inside the circle
		.style("text-anchor", "middle")
		.style("fill", "#fff")
		//.attr("class", "no-select")	//do not allow selection of text (for some reason)
		.each(function(d){
			var textNode = d3.select(this);
			var splitted = d.className.split(" ");
			for(var k=0; k<splitted.length; ++k){
				var tspan = textNode.append("tspan").attr("x", 0).text(splitted[k]);
				if(k==0 && d.nGrams > 1){
					tspan.attr("dy", -(d.nGrams-2)*0.6+"em");
				}else if(d.nGrams == 1){
					tspan.attr("dy", ".3em");
					if(splitted[k].length <= 8){
						tspan.style("font-size", "1.25em");
					}else{
						tspan.style("font-size", "1.125em");
					}
				}else{
					tspan.attr("dy", "1em");
				}
			}
		});
	
	return true;
}

function displayTags(tagDocument){
	var tagList = tagDocument.getElementsByTagName('objectList')[0];
	
	if(tagList){
		parseBubbleChart(tagList);	//don't show the commit button automatically
		if(refreshTimer !== null){	//clear and null the timer
			debug('Clearing refresh timer for good');
			clearTimeout(refreshTimer);
			refreshTimer = null;
			document.getElementById('overlay').className = "hidden";
		}
	}else{	//there was no tags or taglist at all (doing this because the service does not return an empty tagList element)
		retryCount++;
		//if refresh timer was used, then create a new timer to refresh 
		if(refreshTimer !== null){
			debug("Recreating refresh timer");
			clearTimeout(refreshTimer);	//clear the old timer, just in case
			refreshTimer = setTimeout(getTagCloud, 10000);	//and try again in a while
		}else{	//show sync again button if nothing happens in three tries
			if(retryCount < 3){
				setTimeout(getTagCloud, 10000);
			}else{
				document.getElementById('div-sync-again').className = '';
			}
		}
	}
}

function empty(element){
	if(element !== null && element.hasChildNodes()){
		var childs = element.childNodes;
		while(childs.length>0){
			element.removeChild(childs[0]);
		}
	}
}

/**
 * Get URL Parameters Using Javascript
 * Reference: http://www.netlobo.com/url_query_string_javascript.html
 */
function getUrlParameter(parameterName){
	var name = parameterName.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var results = regex.exec(window.location.href);
	if(results === null)
		return null;
	else
		return results[1];
}
