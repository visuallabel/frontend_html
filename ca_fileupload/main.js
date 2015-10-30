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

/** Content Analysis services */
var serviceCA = "/CAFrontEnd/rest/ca/";
var serviceVCA = "/CAFrontEnd/rest/vca/";
var methodGetPhotos = "getPhotos";
var methodGetVideos = "getVideos";
var parameterDataGroups = "data_groups";
var parameterServiceId = "service_id";
var parameterUserId = "user_id";

/* Content Storage services */
var serviceCOS = "/CAFrontEnd/rest/cos/";
var methodAddUrl = "addUrl";
var parameterUrl = "url";

/* Subtitle services */
var serviceSubs = "/CAFrontEnd/rest/subs/";
var methodGetSubtitles = "getSubtitles";

/* User services */
var serviceUsers = "/CAFrontEnd/rest/user/";
var methodUserDetails = "getUserDetails";
var methodLogout = "logout";

/* File services */
var serviceFile = "/CAFrontEnd/rest/fs/";
var methodAddFile = "addFile";
var methodGetFiles = "listFiles";

/* Member variables */
var facebookAuth = new FacebookAuth();
var googleAuth = new GoogleAuth();

/* helper variables */
var holder = null;
var tests = null;
var support = null;
var progressBarElement = null;
var fileupload = null;

/* common variables */
var numberOfFilesToSend = 0;
var numberOfFilesSent = 0;
var selectedFiles = [];
var tooltipUpdatedTimestamp = 0;
var userId = null; // user id of the logged in user
var acceptedTypes = {
		'image/bmp': true,
		'image/png': true,
		'image/jpeg': true,
		'image/gif': true,
		'video/mp4' : true,
		'video/webm' : true
	};
var maxFileSize = 100000000;
var defaultDataGroups = "all";


function onBodyLoad(){
	googleAuth.init(document.getElementById("login-form"));
	facebookAuth.init(document.getElementById("login-form"));
	
	googleAuth.callBackOnLogin = loggedIn;
	facebookAuth.callBackOnLogin = loggedIn;
	
	facebookAuth.callBackOnError = loggedIn;
	initSearch();
	initFileUploader();
	getUserDetails();	//test user login status
}

function loggedIn(){
	$("#login-div").addClass("hidden");
	getUserDetails();
}

function loggedOut(){
	$("#login-div").removeClass("hidden");
	$("#content-div").addClass("hidden");
}

function getUserDetails(){
	var url = serviceUsers + methodUserDetails;
	console.log("Calling: GET "+url);
	$.ajax({
		url : url,
		error : loggedOut,	//user is not currently logged in
		success : userLoggedInHandler
	});
}

function userLoggedInHandler(data){
	$("#login-div").addClass("hidden");
	$("#content-div").removeClass("hidden");
	userId = data.getElementsByTagName("userId")[0].textContent;
	getFiles();
	getPhotos();
	getVideos();
}

/**
 * @return user id for the currently logged in user or null if not logged in
 */
function getUserId(){
	return userId;
}

/**
 * Start analyze on the selected files if any are selected
 */
function analyzeSelected(){
	if(selectedFiles.length < 1){
		console.log("No files selected.");
		return;
	}
	var urls = [];
	for(var i=0;i<selectedFiles.length;++i){
		urls.push(selectedFiles[i].getElementsByTagName("url")[0].textContent);
	}
	analyzeUrl(urls);
}

/**
 * retrieve list of analyzed photos, or photos submitted for analysis.
 * 
 * On success this will update the analyzed photos list.
 * @param {Array[string]} urls
 */
function analyzeUrl(urls){
	var url = serviceCOS + methodAddUrl + "?" + parameterUrl + "=";
	for(var i=0;i<urls.length;++i){
		url += encodeURIComponent(urls[i])+",";
	}
	url = url.substring(0, url.length-1); // remove the trailing ,
	console.log("Calling: POST "+url);
	$.ajax({
		type: "POST",
		cache: false,	//try to bypass the cache
		url : url,
		success : function(){
			getPhotos();
			getVideos();
		},
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to add urls for analysis.");
		}
	});
}

/**
 * retrieve list of analyzed photos, or photos submitted for analysis
 */
