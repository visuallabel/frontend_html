/**
 * Copyright 2015 Tampere University of Technology, Pori Unit
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

var FacebookAuth = function(){
	this.appId = "123456789012345";
	this.scopes = "";	//empty scope means that only basic details are asked
	
	this.serviceFBUser = "/CAFrontEnd/rest/facebook/";
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

FacebookAuth.prototype = {
	
	init : function(contentElement){
		//insert the fb-root tag as first element
		var fbRootElement = document.createElement("div");
		fbRootElement.id = "fb-root";
		contentElement.parentNode.insertBefore(fbRootElement, contentElement);
		
		window.fbAsyncInit = this.initializeFbAsync.bind(this);
		// Load the SDK asynchronously
		(function(d){
			var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
			if (d.getElementById(id)) {return;}
			js = d.createElement('script'); js.id = id; js.async = true;
			js.src = "//connect.facebook.net/en_US/all.js";
			ref.parentNode.insertBefore(js, ref);
		}(document));
		
		this.containerElement = contentElement;
		var btnSignInUsingFacebook = document.createElement("fb:login-button");
		btnSignInUsingFacebook.id = "btn_fb_sign_in";
		btnSignInUsingFacebook.setAttribute("size", "large");
		btnSignInUsingFacebook.setAttribute("scope", this.scopes);
		btnSignInUsingFacebook.appendChild(document.createTextNode("Sign in with Facebook"));
		var divFacebook = document.createElement("div");
		divFacebook.appendChild(btnSignInUsingFacebook);
		this.containerElement.appendChild(divFacebook);
	},
	
	initializeFbAsync : function(){
		FB.init({
			appId      : this.appId, // App ID
			status     : false, // check login status
			cookie     : false, // enable cookies to allow the server to access the session
			xfbml      : true // parse XFBML
		});

		FB.Event.subscribe('auth.authResponseChange', function(response){
			this.handleAuthResult(response);
		}.bind(this));
	},
	
	disconnectFB : function(){
		FB.api({ method: 'Auth.revokeAuthorization' }, function(response) { 
			debug('Authorization revoked');
		});
	},
	
	handleAuthResult : function(authResult) {
		debug("auth response: "+ authResult.status);
		// Here we specify what we do with the response anytime this event occurs. 
		if (authResult.status === 'connected') {
			// The response object is returned with a status field that lets the app know the current
			// login status of the person. In this case, we're handling the situation where they 
			// have logged in to the app.
			if(!this.isloggedIn){
				debug("Use of FB account is authorized");
				this.accessToken = FB.getAccessToken();
				this.login(this.accessToken);
			}
		} else if (authResult.status === 'not_authorized') {
			// In this case, the person is logged into Facebook, but not into the app
		} else {
			debug("Not authorized/logged in");
			//FB.login();
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
		var queryURL = this.serviceFBUser + this.methodLogin + params;
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
		var queryURL = this.serviceFBUser + this.methodRegister + params;
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
			if(status === "FORBIDDEN" && message === "The given Facebook user is not registered with this service, please register before login."){
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
