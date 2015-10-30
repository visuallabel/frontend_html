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
 * handles the history for browse view
 */
var browseHistory = {
	history : new Array(),
	
	/**
	 * @param {Array [Element]} photoList
	 * @param {Integer} firstIndex
	 * @param {Integer} lastIndex
	 * @param {Object} requestParams
	 * @param {String} resultCount the Frontend estimate of the total result count
	 */
	storeBrowseState : function(photoList,firstIndex,lastIndex,requestParams,resultCount) {
		if(photoList != null && firstIndex != null && lastIndex != null && requestParams != null && photoList.length > 0){
			var state = new Object();
			state.photoList = photoList;
			state.firstIndex = firstIndex;
			state.lastIndex = lastIndex;
			state.requestParams = requestParams;
			state.resultCount = resultCount;
			this.history.push(state);
		}else{	
			debug('browseHistory.storeBrowseState: ignored incomplete state.'+photoList+' '+firstIndex+' '+lastIndex+' '+requestParams);	
		}
	},
	
	/**
	 * return previous browse state details or undefined if not available
	 * 
	 * the returned object contains the following attributes:
	 * 		- requestParams, parameters used to perform the original query
	 * 		- photoList, list of photos retrieved by the query
	 * 		- lastIndex, for paging
	 * 		- firstIndex, for paging
	 *  	- resultCount, the Frontend estimate of the total result count, it is not guaranteed to be valid anymore for paging
	 */
	getPreviousBrowseState : function(){
		return this.history.pop();
	}
};