function getPhotos(){
	$("#photos-div").empty();
	var url = serviceCA + methodGetPhotos + "?" + parameterServiceId + "=7&" + parameterDataGroups + "=" + defaultDataGroups + "&" + parameterUserId + "=" + getUserId(); // limit to url storage and to the currently logged in user
	console.log("Calling: GET "+url);
	$.ajax({
		cache: false,	//try to bypass the cache
		url : url,
		success : mediaListHandler,
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to retrieve analyzed files.");
		}
	});
}

/**
 * retrieve list of analyzed videos, or videos submitted for analysis
 */
function getVideos(){
	$("#videos-div").empty();
	var url = serviceVCA + methodGetVideos + "?" + parameterServiceId + "=7&" + parameterDataGroups + "=" + defaultDataGroups + "&" + parameterUserId + "=" + getUserId(); // limit to url storage and to the currently logged in user
	console.log("Calling: GET "+url);
	$.ajax({
		cache: false,	//try to bypass the cache
		url : url,
		success : mediaListHandler,
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to retrieve analyzed files.");
		}
	});
}

/**
 * process the list of photos or videos
 * @param {DomDocument} data
 */
function mediaListHandler(data){
	var media = data.documentElement.getElementsByTagName("media");
	var videoDiv = $("#videos-div");
	var photoDiv = $("#photos-div");
	for(var i=0; i<media.length; ++i){
		var m = media[i];
		var mediaType = m.getElementsByTagName("mediaType")[0].textContent;
		switch(mediaType){
			case "PHOTO":
				photoDiv.append(createPhotoElement(m));
				break;
			case "VIDEO":
				videoDiv.append(createVideoElement(m));
				break;
			default:
				console.log("Unknown media type ignored: "+mediaType);
				break;
		}
	}
}

/**
 * Function to show analyzed photos
 * @param {Element} photo
 * @return {Element} img element
 */
function createPhotoElement(photo){
	var photoUrl = photo.getElementsByTagName("url")[0].textContent;
	
	var imgElement = document.createElement("div");
	var visualObjects = photo.getElementsByTagName("object");
	var faces = [];
	var keywords = [];
	for(var i=0;i<visualObjects.length;++i){
		var visualObject = visualObjects[i];
		var objectType = visualObject.getElementsByTagName("objectType")[0].textContent;
		switch(objectType){
			case "FACE":
				faces.push(visualObject);
				break;
			case "KEYWORD":
				keywords.push(visualObject);
				break;
			default:
				console.log("Ignored visual object of unsupported type: "+objectType);
				break;
		}
	}
	
	imgElement.mediaTip = ""; // construct the photo tip
	if(faces.length > 0){
		imgElement.mediaTip += "<span class='subTitle'>People</span><br>";
		for(var i=0;i<faces.length;++i){
			var face = $(faces[i]);
			
			imgElement.mediaTip += face.children("value")[0].textContent+" ";
		}
	}	
	if(keywords.length > 0){
		if(imgElement.mediaTip.length > 0){
			imgElement.mediaTip += "<br>";
		}
		imgElement.mediaTip += "<span class='subTitle'>Keyword</span><br>";
		for(var i=0;i<keywords.length;++i){
			var keyword = $(keywords[i]);
			imgElement.mediaTip += keyword.children("value")[0].textContent+" ";
		}
	}
	
	imgElement.className = "preview-img";
	$(imgElement).css("background-image", "url('"+photoUrl+"')");
	$(imgElement).bind("mousemove mouseleave", mediaTipHandler);
	bindSimilaritySearch(photo, imgElement);
	return imgElement;
}

/**
 * Function to show analyzed videos
 * @param {Element} video
 * @return {Element} video dom element
 */
