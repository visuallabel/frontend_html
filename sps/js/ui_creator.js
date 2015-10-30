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
 * helper for constructing the ui 
 */
var uihelper = {
	
	// enumerations
	State : {
		BROWSE : {},
		SLIDESHOW : {},
		SLIDESHOW_METADATA : {},
		SEARCH : {},
		EDITMODE : {}
	},
	
	imageBuffer : new Array(),

	// variables
	firstIndex : 0,
	lastIndex : -1,
	stepSize : 9,		//initial stepsize, trying to fit 9 photos into the grid
	photoHeight : 200,  //initial height, may change
	photoWidth : 300, 	//initial width, may change
	photoRows : 3,
	photoCols : 3,
	photos : null,	// array
	resultCount : null,	// NOTE: this is != photos.size(), resultCount is the latest estimate given by Frontend for the total photo count
	requestParams : null,	// also contains browseHistory.DataType
	overlayItemOnClickCallback : null,
	currentElement : null,	// clickedElement
	currentImageId : 'currentImage',
	inactivityListener : null,
	currentState : null,
	previousState : null,
	
	// main elements:
	contentElement : null,
	editElement : null,
	searchElement : null,
	slideshowElement : null,
	metadataElement : null,
	toolbarElement : null,
	
	// search elements:
	searchFacesElement : null,
	searchKeywordsElement : null,
	searchTermsElement : null,
	
	// metadata elements:
	metadataFacesElement : null,
	metadataKeywordsElement : null,
	
	// navigation helper elements:
	toolbarTextNumbersElement : null,
	toolbarTextPhraseElement : null,
	previousButton : null,
	nextButton : null,

	// wait dialog timer
	waitTimer : null,
	
	/**
	 * 
	 * populate next items
	 * 
	 */
	populateNextItems : function() {
		if(uihelper.photos === null){
			return false;
		}
		if(!uihelper.imageBufferNextItemsFinishedLoading()){	// check that the next page is ready
			uihelper.openWaitDialog('Loading...');
			window.setTimeout(function(){uihelper.populateNextItems();},2000);	// try again in 2 seconds
			return false;
		}
		uihelper.closeWaitDialog();	// close wait dialog if one happens to be open
		
		var ret = true;
		if(++uihelper.lastIndex >= uihelper.photos.length){	// last photo
			debug('UIHelper: populateNextItems: last item reached.');
			ret = false;
		}else{		
			if(uihelper.lastIndex >= 0){
				uihelper.firstIndex = uihelper.lastIndex;
			}else{
				uihelper.firstIndex = 0;
			}
			var nodes = new Array();
			for (var i=0; uihelper.lastIndex < uihelper.photos.length && i < uihelper.stepSize; ++i) {
				nodes[i] = uihelper.photos[uihelper.lastIndex];
				++uihelper.lastIndex;
			}		
			
			uihelper.populateItems(uihelper.contentElement, nodes);
			
			//fetch a new set of results
			if(uihelper.lastIndex >= uihelper.photos.length-uihelper.stepSize*2){
				switch(uihelper.requestParams.contentDataType){
					case ContentAnalysis.ContentDataType.SIMILAR_BY_UID:
						//TODO when paging has been fixed in some way for Frontend<->backend access, restore the lines below
						debug('uihelper.populateNextItems: paging disabled for similarity search by uid.');
						//if(!contentAnalysis.searchSimilarByUIDInProgress)
							//contentAnalysis.searchSimilarByUID(uihelper.appendNextItems, uihelper.requestParams.uid, uihelper.lastIndex+uihelper.stepSize*2);
						break;
					case ContentAnalysis.ContentDataType.PHOTOLIST:
						if(!contentAnalysis.getPhotosInProgress)
							//TODO note that the serviceId variable is read from main.js
							contentAnalysis.getPhotos(uihelper.appendNextItems, serviceId, uihelper.lastIndex+uihelper.stepSize*2);	// user serviceId = 3 = picasa, use magic number 4 for pre-loading pages
						break;
					case ContentAnalysis.ContentDataType.SIMILAR_BY_OBJECT:
						if(!contentAnalysis.searchSimilarByObjectInProgress)
							contentAnalysis.searchSimilarByObject(uihelper.appendNextItems, uihelper.requestParams.objectList, uihelper.lastIndex+uihelper.stepSize*2);
						break;
					default:
						debug('uihelper.populateNextItem: unknown data type.');				
						break;
				}	// switch
				ret = true;
			}
		}
		--uihelper.lastIndex;
		return ret;
	},
	
	/**
	 * 
	 * populate previous items
	 * 
	 */
	populatePreviousItems : function() {
		if(uihelper.firstIndex < 1){	// on the first photo page
			debug('UIHelper: populatePreviousItems: on the first page.');
			return false;
		}else{
			uihelper.lastIndex = uihelper.firstIndex-1;
			var start = uihelper.firstIndex - uihelper.stepSize;
			if(start < 0){
				uihelper.firstIndex = 0;
			}else{
				uihelper.firstIndex = start;
			}
			var nodes = new Array();
			for(var i = uihelper.firstIndex, j=0; i < uihelper.lastIndex+1; ++i, ++j){
				nodes[j] = uihelper.photos[i];
			}
			uihelper.populateItems(uihelper.contentElement, nodes);	
		}
		return true;
	},
	
	/**
	 * 
	 */
	upGesture : function() {
		if(uihelper.currentState === uihelper.State.SEARCH || uihelper.currentState === uihelper.State.SLIDESHOW_METADATA)
			uihelper.setUIState(uihelper.previousState);
	},
	
	/**
	 * 
	 */
	downGesture : function() {
		if(uihelper.currentState === uihelper.State.SLIDESHOW){
			uihelper.setUIState(uihelper.State.SLIDESHOW_METADATA);
		}else if(uihelper.currentState === uihelper.State.BROWSE || uihelper.currentState === uihelper.State.SLIDESHOW_METADATA){
			uibuttons.search();
		}
	},

	/**
	 * 
	 * populate initial items
	 * 
 	 * @param {Document} xml
 	 * @param {Object} requestParams
	 */
	populateInitialItems : function(xml, requestParams) {	
		browseHistory.storeBrowseState(uihelper.photos, uihelper.firstIndex, uihelper.lastIndex, uihelper.requestParams, uihelper.resultCount);
		uihelper.photos = null;
		uihelper.firstIndex = 0;
		uihelper.lastIndex = -1;
		uihelper.requestParams = requestParams;
		uihelper.resultCount = null;
		
		var photoList = xml.getElementsByTagName('mediaList')[0];
		if(photoList){		
			var resultCountNodes = $(photoList).children().siblings("resultInfo");	//get the immeadiate children "resultInfo" from photoList (to determine amount of images)
			if(resultCountNodes.length > 0 && resultCountNodes[0].firstChild){
				resultCountNodes = resultCountNodes[0].getElementsByTagName('resultCount');
				if(resultCountNodes.length > 0){
					uihelper.resultCount = resultCountNodes[0].textContent;
				}
			}
			uihelper.photos = Array.prototype.slice.call(photoList.getElementsByTagName('media'));
			
			var photoCount = uihelper.photos.length;
			debug('UIHelper: populate initial items: '+photoCount+' photos.');
			var nodes = new Array();
			for (var i=0; i<uihelper.photos.length; ++i) {
				if(i < uihelper.stepSize){	// only add the stepSize amount of photos for population
					nodes[i] = uihelper.photos[i];
					++uihelper.lastIndex;	// starts from -1, so we can ++ here
				}
				uihelper.addToImageBuffer(uihelper.photos[i]);
			}
			
			
			uihelper.initialItemsLoaded(nodes); // to block until initial items have finished loading
		}else{
			debug('UIHelper: populate initial items: no photos.');
			uihelper.closeWaitDialog();
			uihelper.populateItems(uihelper.contentElement, null);	
		}		
	},
	
	/**
	 * helper function for populate initial items, do not call outside populateInitialItem()
	 * 
	 * @param {Array [Element]} nodes the list of nodes to be populated
	 */
	initialItemsLoaded : function(nodes){
		if(!uihelper.imageBufferNextItemsFinishedLoading()){	// check that the next page is ready
			window.setTimeout(function(){uihelper.initialItemsLoaded(nodes);},2000);	// try again in 2 seconds
			return;
		}

		uihelper.closeWaitDialog();		

		uihelper.populateItems(uihelper.contentElement, nodes);	
	},
	
	/**
	 * 
	 * populate initial items
	 * 
 	 * @param {Object} state (from browseHistory, must be valid - is not checked for validity)
	 */
	populateInitialItemsByState : function(state) {	
		uihelper.photos = state.photoList;
		uihelper.firstIndex = state.firstIndex;
		uihelper.lastIndex = state.lastIndex;
		uihelper.requestParams = state.requestParams;
		uihelper.resultCount = state.resultCount;
		
		var nodes = new Array();
		for(var i=state.firstIndex;i<=state.lastIndex;++i){
			nodes.push(uihelper.photos[i]);
		}
		
		uihelper.populateItems(uihelper.contentElement, nodes);
	},
	
	/**
	 * returns the index of the currentElement, or 0 no currentElement or not found.
	 * Note, this is NOT the uihelper.photos[index], but index+1
	 */
	findPhotoIndex : function(){
		var currentIndex = 0;
		if(uihelper.photos && uihelper.currentElement){
			for(var i=uihelper.firstIndex;i<uihelper.photos.length;++i){	// should be between firstIndex and lastIndex
				if(uihelper.photos[i].getElementsByTagName('UID')[0].textContent == uihelper.currentElement.getAttribute('uid')){
					currentIndex = i+1;
					break;
				}
			}
		}
		return currentIndex;
	},
	
	/**
	 * set the "method" text to toolbar based on the current state 
	 */
	setToolbarText : function(){
		var toolbarTextNumbers = '';
		var toolbarTextPhrase = '';
		if(uihelper.photos){
			var state = uihelper.currentState;
			if(state == uihelper.State.SEARCH){	// if search is open, use whatever mode was the previous mode (open "under" search)
				state = uihelper.previousState;
			}
			switch(state){
				case uihelper.State.EDITMODE:	
					editHandler.setEditToolbarText();
					return;	// handled by editHandler
				case uihelper.State.SLIDESHOW_METADATA:
				case uihelper.State.SLIDESHOW:
					toolbarTextNumbers = uihelper.findPhotoIndex();
					if(toolbarTextNumbers > 1){	// not the first one
						uihelper.previousButton.removeClass('arrowDisabled');
					}else{
						uihelper.previousButton.addClass('arrowDisabled');
					}
					
					if(toolbarTextNumbers < uihelper.photos.length){	// not the last one
						uihelper.nextButton.removeClass('arrowDisabled');
					}else{
						uihelper.nextButton.addClass('arrowDisabled');
					}
					
					if(uihelper.requestParams && uihelper.requestParams.contentDataType == ContentAnalysis.ContentDataType.SIMILAR_BY_UID){
						toolbarTextNumbers = '';
					}
					break;
				default: // uihelper.State.BROWSE
					var realLast = uihelper.firstIndex+uihelper.stepSize;	// note: uihelper.lastIndex is not guaranteed to be correct here!
					if(realLast > uihelper.photos.length){
						realLast = uihelper.photos.length;
					}
					if(uihelper.photos.length > uihelper.stepSize){//TODO
						var realFirst = (uihelper.firstIndex+1);
						if(realFirst == realLast){
							toolbarTextNumbers = '1';
						}else{
							toolbarTextNumbers = (uihelper.firstIndex+1)+' - '+realLast;
						}
					}
					// disable/enable arrows when needed
					if(uihelper.firstIndex > 0){
						uihelper.previousButton.removeClass('arrowDisabled');
					}else{
						uihelper.previousButton.addClass('arrowDisabled');
					}
					if(realLast < uihelper.photos.length){
						uihelper.nextButton.removeClass('arrowDisabled');
					}else{
						uihelper.nextButton.addClass('arrowDisabled');
					}
					break;	// default
			}	// switch
			
			if(uihelper.requestParams && uihelper.currentState != uihelper.State.EDITMODE){	// if we can figure out what method was used and we are not in edit mode
				var realResultCount = uihelper.resultCount; // try to use the Frontend's approximation first
				if(realResultCount === null){	
					realResultCount = uihelper.photos.length; // if no resultInfo available, use the current number of loaded images
				}
				if(realResultCount){
					if((new String(toolbarTextNumbers)).length > 0){	// add "of" if the X-Y count is present, use String() to force javascript to understand that yes, String is really of type String
						toolbarTextNumbers += ' of ';
					}
					if(uihelper.requestParams.contentDataType == ContentAnalysis.ContentDataType.SIMILAR_BY_UID){
						realResultCount--;	// there is always one too many (the first is the one used for the search)
					}
					toolbarTextNumbers += realResultCount.toString();
				}
				switch(uihelper.requestParams.contentDataType){
					case ContentAnalysis.ContentDataType.SIMILAR_BY_UID:
						toolbarTextPhrase = 'similar photos';
						break;
					case ContentAnalysis.ContentDataType.SIMILAR_BY_OBJECT:
						if(typeof uihelper.requestParams.searchCache == 'undefined'){ // save the string so it does not have to be re-constructed each time page is changed
							var values = uihelper.requestParams.objectList.getElementsByTagName('value');
							uihelper.requestParams.searchCache = values[0].textContent;
							var addedValues = new Array();
							addedValues.push(values[0].textContent);
							for(var i=1;i<values.length;++i){
								if(values[i].parentNode.nodeName == 'object' && $.inArray(values[i].textContent, addedValues) == -1){	// shape element can also have value, ignore those
									uihelper.requestParams.searchCache += ', '+values[i].textContent;
									addedValues.push(values[i].textContent);
								}
							}
						}
						toolbarTextPhrase = 'search results for '+uihelper.requestParams.searchCache;			
						break;
					case ContentAnalysis.ContentDataType.PHOTOLIST:	// only Y-Z of X required
						break;
				}	// switch
			}	// if
		}else{
			uihelper.previousButton.addClass('arrowDisabled');
			uihelper.nextButton.addClass('arrowDisabled');
		}
		
		uihelper.toolbarTextNumbersElement[0].textContent = toolbarTextNumbers;
		uihelper.toolbarTextPhraseElement[0].textContent = toolbarTextPhrase;
	},
	
	/**
	 *
	 * add the image designated by the given node to the picture buffer, returns the newly created image
	 *
	 * duplicates will not be added (images with identical url)
	 * 
	 * @param {Element} node
	 */
	addToImageBuffer : function(node){
		var url = node.getElementsByTagName('url')[0].textContent;
		for(var i=0;i<uihelper.imageBuffer.length;++i){
			if(uihelper.imageBuffer[i].src === url){
				return uihelper.imageBuffer[i];
			}
		}
		var image = new Image();
		image.loaded = false;
		//handler to determine the when the image has been loaded
		$(image).load(function(eventObject){
			eventObject.target.loaded = true;
		}).error(function(eventObject){
			debug('uihelper.addToImageBuffer: failed to load image: '+eventObject.target.src);
			eventObject.target.loaded = true;
			eventObject.target.src = 'images/ic_edit_remove_default.png';	//TODO replace with proper error image, that is actually of the correct size and all
		}).attr('src', url);
		uihelper.imageBuffer.push(image);
		return image;
	},
	
	/**
	 * returns true if all images for next page have finished loading
	 * 
	 */
	imageBufferNextItemsFinishedLoading : function(){
		var nodes = new Array();
		var lastIndex = uihelper.lastIndex+1;
		for (var i=0; lastIndex < uihelper.photos.length && i < uihelper.stepSize; ++i) {
			nodes[i] = uihelper.photos[lastIndex];
			++lastIndex;
		}
		
		var nodeCount = nodes.length;
		for(var i=uihelper.imageBuffer.length-1;i>=0 && nodeCount > 0;--i){	// it is more likely that this image is at the end of the buffer
			for(var j=0;j<nodes.length;++j){
				if(nodes[j].getElementsByTagName('url')[0].textContent == uihelper.imageBuffer[i].src){
					if(uihelper.imageBuffer[i].loaded === false){
						return false;
					}
					--nodeCount;	// to prevent browsing through too unnecessary nodes
				}
			}
		}
		return true;
	},
	
	/**
	 *
	 * retrieve the image from the buffer, if no such image exists, a new image will be created (and appended to the buffer) and returned
	 * 
	 * @param {Element} node
	 */
	retriveFromImageBuffer : function(node){
		return uihelper.addToImageBuffer(node);	// this will return the old one if such exists or create and append new one
	},
	
	/**
	 * 
	 * populate next items
	 * 
 	 * @param {Document} xml
	 */
	appendNextItems : function(xml){
		var photoList = xml.getElementsByTagName('mediaList')[0];
		if(photoList){
			var nl = photoList.getElementsByTagName('media');
			for(var i=0; i<nl.length; ++i){
				uihelper.photos.push(nl[i]);
				uihelper.addToImageBuffer(nl[i]);
			}
		}
	},
	
	/**
	 * 
	 * populate the given element with the given  nodes
	 * 
 	 * @param {JQuery Object} element
 	 * @param {Array[Element]} xmlNodes
	 */
	populateItems : function(element, xmlNodes) {
		debug('UIHelper: populate items');
		element.empty();
		var nodeCount = 0;
		var fragment = document.createDocumentFragment();
		if(xmlNodes){
			element.removeClass('no-results');
			this.calculateOptimalPhotoSize();
			
			nodeCount = xmlNodes.length;
			for (var i=0; i < nodeCount; ++i) {
				var node = uihelper.createItem(xmlNodes[i]);
				$(node).css({'width':this.photoWidth+'px', 'height':this.photoHeight+'px'});	//set geometry of the browseItem class
				fragment.appendChild(node);
			}
		}else{	// no photos
			element.addClass('no-results');
		}
		
		for(var i=0;i<uihelper.photoRows*uihelper.photoCols-nodeCount;++i){	// fill the element with empty divs to force correct alignment of items
			var div = document.createElement('div');
			div.className = 'browseItem';
			div.onclick = uibuttons.searchBack;
			$(div).css({'width':this.photoWidth+'px', 'height':this.photoHeight+'px'});	//set geometry of the browseItem class
			fragment.appendChild(div);
		}

		element.append(fragment);
		if(browseHistory.history.length > 0){
			this.toolbarElement.removeClass('toolbar-no-back');
		}else{
			this.toolbarElement.addClass('toolbar-no-back');
		}

		uihelper.setToolbarText();
	},
	
	/**
	 * 
	 * set search elements and initializes the drag'n drop lists, the "face elements" are assumed to contain searchFaceTerms class
	 * and "keyword elements" are assumed to contain searchKeywordTerms class
	 * 
 	 * @param {JQuery Object} searchFacesElement
 	 * @param {JQuery Object} searchKeywordsElement
 	 * @param {JQuery Object} searchTermsElement
	 */
	setSearchElements : function(searchFacesElement, searchKeywordsElement, searchTermsElement) {
		uihelper.searchFacesElement = searchFacesElement;
		uihelper.searchKeywordsElement = searchKeywordsElement;
		uihelper.searchTermsElement = searchTermsElement;
	},
	
	/**
	 * set metadata elements
	 * 
	 * @param {JQuery Object} metadataFacesElement
	 * @param {JQuery Object} metadataKeywordsElement
	 */
	setMetadataElements : function(metadataFacesElement, metadataKeywordsElement) {
		uihelper.metadataFacesElement = metadataFacesElement;
		uihelper.metadataKeywordsElement = metadataKeywordsElement;
	},
	
	/**
	 * 
	 * set default elements and initialize callbacks
	 * 
 	 * @param {JQuery Object} contentElement
 	 * @param {JQuery Object} editElement
 	 * @param {JQuery Object} slideshowElement
	 * @param {JQuery Object} toolbarElement
	 * @param {JQuery Object} metadataElement
	 * @param {JQuery Object} searchElement
	 */
	setDefaultElements : function(contentElement, editElement, slideshowElement, toolbarElement, metadataElement, searchElement){
		uihelper.contentElement = contentElement;
		uihelper.editElement = editElement;
		uihelper.slideshowElement = slideshowElement;
		uihelper.toolbarElement = toolbarElement;
		uihelper.metadataElement = metadataElement;
		uihelper.searchElement = searchElement;
		uihelper.overlayItemOnClickCallback = touchhandler.overlayItemClicked;		
	},
	
	/**
	 * @param {JQuery Object} toolbarTextNumbersElement
	 * @param {JQuery Object} toolbarTextPhraseElement
	 * @param {JQuery Object} previousButton
	 * @param {JQuery Object} nextButton 
	 */
	setNavigationHelpElements : function(toolbarTextNumbersElement, toolbarTextPhraseElement, previousButton, nextButton){
		uihelper.toolbarTextNumbersElement = toolbarTextNumbersElement;
		uihelper.toolbarTextPhraseElement = toolbarTextPhraseElement;
		uihelper.previousButton = previousButton;
		uihelper.nextButton = nextButton;
		//calculate somewhat optimal amount and size of photos
		this.calculateOptimalPhotoSize();
	},
	
	/**
	 * function to figure out photosize
	 */
	calculateOptimalPhotoSize : function(){	
		var padding = 10;
		var toolbarHeight = uihelper.toolbarElement.innerHeight();
		var w = $(window);
		var contentHeight = w.height() - toolbarHeight;
		var contentWidth = w.width() - $('#left-arrow').width() - $('#right-arrow').width();
		
		this.photoHeight = Math.floor(contentHeight / this.photoRows) - padding/2;
		this.photoWidth = Math.floor((contentWidth) / this.photoCols) - padding;
		
		//update step size
		this.stepSize = this.photoRows * this.photoCols;
	},
	
	/**
	 * 
	 * Create and return new html element based on the given item
	 * 
 	 * @param {Element} xmlitem
	 */
	createItem : function(xmlitem) {
		var url = xmlitem.getElementsByTagName('url')[0].textContent;
		var item = document.createElement("div");
		var image = uihelper.retriveFromImageBuffer(xmlitem);
		item.className = 'browseItem';
		item.setAttribute("url", image.src);
		item.setAttribute("uid",xmlitem.getElementsByTagName('UID')[0].textContent);
		$(item).css('background-image', 'url('+image.src+')');
		
		if(xmlitem.getElementsByTagName('description').length > 0){
			$(item).append("<span class='tooltip'>"+xmlitem.getElementsByTagName('description')[0].textContent+"</span>");
		}
		
		if(uihelper.requestParams.contentDataType === ContentAnalysis.ContentDataType.SIMILAR_BY_UID){
			if(uihelper.photos[0] == xmlitem){
				$(item).addClass("highlighted-outline");
			}else{
				var btn_up = document.createElement("button");
				btn_up.className = "button thumbsUp";
				btn_up.type = "button";
				btn_up.onclick = uibuttons.positiveFeedbackClicked;
				var btn_down = document.createElement("button");
				btn_down.className = "button thumbsDown";
				btn_down.type = "button";
				btn_down.onclick = uibuttons.negativeFeedbackClicked;
				item.appendChild(btn_down);
				item.appendChild(btn_up);
			}
		}
		
		item.onclick = uihelper.overlayItemOnClickCallback;
		touchhandler.enableClick(item, uihelper.populateSlideShow, uihelper.populateSimilar);
		return item;
	},
	
	/**
	 * 
	 * Create and return new html element based on the given item
	 * 
 	 * @param {String} uid
 	 * @param {Boolean} positive if positive feedback (ie. similar photos), if false then assumed to be nonsimilar photo (negative feedback)
	 */
	sendSimilarityFeedback : function(uid, positive){
		var array = new Array();
		for(var i=0;i<uihelper.photos.length;++i){
			if(uihelper.photos[i].getElementsByTagName('UID')[0].textContent === uid){
				array.push(uihelper.photos[i]);
				break;
			}
		}
		if(positive){
			similarityFeedback(uihelper.photos[0], null, array);
		}else{
			similarityFeedback(uihelper.photos[0], array, null);
		}
	},
	
	/**
	 * 
	 * initialize the image list with photos similar to the clicked element
	 * 
	 * @param {HTMLElement} clickedElement
	 * 
	 */
	populateSimilar : function(clickedElement) {
		similaritySearch(clickedElement.getAttribute('uid'));
		uihelper.setUIState(uihelper.State.BROWSE);
	},
	
	/**
	 * 
	 */
	clearMetadata : function(){
		uihelper.metadataFacesElement.empty();
		uihelper.metadataKeywordsElement.empty();
	},
	
	/**
	 * callback for populating metadata panel 
	 * 
	 * @param {Document} data
	 */
	populateMetadata : function(data) {
		uihelper.clearMetadata();
		
		if(typeof data == 'undefined'){
			return;
		}		
		var objectList = data.getElementsByTagName('object');
		var liElements = [];
		for(var i=0;i<objectList.length;++i){
			var value = null; // may be overwritten by name parameter
			var objectType = null;
			var status = null;
			var childNodes = objectList[i].childNodes;
			var confidence = null;
			var realValue = null; // the real, original value
			var rank = null;
			var backendId = null;
			var serviceType = null;
			for(var j=0;j<childNodes.length;++j){
				var nodeName = childNodes[j].nodeName;
				if(nodeName == 'status'){	
					status = childNodes[j].textContent;		
				}else if(nodeName == 'objectType'){
					objectType = childNodes[j].textContent;
				}else if(nodeName == 'value'){
					realValue = childNodes[j].textContent;
					if(value == null){	// may have been set previously by name element
						value = realValue;
					}
				}else if(nodeName == 'confidence'){
					confidence = childNodes[j].textContent;
				}else if(nodeName == 'name'){	// always use name if available
					value = childNodes[j].textContent;
				}else if(nodeName == 'rank'){
					rank = childNodes[j].textContent;
				}else if(nodeName == 'backendId'){
					backendId = childNodes[j].textContent;
				}else if(nodeName == 'serviceId'){
					serviceType = childNodes[j].textContent;
				}
			}	// for object's children
			if(status == 'USER_REJECTED'){
				debug('uihelper.populateMetadata: ignored object with status USER_REJECTED');
				continue;
			}
			if(objectType == null || (objectType != 'KEYWORD' && objectType != 'FACE')){
				debug('uihelper.populateMetadata: missing or unsupported objectType.');
				continue;
			}
			if(value == null){
				value = "unknown";
			}
			var li = document.createElement('li');
			li.setAttribute('status', status);
			li.setAttribute('objectType', objectType);
			li.setAttribute('realValue', realValue);
			li.setAttribute('confidence', confidence);
			li.setAttribute('rank', rank);
			li.setAttribute('backendId', backendId);
			li.setAttribute('serviceType', serviceType);
			var tagClass = backendIdLookup(backendId, serviceType);	//set correct class name for a given backendId and serviceType
			li.className = tagClass;
			var commaIndex = value.indexOf(',');
			var trimmedValue = commaIndex > 0 ? value.substring(0, commaIndex) : value;
			li.appendChild(document.createTextNode(trimmedValue));
			liElements.push(li);
		}
		
		liElements.sort(function(a, b){
				var aRank = Number(a.getAttribute('rank'));
				var bRank = Number(b.getAttribute('rank'));
				if(aRank == bRank){
					var aVal = Number(a.getAttribute('confidence'));
					var bVal = Number(b.getAttribute('confidence'));
					if(aVal > bVal){
						return -1;
					}else if(aVal < bVal){
						return 1;
					}else{
						return 0;
					}
				}else if(aRank > bRank){
					return 1;
				}else{
					return -1;
				}
			});
		var buttonArray = [];
		for(var i=0; i<liElements.length; ++i){
			var liElement = liElements[i];
			switch(liElement.getAttribute('objectType')){
				case 'FACE':
					liElement.className = "";	//override the class name of FACE tag
					uihelper.metadataFacesElement.append(liElement);
					break;
				case 'KEYWORD':
				case 'OBJECT':
				default:
					uihelper.metadataKeywordsElement.append(liElement);
					if(buttonArray.indexOf(liElement.className) == -1){
						buttonArray.push(liElement.className);
					}
					break;
			}	// switch
		}
		$("#metadata-tag-selector").empty();
		for(var i=0; i<buttonArray.length; ++i){	//add some buttons
			var tagSelectorButton = document.createElement("button");
			tagSelectorButton.className = "button "+buttonArray[i];
			tagSelectorButton.classToggler = "NO_"+buttonArray[i];
			tagSelectorButton.textContent = buttonArray[i];
			tagSelectorButton.onclick = function(e){
					$("#metadata-keywords").toggleClass(e.target.classToggler);
				}
			$("#metadata-tag-selector").append(tagSelectorButton);
		}
	},
	
	/**
	 * helper for populating keywords and faces based on the passed object  list 
	 * 
	 * @param {NodeList} objectList
	 * @param {JQuery Object} keywordsElement
	 * @param {JQuery Object} facesElement
	 */
	populateKeywordsFacesHelper : function(objectList, keywordsElement, facesElement) {
		var duplicates = new Array();
		for(var i=0;i<objectList.length;++i){
			var value = null; // may be overwritten by name parameter
			var objectType = null;
			var stat = null;
			var childNodes = objectList[i].childNodes;
			var confidence = null;
			var realValue = null; // the real, original value
			for(var j=0;j<childNodes.length;++j){
				var nodeName = childNodes[j].nodeName;
				if(nodeName == 'status'){	
					stat = childNodes[j].textContent;		
				}else if(nodeName == 'objectType'){
					objectType = childNodes[j].textContent;
				}else if(nodeName == 'value'){
					realValue = childNodes[j].textContent;
					if(value == null){	// may have been set previously by name element
						value = realValue;
					}
				}else if(nodeName == 'confidence'){
					confidence = childNodes[j].textContent;
				}else if(nodeName == 'name'){	// always use name if available
					value = childNodes[j].textContent;
				}
			}	// for object's children
			
			if(objectType == null || value == null){
				debug('uihelper.populateKeywordsFacesHelper: objectType or value missing.');
				continue;
			}
			
			switch(stat){
				case 'USER_CONFIRMED': 	// allow user confirmed
					duplicates.push(value.toLowerCase());	// to prevent duplicates of confirmed to appear "as candidates"
					break;
				case 'NO_FRIENDLY_KEYWORD': //TODO remove to disable keywords without friendly values
				case 'CANDIDATE':// only allow CANDIDATEs with high enough confidence				
					if(objectType == 'KEYWORD'){
						if(confidence === null || new Number(confidence) < editHandler.userConfirmedConfidenceThreshold){
							objectType = null;	// set to null and break to cause this object to be ignored in the following if
						}else{	// check for duplicates
							var lowerValue = value.toLowerCase();
							if(duplicates.indexOf(lowerValue) >= 0){	// ignore duplicates
								debug('uihelper.populateKeywordsFacesHelper: ignored duplicate value: '+value);
								objectType = null;	// set to null and break to cause this object to be ignored in the following if
							}else{
								duplicates.push(lowerValue);
							}
						}	// else
					}	// if keyword
					break;
				default:	// discard USER_REJECTED, etc
					objectType = null;	// set to null and break to cause this object to be ignored in the following if
					break;
			}	
			
			if(objectType){
				var li = document.createElement('li');
				li.setAttribute('status',stat);
				li.setAttribute('objectType',objectType);
				li.setAttribute('realValue', realValue);
				var button = document.createElement('button');
				button.onclick = function(e){uihelper.moveSearchTerm(e.target.parentNode);};
				button.className = 'searchAddButton button';
				button.appendChild(document.createTextNode(value));
				li.appendChild(button);
				uihelper.appendSortedSearchLiElement(li, keywordsElement, facesElement);
			}
		}	// for
	},
	
	/**
	 *
	 * NOTE: if the passed li has objectType of OBJECT, it can only be appended to search term list 
	 * (where it will be appended, regardless of passed elements)  
	 *
	 * @param {HtmlLiElement} li must have objectType attribute and button child with textContent 
	 * @param {JQuery Object} keywordsElement
	 * @param {JQuery Object} facesElement
	 */
	appendSortedSearchLiElement : function(li, keywordsElement, facesElement){
		var found = false;
		var value = li.getElementsByTagName('button')[0].textContent;
		var targetElement = null;
		switch(li.getAttribute('objectType')){
			case 'KEYWORD':							
				targetElement = keywordsElement[0];
				break;
			case 'FACE':
				targetElement = facesElement[0];
				break;
			case 'OBJECT':
				targetElement = uihelper.searchTermsElement[0];
				break;
			default:
				debug('uihelper.appendSortedSearchLiElement: unknown objectType: '+li.getAttribute('objectType'));
				return;
		}	// switch
		if(targetElement.firstChild){
			for(var k=0;k<targetElement.childNodes.length;++k){
				if(targetElement.childNodes[k].firstChild.textContent > value){
					targetElement.insertBefore(li,targetElement.childNodes[k]);
					found = true;
					break;
				}
			}	// for
		}
		if(!found){
			targetElement.appendChild(li);	
		}
	},
	
	/**
	 *
	 *  moves the given li element to search term list or to keyword/face term if located on term list
	 *  
	 *
	 * @param {HtmlLiElement} li 
	 */
	moveSearchTerm : function(li){
		switch(li.getAttribute('objectType')){
			case 'KEYWORD':
				if(li.parentNode == uihelper.searchKeywordsElement[0]){
					li.parentNode.removeChild(li);
					uihelper.appendSortedSearchLiElement(li, uihelper.searchTermsElement, null);
					$('button', li).removeClass('searchAddButton');
					$('button', li).addClass('searchRemoveButton');
				}else{
					li.parentNode.removeChild(li);
					uihelper.appendSortedSearchLiElement(li, uihelper.searchKeywordsElement, null);
					$('button', li).addClass('searchAddButton');
					$('button', li).removeClass('searchRemoveButton');
				}
				break;
			case 'FACE':
				if(li.parentNode == uihelper.searchFacesElement[0]){
					li.parentNode.removeChild(li);			
					uihelper.appendSortedSearchLiElement(li, null, uihelper.searchTermsElement);
					$('button', li).removeClass('searchAddButton');
					$('button', li).addClass('searchRemoveButton');
				}else{
					li.parentNode.removeChild(li);		
					uihelper.appendSortedSearchLiElement(li, null, uihelper.searchFacesElement);
					$('button', li).addClass('searchAddButton');
					$('button', li).removeClass('searchRemoveButton');
				}
				break;
			default:	// CASE 'OBJECT'
				li.parentNode.removeChild(li);	// just remove it
				break;
		}
	},
	
	/**
	 * 
	 */
	clearSearch : function() {
		uihelper.searchFacesElement.empty();
		uihelper.searchKeywordsElement.empty();
		uihelper.searchTermsElement.empty();
		document.getElementById('keyword-edit').value = '';
		
		//initialize search overlay's input fields by removing any old keyup listeners and add a keyup listener
		$("#keyword-edit").off('keyup');
		$("#keyword-edit").on('keyup', { target: "#btn-main-search", action: "click"}, uibuttons.enterChecker);
		$("#add-search-term-edit").off('keyup');
		$("#add-search-term-edit").on('keyup', { target: "#btn-tag-search", action: "click"}, uibuttons.enterChecker);
	},
	
	/**
	 * callback for populating search panel 
	 * 
	 * @param {Document} data photo details xml document or null if none available
	 */
	populateSearch : function(data) {
		if(data === null){
			uihelper.clearSearch();
		}else{
			if(uihelper.currentElement && uihelper.currentElement.getAttribute('uid') == data.getElementsByTagName('UID')[0].textContent){	// the results are async so check that this is for the current one
				uihelper.clearSearch();
				uihelper.populateKeywordsFacesHelper(data.getElementsByTagName('object'), uihelper.searchKeywordsElement, uihelper.searchFacesElement);
			}else{
				return;	// do nothing if this reply is for an old request
			}
		}
		
		var divs = uihelper.searchElement[0].getElementsByTagName('div');
		if(uihelper.previousState == uihelper.State.BROWSE || uihelper.currentState == uihelper.State.BROWSE){
			for(var i=0;i<divs.length;++i){
				var div = $(divs[i]);
				if(div.hasClass('hide-if-empty')){
					div.addClass('hidden');
				}
			}
		}else{
			for(var i=0;i<divs.length;++i){
				var div = $(divs[i]);
				if(div.hasClass('hide-if-empty')){
					div.removeClass('hidden');
				}	// if
			}	// for
		}	// else
	},
	
	/**
	 * 
	 * populate the slideshow based on the same clickedElement
	 * 
	 * @param {HTMLElement} clickedElement
	 * 
	 */
	populateSlideShow : function(clickedElement) {
		if(uihelper.currentState == uihelper.State.SEARCH && uihelper.previousState == uihelper.State.BROWSE){	//hack to close search overlay
			uibuttons.back();
		}else{
			uibuttons.backCallback = uibuttons.slideshowBack;
			uihelper.currentElement = clickedElement;
			
			var url = clickedElement.getAttribute('url');
			uihelper.slideshowElement[0].setAttribute("uid",clickedElement.getAttribute('uid'));
			uihelper.slideshowElement.css('background-image', 'url('+url+')');
			uihelper.setUIState(uihelper.State.SLIDESHOW);
		}
	},
	
	/**
	 * show next slide show item if available
	 */
	nextSlideshowItem : function() {
		if(uihelper.currentElement){
			var next = uihelper.currentElement.nextSibling;
			var populated = false;
			if(next && next.getAttribute('uid')){
				uihelper.populateSlideShow(next);
				populated = true;
			}else if(uihelper.populateNextItems()){
				uihelper.populateSlideShow(uihelper.contentElement[0].firstChild);
				populated = true;
			}
			
			if(populated && uihelper.previousState == uihelper.State.SEARCH){
				uibuttons.search();
			}else if(populated && uihelper.previousState == uihelper.State.SLIDESHOW_METADATA){
				uibuttons.details();
			}
		}
	},
	
	/**
	 * show previous slide show item if available
	 */
	previousSlideshowItem : function() {
		if(uihelper.currentElement){
			var previous = uihelper.currentElement.previousSibling;
			var populated = false;
			if(previous){
				uihelper.populateSlideShow(previous);
				populated = true;
			}else if(uihelper.populatePreviousItems()){
				uihelper.populateSlideShow(uihelper.contentElement[0].lastChild);
				populated = true;
			}
			
			if(populated && uihelper.previousState == uihelper.State.SEARCH){
				uibuttons.search();
			}else if(populated && uihelper.previousState == uihelper.State.SLIDESHOW_METADATA){
				uibuttons.details();
			}
		}
	},

	/**
	 * can be used to change the UI state
	 * 
	 * @param {uihelper.State} newState
	 */
	setUIState : function(newState) {
		uihelper.toggleStatusbar();		//empty and hide the statusbar on the transition
		switch(newState){
			case uihelper.State.BROWSE: 
				debug('Toolbar state changed to BROWSE');			
				//Visible buttons: Back; Search-open; <# of images> in <folder name>; Options
				if(this.toolbarElement.hasClass('toolbar-no-back')){	// keep whatever status the back button had
					this.toolbarElement.attr('class', 'toolbar toolbar-no-back toolbar-mainview transitions-fast');
				}else{
					this.toolbarElement.attr('class', 'toolbar toolbar-mainview transitions-fast');
				}
				uibuttons.backCallback = uibuttons.browseBack;
				uibuttons.nextCallback = uihelper.populateNextItems;
				uibuttons.previousCallback = uihelper.populatePreviousItems;
				uihelper.currentElement = null;
				
				uihelper.contentElement.removeClass('hidden');
				uihelper.slideshowElement.addClass('hidden');
				uihelper.editElement.addClass('hidden');
				uihelper.metadataElement.addClass('hidden');
				uihelper.searchElement.addClass('hidden');
				break;
			case uihelper.State.SLIDESHOW: 
				debug('Toolbar state changed to SLIDESHOW');
				if(uihelper.toolbarElement.hasClass('collapsed')){
					uihelper.toolbarElement.attr('class', 'toolbar toolbar-slideshow transitions-fast collapsed');
				}else{
					uihelper.toolbarElement.attr('class', 'toolbar toolbar-slideshow transitions-fast');
				}
				if(uihelper.currentState === uihelper.State.BROWSE)
					uihelper.toggleStatusbar('Long Press anywhere on the photo to search for similar photos.', "long-press-tip");
				//Visible buttons: Back; Metadata-expand; Search-open; Edit
				uibuttons.backCallback = uibuttons.slideshowBack;
				uibuttons.nextCallback = uihelper.nextSlideshowItem;
				uibuttons.previousCallback = uihelper.previousSlideshowItem;
				
				uihelper.contentElement.addClass('hidden');
				uihelper.slideshowElement.removeClass('hidden');
				uihelper.editElement.addClass('hidden');
				uihelper.metadataElement.addClass('hidden');
				uihelper.searchElement.addClass('hidden');
				break;
			case uihelper.State.SLIDESHOW_METADATA:
				debug('Toolbar state changed to SLIDESHOW_METADATA');
				uihelper.clearMetadata();
				uihelper.toolbarElement.addClass('toolbar-metadata');
				uihelper.metadataElement.removeClass('hidden');
				uihelper.slideshowElement.removeClass('hidden');
				uihelper.editElement.addClass('hidden');
				uibuttons.backCallback = uibuttons.detailsBack;
				uibuttons.nextCallback = uihelper.nextSlideshowItem;
				uibuttons.previousCallback = uihelper.previousSlideshowItem;
				contentAnalysis.getPhotoDetails(uihelper.populateMetadata,uihelper.currentElement.getAttribute('uid'));
				//Visible buttons: Back; Metadata-collapse; Search-open; ; Edit
				break;
			case uihelper.State.SEARCH: 
				debug('Toolbar state changed to SEARCH');
				uihelper.clearSearch();
				uihelper.toolbarElement.addClass('toolbar-search');
				uihelper.toolbarElement.removeClass('collapsed toolbar-no-back');
				uibuttons.backCallback = uibuttons.searchBack;
				uihelper.searchElement.removeClass('hidden');
				//Visible buttons: Back; Metadata-expand; Search-close; ; Edit
				break;
			case uihelper.State.EDITMODE: 
				debug('Toolbar state changed to EDITMODE');
				uihelper.toolbarElement.addClass('toolbar-editmode');
				uihelper.toolbarElement.removeClass('collapsed');
				uihelper.slideshowElement.addClass('hidden');
				uihelper.metadataElement.addClass('hidden');
				uihelper.editElement.removeClass('hidden');
				uibuttons.backCallback = uibuttons.editBack;
				uibuttons.nextCallback = null;
				uibuttons.previousCallback = null;
				//Visible buttons: Cancel; <Photo name>; Done
				break;
			default: 
				debug('Toolbar state changed to UNKNOWN');
				break;
		}
		uihelper.previousState = uihelper.currentState;
		uihelper.currentState = newState;
		uihelper.setToolbarText();
	},
	
	/**
	 * hide/show the toolbar 
	 */
	toggleToolbar : function(){
		if(uihelper.currentState === uihelper.State.SEARCH || uihelper.currentState === uihelper.State.SLIDESHOW_METADATA){	//hack to close search overlay
			uibuttons.back();
		}else if(uihelper.currentState == uihelper.State.SLIDESHOW){
			if(uihelper.toolbarElement.hasClass('collapsed')){
				uihelper.toolbarElement.removeClass('collapsed');
			}else{
				uihelper.toolbarElement.addClass('collapsed');
				uihelper.toggleStatusbar();
			}
		}
	},
	
	/**
	 * hide/show the statusbar
	 */
	toggleStatusbar : function(text, className){
		if(text){
			$("#bottom-statusbar").removeClass('collapsed');
			$("#statusbar-content").empty();
			var div = document.createElement('div');
			div.textContent = text;
			if(className)
				div.className = className;			
			$("#statusbar-content")[0].appendChild(div);
			$(div).hide();
			$(div).delay(200).fadeIn();
		}else{
			$("#bottom-statusbar").addClass('collapsed');
			$("#statusbar-content").empty();
		}
	},
	
	/**
	 * asks user details (username and password)
	 * 
	 * @param {callback function} callback username and password are passed to this function, in that order
	 * @param {String} message optional message to be shown in the dialog, such as "incorrect username or password"
	 */
	askUserDetails : function(callback, message){	
		var username = document.getElementById('username');
		var password = document.getElementById('password');
		var messageElement = $('#user-details-dialog-text');
		if(message){
			messageElement[0].textContent = message;
			messageElement.removeClass('hidden');
		}else{
			messageElement.addClass('hidden');
		}

		var d = $("#user-details-dialog-form");
		d.dialog({
			autoOpen : true,
			modal : true,
			draggable: false,
			resizable: false,
			position: ['center', 50],
			width: 600,
			height: 345,
			closeOnEscape: false,
			open: function(event, ui) { 
				$('.ui-dialog', ui.dialog).addClass('login-dialog');	//set correct class for the dialog
				$('.ui-dialog-titlebar', ui.dialog).addClass('login-dialog');
				$("#toolbar").addClass('hidden');
			},	
			buttons : {
				"Login" : {
					text: "Login",
					id: "btnLogin",
					click: function() {
						if($.trim(username.value).length > 0 && $.trim(password.value).length > 0){
							callback(username.value, password.value);
							$(this).dialog("close");
						}
					}
				}
			}
		});
		//remove any old keyup listeners and add a keyup listener
		$(d).off('keyup');
		$(d).on('keyup', { target: "#btnLogin", action: "click"}, uibuttons.enterChecker);
	},
	
	/**
	 * show modal wait dialog with the given message
	 * 
	 * @param {String} message
	 */
	openWaitDialog : function(message){
		if(uihelper.waitTimer == null)
			uihelper.waitTimer = window.setTimeout(function(){uihelper.openErrorDialog('Service Unavailable','The service is currently unavailable. Please try again later.');},contentAnalysis.timeout+15000);	// wait 15s longer than the http request timeout
		document.getElementById('wait-dialog-text').textContent = message;
		var d = $("#wait-dialog");
		d.dialog({
			autoOpen : true,
			modal : true,
			draggable: false,
			resizable: false,
			width: 250,
			closeOnEscape: false,
			open: function(event, ui) { 
				$(".ui-dialog", ui.dialog).removeClass('error-dialog');	//set correct class for the dialog
				$(".ui-dialog", ui.dialog).addClass('wait-dialog');	//set correct class for the dialog
			},
		});
	},
	
	/**
	 * close wait dialog if open 
	 */
	closeWaitDialog : function(){
		if(uihelper.waitTimer){
			window.clearTimeout(uihelper.waitTimer);
			uihelper.waitTimer = null;
		}
		var d = $("#wait-dialog");
		if(d.is(':data(dialog)')){	// check if the dialog is open
			d.dialog('close');
		}
	},
	
	/**
	 * show modal error dialog with the given message
	 * 
	 * @param {String} title
	 * @param {String} message
	 */
	openErrorDialog : function(title, message){	
		uihelper.closeWaitDialog();	// close if open
		document.getElementById('error-dialog-text').textContent = message;
		var d = $("#error-dialog");
		d.dialog({
			autoOpen : true,
			modal : true,
			draggable: false,
			resizable: false,
			width: 250,
			closeOnEscape: false,
			open: function(event, ui) {
				$(".ui-dialog", ui.dialog).removeClass('wait-dialog');	//set correct class for the dialog
				$('.ui-dialog', ui.dialog).addClass('error-dialog');
			},
			buttons : {
				"OK" : uihelper.closeErrorDialog
			}
		});
		d.dialog('option', 'title', title);
	},
	
	/**
	 * close wait dialog if open 
	 */
	closeErrorDialog : function(){
		var d = $("#error-dialog");
		if(d.is(':data(dialog)')){	// check if the dialog is open
			d.dialog('close');
		}
	}
};
