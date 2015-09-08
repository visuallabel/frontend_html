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

/** User services */
var serviceUsers = "/CAFrontEnd/rest/user/";
var methodExternalConnections = "getExternalAccountConnections";
var methodUserDetails = "getUserDetails";
var methodLogout = "logout";

/** User login "login with xx" related stuff */
var serviceFacebook = "/CAFrontEnd/rest/facebook/";
var serviceGoogle = "/CAFrontEnd/rest/google/";
var serviceTwitter = "/CAFrontEnd/rest/twitter/";

/** FB-Jazz and Twitter-Jazz */
var serviceFBJ = "/CAFrontEnd/rest/fbj/";
var serviceTWJ = "/CAFrontEnd/rest/tj/";

var methodAuthorize = "authorize";
var methodUnauthorize = "unauthorize";
var methodSummarize = "summarize";

/** Test methods, syncs are for photos, summarizations for text */
var serviceContentStorage = "/CAFrontEnd/rest/cos/";
var methodSynchronizePicasa = "synchronize";

// Member variables
var facebookAuth = new FacebookAuth();
var googleAuth = new GoogleAuth();

var supportedServices = ["FACEBOOK", "GOOGLE", "TWITTER"];

function onBodyLoad(){
	googleAuth.init(document.getElementById("login-form"));
	facebookAuth.init(document.getElementById("login-form"));
	
	googleAuth.callBackOnLogin = loggedIn;
	facebookAuth.callBackOnLogin = loggedIn;
	
	facebookAuth.callBackOnError = loggedIn;
/*
	facebookAuth.callBackOnRegister = userRegistered;
	facebookAuth.callBackOnError = errorHandler;
*/
	getUserDetails();	//test user login status
}

function loggedIn(){
	$("#login-div").addClass("hidden");
	getUserDetails();
}

function loggedOut(){
	$("#login-div").removeClass("hidden");
	$("#toolbar-div").addClass("hidden");
	$("#content-div").addClass("hidden");
}

function logout(){
	$.ajax({
		url: serviceUsers + methodLogout,
		success : function(){ location.reload(); }//reload the page
	});
}

function getUserDetails(){
	$.ajax({
		url : serviceUsers + methodUserDetails,
		error : loggedOut,	//user is not currently logged in
		success : populateUserDetails
	});
}
function populateUserDetails(data){
	var contentElement = $("#toolbar-div");
	contentElement.removeClass("hidden");
	
	var userDetailsList = data.documentElement.getElementsByTagName("userDetails");
	if(userDetailsList.length > 0){
		var detailElement = $("#username")[0];
		var details = userDetailsList[0];
		var text = details.getElementsByTagName("username")[0].textContent + " (id: " + details.getElementsByTagName("userId")[0].textContent + ")";
		detailElement.textContent = text;
	}
	getExternalConnections();
}

function getExternalConnections(){
	$.ajax({
		url : serviceUsers + methodExternalConnections,
		success : populateExternalConnections,
		complete : function() {	}
	});
}
function populateExternalConnections(data){
	var contentElement = $("#content-div");	
	contentElement.empty();
	$("#content-div").removeClass("hidden");
	
	var inactiveConnections = supportedServices;
	var connectionsList = data.documentElement.getElementsByTagName("externalAccountConnection");
	var listElement = document.createElement("ul");
	//display the active connections to third party services
	for(var i=0; i<connectionsList.length; ++i){
		var connection = connectionsList[i];
		var serviceType = connection.getElementsByTagName("serviceType")[0].textContent;
		listElement.appendChild(generateListItem(serviceType, true, connection));
		inactiveConnections.splice(inactiveConnections.indexOf(serviceType),1);
	}
	//display the inactive connections (not enabled by the user)
	for(var i=0; i<inactiveConnections.length; ++i){
		var serviceType = inactiveConnections[i];
		listElement.appendChild(generateListItem(serviceType, false));
	}
	contentElement.append(listElement);
}

function generateListItem(serviceType, isActive, connection){
	var listItem = document.createElement("li");
	var accountItem = document.createElement("div");
	accountItem.className = "connection " + serviceType
	if(isActive){
		$(accountItem).append('<div>'+connection.getElementsByTagName("externalId")[0].textContent+'</div>');
	}else{
		$(accountItem).append("<div>Service is not activated.</div>");
		//accountItem.className += " disabled";
	}
	generateLinks(serviceType, isActive, accountItem);
	listItem.appendChild(accountItem);
	return listItem;
}

function generateLinks(serviceType, isActive, element){
	if(supportedServices.indexOf(serviceType) < 0){
		element.textContent = serviceType + " not supported.";
		return;
	}
	if(isActive){
		$(element).append('<button class="authorize" onclick="btnCallback(\''+serviceType+'\',\'AUTHORIZE\')">Reauthorize</button>');	//urlAuthorize
		$(element).append('<button class="resync" onclick="btnCallback(\''+serviceType+'\',\'RESYNC\')">Resync Account</button>');	//urlResync
		$(element).append('<button class="summarize" onclick="btnCallback(\''+serviceType+'\',\'SUMMARIZE\')">Summarize Account</button>');	//urlSummarize
		$(element).append('<button class="unauthorize" onclick="btnCallback(\''+serviceType+'\',\'UNAUTHORIZE\')">Revoke Authorization</button>');	//urlUnauthorize
	}else{
		$(element).append('<button class="authorize" onclick="btnCallback(\''+serviceType+'\',\'AUTHORIZE\')">Authorize</button>');	//urlAuthorize
	}
}

function btnCallback(serviceType, action){
	var baseUrl = "";
	var urlResync = "";
	var urlSummarize = "";
	var url = null;
	switch(serviceType){
		case "FACEBOOK":
			baseUrl = serviceFacebook;
			urlSummarize = serviceFBJ + methodSummarize;
			urlResync = urlSummarize + "?synchronize=true";
			break;
		case "GOOGLE":
			baseUrl = serviceGoogle;
			urlResync = serviceContentStorage + methodSynchronizePicasa + "?service_id=1";	//service_id=1 === PICASA_STORAGE_SERVICE
			urlSummarize = urlResync;	//URL for resync and summarize are the same for both operations
			break;
		case "TWITTER":
			baseUrl = serviceTwitter;
			urlSummarize = serviceTWJ + methodSummarize;
			urlResync = urlSummarize + "?synchronize=true";
			break;
		default: 
			return;
	}
	
	switch(action){
		case "AUTHORIZE":
			url = baseUrl + methodAuthorize;
			break;
		case "UNAUTHORIZE":
			url = baseUrl + methodUnauthorize;
			break;
		case "SUMMARIZE":
			url = urlSummarize;
			break;
		case "RESYNC":
			url = urlResync;
			break;
		default:
			return;
	}
	if(url != null){
		var isConfirmed = window.confirm("Do you really want to perform operation "+action+"?\n(Effects are immediate and cannot be undone)");
		debug(url);
		if(isConfirmed){
			window.open(url);
		}
	}
}