function createVideoElement(video){
	var videoUrl = video.getElementsByTagName("url")[0].textContent;
	
	var videoElement = document.createElement("video");
	videoElement.textContent = "Video is not supported.";
	videoElement.setAttribute('controls', 'controls');
	
	var sourceElement = document.createElement("source");
	sourceElement.setAttribute("src", videoUrl);
	videoElement.appendChild(sourceElement);
	
	var trackElement = document.createElement("track");
	var params = "?file_format=webvtt&subtitle_format=individual&uid="+video.getElementsByTagName("UID")[0].textContent;
	var subtitleUrl = serviceSubs + methodGetSubtitles + params;
	trackElement.setAttribute('src', subtitleUrl);
	trackElement.setAttribute('kind', 'subtitles');
	trackElement.setAttribute('srclang', 'en');
	trackElement.setAttribute('label', 'VisualLabel tags');
	videoElement.appendChild(trackElement);
	
	var visualObjects = video.getElementsByTagName("object");
	var faces = [];
	var keywords = [];
	for(var i=0;i<visualObjects.length;++i){
		var visualObject = visualObjects[i];
		var objectType = visualObject.getElementsByTagName("objectType")[0].textContent;
		var value = visualObject.getElementsByTagName("value")[0].textContent;
		switch(objectType){
			case "FACE":
				if(faces.indexOf(value) < 0){ // only add if not already present
					faces.push(value);
				}
				break;
			case "KEYWORD":
				if(keywords.indexOf(value) < 0){ // only add if not already present
					keywords.push(value);
				}
				break;
			default:
				console.log("Ignored visual object of unsupported type: "+objectType);
				break;
		}
	}
	
	videoElement.mediaTip = ""; // construct the media tip
	if(faces.length > 0){
		videoElement.mediaTip += "<span class='subTitle'>People</span><br>";
		for(var i=0;i<faces.length;++i){
			videoElement.mediaTip += faces[i]+" ";
		}
	}	
	if(keywords.length > 0){
		if(videoElement.mediaTip.length > 0){
			videoElement.mediaTip += "<br>";
		}
		videoElement.mediaTip += "<span class='subTitle'>Keyword</span><br>";
		for(var i=0;i<keywords.length;++i){
			videoElement.mediaTip += keywords[i]+" ";
		}
	}
	
	videoElement.className = "preview-video";
	$(videoElement).bind("mousemove mouseleave", mediaTipHandler);
	bindSimilaritySearch(video, videoElement);
	return videoElement;
}

/**
 * mouse move handler
 * @param {Event} event
 */
function mediaTipHandler(event){
	if(event.target.mediaTip.length < 1){ // no media tip, i.e. it has no valid visual objects
		return;
	}
	
	if(event.type == "mousemove"){
		if(event.timeStamp > tooltipUpdatedTimestamp) {
			tooltipUpdatedTimestamp = event.timeStamp+25;	//wait for 25 milliseconds before doing anything again
		}else{
			return;
		}
	}
	var mediaTip = $("#media-tip");
	switch(event.type){
		case "mousemove":
			mediaTip.css("left", event.pageX-$(window).scrollLeft()+25+"px");
			mediaTip.css("top", event.pageY-$(window).scrollTop()+"px");
						
			mediaTip.html(event.target.mediaTip);
			mediaTip.removeClass("hidden");
			break;
		case "mouseleave":
			mediaTip.addClass("hidden");
			break;
		default:
			break;
	}//switch
}

/**
 * retrieve list of uploaded files
 */
function getFiles(){
	var url = serviceFile + methodGetFiles;
	console.log("Calling: GET "+url);
	$.ajax({
		cache: false,	//try to bypass the cache
		url : url,
		success : fileListHandler,
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to retrieve uploaded files.");
		}
	});
}

function fileListHandler(data){
	var files = data.documentElement.getElementsByTagName("file");
	for(var i=0; i<files.length; ++i){
		var fileUrl = files[i].getElementsByTagName("url")[0].textContent;
		if(fileUrl.indexOf(".webm") >= 0 || fileUrl.indexOf(".mp4") >= 0){	//hacky way to check if there is a video or a image
			showVideoFile(files[i]);
		}else{
			showFile(files[i]);
		}
	}
}

function initFileUploader(){
	holder = document.getElementById('holder');
	tests = {
		  filereader: typeof FileReader != 'undefined',
		  dnd: 'draggable' in document.createElement('span'),
		  formdata: !!window.FormData,
		  progress: "upload" in new XMLHttpRequest
		};
	support = {
		  filereader: document.getElementById('filereader'),
		  formdata: document.getElementById('formdata'),
		  progress: document.getElementById('progress')
		};
	progressBarElement = document.getElementById('uploadprogress');
	fileupload = document.getElementById('upload');
	
	var testApi = ["filereader", "formdata", "progress"];
	for(var i=0; i<testApi.length; ++i){
		var api = testApi[i];
		if (tests[api] === false) {
			$(support[api]).addClass('fail');
		} else {
			$(support[api]).addClass('hidden');
		}
	}
	if (tests.dnd) {	//drag'n'drop style
		holder.ondragover = function () { this.className = 'hover'; return false; };
		holder.ondragleave = function () { this.className = ''; return false; };
		holder.ondragend = function () { this.className = ''; return false; };
		holder.ondrop = function (e) {
			this.className = '';
			e.preventDefault();
			readfiles(e.dataTransfer.files);
		};
	} else {	//fallback on element input type=file
		fileupload.className = 'hidden';
		fileupload.querySelector('input').onchange = function () {
			readfiles(this.files);
		};
	}
}

