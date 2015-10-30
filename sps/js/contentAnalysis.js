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

/**
 * 
 * initializer
 */
var ContentAnalysis = function() {
	this.basePath = "/CAFrontEnd";
	this.max_items = 25; // default item count
	this.loginInProgress = false;
	this.getPhotosInProgress = false;
	this.getPhotoDetailsInProgress = false;
	this.searchSimilarByUIDInProgress = false;
	this.searchSimilarByObjectInProgress = false;
	this.updatePhotosInProgress = false;
	this.similarityFeedbackInProgress = false;
	this.timeout = 120000; // http request time out in ms
};

/**
 * VisualObjectType enumeration 
 */
ContentAnalysis.VisualObjectType = {
	KEYWORD : {},
	FACE : {},
	OBJECT : {}
};

// enumerations
ContentAnalysis.ContentDataType = {
	SIMILAR_BY_UID : {},
	PHOTOLIST : {},	// generic photoList (ie. getPhotos())
	SIMILAR_BY_OBJECT : {},
	UPDATE_PHOTOS : {},
	SIMILARITY_FEEDBACK : {},
	UNKNOWN : {}
};

// Service/class enums
ContentAnalysis.ServiceTypes = {
	BACKEND: "BACKEND",
	FBJ: "FBJ",
	TWJ: "TWJ",
	PICASA: "PICASA",
	FSIO: "FSIO",
	URL_STORAGE: "URL",
	USER: "USER",
	UNKNOWN_BACKEND: "UNKNOWN_BACKEND",
	UNKNOWN_SERVICE: "UNKNOWN_SERVICE"
};

function backendIdLookup(backendId, serviceTypeId){
	if(backendId !== null){
		if(backendId == 2){
			return ContentAnalysis.ServiceTypes.BACKEND;	//PICSOM, really
		}else if(backendId == 3){
			return ContentAnalysis.ServiceTypes.BACKEND;	//MUVIS, really
		}else if(backendId == 7){
			if(serviceTypeId == 3 || serviceTypeId == 4){
				return ContentAnalysis.ServiceTypes.FBJ;
			}else if(serviceTypeId == 5 || serviceTypeId == 6){
				return ContentAnalysis.ServiceTypes.TWJ;
			}else{
				return ContentAnalysis.ServiceTypes.BACKEND;	//MEAD/Summarizer, really
			}
		}else{
			return ContentAnalysis.ServiceTypes.UNKNOWN_BACKEND;
		}
	}else if(serviceTypeId !== null){
		if(serviceTypeId == 1){
			return ContentAnalysis.ServiceTypes.PICASA;
		}else if(serviceTypeId == 2){
			return ContentAnalysis.ServiceTypes.FSIO;
		}else if(serviceTypeId == 4){
			return ContentAnalysis.ServiceTypes.FBJ;
		}else if(serviceTypeId == 6){
			return ContentAnalysis.ServiceTypes.TWJ;
		}else if(serviceTypeId == 7){
			return ContentAnalysis.ServiceTypes.URL_STORAGE;
		}else{
			return ContentAnalysis.ServiceTypes.UNKNOWN_SERVICE;
		}
	}else{
		return ContentAnalysis.ServiceTypes.USER;
	}
};

/**
 * Helper function to return limit query string in correct format
 * @param startItem
 * @param endItem
 * @returns
 */
function toLimitQueryString(startItem, endItem){
	var limitString = "";
	limitString = String(startItem);
	if(endItem){
		limitString += "-" + String(endItem);
	}
	return limitString;
}

/**
 * 
 * prototype for ContentAnalysis
 */
