/*!
*   This file is part of Aloha Editor
*   Author & Copyright (c) 2010 Gentics Software GmbH, aloha@gentics.com
*   Licensed unter the terms of http://www.aloha-editor.com/license.html
*//*
*	Aloha Editor is free software: you can redistribute it and/or modify
*   it under the terms of the GNU Affero General Public License as published by
*   the Free Software Foundation, either version 3 of the License, or
*   (at your option) any later version.*
*
*   Aloha Editor is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU Affero General Public License for more details.
*
*   You should have received a copy of the GNU Affero General Public License
*   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/**
 * Editable object
 * @namespace GENTICS.Aloha
 * @class Editable
 * @method
 * @constructor
 * @param {Object} obj jQuery object reference to the object
 */
GENTICS.Aloha.Editable = function(obj) {
	
	// check wheter the object has an ID otherwise generate and set globally unique ID
	if ( !obj.attr('id') ) {
		obj.attr('id', GENTICS.Utils.guid());
	}

	// store object reference
	this.obj = obj;
	this.originalObj = obj;

	// the editable is not yet ready
	this.ready = false;

	// delimiters, timer and idle for smartContentChange
	// smartContentChange triggers -- tab: '\u0009' - space: '\u0020' - enter: 'Enter'
	this.sccDelimiters = [':', ';', '.', '!', '?', '\u0009', 'Enter'];
	this.sccIdle = 10000;
	this.sccDelay = 1000;
	this.sccTimerIdle = false;
	this.sccTimerDelay = false;
	
	// register the editable with Aloha
	GENTICS.Aloha.registerEditable(this);

	// try to initialize the editable
	this.init();
};

