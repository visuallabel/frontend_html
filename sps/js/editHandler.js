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
 * helper for edit metadata functionality
 */
var editHandler = {
	facesElement : null,
	keywordsElement : null,
	facesCandidatesElement : null,
	keywordsCandidatesElement : null,
	editCanvas : null,
	data : null,
	drawing : false,
	currentImage : null,
	rectangleTopX : null,
	rectangleTopY : null,
	rectangleBottomX : null,
	rectangleBottomY : null,
	userConfirmedConfidenceThreshold : 0.05,	//reduced amount of threshold (from 0.9)
	candidateConfidenceThreshold : 0.01,		//reduced amount of threshold (from 0.5)
	currentFace : null,	// can also be used to detect if draw is enabled
	currentKeyword : null,
	drawColor : 'red',
	drawWidth : 2,	// radius of the line
	
	/**
	 * 
 	 * @param {JQuery Object} facesElement
	 * @param {JQuery Object} keywordsElement
 	 * @param {JQuery Object} editCanvas
 	 * @param {JQuery Object} facesCandidatesElement
 	 * @param {JQuery Object} keywordsCandidatesElement
	 */
	setElements : function(facesElement, keywordsElement, editCanvas, facesCandidatesElement, keywordsCandidatesElement){
		editHandler.facesElement = facesElement;
		editHandler.keywordsElement = keywordsElement;
		editHandler.facesCandidatesElement = facesCandidatesElement;
		editHandler.keywordsCandidatesElement = keywordsCandidatesElement;
		editHandler.editCanvas = editCanvas;

		var canvas = editHandler.editCanvas[0];
		if(Modernizr.touch){
			debug('editHandler.setElements: touch enabled');
			canvas.addEventListener('touchstart', this, false);
			canvas.addEventListener('touchend', this, false);
			canvas.addEventListener('touchcancel', this, false);
			canvas.addEventListener('touchmove', this, false);
		}else{
			debug('editHandler.setElements: touch not available.');
			canvas.addEventListener('mousedown', this, false);
			canvas.addEventListener('mousemove', this, false);
			canvas.addEventListener('mouseup', this, false);
		}
	},
	
	/**
	 * set the object related to the passed li-element to user confirmed status
	 * 
	 * This will also move the element to confirmed list
	 * 
	 * @param {HTMLLiElement} li
	 */
	setObjectToUserConfirmedStatus : function(li){
		var targetNode = editHandler.getTargetNode(li);
		var statNode = null;
		var valueNode = null;
		for(var i=0;i<targetNode.childNodes.length;++i){
			switch(targetNode.childNodes[i].nodeName){
				 case 'status':
				 	statNode = targetNode.childNodes[i];
				 	break;
				 case 'value':
				 	valueNode = targetNode.childNodes[i];
				 	break;
				 default:
				 	break;
			}
		}	
		
		li.parentNode.removeChild(li);
		switch(li.getAttribute('objectType')){
			case 'KEYWORD':
				editHandler.appendSortedLiElement(li,valueNode.textContent,null,editHandler.keywordsElement[0]);
				break;
			case 'FACE':
				editHandler.appendSortedLiElement(li,valueNode.textContent,null,editHandler.facesElement[0]);
				break;
			default:
				debug('editHandler.setObjectToUserConfirmedStatus: unknown objectType: '+li.getAttribute('objectType'));
				return;
		}

		statNode.textContent = 'USER_CONFIRMED';
		targetNode.setAttribute('modified','true');
		$(li.getElementsByTagName('button')[0]).removeClass('addButton');
		$(li.getElementsByTagName('button')[0]).addClass('removeButton');
	},
	
	/**
	 * @param {Event} e
	 */
	handleEvent : function(e) {
		switch(e.type) {
			case 'mousedown':
				editHandler.canvasPressed(e);
				break;
			case 'mousemove':
				this.draw(e.clientX,e.clientY,e.clientX,e.clientY);
				e.preventDefault();
				e.stopPropagation();
				break;
			case 'mouseup':
				this.drawing = false;
				e.preventDefault();
				e.stopPropagation();
				break;
			case 'touchstart':
				editHandler.canvasPressed(e);
				break;
			case 'touchmove':
				var endPoint = e.touches[0];
				if(endPoint){
					e.preventDefault();
					e.stopPropagation();
					this.draw(endPoint.clientX,endPoint.clientY,endPoint.clientX,endPoint.clientY);
				}
				break;
			case 'touchend':
				this.drawing = false;
				e.preventDefault();
				e.stopPropagation();
				break;
			case 'touchcancel':
				e.preventDefault();	// just in case
				break;
		}
	},
	
	/**
	 * called when "down" event is called on canvas
	 * 
	 * @param {Event} e
	 */
	canvasPressed : function(e) {
		this.drawing = true;
		this.resetCanvas();
		e.preventDefault();
		e.stopPropagation();
		if(editHandler.currentFace == null){
			var li = editHandler.addConfirmed(ContentAnalysis.VisualObjectType.FACE, '#add-face-editmode');
			if(li == null){
				debug('editHandler.draw: failed to create new face.');
				return;
			}
		}
	},
	
	/**
	 * draw to canvas, the passed coordinates will be automatically converted relative to the canvas (ie. raw x/y of touch/click event is OK),
	 * if you are passing real (already relative coordinates), call drawReal
	 * 
	 * to draw a point, pass startX==endX, startY==endY
	 * 
	 * @param {Integer} startX
	 * @param {Integer} startY
	 * @param {Integer} endX
	 * @param {Integer} endY
	 */
	draw : function(startX,startY,endX,endY){
		if(editHandler.currentFace == null || !editHandler.drawing){
			return;
		}
		var canvas = editHandler.editCanvas[0];
		var rect  = canvas.getClientRects()[0];
		var realStartX = startX-rect.left;
		var realStartY = startY-rect.top;
		var realEndX = endX-rect.left;	
		var realEndY = endY-rect.top;
		editHandler.drawReal(realStartX,realStartY,realEndX,realEndY);
	},
	
	/**
	 * see: draw()
	 * 
	 * to draw a point, pass startX==endX, startY==endY
	 * 
	 * Note: this will ignore editHandler.currentFace and editHandler.drawing
	 * 
	 * @param {Integer} realStartX
	 * @param {Integer} realStartY
	 * @param {Integer} realEndX
	 * @param {Integer} realEndY
	 */
	drawReal : function(realStartX,realStartY,realEndX,realEndY){	
		if(editHandler.rectangleTopX == null || editHandler.rectangleTopX > realStartX){
			editHandler.rectangleTopX = realStartX;
		}
		if(editHandler.rectangleTopY == null || editHandler.rectangleTopY < realStartY){
			editHandler.rectangleTopY = realStartY;
		}
		if(editHandler.rectangleBottomX == null || editHandler.rectangleBottomX < realEndX){
			editHandler.rectangleBottomX = realEndX;
		}
		if(editHandler.rectangleBottomY == null || editHandler.rectangleBottomY > realEndY){
			editHandler.rectangleBottomY = realEndY;
		}
		
		var ctx=editHandler.editCanvas[0].getContext("2d");	
		ctx.beginPath();
		if(realStartX == realEndX && realStartY == realEndY){	// make "point"
			ctx.arc(realStartX, realStartY, editHandler.drawWidth, 0, 2 * Math.PI, true);
			ctx.fillStyle=editHandler.drawColor;
			ctx.fill();
		}else{	// make line
			ctx.lineWidth=editHandler.drawWidth*2;
			ctx.strokeStyle=editHandler.drawColor;
			ctx.moveTo(realStartX,realStartY);
			ctx.lineTo(realEndX,realEndY);
			ctx.stroke();
		}
	},
	
	/**
	 * 
 	 * @param {HTMLLiElement} clickedElement
	 */
	keywordSelected : function(clickedElement){
		if(editHandler.currentKeyword === clickedElement)
			return;
		editHandler.deselectCurrent();	// de-select previous face/keyword
		$(clickedElement).addClass('edit-highlighted');
		editHandler.currentKeyword = clickedElement;
		$('input', clickedElement).focus();	// force ipad to get focus as it seems not to understand to do it automatically
	},
	
	/**
	 * de-select current face or keyword if one was currently selected
	 */
	deselectCurrent : function(){	
		if(editHandler.currentFace){
			editHandler.saveCurrent(editHandler.currentFace);
			$('input', editHandler.currentFace).blur();
			$(editHandler.currentFace).removeClass('edit-highlighted');
			editHandler.currentFace = null;
		}
		if(editHandler.currentKeyword){
			editHandler.saveCurrent(editHandler.currentKeyword);
			$('input', editHandler.currentKeyword).blur();
			$(editHandler.currentKeyword).removeClass('edit-highlighted');
			editHandler.currentKeyword = null;
		}
		editHandler.resetCanvas();
	},
	
	/**
	 * 
 	 * @param {HTMLLiElement} clickedElement
	 */
	faceSelected : function(clickedElement){
		if(editHandler.currentFace === clickedElement)
			return;
		editHandler.deselectCurrent();	// de-select previous face/keyword
		editHandler.currentFace = clickedElement;
		$(clickedElement).addClass('edit-highlighted');
		$('input', clickedElement).focus();	// force ipad to get focus as it seems not to understand to do it automatically
		var shapeValue = null;
		var shapeType = null;
		var targetNode = editHandler.getTargetNode(clickedElement);
		for(var i=0;i<targetNode.childNodes.length;++i){
			if(targetNode.childNodes[i].nodeName == 'shape'){
				var shapeChilds = targetNode.childNodes[i].childNodes;
				for(var k=0;k<shapeChilds.length;++k){
					switch(shapeChilds[k].nodeName){
						case 'shapeType':
							shapeType = shapeChilds[k].textContent;
							break;
						case 'value':
							shapeValue = shapeChilds[k].textContent;
							break;
					}	// switch
				}	// for shape children
				break;
			}	// if
		}
		
		if(shapeType == null || shapeValue == null){
			debug('editHandler.faceSelected: no shape data.');
		}else if(shapeType !== 'RECTANGLE'){
			debug('editHandler.faceSelected: unknown shapeType: '+shapeType);
		}else{
			var coordinates = shapeValue.split(',');		
			editHandler.drawReal(coordinates[0],coordinates[1],coordinates[2],coordinates[1]);	// top
			editHandler.drawReal(coordinates[2],coordinates[1],coordinates[2],coordinates[3]);	// right
			editHandler.drawReal(coordinates[2],coordinates[3],coordinates[0],coordinates[3]);	// bottom
			editHandler.drawReal(coordinates[0],coordinates[3],coordinates[0],coordinates[1]);	// left		
		}
	},
	
	/**
	 * 
 	 * @param {Document} data
	 */
	populateEdit : function(data){
		editHandler.currentFace = null;
		editHandler.currentKeyword = null;
		editHandler.data = data;
		editHandler.keywordsElement.empty();
		editHandler.facesElement.empty();
		editHandler.keywordsCandidatesElement.empty();
		editHandler.facesCandidatesElement.empty();
		var objectList = data.getElementsByTagName('object');
		var duplicates = new Array();
		//TODO discard != USER_CONFIRMED duplicates
		for(var i=0;i<objectList.length;++i){
			var value = null;
			var objectType = null;
			var objectId = null;
			var statNode = null;
			var confidence = null;
			var childNodes = objectList[i].childNodes;
			for(var j=0;j<childNodes.length;++j){
				var nodeName = childNodes[j].nodeName;
				if(nodeName == 'objectType'){
					objectType = childNodes[j].textContent;
				}else if(nodeName == 'value'){
					if(value == null){
						value = childNodes[j].textContent;
					}				
				}else if(nodeName == 'objectId'){
					objectId = childNodes[j].textContent;
				}else if(nodeName == 'status'){
					statNode = childNodes[j];
				}else if(nodeName == 'confidence'){
					confidence = childNodes[j].textContent;
				}else if(nodeName == 'name'){	// use name as value if one is available
					value = childNodes[j].textContent;
				}
			}	// for object's children
			
			if(objectType && objectId && statNode){
				if(statNode.textContent == 'CANDIDATE'){
					if(confidence){	// if confidence was given (used for sort)
						if(objectType == 'FACE' || confidence > editHandler.userConfirmedConfidenceThreshold){	// confidence is high enough to be classified as confirmed, or it is a face
							statNode.textContent = 'USER_CONFIRMED';
							objectList[i].setAttribute('modified','true');
						}else if(confidence < editHandler.candidateConfidenceThreshold){	// confidence is too low to be shown
							continue;	// skip this element
						}
					}
					if(value){	// check for duplicates
						var lowerValue = value.toLowerCase();
						if(duplicates.indexOf(lowerValue) >= 0){	// ignore duplicates
							debug('editHandler.populateEdit: ignored duplicate value: '+value);
							continue;
						}else{
							duplicates.push(lowerValue);
						}
					}	// if
				}else if(value){
					duplicates.push(value.toLowerCase());	// do not allow duplicates of confirmed to appear in candidate list
				}
				editHandler.createLiElement(objectType, objectId, statNode.textContent, value, confidence);				
			}else{
				debug('editHandler.populateEdit: missing objectType, status or objectId.');
			}
		}	// for
			
		editHandler.currentImage = new Image();
		editHandler.currentImage.src = data.getElementsByTagName('url')[0].textContent;
		
		editHandler.resetCanvas();
		uihelper.setUIState(uihelper.State.EDITMODE);

		//initialize edit overlay's input fields by removing any old keyup listeners and add a keyup listener
		$("#add-face-editmode").off('keyup');
		$("#add-face-editmode").on('keyup', { target: "#btn-add-face", action: "click"}, uibuttons.enterChecker);
		$("#add-keyword-editmode").off('keyup');
		$("#add-keyword-editmode").on('keyup', { target: "#btn-add-keyword", action: "click"}, uibuttons.enterChecker);
		uihelper.closeWaitDialog();
	},
	
	/**
	 * set toolbar for edit mode
	 */
	setEditToolbarText : function(){
		var toolbarTextTitle = "Edit Photo Details";
		uihelper.previousButton.addClass('arrowDisabled');
		uihelper.nextButton.addClass('arrowDisabled');
		
		if(editHandler.data){
			var nodes = editHandler.data.getElementsByTagName('name');// get name if exists
			if(nodes.length > 0){
				uihelper.toolbarTextNumbersElement[0].textContent = toolbarTextTitle + ' ' + nodes[0].textContent;
			}else{
				uihelper.toolbarTextNumbersElement[0].textContent = toolbarTextTitle;
			}
			nodes = editHandler.data.getElementsByTagName('description');// get description if exists
			if(nodes.length > 0){
				uihelper.toolbarTextPhraseElement[0].textContent = nodes[0].textContent;
			}else{
				uihelper.toolbarTextPhraseElement[0].textContent = '';
			}
		}	
	},
	
	/**
	 * Adds the given li element to correct location in the passed targetElement (as element's child)
	 * 
	 * The sort is based on (in order):
	 * - null values are sorted in the front of the list
	 * - confidence
	 *     - on identical confidence, by value
	 * - value
	 * 
	 * @param {HTMLLiElement} li
	 * @param {String} value
	 * @param {String} confidence
	 * @param {Element} targetElement
	 */
	appendSortedLiElement : function(li, value, confidence, targetElement){
		if(targetElement.firstChild == null){	// no need to sort
			targetElement.appendChild(li);
			return;
		}
		
		if(value == null){	// sort non-valued to the front of the list to encourage user to do something to them, ignore confidence
			targetElement.insertBefore(li, targetElement.firstChild);
			return;
		}

		var confidenceNumber = null;
		if(confidence){
			confidenceNumber = Number(confidence);
		}
		var objectIdList = editHandler.data.getElementsByTagName('objectId');
		for(var i=0;i<targetElement.childNodes.length;++i){	// go through childNodes
			var objectId = targetElement.childNodes[i].getAttribute('objectId');
			for(var j=0;j<objectIdList.length;++j){	// find the childNode's real object from dom
				if(objectIdList[j].textContent == objectId){
					if(confidenceNumber){	// try confidence if it was given
						var confidenceNodes = objectIdList[j].parentNode.getElementsByTagName('confidence');
						if(confidenceNodes.firstChild){	// the target has confidence
							var targetConfidence = Number(confidenceNodes[0].textContent);
							if(targetConfidence == confidenceNumber){	// the same confidence
								for(var k=0;k<objectIdList[j].parentNode.childNodes.length;++k){	// find the correct Value element
									if(objectIdList[j].parentNode.childNodes[k].nodeName == 'value'){
										if(objectIdList[j].parentNode.childNodes[k].textContent.toLowerCase() > value.toLowerCase()){	// if this is before
											targetElement.insertBefore(li, targetElement.childNodes[i]);
											return;
										}
										break;
									}
								}	// for	
							}else if(targetConfidence > confidenceNumber){	// this has better confidence
								targetElement.insertBefore(li, targetElement.childNodes[i]);
								return;
							}
						}else{	// put it before the one without confidence given
							targetElement.insertBefore(li, targetElement.childNodes[i]);
							return;
						}
					}else{	// no confidence given
						for(var k=0;k<objectIdList[j].parentNode.childNodes.length;++k){	// find the correct Value element
							if(objectIdList[j].parentNode.childNodes[k].nodeName == 'value'){
								if(objectIdList[j].parentNode.childNodes[k].textContent.toLowerCase() > value.toLowerCase()){	// if this is before
									targetElement.insertBefore(li, targetElement.childNodes[i]);
									return;
								}
								break;
							}
						}	// for
					}	// else
					break;
				}	// if objectId matches
			}	// for objects
		}	// for childNodes
		targetElement.appendChild(li);	// if no valid place was found, dump at the end of the list
	},
	
	/**
	 * @param {MouseEvent} e
	 */
	liButtonPressed : function(e){
		if(e.target.parentNode.parentNode == editHandler.keywordsElement[0] || e.target.parentNode.parentNode == editHandler.facesElement[0]){
			editHandler.removeMetadata(e);
		}else{
			editHandler.setObjectToUserConfirmedStatus(e.target.parentNode);
		}
	},
	
	/**
	 * 
	 * Helper function for creating a new Li element for keyword/face, will be automatically appended to the correct tree
	 * 
	 * returns the li element on success, null on failure
	 * 
	 * @param {String} objectType
	 * @param {String} objectId
	 * @param {String} status
	 * @param {String} value can be null
	 * @param {String} confidence can be null
	 * 
	 */
	createLiElement : function(objectType, objectId, status, value, confidence){
		var li = document.createElement('li');
		var button = document.createElement('button');
		var input = document.createElement('input');
		input.onclick = function(e){ 
			if(e.which === 1){	//handle only the left mouse click
				e.target.focus();	// hack to make ios to understand to have the focus
				e.preventDefault();
				e.stopPropagation();
			}
		};

		$(input).on('keyup', { target: editHandler, action: "deselect"}, uibuttons.enterChecker);
		if(objectType == 'KEYWORD'){
			if(status == 'USER_CONFIRMED'){
				button.className = 'removeButton button float-left';
				editHandler.appendSortedLiElement(li, value, null, editHandler.keywordsElement[0]);
			}else if(status == 'CANDIDATE' || status == 'NO_FRIENDLY_KEYWORD'){ //TODO remove NO_FRIENDLY_KEYWORD to disallow keywords without friendly values
				button.className = 'addButton button float-left';
				editHandler.appendSortedLiElement(li, value, confidence, editHandler.keywordsCandidatesElement[0]);
			}else{
				debug('editHandler.createLiElement: unsupported status: '+status+' for objectId: '+objectId);
				return null;
			}
			input.onfocus = function(e){editHandler.keywordSelected(e.target.parentNode);};
		}else if(objectType == 'FACE'){
			if(status == 'USER_CONFIRMED'){
				button.className = 'removeButton button float-right';
				editHandler.appendSortedLiElement(li, value, null, editHandler.facesElement[0]);
			}else if(status == 'CANDIDATE'){
				button.className = 'addButton button float-right';
				editHandler.appendSortedLiElement(li, value, confidence, editHandler.facesCandidatesElement[0]);
			}else{
				debug('editHandler.createLiElement: unsupported status: '+status+' for objectId: '+objectId);
				return null;
			}
			input.placeholder = "Unknown";
			input.onfocus = function(e){editHandler.faceSelected(e.target.parentNode);};
		}else{
			debug('editHandler.createLiElement: unsupported objectType: '+objectType+' for objectId: '+objectId);
			return null;
		}	// else
		
		input.setAttribute('type','text');
		if(value)	// faces can be without values
			input.value = value;
		
		button.setAttribute('type','button');
		button.onclick = editHandler.liButtonPressed;
		
		li.setAttribute('objectId',objectId);	
		li.setAttribute('objectType',objectType);	
		li.appendChild(input);
		li.appendChild(button);
		return li;
	},
	
	
	/**
	 * returns the object node (from xml document) for the given keyword or faces li or null if not found
	 * 
	 * @param {HTMLLiElement} li
	 */
	getTargetNode : function(li){
		var objectId = li.getAttribute('objectId');
		var objectIdList = editHandler.data.getElementsByTagName('objectId');
		var targetNode = null;
		for(var i=0;i<objectIdList.length;++i){
			if(objectIdList[i].textContent == objectId){
				targetNode = objectIdList[i].parentNode;
				break;
			}
		}
		return targetNode;
	},
	
	/**
	 * saves the unsaved data to dom (editHandler.data) if needed
	 * 
 	 * @param {HtmlLiElement} li
	 */
	saveCurrent : function(li){
		var targetNode = editHandler.getTargetNode(li);
		var inputElement = li.getElementsByTagName('input')[0];
		
		var isFace = (li.getAttribute('objectType') == 'FACE');	// for saving shape data
		var shapeNode = null;
		var valueNode = null;
		var nameNode = null;
		var confidenceNode = null;

		for(var i=0;i<targetNode.childNodes.length;++i){
			var nodeName = targetNode.childNodes[i].nodeName;
			if(nodeName == 'value'){
				valueNode = targetNode.childNodes[i];
			}else if(nodeName == 'confidence'){
				confidenceNode = targetNode.childNodes[i];
			}else if(nodeName == 'shape'){
				shapeNode = targetNode.childNodes[i];
			}else if(nodeName == 'name'){
				nameNode = targetNode.childNodes[i];
			}
		}
		if($.trim(inputElement.value).length === 0){
			if(!isFace && valueNode){	// face can be empty when user is drawing
				inputElement.value = valueNode.textContent; // restore old value if possible
				debug('editHandler.saveCurrent: empty value.');	
			}
		}else if(nameNode != null){	// if nameNode is present, edit that
			if(nameNode.textContent !== inputElement.value){
				nameNode.textContent = inputElement.value;
				targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
			}
		}else if(valueNode == null){
			valueNode = editHandler.data.createElement('value');
			targetNode.appendChild(valueNode);
			valueNode.textContent = inputElement.value;
			targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
		}else if(valueNode.textContent !== inputElement.value){
			valueNode.textContent = inputElement.value;
			targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
		}
	
		if(confidenceNode == null){	// do not set modified here, only changing the confidence is probably not enough to send something back to the server
			confidenceNode = editHandler.data.createElement('confidence');
			targetNode.appendChild(confidenceNode);
		}
		confidenceNode.textContent = '1';
				
		if(isFace){
			var shapeTypeNode = null;
			var shapeValueNode = null;
			if(shapeNode){
				if(editHandler.rectangleBottomX == null || editHandler.rectangleBottomY == null || editHandler.rectangleTopX == null || editHandler.rectangleTopY == null){	// remove shape
					targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
					targetNode.removeChild(shapeNode);
					return;	// nothing more needed
				}else{	// find the previous nodes if they exist
					for(var i=0;i<shapeNode.childNodes.length;++i){
						var nodeName = shapeNode.childNodes[i].nodeName;
						if(nodeName == 'shapeType'){
							shapeTypeNode = shapeNode.childNodes[i];
						}else if(nodeName == 'value'){
							shapeValueNode = shapeNode.childNodes[i];
						}
						if(shapeTypeNode && shapeValueNode){
							break;	// no need to look any further
						}
					}	// for
				}	// else
			}
			if(editHandler.rectangleBottomX && editHandler.rectangleBottomY && editHandler.rectangleTopX && editHandler.rectangleTopY){	// shapedata needs to be added or modified
				var shapeValueString = editHandler.rectangleTopX+','+editHandler.rectangleTopY+','+editHandler.rectangleBottomX+','+editHandler.rectangleBottomY;
				if(shapeNode == null){
					shapeNode = editHandler.data.createElement('shape');
					targetNode.appendChild(shapeNode);
				}
				if(shapeValueNode == null){
					shapeValueNode = editHandler.data.createElement('value');
					shapeNode.appendChild(shapeValueNode);
				}
				if(shapeValueNode.textContent !== shapeValueString){	// the values have been modified
					shapeValueNode.textContent = shapeValueString;
					if(shapeTypeNode == null){
						shapeTypeNode = editHandler.data.createElement('shapeType');
						shapeNode.appendChild(shapeTypeNode);
					}
					shapeTypeNode.textContent = 'RECTANGLE';
					targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
				}	// if			
			}// else ignore if no previous shape data, nor anything to add
		}
	},
	
	/**
	 * 
 	 * @param {MouseEvent} e
	 */
	removeMetadata : function(e){
		e.preventDefault();
		e.stopPropagation();
		editHandler.resetCanvas();
		var li = e.currentTarget.parentNode;	// li element
		
		var targetNode = editHandler.getTargetNode(li);
		if(targetNode.getAttribute('new')){	// if this was a new node, just remove it
			targetNode.parentNode.removeChild(targetNode);
		}else{	
			var confidenceNode = null;
			for(var i=0;i<targetNode.childNodes.length;++i){
				switch(targetNode.childNodes[i].nodeName){
					case 'status':
						targetNode.childNodes[i].textContent = 'USER_REJECTED';			
						break;
					case 'confidence':
						confidenceNode = targetNode.childNodes[i];
						break;
				}
			}	// for
			
			targetNode.setAttribute('modified','true');	// for checking what data needs to be sent back to the server
			if(confidenceNode == null){
				confidenceNode = editHandler.data.createElement('confidence');
				targetNode.appendChild(confidenceNode);
			}
			confidenceNode.textContent = '1';
		}	// else
		
		editHandler.deselectCurrent();
		li.parentNode.removeChild(li);	// parent of li (ul)
	},
	
	/**
	 * return the (object) node with empty value or null if none is found
	 * 
	 * @param {ContentAnalysis.VisualObjectType} objectType
	 * @param {String} status USER_REJECTED, USER_CONFIRMED, etc... to target the search, if null, all elements are going to be searched
	 */
	getEmptyNodeByValue : function(objectType, status){
		var objectTypeString = null;
		switch(objectType){
			case ContentAnalysis.VisualObjectType.KEYWORD:
				objectTypeString = 'KEYWORD';
				break;
			case ContentAnalysis.VisualObjectType.FACE:
				objectTypeString = 'FACE';
				break;
			default:
				debug('editHandler.hasEmptyValues: unknown objectType');
				return null;
		}
		var objectNodes = editHandler.data.getElementsByTagName('object');
		for(var i=0;i<objectNodes.length;++i){	// go through all object nodes, and check that there are no empty value elements
			var value = null;
			for(var j=0;j<objectNodes[i].childNodes.length;++j){
				if(objectNodes[i].childNodes[j].nodeName == 'value'){
					value = $.trim(objectNodes[i].childNodes[j].textContent);
				}else if(objectNodes[i].childNodes[j].nodeName == 'objectType' && objectNodes[i].childNodes[j].textContent != objectTypeString){
					value = 'true';	// just put whatever, we do not have care this type of object
					break;
				}else if(status != null && objectNodes[i].childNodes[j].nodeName == 'status' && objectNodes[i].childNodes[j].textContent != status){
					value ='true';	// do not care object of this status type
					break;
				}
			}	// for children
			if(value == null){
				return objectNodes[i];
			}
		}
		return null;
	},
	
	/**
	 * return the li node corresponding to the given (object) node (from .data document) if one exists
	 * 
	 * @param {Node} node
	 */
	getSourceNode : function(node){
		var objectId = null;
		var objectType = null;
		for(var i=0;i<node.childNodes.length;++i){
			if(node.childNodes[i].nodeName == 'objectId'){
				objectId = node.childNodes[i].textContent;
			}else if(node.childNodes[i].nodeName == 'objectType'){
				objectType = node.childNodes[i].textContent;
			}
		}
		var li = null;
		var liNodes = null;
		switch(objectType){
			case 'KEYWORD':
				liNodes = editHandler.keywordsElement[0].getElementsByTagName('li');
				break;
			case 'FACE':
				liNodes = editHandler.facesElement[0].getElementsByTagName('li');
				break;
		}
		for(var i=0;i<liNodes.length;++i){
			if(liNodes[i].getAttribute('objectId') == objectId){
				li = liNodes[i];
				break;
			}
		}
		return li;
	},
	
	/**
	 * add the user confirmed of the given type with confidence of 1
	 * 
	 * @param {ContentAnalysis.VisualObjectType} objectType
	 * @param {String} inputElementId
	 * @return the created (added) li element or null on failure
	 */
	addConfirmed : function(objectType, inputElementId){
		var inputValue = $.trim($(inputElementId).val());
		$(inputElementId).val(null);
		if(!inputValue){
			return null;
		}
		var foundNode = editHandler.getEmptyNodeByValue(objectType, 'USER_CONFIRMED');
		if(foundNode != null){
			editHandler.getSourceNode(foundNode).getElementsByTagName('input')[0].focus();
			debug('editHandler.addConfirmed: empty tag already exists.');
			return null;
		}
		
		var objectTypeNode = editHandler.data.createElement('objectType');
		switch(objectType){
			case ContentAnalysis.VisualObjectType.KEYWORD:
				objectTypeNode.textContent = 'KEYWORD';
				break;
			case ContentAnalysis.VisualObjectType.FACE:
				objectTypeNode.textContent = 'FACE';		
				break;
			default:
				debug('editHandler.addConfirmed: unknown objectType: '+objectType);
				return null;
		}
		var objectNode = editHandler.data.createElement('object');
		objectNode.appendChild(objectTypeNode);
		
		var objectIdNode = objectNode.appendChild(editHandler.data.createElement('objectId'));
		objectIdNode.textContent = 'CABrowser_WEBUI-'+(new Date()).getTime()+Math.random();	// create sufficiently random id
		var statNode = objectNode.appendChild(editHandler.data.createElement('status'));
		statNode.textContent = 'USER_CONFIRMED';
		var valueNode = objectNode.appendChild(editHandler.data.createElement('value'));
		valueNode.textContent = inputValue;
		var confidenceNode = objectNode.appendChild(editHandler.data.createElement('confidence'));
		confidenceNode.textContent = '1';
		objectNode.setAttribute('modified','true');
		
		var li = editHandler.createLiElement(objectTypeNode.textContent, objectIdNode.textContent, statNode.textContent, valueNode.textContent, '1');
		if(li == null){
			debug('editHandler.addConfirmed: failed to create element.');
		}else{
			var objectList = editHandler.data.getElementsByTagName('objectList');// there can be only one since there is only one photo
			if(objectList.length < 1){
				objectList = editHandler.data.getElementsByTagName('media')[0].appendChild(editHandler.data.createElement('objectList'));
			}else{
				objectList = objectList[0];
			}
			objectList.appendChild(objectNode);
			
			switch(objectTypeNode.textContent){	// finally, make the new element selected
				case 'KEYWORD':
					editHandler.deselectCurrent();	//only deselect current on keywords
					break;
				case 'FACE':
					editHandler.faceSelected(li);
					break;
			}
		}	// else
		return li;
	},
	
	/**
	 * resets the canvas (removes all user drawn content)
	 */
	resetCanvas : function(){
		var canvas = editHandler.editCanvas[0];
		canvas.width = editHandler.currentImage.width;
		canvas.height = editHandler.currentImage.height;
		canvas.getContext("2d").drawImage(editHandler.currentImage,0,0);
		editHandler.rectangleTopX = null;
		editHandler.rectangleTopY = null;
		editHandler.rectangleBottomX = null;
		editHandler.rectangleBottomY = null;
	},
	
	/**
	 * saves modifications using dark high level wild magic
	 */
	saveModifications : function(){
		editHandler.deselectCurrent();
		var photoListDocument = contentAnalysis.createPhotoList();
		var photo = photoListDocument.documentElement.appendChild(photoListDocument.createElement('media'));
		var objectList = photo.appendChild(photoListDocument.createElement('objectList'));
		var modified = false;
		
		var photoChildren = editHandler.data.getElementsByTagName('media')[0].childNodes;	// there is only one
		for(var i=0;i<photoChildren.length;++i){
			if(photoChildren[i].nodeType != 1){	//do nothing if the nodeType is not ELEMENT (nodeType===1)
				continue;
			} 
			if(photoChildren[i].nodeName == 'objectList'){
				var objectChildren = photoChildren[i].childNodes;
				for(var j=0;j<objectChildren.length;++j){	// check all object-elements
					if(objectChildren[j].nodeType == 1 && objectChildren[j].getAttribute('modified')){
						for(var k=0;k<objectChildren[j].childNodes.length;++k){	// find value-element, note: optional shape may also contain value, so getElementsByTagName != ok
							if(objectChildren[j].childNodes[k].nodeName == 'value'){
								if($.trim(objectChildren[j].childNodes[k].textContent).length > 0){
									objectList.appendChild(photoListDocument.importNode(objectChildren[j], true)).removeAttribute('modified');
									modified = true;
								}else{
									debug('editHandler.saveModifications: ignored element with empty value.');
								}
								break;
							}	// if value element
						}	// for value element			
					}	// if
				}	// for object elements
			}else{
				photo.appendChild(photoListDocument.importNode(photoChildren[i], true));
				if(photoChildren[i].getAttribute('modified')){
					photo.appendChild(photoListDocument.importNode(photoChildren[i], true)).removeAttribute('modified');
					modified = true;
				}
			}	// else
		}
		
		if(modified){
			contentAnalysis.updatePhotos(editHandler.saveCompleted, photoListDocument);
			uihelper.openWaitDialog('Saving...');
		}
	},
	
	/**
	 * 
     * @param {Object} data
     * @param {Object} params
	 */
	saveCompleted : function(data, params){
		var success = contentAnalysis.isValidResponse(data);
		debug('editHandler.saveCompleted: '+success);
		if(success){
			var photoChildren = editHandler.data.getElementsByTagName('media')[0].childNodes;	// there is only one
			for(var i=0;i<photoChildren.length;++i){
				if(photoChildren[i].nodeType != 1){	//do nothing if the nodeType is not ELEMENT (nodeType===1)
					continue;
				}
				if(photoChildren[i].nodeName == 'objectList'){
					for(var j=0;j<photoChildren[i].childNodes.length;++j){
						if(photoChildren[i].childNodes[j].nodeType == 1){	//make sure the nodeType is ELEMENT (nodeType===1)
							photoChildren[i].childNodes[j].removeAttribute('modified');
						}
					}
				}else{
					photoChildren[i].removeAttribute('modified');
				}
			}	// for
			uihelper.closeWaitDialog();
			uibuttons.back();
		}else{
			uihelper.openErrorDialog('Save Failed.', 'Failed to send results.');	// this will create wait dialog automatically
		}
	}
};