ContentAnalysis.prototype = {
	/**
	 * show login prompt if the user details are not found on localStorage
	 * 
	 * @param {callback function} userDetailsDialog called for retrieving username and password, should accept callback to which the username and password used typed is to be passed, and an optional error message
	 * @param {callback function} loginCompleted called when login has completed, true passed as parameter on success, false on failure
	 * @param {callback function} errorDialog called on http error (but NOT on login error). Should accept title and message.
	 * 
	 */
	initCA : function(userDetailsDialog, loginCompleted, errorDialog){
		this.userDetailsDialog = userDetailsDialog;
		this.loginCompleted = loginCompleted;
		this.errorDialog = errorDialog;
	},
	
	/**
	 * update the local storage variables with new user information 
	 */
	updateUserDetails : function(){
		this.loginInProgress = true;
		debug('getUserDetails');
		$.ajax({	// check that the user details are valid
				timeout : contentAnalysis.timeout,
				url : contentAnalysis.basePath + "/rest/user/getUserDetails",
				success : function(data) {
					var userIdNodes = data.getElementsByTagName('userId');
					var usernameNodes = data.getElementsByTagName('username');
					if(userIdNodes.length > 0){
						localStorage.userid = userIdNodes[0].textContent;
						contentAnalysis.loginCompleted(true); // call the given callback function with successful login (true)
					}else{
						debug('contentAnalysis.getUserDetails failed: did not receive userId.');
						localStorage.removeItem('userid');
						contentAnalysis.userDetailsDialog(contentAnalysis.login, 'Incorrect username or password');
					}
				},
				error : function(jqXHR, textStatus, errorThrown) {
					debug('contentAnalysis.getUserDetails failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
					// remove from local storage to prevent strange state upon page refresh after failure
					localStorage.removeItem('userid');
					switch(jqXHR.status){
						case 401:
						case 403:
							contentAnalysis.userDetailsDialog(contentAnalysis.login, 'Login failed: Incorrect username and/or password. Please try again.');
							break;
						default:
							contentAnalysis.userDetailsDialog(contentAnalysis.login, contentAnalysis.error(jqXHR.status, false, 'Login failed.')+' Please try again.');
							break;
					}
				},
				complete : function() {
					this.loginInProgress = false;
				},
				context : this
			});
	},
	
	/**
	 *
	 * if username or password is null, the details will be fetched from localStorage, if details are not found from localStorage, the login dialog will be shown  
	 *
	 * @param {string} username
	 * @param {string} password
	 */
	login : function(username, password){
		if(username && password){
			contentAnalysis.loginInProgress = true;
			debug('login');
			$.ajax({	// check that the user details are valid
				timeout : contentAnalysis.timeout,
				username : username,
				password: password,
				url : contentAnalysis.basePath + "/rest/user/login",
				success : function(data) {
					contentAnalysis.updateUserDetails();
				},
				error : function(jqXHR, textStatus, errorThrown) {
					debug('contentAnalysis.login failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
					// remove from local storage to prevent strange state upon page refresh after failure
					localStorage.removeItem('userid');
					switch(jqXHR.status){
						case 401:
						case 403:
							contentAnalysis.userDetailsDialog(contentAnalysis.login, 'Login failed: Incorrect username or password. Please try again.');
							break;
						default:
							contentAnalysis.userDetailsDialog(contentAnalysis.login, contentAnalysis.error(jqXHR.status, false, 'Login failed.')+' Please try again.');
							break;
					}
				},
				complete : function() {
					this.loginInProgress = false;
				},
				context : this
			});
		}else{
			if(typeof localStorage.userid == 'undefined'){
				contentAnalysis.userDetailsDialog(contentAnalysis.login, null);
			}
		}
	},
	
	/**
	 * clear user details 
	 */
	logout : function(){
		debug('logout');
		this.loginInProgress = true;
		$.ajax({	// logout the user
			timeout : contentAnalysis.timeout,
			url : contentAnalysis.basePath + "/rest/user/logout",
			success : function(data) {
				debug('contentAnalysis.logout Logout success.');
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.logout failed.');
			},
			complete : function() {
				this.loginInProgress = false;
				$.ajax({	//really logout the user (by deliberately logging in with wrong credentials) 
					timeout : contentAnalysis.timeout,
					username : "user.log",
					password : "user.out",
					async : false,
					url : contentAnalysis.basePath + "/rest/user/login",
					complete : function() {
						debug("Really logged out");
					}
				});
				location.reload();
			},
			context : this
		});
		localStorage.removeItem('userid');
	},
	
	/**
	 * call the given error callback with description of the given error code (HTTP status code)
	 * 
	 * @param {Integer} errorCode
	 * @param {Boolean} showError if true, the error dialog will be shown, otherwise only the textual description of the error is returned
	 * @param {String} defaultMessage shown on unknown error, if not given built-in default message will be used
	 * @return the error message as a string
	 */
	error : function(errorCode,showError,defaultMessage){
		var message = null;
		var title = null;
		switch(errorCode){
			case 400:	// Bad Request
			case 406:	// Not Acceptable
				title = 'Critical Error';
				message = 'Server received bad data. The application is not working properly, and this is most likely caused by a bug in the application.';
				break;
			case 401:	// Unauthorized
			case 403:	// Forbidden
				title = 'Access Denied';
				message = 'Access to the requested resource was denied.';
				break;
			case 404:	// Not Found
				title = 'Not Found';
				message = 'The requested resource is currently not available.';
				break;
			case 500:	// Internal Server Error
			case 503:	// Service Unavailable
				title = 'Service Unavailable';
				message = 'The service is currently unavailable.';
				break;
			case 408: 	// Request Timeout
				title = 'Service Unavailable';
				message = 'Connection failed.';
				break;
			default:
				title = 'Operation Failed';
				if(defaultMessage){
					message = defaultMessage;
				}else{
					message = 'Error code: '+errorCode;
				}
				break;
		}
		if(showError){
			this.errorDialog(title, message);
		}
		debug('contentAnalysis.error: '+title+' -- '+message);
		return message;
	},

	/**
	 * 
	 * gets all user's photos, onReady called when http request has been completed
	 * 
 	 * @param {callback function} onReady
 	 * @param {Integer} serviceId
 	 * @param {Integer} startItem
	 */
	getPhotos : function(onReady, serviceId, startItem) {
		this.getPhotosInProgress = true;
		if(typeof startItem == 'undefined'){
			startItem = 0;
		}
		var limits = toLimitQueryString(startItem, startItem+this.max_items);
		debug('getPhotos?user_id='+localStorage.userid+'&service_id='+serviceId+'&limits='+limits+'&data_groups=result_info,all');
		$.ajax({
			timeout : this.timeout,
			url : this.basePath + "/rest/ca/getPhotos?data_groups=result_info,all",
			data : {
				user_id : localStorage.userid, // only photos for current user
				//service_id: serviceId,
				limits: limits
			},
			success : function(data) {
				var params = new Object();
				params.contentDataType = ContentAnalysis.ContentDataType.PHOTOLIST;
				params.serviceId = serviceId;
				params.startItem = startItem;
				onReady(data, params);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.getPhotos failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.getPhotosInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * 
	 * gets details of the photo designated by the given uid, onReady called when http request has been completed
	 * 
	 * 
 	 * @param {callback function} onReady
 	 * @param {String} uid
	 */
	getPhotoDetails : function(onReady, uid) {
		this.getPhotoDetailsInProgress = true;
		debug('getPhotos?user_id='+localStorage.userid+'&uid='+uid+'&data_groups=all');
		$.ajax({
			timeout : this.timeout,
			url : this.basePath + "/rest/ca/getPhotos",
			data : {
				user_id : localStorage.userid,
				uid: uid,
				data_groups : "all"
			},
			success : function(data) {
				onReady(data);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.getPhotoDetails failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.getPhotoDetailsInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * 
	 * search similar photos based on the given uid
	 * 
	 * 
 	 * @param {callback function} onReady
 	 * @param {String} uid
 	 * @param {Integer} startItem
	 */
	searchSimilarByUID : function(onReady, uid, startItem) {
		this.searchSimilarByUIDInProgress = true;
		if(typeof startItem == 'undefined'){
			startItem = 0;
		}
		var limits = toLimitQueryString(startItem, startItem+this.max_items);
		debug('similarPhotosById?user_id='+localStorage.userid+'&uid='+uid+'&limits='+limits+'&data_groups=result_info,all');
		$.ajax({
			timeout : this.timeout,
			url : this.basePath + "/rest/ca/similarPhotosById?data_groups=result_info,all",
			data : {
				user_id : localStorage.userid,
				uid: uid,
				limits: limits
			},
			success : function(data) {
				var params = new Object();
				params.contentDataType = ContentAnalysis.ContentDataType.SIMILAR_BY_UID;
				params.uid = uid;
				params.startItem = startItem;
				onReady(data, params);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.searchSimilarByUID failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.searchSimilarByUIDInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * 
	 * search similar photos based on the given list of objects (xml elements)
	 * 
	 * 
 	 * @param {callback function} onReady
 	 * @param {Document} objectList
 	 * @param {Integer} startItem
	 */
	searchSimilarByObject : function(onReady, objectList, startItem) {
		this.searchSimilarByObjectInProgress = true;
		if(typeof startItem == 'undefined'){
			startItem = 0;
		}
		var limits = toLimitQueryString(startItem, startItem+this.max_items);
		var url = this.basePath + "/rest/ca/similarPhotosByObject?user_id="+localStorage.userid+"&limits="+limits+"&data_groups=result_info";		
		debug(url);
		$.ajax({
			timeout : this.timeout,
			url : url,
			data : objectList,
			contentType: 'text/xml',
			processData: false,
			type: 'POST',
			success : function(data) {
				var params = new Object();
				params.contentDataType = ContentAnalysis.ContentDataType.SIMILAR_BY_OBJECT;
				params.objectList = objectList;
				params.startItem = startItem;
				onReady(data, params);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.searchSimilarByObject failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.searchSimilarByObjectInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * 
	 * Append a new node of the type (type) with the given value to the passed element
	 * 
	 * @param {ContentAnalysis.VisualObjectType} type
	 * @param {String} value
	 * @param {Element} element
	 * @param {String} status optional status such as USER_CONFIRMED or CANDIDATE, if null, USER_CONFIRMED is assumed
	 */
	appendVisualObject : function (type, value, element, status) {
		var doc = element.ownerDocument;
		var objectTypeElement = doc.createElement('objectType');
		switch(type){
			case ContentAnalysis.VisualObjectType.KEYWORD:
				objectTypeElement.appendChild(doc.createTextNode('KEYWORD'));
				break;
			case ContentAnalysis.VisualObjectType.FACE:
				objectTypeElement.appendChild(doc.createTextNode('FACE'));
				break;
			case ContentAnalysis.VisualObjectType.OBJECT:
				objectTypeElement.appendChild(doc.createTextNode('OBJECT'));
				break;
			default:
				debug('Unknown VisualObjectType.');
				return;
		}
		
		var objectElement = doc.createElement('object');
		objectElement.appendChild(objectTypeElement);
		
		var valueElement = doc.createElement('value');
		valueElement.appendChild(doc.createTextNode(value));
		objectElement.appendChild(valueElement);
		
		var statElement = doc.createElement('status');
		if(status){
			statElement.appendChild(doc.createTextNode(status));
		}else{
			statElement.appendChild(doc.createTextNode('USER_CONFIRMED'));
		}		
		objectElement.appendChild(statElement);
		
		element.appendChild(objectElement);
	},
	
	/**
	 * @param {Document} data
	 * 
	 * return true on valid response, false on failure
	 */
	isValidResponse : function(data) {
		var success = true;
		var childNodes = data.documentElement.childNodes;
		for(var i=0;i<childNodes.length;++i){
			switch(childNodes[i].nodeName){
				case 'status':
					if(childNodes[i].textContent.toLowerCase() !== 'ok'){
						debug('contentAnalysis.isValidResponse: status: '+childNodes[i].textContent);
						success = false;
					}else{
						return true;
					}
					break;
				case 'error_msg':
					debug('contentAnalysis.isValidResponse: error_msg: '+childNodes[i].textContent);
					break;
				case 'error_code':
					debug('contentAnalysis.isValidResponse: error_code: '+childNodes[i].textContent);
					break;
				case 'error':
					debug('contentAnalysis.isValidResponse: error: '+childNodes[i].textContent);
					break;
			}	// switch
		}
		return success;
	},
	
	/**
	 * 
	 * boolean parameter is passed to onReady to signify whether the operation was success or not
	 * 
	 * @param {callback function} onReady
	 * @param {Document} photoList
	 */
	updatePhotos : function(onReady, photoList){	
		this.updatePhotosInProgress = true;
		var url = this.basePath + "/rest/ca/updatePhotos";		
		debug(url);
		$.ajax({
			timeout : this.timeout,
			url : url,
			data : photoList,
			contentType: 'text/xml',
			processData: false,
			type: 'POST',
			success : function(data) {
				var params = new Object();
				params.contentDataType = ContentAnalysis.ContentDataType.UPDATE_PHOTOS;
				params.photoList = photoList;
				onReady(data, params);
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.updatePhotos failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.updatePhotosInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * 
	 * boolean parameter is passed to onReady to signify whether the operation was success or not
	 * 
	 * @param {Document} feedbackList
	 */
	similarityFeedback : function(feedbackList){	
		this.similarityFeedbackInProgress = true;
		var url = this.basePath + "/rest/ca/similarityFeedback";	
		debug(url);
		$.ajax({
			timeout : this.timeout,
			url : url,
			data : feedbackList,
			contentType: 'text/xml',
			processData: false,
			type: 'POST',
			success : function(data) {
				if(contentAnalysis.isValidResponse(data)){
					debug('contentAnalysis.similarityFeedback: feedback was sent successfully.');
				}else{
					debug('contentAnalysis.similarityFeedback failed.');
				}
			},
			error : function(jqXHR, textStatus, errorThrown) {
				debug('contentAnalysis.similarityFeedback failed: '+jqXHR.status+' '+textStatus+' '+errorThrown);
				this.error(jqXHR.status,true,null);
			},
			complete : function() {
				this.similarityFeedbackInProgress = false;
			},
			context : this
		});
	},
	
	/**
	 * send similarity search feedback consisting of the given array(s) of Photos for the given referencePhoto (target of feedback)
	 * 
	 * at least one of dissimilarPhotos or similarPhotos must be given
	 * 
	 * @param {String} referencePhoto
	 * @param {Array [String]} dissimilarPhotos optional
	 * @param {Array [String]} similarPhotos optional
	 * @return a new dom document
	 */
	createFeedbackList : function(referencePhoto, dissimilarPhotos, similarPhotos) {
		var feedbackList = document.implementation.createDocument(null, 'feedbackList', null);
		var referencePhotoList = feedbackList.documentElement.appendChild(feedbackList.createElement('referenceMediaList'));
		var node = referencePhoto.cloneNode(true);
		contentAnalysis.stripToDefaultDatagroup(node);
		referencePhotoList.appendChild(referencePhoto.cloneNode(true));
		
		if(dissimilarPhotos != null){
			var dissimilarPhotoList = feedbackList.documentElement.appendChild(feedbackList.createElement('dissimilarMediaList'));
			for(var i=0;i<dissimilarPhotos.length;++i){
				node = dissimilarPhotos[i].cloneNode(true);
				contentAnalysis.stripToDefaultDatagroup(node);
				dissimilarPhotoList.appendChild(node);
			}
		}
		if(similarPhotos != null){
			var similarPhotoList = feedbackList.documentElement.appendChild(feedbackList.createElement('similarMediaList'));
			for(var i=0;i<similarPhotos.length;++i){
				node = similarPhotos[i].cloneNode(true);
				contentAnalysis.stripToDefaultDatagroup(node);
				similarPhotoList.appendChild(node);
			}
		}
		return feedbackList;
	},
	
	/**
	 * remove all children from the photo that are not default elements (uid, userId, serviceId, url) 
	 *
	 *@param {Node} photo 
	 */
	stripToDefaultDatagroup : function(photo) {
		for(var i=photo.childNodes.length-1;i>=0;--i){
			var nodeName = photo.childNodes[i].nodeName;
			if(nodeName !== 'UID' && nodeName !== 'url' && nodeName !== 'userId' && nodeName !== 'serviceId'){
				photo.removeChild(photo.childNodes[i]);
			}
		}
	},
	
	/**
	 * returns new xml Document with objectList root 
	 */
	createVisualObjectList : function() {
		return document.implementation.createDocument(null, 'objectList', null);
	},
	
	/**
	 * returns new xml Document with photoList root 
	 */
	createPhotoList : function() {
		return document.implementation.createDocument(null, 'mediaList', null);
	}
};
