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

/* search services */
var methodSimilarPhotos = "similarPhotosById";
var methodSimilarVideos = "similarVideosById";
var parameterLimits = "limits";
var parameterGUID = "uid";

/* common variables */
var initialLimits = "0-9"; // limit initial search to first 10 results

/**
 * @param {string} guid
 */
function searchSimilarPhotos(guid){
	var url = serviceCA + methodSimilarPhotos + "?" + parameterLimits + "=" + initialLimits + "&" + parameterDataGroups + "=" + defaultDataGroups + "&" + parameterUserId + "=" + getUserId() + "&" + parameterGUID + "=" + guid; // limit to currently logged in user
	console.log("Calling: GET "+url);
	$.ajax({
		cache: false,	//try to bypass the cache
		url : url,
		success : searchResultHandler,
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to retrieve search results.");
		}
	});
}

/**
 * @param {string} guid
 */
function searchSimilarVideos(guid){
	var url = serviceVCA + methodSimilarVideos + "?" + parameterLimits + "=" + initialLimits + "&" + parameterDataGroups + "=" + defaultDataGroups + "&" + parameterUserId + "=" + getUserId() + "&" + parameterGUID + "=" + guid; // limit to currently logged in user
	console.log("Calling: GET "+url);
	$.ajax({
		cache: false,	//try to bypass the cache
		url : url,
		success : searchResultHandler,
		error : function(jqXHR, textStatus, errorThrown) {
			console.log("Failed to retrieve search results.");
		}
	});
}

/**
 * initialize search
 */
function initSearch(){
	$("#search-results-div").dblclick(function() {
  		$(this).addClass("hidden");
	});
}

/**
 * process the list of photos or videos
 * @param {DomDocument} data
 */
function searchResultHandler(data){
	var media = data.documentElement.getElementsByTagName("media");
	var resultsDiv = $("#search-results-div");
	resultsDiv.empty();
	var count = 0;
	for(var i=0; i<media.length; ++i){
		var m = media[i];
		var mediaType = m.getElementsByTagName("mediaType")[0].textContent;
		switch(mediaType){
			case "PHOTO":
				resultsDiv.append(createPhotoElement(m));
				++count;
				break;
			case "VIDEO":
				resultsDiv.append(createVideoElement(m));
				++count;
				break;
			default:
				console.log("Unknown media type ignored: "+mediaType);
				break;
		}
	}
	if(count < 1){
		resultsDiv.append(document.createTextNode("No results for similarity search."));
	}
	resultsDiv.removeClass("hidden");
	window.scrollTo(0, 0);
}

/**
 * Bind similarity search handler based on the media element to the given target element
 * 
 * @param {Node} media the xml dom node containing media details
 * @param {Node} target any dom node or element capable of handling double click events
 */
function bindSimilaritySearch(media, target){
	target.setAttribute("guid", media.getElementsByTagName("UID")[0].textContent);
	var mediaType = media.getElementsByTagName("mediaType")[0].textContent;
	switch(mediaType){
		case "PHOTO":
			$(target).dblclick(function() {
  				searchSimilarPhotos(this.getAttribute("guid"));
			});
			break;
		case "VIDEO":
			$(target).dblclick(function() {
  				searchSimilarVideos(this.getAttribute("guid"));
			});
			break;
		default:
			console.log("Unknown media type : "+mediaType);
			break;
	}
}
