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

var DEBUG = true;
var contentAnalysis = new ContentAnalysis();
var serviceId = 1;

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

/**
 * 
 * called when html body is loaded
 */
function onBodyLoad() {
	var slideShow = $('#slideshow');
	var content = $('#content');
	uihelper.setDefaultElements(content,$('#edit'),slideShow, $('#toolbar'), $('#metadata'), $('#search'));
	
	uihelper.setSearchElements($('#search-faces'),$('#search-keywords'),$('#search-terms'));
	
	uihelper.setMetadataElements($('#metadata-faces'),$('#metadata-keywords'));
	
	uihelper.setNavigationHelpElements($('#toolbar-text-numbers'),$('#toolbar-text-phrase'),$('#button-previous'),$('#button-next'));
	
	editHandler.setElements($('#edit-faces'),$('#edit-keywords'),$('#editCanvas'),$('#edit-faces-candidates'),$('#edit-keywords-candidates'));
	
	touchhandler.enableScroll(content[0],uihelper.populatePreviousItems,uihelper.populateNextItems,uihelper.upGesture,null);//uihelper.downGesture);	//disabled down gesture on main screen
	
	touchhandler.enableScroll(slideShow[0],uihelper.previousSlideshowItem,uihelper.nextSlideshowItem,uihelper.upGesture,uihelper.downGesture);
	
	touchhandler.enableClick(slideShow[0],uihelper.toggleToolbar,uihelper.populateSimilar);
	
	uibuttons.initializeAutocomplete();	//initialize autocomplete for input fields
	
	contentAnalysis.max_items = uihelper.photoRows * uihelper.photoCols * 6;	// use magic number 6 for load balancing
	
	contentAnalysis.initCA(uihelper.askUserDetails, loginCompleted, uihelper.openErrorDialog);
	//contentAnalysis.login(null,null);
	contentAnalysis.updateUserDetails();
}

/**
 * @param {boolean} success 
 */
function loginCompleted(success){
	if(success){
		showWaitDialog(ContentAnalysis.ContentDataType.PHOTOLIST);
		contentAnalysis.getPhotos(photosLoaded, serviceId);	// user serviceId = 1 = picasa
		uihelper.setUIState(uihelper.State.BROWSE);
		$('#tutorial').delay(2000).fadeIn('slow');		//delay the opening of tutorial overlay a bit
	}else{
		uihelper.openErrorDialog('Login failed', 'Login failed.');
	}
}

/**
 * open wait dialog 
 * 
 * @param {ContentAnalysis.ContentDataType} contentType
 */
function showWaitDialog(contentType){
	if(contentType){
		switch(contentType){
			case ContentAnalysis.ContentDataType.SIMILAR_BY_UID:
			case ContentAnalysis.ContentDataType.SIMILAR_BY_OBJECT:
				uihelper.openWaitDialog('Searching...');
				break;
			default:
				uihelper.openWaitDialog('Loading...');
				break;
		}
	}else{
		uihelper.openWaitDialog('Loading...');
	}
}

/**
 * perform similarity search based on the given uid
 * 
 * @param {String} uid
 */
function similaritySearch(uid) {
	showWaitDialog(ContentAnalysis.ContentDataType.SIMILAR_BY_UID);
	contentAnalysis.searchSimilarByUID(photosLoaded, uid, 0);
}

/**
 * send similarity search feedback consisting of the given array(s) of Photos for the given referencePhoto (target of feedback)
 * 
 * at least one of dissimilarPhotos or similarPhotos must be given
 * 
 * @param {String} referencePhoto
 * @param {Array [String]} dissimilarPhotos optional
 * @param {Array [String]} similarPhotos optional
 */
function similarityFeedback(referencePhoto, dissimilarPhotos, similarPhotos) {
	var feedbackList = contentAnalysis.createFeedbackList(referencePhoto,dissimilarPhotos,similarPhotos);
	contentAnalysis.similarityFeedback(feedbackList);
}

/**
 * perform similarity search based on the given objects
 * 
 * @param {Document} objectList
 */
function objectBasedSearch(objectList) {
	showWaitDialog(ContentAnalysis.ContentDataType.SIMILAR_BY_OBJECT);
	contentAnalysis.searchSimilarByObject(photosLoaded, objectList, 0);
}

/**
 * 
 * populate initial items
 * 
 * @param {Document} xmlResponseDocument
 * @param {Object} requestParams
 */
function photosLoaded(xmlResponseDocument, requestParams){
	debug("main.js::photosLoaded");
	if(contentAnalysis.isValidResponse(xmlResponseDocument)){
		uihelper.populateInitialItems(xmlResponseDocument, requestParams);	
	}
}

/**
 * scroll the page to top
 */ 
function scrollPageToTop(){
	window.scrollTo(0, 0);
	document.body.scrollTop = 0;
}
