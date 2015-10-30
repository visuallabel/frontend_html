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
 * helper for handling ui buttons
 */
var uibuttons = {
	backCallback : null, // callback function for back button
	nextCallback : null, // callback for next button
	previousCallback : null, // callback for previous button

	/**
	 * Initializes the jquery.autocomplete plugin (doesn't use the jQuery UI's annoying version).
	 * Uses slightly different parameters for keyword and face editing (filters).
	 */
	initializeAutocomplete : function(){
		var restSuggestMethod = "/rest/cs/suggest";
		var limits = "0-9";	//extra params may be added
		$("#keyword-edit").autocomplete({ 
			url: contentAnalysis.basePath + restSuggestMethod,
			minChars: 2,
			queryParamName: "query",
			remoteDataType: "xml",
			//extraParams:{'rows': limits},
			useCache: false,
			sortResults: false,
			processData: this.parseAutocompleteData});
		$("#add-search-term-edit").autocomplete({ 
			url: contentAnalysis.basePath + restSuggestMethod,
			minChars: 2,
			queryParamName: "query",
			remoteDataType: "xml",
			//extraParams:{'rows': limits},
			sortResults: false,
			processData: this.parseAutocompleteData});
		$("#add-face-editmode").autocomplete({ 
			url: contentAnalysis.basePath + restSuggestMethod,
			minChars: 2,
			queryParamName: "query",
			remoteDataType: "xml",
			//extraParams:{'rows': limits, 'data_groups': 'face'},
			extraParams:{'data_groups': 'face'},
			sortResults: false,
			processData: this.parseAutocompleteData});
		$("#add-keyword-editmode").autocomplete({ 
			url: contentAnalysis.basePath + restSuggestMethod,
			minChars: 2,
			queryParamName: "query",
			remoteDataType: "xml",
			//extraParams:{'rows': limits, 'data_groups': 'keywords'},
			extraParams:{'data_groups': 'keywords'},
			sortResults: false,
			processData: this.parseAutocompleteData});
	},
	
	/**
	 * Parse the data from autocomplete. The data here is spliced to Array row-by-row basis.
	 */
	parseAutocompleteData : function(data){
		var parsed = [];
		if(data instanceof Array){
			var strDocument = "";
			for(var i=0; i < data.length; ++i){
				strDocument += data[i].value;
			}
			var doc = new DOMParser().parseFromString(strDocument, "text/xml");
			var collation = "";
			var collationNodeList = doc.documentElement.getElementsByTagName("collation");
			if(collationNodeList.length > 0 && collationNodeList[0].textContent != undefined && collationNodeList[0].textContent != ""){
				collation = collationNodeList[0].textContent + " ";
			}
			var suggestionNodeList = doc.documentElement.getElementsByTagName("suggestion");
			for(var j=0; j<suggestionNodeList.length; ++j){
				parsed.push(collation + suggestionNodeList[j].textContent);
			}
		}
		return parsed;
	},
	
	/**
	 * call to perform currently active back callback function
	 */
	back : function(){
		debug('uibuttons: back.');
		if(browseHistory.history.length > 0){
			uihelper.toolbarElement.removeClass('toolbar-no-back');
		}else{
			uihelper.toolbarElement.addClass('toolbar-no-back');
		}
		if(this.backCallback)
			this.backCallback();
	},
	
	/**
	 * call the perform the back button for slideshow view
	 * 
	 * NOTE: you should call back() instead of this
	 */
	slideshowBack : function(){
		uihelper.setUIState(uihelper.State.BROWSE);
	},
	
	/**
	 * populate edit based on element selected in slideshow view
	 * 
	 */
	edit : function() {
		if(uihelper.currentState == uihelper.State.EDITMODE){
			return;
		}else if(uihelper.currentElement){			
			contentAnalysis.getPhotoDetails(editHandler.populateEdit,uihelper.currentElement.getAttribute('uid'));
			uihelper.openWaitDialog('Loading...');
		}else{
			debug('uihelper.edit: no element selected.');
		}
	},
	
	/**
	 * call the perform the back button for edit view
	 * 
	 * NOTE: you should call back() instead of this
	 */
	editBack : function(){
		uihelper.toolbarElement.removeClass('toolbar-editmode');
		uihelper.setUIState(uihelper.previousState);
	},
	
	/**
	 * opens up a details/metadata dialog
	 */
	details : function(){
		if(uihelper.currentState == uihelper.State.SLIDESHOW_METADATA){
			uibuttons.detailsBack();
		}else if(uihelper.currentState == uihelper.State.SEARCH){
			return; // do nothing in this state
		}else{
			uihelper.setUIState(uihelper.State.SLIDESHOW_METADATA);
		}
	},
	
	/**
	 * back button for details view
	 */
	detailsBack : function(){
		uihelper.setUIState(uihelper.State.SLIDESHOW);
	},
	
	/**
	 * back button for search
	 */
	searchBack : function(){
		if(uihelper.currentState == uihelper.State.SEARCH){
			if(uihelper.previousState){
				uihelper.setUIState(uihelper.previousState);
			}else{
				uihelper.setUIState(uihelper.State.BROWSE);
			}
		}
	},
	
	/**
	 * back button for browse
	 */
	browseBack : function(){
		var previous = browseHistory.getPreviousBrowseState();
		if(previous){
			uihelper.populateInitialItemsByState(previous);
		}
	},
	
	/**
	 * search button (toolbar)
	 */
	search : function() {
		if(uihelper.currentState == uihelper.State.SEARCH){
			uibuttons.back();
		}else{
			if(uihelper.currentState == uihelper.State.SLIDESHOW_METADATA){
				uibuttons.detailsBack();
			}			
			if(uihelper.currentElement){
				contentAnalysis.getPhotoDetails(uihelper.populateSearch,uihelper.currentElement.getAttribute('uid'));
				$('#div-main-search').addClass('hidden');
			}else{
				uihelper.populateSearch(null);	// to clear old keywords and faces
				$('#div-main-search').removeClass('hidden');
			}
			uihelper.setUIState(uihelper.State.SEARCH);
		}		
	},
	
	/**
	 * 
	 * similarity search button (inside search "panel")
	 * 
	 * @param {HTMLElement} clickedElement
	 * 
	 */
	similaritySearch : function() {
		similaritySearch(uihelper.currentElement.getAttribute('uid'));
		uihelper.setUIState(uihelper.State.BROWSE);
	},
	
	/**
	 * add new search term of type object, takes the value from search overlay's input field
	 */
	addSearchTerm : function(){
		var input = document.getElementById('add-search-term-edit');
		var value = $.trim(input.value);
		input.value = '';
		if(value){
			var li = document.createElement('li');
			li.setAttribute('status','USER_CONFIRMED');
			li.setAttribute('objectType','OBJECT');
			var button = document.createElement('button');
			button.onclick = function(e){uihelper.moveSearchTerm(e.target.parentNode);};
			button.className = 'searchRemoveButton button';
			button.appendChild(document.createTextNode(value));
			li.appendChild(button);
			uihelper.appendSortedSearchLiElement(li, null, null);
		}
	},
	
	/**
	 * object search button (inside search "panel")
	 */
	objectSearch : function(){		
		var objectList = contentAnalysis.createVisualObjectList();
		var input = document.getElementById('keyword-edit');
		var value = $.trim(input.value);
		input.value = value;
		if(value){
			var values = value.replace(' ',',').split(',');	
			for(var i=0;i<values.length;++i){
				var trimmedValue = $.trim(values[i]);
				if(trimmedValue.length > 0){
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.OBJECT, values[i], objectList.documentElement, null);
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.OBJECT, values[i], objectList.documentElement, 'CANDIDATE');
				}else{
					debug('uihelper.objectSearch: ignored empty search term.');
				}
			}
		}
		
		var termNodes = uihelper.searchTermsElement[0].getElementsByTagName('li');
		for(var i=0;i<termNodes.length;++i){
			var realValue = termNodes[i].getAttribute('realValue');
			if(realValue === null){ // if real value is not available, use the visible text content
				realValue = termNodes[i].textContent;
			}
			switch(termNodes[i].getAttribute('objectType')){
				case 'KEYWORD':
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.KEYWORD, realValue, objectList.documentElement, 'CANDIDATE');
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.KEYWORD, realValue, objectList.documentElement, null);
					break;
				case 'FACE':
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.FACE, realValue, objectList.documentElement, 'CANDIDATE');
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.FACE, realValue, objectList.documentElement, null);
					break;
				default:	// CASE 'OBJECT'
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.OBJECT, realValue, objectList.documentElement, 'CANDIDATE');
					contentAnalysis.appendVisualObject(ContentAnalysis.VisualObjectType.OBJECT, realValue, objectList.documentElement, null);
					break;
			}	// switch
		}

		if(objectList.documentElement.firstChild){
			objectBasedSearch(objectList);
		
			uihelper.setUIState(uihelper.State.BROWSE);
		}else{
			debug('uihelper.objectSearch: no terms given.');
		}	// else				
	},
	
	/**
	 * 
	 */
	previous : function(){
		if(uibuttons.previousCallback){
			uibuttons.previousCallback();
		}
	},
	
	/**
	 * 
	 */
	next : function(){
		if(uibuttons.nextCallback){
			uibuttons.nextCallback();
		}
	},
	
	/**
	 * Enter-key checker to be attached to input-fields in order to activate something
	 *
	 * @param {Event} event
	 */
	enterChecker : function(event){
		if (event.keyCode === $.ui.keyCode.ENTER){
			var target = event.data.target;
			switch(event.data.action){
				case "deselect": target.deselectCurrent(); break;
				case "click":
				default: $(target).click(); break;
			}
			event.preventDefault();
			event.stopPropagation();
			return false;
		}
	},
	
	/**
	 * click handler for negative feedback
	 * @param {Event} e
	 */
	negativeFeedbackClicked : function(e){
		var uid = e.target.parentNode.getAttribute('uid');
		$("button", e.target.parentNode).removeClass("thumbsUp-selected thumbsDown-selected");
		$(e.target).addClass("thumbsDown-selected");
		uihelper.sendSimilarityFeedback(uid, false);
	},
	
	/**
	 * click handler for positive feedback
	 * @param {Event} e
	 */
	positiveFeedbackClicked : function(e){
		var uid = e.target.parentNode.getAttribute('uid');
		$("button", e.target.parentNode).removeClass("thumbsUp-selected thumbsDown-selected");
		$(e.target).addClass("thumbsUp-selected");
		uihelper.sendSimilarityFeedback(uid, true);
	}
};