GENTICS.Aloha.Editable.prototype = {
	/**
	 * True, if this editable is active for editing
	 * @property
	 * @type boolean
	 */
	isActive: false,

	/**
	 * stores the original content to determine if it has been modified
	 * @hide
	 */
	originalContent: null,

	/**
	 * every time a selection is made in the current editable the selection has to
	 * be saved for further use
	 * @hide
	 */
	range: undefined,

	/**
	 * Check if object can be edited by Aloha Editor
	 * @return {boolean } editable true if Aloha Editor can handle else false 
	 * @hide
	 */
	check: function() {
	
		/* TODO check those elements
		'map', 'meter', 'object', 'output', 'progress', 'samp',
		'time', 'area', 'datalist', 'figure', 'kbd', 'keygen',
		'mark', 'math', 'wbr', 'area',
		*/
	
		// Extract El
		var	that = this,
			obj = this.obj,
			el = obj.get(0),
			nodeName = el.nodeName.toLowerCase(),
	
		// supported elements
			textElements = [ 'a', 'abbr', 'address', 'article', 'aside',
					'b', 'bdo', 'blockquote',  'cite', 'code', 'command',
					'del', 'details', 'dfn', 'div', 'dl', 'em', 'footer', 'h1', 'h2',
					'h3', 'h4', 'h5', 'h6', 'header', 'i', 'ins', 'menu',
					'nav', 'p', 'pre', 'q', 'ruby',  'section', 'small',
					'span', 'strong',  'sub', 'sup', 'var']; 	
	
		for (var i = 0; i < textElements.length; i++) {
			if ( nodeName == textElements[i] ) {
				return true;
			}
		}
	
		// special handled elements
		switch ( nodeName ) {
			case 'label':
			case 'button':
				// TODO need some special handling.
				break;
		
			case 'textarea':
				// Create a div alongside the textarea
				var div = jQuery('<div id="'+this.getId()+'-aloha" class="GENTICS_textarea"/>').insertAfter(obj);
				// Resize the div to the textarea
				div.height(obj.height())
				   .width(obj.width())
				// Populate the div with the value of the textarea
				   .html(obj.val());
				// Hide the textarea
				obj.hide();
				// Attach a onsubmit to the form to place the HTML of the div back into the textarea
				var updateFunction = function(){
					var val = that.getContents();
					obj.val(val);
				};
				obj.parents('form:first').submit(updateFunction);
				// Swap textarea reference with the new div
				this.obj = div;
				// Supported
				return true;
			
			default:
				break;
		}
				
		// the following elements are not supported
		/*		
		'canvas', 'audio', 'br', 'embed', 'fieldset', 'hgroup', 'hr', 
		'iframe', 'img', 'input', 'map', 'script', 'select', 'style', 
		'svg', 'table', 'ul', 'video', 'ol', 'form', 'noscript',
		 */
		return false;
	},


	/**
	 * Initialize the editable
	 * @return void
	 * @hide
	 */
	init: function() {
		var that = this;
	
		// smartContentChange settings
		if (GENTICS.Aloha.settings && GENTICS.Aloha.settings.smartContentChange) {
			if (GENTICS.Aloha.settings.smartContentChange.delimiters) {
				this.sccDelimiters = GENTICS.Aloha.settings.smartContentChange.delimiters;
			} else {
				this.sccDelimiters = this.sccDelimiters;
			}
		
			if (GENTICS.Aloha.settings.smartContentChange.idle) {
				this.sccIdle = GENTICS.Aloha.settings.smartContentChange.idle;
			} else {
				this.sccIdle = this.sccIdle;
			}
		
			if (GENTICS.Aloha.settings.smartContentChange.delay) {
				this.sccDelay = GENTICS.Aloha.settings.smartContentChange.delay;
			} else {
				this.sccDelay = this.sccDelay;
			}
		}
	
		// check if Aloha can handle the obj as Editable
		if ( !this.check( this.obj ) ) {
			//GENTICS.Aloha.log('warn', this, 'Aloha cannot handle {' + this.obj[0].nodeName + '}');
			this.destroy();
			return;
		}
	
		// only initialize the editable when Aloha is ready
		if (GENTICS.Aloha.ready) {

			// initialize the object
			this.obj.addClass('GENTICS_editable')
				    .contentEditable(true);
		
			// add focus event to the object to activate
			this.obj.mousedown(function(e) {
				return that.activate(e);
			});
		
			this.obj.focus(function(e) {
				return that.activate(e);
			});
		
			// by catching the keydown we can prevent the browser from doing its own thing
			// if it does not handle the keyStroke it returns true and therefore all other
			// events (incl. browser's) continue
			this.obj.keydown( function(event) { 
				return GENTICS.Aloha.Markup.preProcessKeyStrokes(event);
			});
		
			// handle shortcut keys
			this.obj.keyup( function(event) { 
				if (event['keyCode'] == 27 ) {
					GENTICS.Aloha.deactivateEditable();
					return false;
				}
			
				// check if this key stroke triggers a smartContentChange
				GENTICS.Aloha.activeEditable.smartContentChange(event);
			});
		
			// register the onSelectionChange Event with the Editable field
			this.obj.GENTICS_contentEditableSelectionChange(function (event) {
				GENTICS.Aloha.Selection.onChange(that.obj, event);
				return that.obj;
			});
		
			// throw a new event when the editable has been created
			/**
			 * @event editableCreated fires after a new editable has been created, eg. via $('#editme').aloha()
			 * The event is triggered in Aloha's global scope GENTICS.Aloha
			 * @param {Event} e the event object
			 * @param {Array} a an array which contains a reference to the currently created editable on its first position 
			 */
			GENTICS.Aloha.EventRegistry.trigger(
				new GENTICS.Aloha.Event(
					'editableCreated',
					GENTICS.Aloha,
					[ this ]
				)
			);

			// mark the editable as unmodified
			this.setUnmodified();
		
			this.snapshotContent = this.getContents();

			// now the editable is ready
			this.ready = true;
		}
	},

	/**
	 * destroy the editable
	 * @return void
	 */
	destroy: function() {
		
		// leave the element just to get sure
		if (this == GENTICS.Aloha.getActiveEditable()) {
			this.blur();
			
			// also hide the floating menu if the current editable was active
			GENTICS.Aloha.FloatingMenu.obj.hide();
			GENTICS.Aloha.FloatingMenu.shadow.hide();
		}
	
		// original Object
		var	that = this,
			oo = this.originalObj.get(0),
			onn = oo.nodeName.toLowerCase();
	
		// special handled elements
		switch ( onn ) {
			case 'label':
			case 'button':
				// TODO need some special handling.
				break;
		
			case 'textarea':
				// restore content to original textarea
				var val = this.getContents();
				this.originalObj.val(val);
				this.obj.remove();
				this.originalObj.show();
			
			default:
				break;
		}
		
		// now the editable is not ready any more
		this.ready = false;

		// initialize the object
		this.obj.removeClass('GENTICS_editable')
		// Disable contentEditable
			    .contentEditable(false)
		
		// unbind all events 
		// TODO should only unbind the specific handlers.
			    .unbind('mousedown focus keydown keyup'); 
	
		/* TODO remove this event, it should implemented as bind and unbind
		// register the onSelectionChange Event with the Editable field
		this.obj.GENTICS_contentEditableSelectionChange(function (event) {
			GENTICS.Aloha.Selection.onChange(that.obj, event);
			return that.obj;
		});
		*/
		
		// throw a new event when the editable has been created
		/**
		 * @event editableCreated fires after a new editable has been destroyes, eg. via $('#editme').mahalo()
		 * The event is triggered in Aloha's global scope GENTICS.Aloha
		 * @param {Event} e the event object
		 * @param {Array} a an array which contains a reference to the currently created editable on its first position 
		 */
		GENTICS.Aloha.EventRegistry.trigger(
			new GENTICS.Aloha.Event(
				'editableDestroyed',
				GENTICS.Aloha,
				[ this ]
			)
		);
		
		// finally register the editable with Aloha
		GENTICS.Aloha.unregisterEditable(this);

	},

	/**
	 * marks the editables current state as unmodified. Use this method to inform the editable
	 * that it's contents have been saved
	 * @method
	 */
	setUnmodified: function () {
		this.originalContent = this.getContents();
	},

	/**
	 * check if the editable has been modified during the edit process#
	 * @method
	 * @return boolean true if the editable has been modified, false otherwise
	 */
	isModified: function () {
		return this.originalContent != this.getContents();
	},

	/**
	 * String representation of the object
	 * @method
	 * @return GENTICS.Aloha.Editable
	 */
	toString: function() {  
		return 'GENTICS.Aloha.Editable';
	},

	/**
	 * check whether the editable has been disabled 
	 */
	isDisabled: function () {
		return !this.obj.contentEditable() || this.obj.contentEditable() === 'false';
	},

	/**
	 * disable this editable
	 * a disabled editable cannot be written on by keyboard
	 */
	disable: function() {
		this.isDisabled() || this.obj.contentEditable(false);
	},

	/**
	 * enable this editable
	 * reenables a disabled editable to be writteable again 
	 */
	enable: function() {
		this.isDisabled() && this.obj.contentEditable(true);
	},


	/**
	 * activates an Editable for editing
	 * disables all other active items
	 * @method
	 */
	activate: function(e) {
		// stop event propagation for nested editables
		if (e) {
			e.stopPropagation();
		}

		// get active Editable before setting the new one.
		var oldActive = GENTICS.Aloha.getActiveEditable(); 

		// handle special case in which a nested editable is focused by a click
		// in this case the "focus" event would be triggered on the parent element
		// which actually shifts the focus away to it's parent. this if is here to
		// prevent this situation
		if (e && e.type == 'focus' && oldActive != null && oldActive.obj.parent().get(0) == e.currentTarget) {
			return;
		}uniChar = null
	
		// leave immediately if this is already the active editable
		if (this.isActive || this.isDisabled()) {
			// we don't want parent editables to be triggered as well, so return false
			return;
		}

	
		// set active Editable in core
		GENTICS.Aloha.activateEditable( this );
	
		// ie specific: trigger one mouseup click to update the range-object
		if (document.selection && document.selection.createRange) {
			this.obj.mouseup();
		}

		// finally mark this object as active
		this.isActive = true;
	
		/**
		 * @event editableActivated fires after the editable has been activated by clicking on it.
		 * This event is triggered in Aloha's global scope GENTICS.Aloha
		 * @param {Event} e the event object
		 * @param {Array} a an array which contains a reference to last active editable on its first position, as well
		 * as the currently active editable on it's second position 
		 */
		// trigger a 'general' editableActivated event
		GENTICS.Aloha.EventRegistry.trigger(
			new GENTICS.Aloha.Event('editableActivated', GENTICS.Aloha, {
				'oldActive' : oldActive,
				'editable' : this
			})
		);

		/**
		 * @event editableActivated fires after the editable has been activated by clicking on it.
		 * This event is triggered in the Editable's local scope
		 * @param {Event} e the event object
		 * @param {Array} a an array which contains a reference to last active editable on its first position 
		 */
		// and trigger our *finished* event
		GENTICS.Aloha.EventRegistry.trigger(
			new GENTICS.Aloha.Event('editableActivated', this, {
				'oldActive' : GENTICS.Aloha.getActiveEditable()
			})
		);
	},

	/**
	 * handle the blur event
	 * this must not be attached to the blur event, which will trigger far too often
	 * eg. when a table within an editable is selected
	 * @hide 
	 */
	blur: function() {

		// blur this contenteditable
		this.obj.blur();

		// disable active status
		this.isActive = false;
	
		/**
		 * @event editableDeactivated fires after the editable has been activated by clicking on it.
		 * This event is triggered in Aloha's global scope GENTICS.Aloha
		 * @param {Event} e the event object
		 * @param {Array} a an array which contains a reference to this editable 
		 */
		// trigger a 'general' editableDeactivated event
		GENTICS.Aloha.EventRegistry.trigger(
			new GENTICS.Aloha.Event('editableDeactivated', GENTICS.Aloha, {
				'editable' : this
			})
		);

		/**
		 * @event editableDeactivated fires after the editable has been activated by clicking on it.
		 * This event is triggered in the Editable's scope
		 * @param {Event} e the event object
		 */
		GENTICS.Aloha.EventRegistry.trigger(
			new GENTICS.Aloha.Event('editableDeactivated', this)
		);
	
		/**
		 * @event smartContentChanged
		 */
		GENTICS.Aloha.activeEditable.smartContentChange({type : 'blur'}, null);
	},

	/**
	 * check if the string is empty
	 * used for zerowidth check
	 * @return true if empty or string is null, false otherwise
	 * @hide
	 */
	empty: function(str) {
		return (null === str)
		// br is needed for chrome
		|| (jQuery.trim(str) == '' || str == '<br/>');
	},

	/**
	 * Get the contents of this editable as a HTML string
	 * @method
	 * @return contents of the editable
	 */
	getContents: function() {
		// clone the object
		var clonedObj = this.obj.clone();

		// do core cleanup
		clonedObj.find('.GENTICS_cleanme').remove();

		GENTICS.Aloha.PluginRegistry.makeClean(clonedObj);
		return clonedObj.html();
	},

	/**
	 * Get the id of this editable
	 * @method
	 * @return id of this editable
	 */
	getId: function() {
		return this.obj.attr('id');
	},

	/**
	 * Handle a smartContentChange; This is used for smart actions within the content/while editing.
	 * @hide
	 */
	smartContentChange: function(event) {
		var that = this,
			uniChar = null;
	
		clearTimeout(this.sccTimerDelay);
		clearTimeout(this.sccTimerIdle);
	
		if (this.snapshotContent == GENTICS.Aloha.activeEditable.getContents()) {
			return false;
		}

		// ignore meta keys like crtl+v or crtl+l and so on
		if (event && (event.metaKey || event.crtlKey || event.altKey)) {
			return false;
		}
	
		// regex unicode
		if (event && event.originalEvent) {
		
			var re = new RegExp("U\\+(\\w{4})"),
				match = re.exec(event.originalEvent.keyIdentifier);
			if (match !== null) {
				uniChar = eval('"\\u' + match[1] + '"');
			}
			if (uniChar === null) {
				uniChar = event.originalEvent.keyIdentifier;
			}
		}
	
		// handle "Enter" -- it's not "U+1234" -- when returned via "event.originalEvent.keyIdentifier"
		// reference: http://www.w3.org/TR/2007/WD-DOM-Level-3-Events-20071221/keyset.html
		if (jQuery.inArray(uniChar, this.sccDelimiters) >= 0) {
		
			clearTimeout(this.sccTimerIdle);
		
			this.sccTimerDelay = setTimeout(function() {
			
				GENTICS.Aloha.EventRegistry.trigger(
					new GENTICS.Aloha.Event('smartContentChanged', GENTICS.Aloha, {
					'editable' : GENTICS.Aloha.activeEditable,
					'keyIdentifier' : event.originalEvent.keyIdentifier,
					'keyCode' : event.keyCode,
					'char' : uniChar,
					'triggerType' : 'keypress', // keypress, timer, blur, paste
					'snapshotContent' : that.getSnapshotContent()
					})
				);

				GENTICS.Aloha.Log.debug(this, 'smartContentChanged: event type keypress triggered');
				
				var r = GENTICS.Aloha.Selection.rangeObject;
				if (r.isCollapsed()
					&& r.startContainer.nodeType == 3) {
					
					var posDummy = jQuery('<span id="GENTICS-Aloha-PosDummy" />');
					
					GENTICS.Utils.Dom.insertIntoDOM(
						posDummy,
						r,
						this.obj,
						null,
						false,
						false
					);
					
					console.log(posDummy.offset().top, posDummy.offset().left);
					
					GENTICS.Utils.Dom.removeFromDOM(
						posDummy,
						r,
						false
					);
					
					r.select();
				}
			},this.sccDelay);
		}

		else if (uniChar != null) {

			this.sccTimerIdle = setTimeout(function() {
				// in the rare case idle time is lower then delay time
				clearTimeout(this.sccTimerDelay);
				GENTICS.Aloha.EventRegistry.trigger(
					new GENTICS.Aloha.Event('smartContentChanged', GENTICS.Aloha, {
					'editable' : GENTICS.Aloha.activeEditable,
					'keyIdentifier' : null,
					'keyCode' : null,
					'char' : null,
					'triggerType' : 'idle',
					'snapshotContent' : that.getSnapshotContent()
					})
				);
			
				GENTICS.Aloha.Log.debug(this, 'smartContentChanged: event type timer triggered');
			},this.sccIdle);
		
		}

		else if (event && event.type === 'paste') {
			GENTICS.Aloha.EventRegistry.trigger(
				new GENTICS.Aloha.Event('smartContentChanged', GENTICS.Aloha, {
				'editable' : GENTICS.Aloha.activeEditable,
				'keyIdentifier' : null,
				'keyCode' : null,
				'char' : null,
				'triggerType' : 'paste', // paste
				'snapshotContent' : that.getSnapshotContent()
				})
			);
		
			GENTICS.Aloha.Log.debug(this, 'smartContentChanged: event type paste triggered');
		}

		else if (event && event.type === 'blur') {
			GENTICS.Aloha.EventRegistry.trigger(
				new GENTICS.Aloha.Event('smartContentChanged', GENTICS.Aloha, {
				'editable' : GENTICS.Aloha.activeEditable,
				'keyIdentifier' : null,
				'keyCode' : null,
				'char' : null,
				'triggerType' : 'blur',
				'snapshotContent' : that.getSnapshotContent()
				})
			);
		
			GENTICS.Aloha.Log.debug(this, 'smartContentChanged: event type blur triggered');
		}

	},

	/**
	 * Get a snapshot of the active editable as a HTML string
	 * @hide
	 * @return snapshot of the editable
	 */
	getSnapshotContent: function() {	
		var ret = this.snapshotContent;
	
		this.snapshotContent = this.getContents();
	
		return ret;
	}
};
