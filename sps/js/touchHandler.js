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
 *  touch handler
 */
var touchhandler = {
	swipeMinHorizontalThreshold : 170,
	swipeMinVerticalThreshold : 150,
	swipeMaxTimeThreshold : 1500, // in ms
    swipeMinTimeThreshold : 150, // in ms
    clickMaxTimeThreshold : 150, // in ms
    longClickMaxTimeThreshold : 5000, // in ms
    longClickMinTimeThreshold : 500, // in ms
    clickMaxVerticalThreshold : 50,
    clickMaxHorizontalThreshold : 50,
	
	/**
	 * 
	 * set scroll listeners for the given element, the callbacks to functions that handle previous and next functionality must be provided
	 * 
 	 * @param {HTMLElement} element
 	 * @param {callback function} previousFunction
 	 * @param {callback function} nextFunction
	 * @param {callback function} upFunction
 	 * @param {callback function} downFunction
	 */
	enableScroll : function(element, previousFunction, nextFunction, upFunction, downFunction) {
		new ScrollTouchHandler(element, previousFunction, nextFunction, upFunction, downFunction);
	},
	
	/**
	 * 
	 * set click listeners for the given element
	 * 
 	 * @param {HTMLElement} element
 	 * @param {callback function} clickCallbackFunction called when click happens, the clicked element will be passed to the callback function
 	 * @param {callback function} longClickCallbackFunction called when long click happens, the clicked element will be passed to the callback function
	 */
	enableClick : function(element, clickCallbackFunction, longClickCallbackFunction) {
		new ClickTouchHandler(element, clickCallbackFunction, longClickCallbackFunction);
	}
};

/**
 * 
 * @param {HTMLElement} element
 * @param {callback function} clickCallbackFunction called when click happens, the clicked element will be passed to the callback function
 * @param {callback function} longClickCallbackFunction called when long click happens, the clicked element will be passed to the callback function
 * 
 */
function ClickTouchHandler(element, clickCallbackFunction, longClickCallbackFunction) {
	this.previousX = 0;
	this.previousY = 0;
	this.previousTimeStamp = 0;
	this.element = element;
	this.clickCallbackFunction = clickCallbackFunction;
	this.longClickCallbackFunction = longClickCallbackFunction;
	if(Modernizr.touch){
		this.element.addEventListener('touchstart', this, false);
		this.element.addEventListener('touchend', this, false);
		this.element.addEventListener('touchcancel', this, false);
		this.element.addEventListener('touchmove', this, false);
	}else{
		this.element.addEventListener('mousedown', this, false);
		this.element.addEventListener('mouseup', this, false);
	}
}

/**
 * prototype for ClickTouchHandler
 */
ClickTouchHandler.prototype = {
	handleEvent : function(e) {
		if(e.eventPhase !== 2)	//discard all events that are either in BUBBLING or CAPTURING phase
			return;
		switch(e.type) {
			case 'mousedown':
				if(e.which !== 1)	//handle only the left mouse click
					break;
				this.touchStarted(e.timeStamp,e.clientX,e.clientY);
				e.preventDefault();
				break;
			case 'mouseup':
				if(e.which !== 1)	//handle only the left mouse click
					break;
				if(this.touchEnded(e.timeStamp,e.clientX,e.clientY)){
					e.preventDefault();
					e.stopPropagation();
				}
				break;
			case 'touchstart':
				this.touchStarted(e.timeStamp, e.touches[0].clientX, e.touches[0].clientY);
				break;
			case 'touchmove':
				e.preventDefault();	// the prevent mysterious disappearence of touchend events
				break;
			case 'touchend':
				var endPoint = e.changedTouches[0];
				if(endPoint && this.touchEnded(e.timeStamp,endPoint.clientX,endPoint.clientY)){
					e.preventDefault();
					e.stopPropagation();
				}
				break;
			case 'touchcancel':
				e.preventDefault();	// just in case
				break;
		}
	},
	
	/**
	 * 
	 * called when touch/click has been started by the user
	 * 
	 * @param {Long} timeStamp in ms
	 * @param {Long} x
	 * @param {Long} y
	 * 
	 */
	touchStarted : function(timeStamp, x, y) {
		this.previousX = x;
		this.previousY = y;
		this.previousTimeStamp = timeStamp;
	},
	
	/**
	 * 
	 * called when touch/click has been finished by the user
	 * 
	 * @param {Long} timeStamp in ms
	 * @param {Long} x
	 * @param {Long} y
	 * 
	 */
	touchEnded : function(timeStamp, x, y) {
		if(Math.abs(x-this.previousX) < touchhandler.clickMaxHorizontalThreshold && Math.abs(y-this.previousY) < touchhandler.clickMaxVerticalThreshold){
			var duration = timeStamp-this.previousTimeStamp;
			if(duration < touchhandler.clickMaxTimeThreshold){
				this.clickCallbackFunction(this.element);
				return true;
			}else if(this.longClickCallbackFunction && duration < touchhandler.longClickMaxTimeThreshold && duration > touchhandler.longClickMinTimeThreshold){
				this.longClickCallbackFunction(this.element);
				return true;
			}
		}
		return false;
	}
};