/**
 * TODO this function cannot not handle large file (e.g. 300MB+ video files) because of excessive CPU usage cause by the FileReader API,
 * proper implementation should use workers to offload the read operation. The use of async filereader is irrelevant for the performance.
 */
function readfiles(files){
	//init variables
	numberOfFilesToSend = files.length;
	numberOfFilesSent = 0;
	$("#files-uploaded").text(numberOfFilesSent);
	for (var i = 0; i < files.length; i++) {
		var file = files[i];//TODO
		if(acceptedTypes[file.type] !== true){
			console.log("unsupported file type ("+file.type+"), aborting...");
			--numberOfFilesToSend;
			continue;
		}else if(file.size > maxFileSize){
			console.log("Ignored too large file of size "+file.size+" (limit: "+maxFileSize+")");
			--numberOfFilesToSend;
			continue;
		}
		$("#progress-div").removeClass("hidden");
		var reader = new FileReader();
		reader.fileName = file.name;
		reader.onload = function(event){ 
			sendFile(event.target.result, this.fileName);
		};
		reader.readAsArrayBuffer(file);
	}
	$("#files-to-upload").text(numberOfFilesToSend);
}

/**
 * TODO the XMLHttpRequest.send() will simply die on large files (300MB+) causing undefined behavior
 */
function sendFile(data, fileName){
	console.log("Sending file: "+fileName);
	// now post a new XHR request
	if (data == null){
		return false;
	}

	var xhr = new XMLHttpRequest();
	var fileNameParam = "?filename="+fileName;
	var queryUrl = serviceFile+methodAddFile+fileNameParam;
	xhr.open('POST', queryUrl, true);
	xhr.onload = function(event) {	//file has been uploaded
		++numberOfFilesSent;
		$("#files-uploaded").text(numberOfFilesSent);
		progressBarElement.value = progressBarElement.innerHTML = 100;
		if(numberOfFilesSent >= numberOfFilesToSend){
			setTimeout(function(){
				$("#progress-div").addClass("hidden");
			}, 5000);
		}
		//add the file to image listing...
		showFile(event.target.responseXML.documentElement.getElementsByTagName("file")[0]);
	};
	xhr.onloadstart = function(){
		console.log("resetting progress bar");
		progressBarElement.value = progressBarElement.innerHTML = 0;
	};
	if (tests.progress) {
		xhr.upload.onprogress = updateProgressBar;
	}	
	xhr.send(data);
	return true;
}

function updateProgressBar(event){
	console.log(event.loaded+" of "+event.total);
	if (event.lengthComputable) {
		var complete = (event.loaded / event.total * 100 | 0);
		progressBarElement.value = progressBarElement.innerHTML = complete;
	}
}

/**
 * Function to show image files
 */
function showFile(imageFile){
	var fileUrl = imageFile.getElementsByTagName("url")[0].textContent;
	
	var imgElement = document.createElement("div");
	imgElement.file = imageFile;
	imgElement.className = "preview-img";
	$(imgElement).css("background-image", "url('"+fileUrl+"')");
	$(imgElement).bind("click", fileSelectionHandler);
	$("#files-div").append(imgElement);
}

/**
 * Function to show video files
 */
function showVideoFile(videoFile){
	var fileUrl = videoFile.getElementsByTagName("url")[0].textContent;
	
	var imgElement = document.createElement("div");
	imgElement.className = "preview-video";
	var videoElement = document.createElement("video");
	videoElement.file = videoFile;
	videoElement.setAttribute("controls", "controls");
	var sourceElement = document.createElement("source");
	sourceElement.setAttribute("src", fileUrl);
	videoElement.appendChild(sourceElement);
	
	imgElement.appendChild(videoElement);
	$(imgElement).bind("click", fileSelectionHandler);
	$("#files-div").append(imgElement);
}

/**
 * mouse click handler
 * @param {Event} event
 */
function fileSelectionHandler(event){
	var target = $(event.target);
	if(target.hasClass("selected-file")){
		var index = selectedFiles.indexOf(event.target.file);
		if (index > -1) {
			selectedFiles.splice(index, 1);
		}
		target.removeClass("selected-file");
	}else{
		selectedFiles.push(event.target.file);
		target.addClass("selected-file");
	}
}
