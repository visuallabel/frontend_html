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

var GoogleAuth = function(){
	this.apiKey = "ADD_YOUR_API_KEY_HERE";
	this.clientId = "ADD_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";
	this.scopes = "https://www.googleapis.com/auth/userinfo.profile";
	
	this.ca_login_root = "/ca_login";		//change to path where the ca_login/login.html really is (by default on '/ca_login')
	
	this.serviceGUser = "/CAFrontEnd/rest/google/";
	this.serviceUser = "/CAFrontEnd/rest/user/";
	this.methodLogin = "login";
	this.methodLogout = "logout";
	this.methodRegister = "register";
	this.paramAccessToken = "access_token";
	
	this.callBackOnLogin = null;
	this.callBackOnRegister = null;
	this.callBackOnError = null;
	
	this.accessToken = null;
	this.containerElement = null;
	this.isloggedIn = false;
};

GoogleAuth.prototype = {
	
	init : function(contentElement){
		//load google api asynchronically
		var js, id = 'gapi-sdk', ref = document.getElementsByTagName('script')[0];
		if (document.getElementById(id)){
			//nothing do as the api has been loaded already 
		}else{
			//inject style sheet with g-plus images and stuff
			var styleSheet = document.createElement('link');
			styleSheet.setAttribute('rel', 'stylesheet');
			styleSheet.setAttribute('type', 'text/css');
			styleSheet.setAttribute('href', this.ca_login_root+'/styles/gplus.css');
			ref.parentNode.insertBefore(styleSheet, ref);
			//inject google api scripts
			js = document.createElement('script'); js.id = id; js.async = true;
			js.src = "//apis.google.com/js/client.js";
			ref.parentNode.insertBefore(js, ref);
		}
		this.containerElement = contentElement;
		var btnSignInUsingGoogle = document.createElement("button");
		btnSignInUsingGoogle.id = "btn_g_sign_in";
		btnSignInUsingGoogle.className = "btn_g_plus";
		var divGoogle = document.createElement("div");
		divGoogle.appendChild(btnSignInUsingGoogle);
		this.containerElement.appendChild(divGoogle);
		btnSignInUsingGoogle.onclick = this.handleAuthClick.bind(this);		//using "this.handleAuthClick.bind(this)" instead of this.handleAuthClick changes the scope of callback to this (GoogleAuth object) (see e.g. http://ngauthier.com/2012/04/var-self-equals-lame.html)
	},
	
	/**
	 * @param event
	 * @returns {Boolean}
	 */
	handleAuthClick : function(event) {
		debug("G+ clicked.");
		gapi.client.setApiKey(this.apiKey);
		gapi.auth.authorize({client_id: this.clientId, scope: this.scopes, immediate: false}, this.handleAuthResult.bind(this));
		return false;
	},
	
	handleAuthResult : function(authResult) {
		if (authResult && !authResult.error) {
			debug("Use of Google account is authorized");
			this.accessToken = gapi.auth.getToken().access_token;	//store the access_token temporarily
			this.login(this.accessToken);
		} else {
			debug("Not authorized/logged in");
		}
	},
	
	/**
	 * Function to login
	 */
	login : function(access_token){
		if(access_token === null || access_token === ""){
			return;
		}
		var params = "?" + this.paramAccessToken + "=" + encodeURI(access_token);
		var queryURL = this.serviceGUser + this.methodLogin + params;
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("GET", queryURL, true);
		xmlhttp.setRequestHeader('Cache-Control', 'no-cache'); //setting headers must be after OPEN but before SEND
		xmlhttp.onreadystatechange=this.httpRequestReady.bind(this);
		xmlhttp.send();	
	},
	
	/**
	 * Function to logout
	 */
	logout : function(){
		var queryURL = this.serviceUser + this.methodLogout;
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("GET", queryURL, true);
		xmlhttp.setRequestHeader('Cache-Control', 'no-cache'); //setting headers must be after OPEN but before SEND
		xmlhttp.onreadystatechange=this.httpRequestReady.bind(this);
		xmlhttp.send();	
	},
	
	/**
	 * Function to register
	 */
	register : function(access_token){
		if(access_token === null || access_token === ""){
			return;
		}
		var params = "?" + this.paramAccessToken + "=" + encodeURI(access_token);
		var queryURL = this.serviceGUser + this.methodRegister + params;
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("GET", queryURL, true);
		xmlhttp.setRequestHeader('Cache-Control', 'no-cache'); //setting headers must be after OPEN but before SEND
		xmlhttp.onreadystatechange=this.httpRequestReady.bind(this);
		xmlhttp.send();	
	},
	
	/**
	 * Callback function for XHR
	 * @param event
	 */
	httpRequestReady : function(event){
		var xmlHttpRequest = event.target;
		if(!(xmlHttpRequest.readyState == 4) || !(xmlHttpRequest.responseXML)){
			return;
		}
		var methodName = xmlHttpRequest.responseXML.documentElement.getAttribute("method");
		var status = xmlHttpRequest.responseXML.documentElement.getElementsByTagName("status")[0].textContent;
		
		if(xmlHttpRequest.status === 401){	//state UNAUTHORIZED
			var message = xmlHttpRequest.responseXML.documentElement.getElementsByTagName("message")[0].textContent;
			debug("An authentication error occurred.");
			debug(status +"::"+message);
			return;
		}else if(xmlHttpRequest.status === 403){	//state FORBIDDEN, i.e. 
			var message = xmlHttpRequest.responseXML.documentElement.getElementsByTagName("message")[0].textContent;
			debug(status +"::"+message);
			if(status === "FORBIDDEN" && message === "The given Google user is not registered with this service, please register before login."){
				this.register(this.accessToken);
			}
			return;
		}else if(xmlHttpRequest.status !== 200){
			var message = xmlHttpRequest.responseXML.documentElement.getElementsByTagName("message")[0].textContent;
			debug(status +"::"+message);
			//let the callback handler decide what to do on other situations
			if(this.callBackOnError != null){
				this.callBackOnError(xmlHttpRequest.status, status, message);
			}
			return;
		}else{
		}
		
		switch(methodName){
			case this.methodLogin:
				debug("Login successful");
				this.accessToken = null;	//remove accessToken from variables
				this.isloggedIn = true;
				if(this.callBackOnLogin !== null){
					this.callBackOnLogin();
				}
				break;
			case this.methodLogout:
				debug("Logout successful");
				this.isloggedIn = false;
				break;
			case this.methodRegister:
				debug("Register successful");
				if(this.callBackOnRegister !== null){
					this.callBackOnRegister();
				}
				this.login(this.accessToken);
				break;
			default:
				break;
		}
	}
	
};