/**
 * 
 * @param {HTMLElement} element
 * @param {callback function} previousFunction
 * @param {callback function} nextFunction
 * @param {callback function} upFunction
 * @param {callback function} downFunction
 * 
 */
function ScrollTouchHandler(element, previousFunction, nextFunction, upFunction, downFunction) {
	this.element = element;
	this.previousFunction = previousFunction;
	this.nextFunction = nextFunction;
	this.upFunction = upFunction;
	this.downFunction = downFunction;

	this.previousX = 0;
	this.previousY = 0;
	this.previousTimeStamp = 0;

	if(Modernizr.touch){
		this.element.addEventListener('touchstart', this, false);
		this.element.addEventListener('touchend', this, false);
		this.element.addEventListener('touchmove', this, false);
		this.element.addEventListener('touchcancel', this, false);
	}else{
		this.element.addEventListener('mousedown', this, false);
		this.element.addEventListener('mouseup', this, false);
	}
};

/**
 * prototype for ScrollTouchHandler
 */
ScrollTouchHandler.prototype = {
	handleEvent : function(e) {
		switch(e.type) {
			case 'mousedown':
				this.touchStarted(e.timeStamp,e.clientX,e.clientY);
				e.preventDefault();
				break;
			case 'mouseup':
				if(this.touchEnded(e.timeStamp,e.clientX,e.clientY)){
					e.preventDefault();
					e.stopPropagation();
				}
				break;
			case 'touchstart':
				this.touchStarted(e.timeStamp, e.touches[0].clientX, e.touches[0].clientY);
				break;
			case 'touchmove':
				e.preventDefault();	// the prevent mysterious disappearence of touchend events
				break;
			case 'touchend':
				var endPoint = e.changedTouches[0];
				if(endPoint && this.touchEnded(e.timeStamp,endPoint.clientX,endPoint.clientY)){
					e.stopPropagation();
					e.preventDefault();
				}
				break;
			case 'touchcancel':
				e.preventDefault();	// just in case
				break;
		}
	},
	
	/**
	 * 
	 * called when touch/click has been started by the user
	 * 
	 * @param {Long} timeStamp in ms
	 * @param {Long} x
	 * @param {Long} y
	 * 
	 */
	touchStarted : function(timeStamp, x, y) {
		this.previousX = x;
		this.previousY = y;
		this.previousTimeStamp = timeStamp;
	},
	
	/**
	 * 
	 * called when touch/click has been finished by the user
	 * 
	 * @param {Long} timeStamp in ms
	 * @param {Long} x
	 * @param {Long} y
	 * 
	 */
	touchEnded : function(timeStamp, x, y) {
        var duration = 0;
		if(this.previousTimeStamp){
			duration = timeStamp - this.previousTimeStamp;
			this.previousTimeStamp = null;
		}
		if(duration > touchhandler.swipeMaxTimeThreshold || duration < touchhandler.swipeMinTimeThreshold){
			return false;
		}
		
		var difference_x = this.previousX - x;
		var difference_y = this.previousY - y;
		if(Math.abs(difference_x) > touchhandler.swipeMinHorizontalThreshold){
			if(difference_x < 0){	// movement to left
				this.previousFunction();
			}else{	// movement to right
				this.nextFunction();
			}
		}else if(Math.abs(difference_y) > touchhandler.swipeMinVerticalThreshold){
			if(difference_y > 0){	// movement to up
				if(this.upFunction)
					this.upFunction();
			}else if(this.downFunction){	// movement to down	and callback given
				this.downFunction();
			}
		}
		return true;
	},
};
