/**
 * Tag manager plugin for jQuery.
 * version 0.1.1
 * Kane Cohen [KaneCohen@gmail.com] | https://github.com/KaneCohen | https://github.com/KaneCohen/tokenizer
 * @preserve
 */
(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	} else {
		factory(jQuery);
	}
}(function($) {
	$.fn.tokenizer = function(options) {
		var vals = [], o = {}, args = arguments;
		if ($.type(options) == 'string') {
			o = options;
		} else {
			$.extend(o, options);
			o.elements = $(this.selector);
			o.selector = this.selector;
		}
		this.each(function() {
			o.element = $(this);
			var tokenizer = $(this).parents('.tokenizer').data('tokenizer');
			if (tokenizer) {
				tokenizer.trigger.apply(tokenizer, args);
				vals.push(tokenizer.o.element);
			} else {
				new Tokenizer(o);
			}
		});

		if (vals.length == 1) {
			return vals[0];
		} else if (vals.length > 1) {
			return vals;
		}
		return this;
	};

	var defaultVars = {
		keys : {
			8:   'backspace',
			9:   'tab',
			13:  'enter',
			27:  'escape',
			37:  'left',
			38:  'up',
			39:  'right',
			40:  'down',
			46:  'delete',
			108: 'numpadEnter'
		},
		wrapper:     null,  // Wrapper element for our input.
		typehead:    null,  // Typehead element.
		listWrapper: null,
		list:        null,
		itemsList:   null,
		activeItems: [],
		cache:       {},
		timer:       null,
		ajaxCall:    null,
		setItems:    [],
		classes: {
			wrapper: 'tokenizer',
			typehead: 'tokenizer-typehead',
			list: 'tokenizer-list'
		},
		html : {
			wrapper:     '<div class="tokenizer"/></div>',
			typehead:    '<input class="tokenizer-typehead" />',
			listWrapper: '<div class="tokenizer-list-wrapper">',
			list:        '<ul class="tokenizer-list"></ul>',
			listItem:    '<li class="list-item"></li>',
			itemsWrapper: '<div class="tokenizer-items-wrapper"><ul class="items-list"></ul></div>',
			item:         '<li class="item"><span class="item-label"></span><span class="item-remove">×</span><input type="hidden" /></li>'
		}
	};

	function guid() {
		return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	}

	function Tokenizer(o) {
		this.id = guid();
		this.o = $.extend(true, {}, this.d, o);
		this.v = $.extend(true, {}, defaultVars);
		this.init(o);
	}

	Tokenizer.prototype = {
		id: null,
		v: {},
		o: {},
		d: {
			element:          null,
			items:            [],       // List of initial items to work with.
																	// Example: [{id: 143, value: 'Hello World'}, {id: 144, value: 'Foo Bar'}].
			newItems:         true,     // Allow input (on enter) of new items.
			multiple:         true,     // Accept multiple tags per field.
			ajaxType:         'GET',    // Ajax request type.
			url:              false,    // Full server url.
			queryParam:       'q',      // What param to use when asking server for data.
			limit:            false,    // Add a limit parameter to query.
			ajaxDelay:        300,      // Dealy between last keydown event and ajax request for data.
			placeholder:      false,    // Hardcoded placeholder text. If not set, will use placeholder from the element itself.
			minChars:         2,        // Number of characters before we start to look for similar items.
			noSubmit:         true,     // Do not submit form on enter.
			start:            null ,    // Run once when we assign autoSelect to the element.
			listLength:       8,        // Max items in the list.
			itemName:         'items',  // If set, for each tag/token there will be added input field with array property name: name="itemNameAttr[]".
			newItemSuffix:    'New',    // Suffix that will be added to the new tag in case it was not available from the server.
			itemProp:         'id',     // Value that will be taken out of the results and inserted into itemAttr.
			newItemProp:      'name',   // What prop to use when creating new item.
			searchProperty:   'name',   // Which property to search for.
			callbacks: {
				itemAdd:       function(){},
				itemBuild:     function(){},
				itemRemove:	   function(){},
				parseItems:    function(){},       // Callback to create our own list. input: self, items.
				listShow:      function(){},       // Callback on list show.
				listBuild:     function(){},       // Callback to build custom list.
				listItemClick: function(){},       // Callback applied when we click on row in the list.
				ajaxBefore:    function(){},
				ajaxAfter:     function(){},
				error:         function(){}
			}
		},
		init: function() {
			this.initHtml();
			this.initEvents();
			this.initCallbacks();
			this.refreshInput();

			// Attach instance to the list of other instances.
			var tokenizers = $(document).data('tokenizers') || {};
			tokenizers[this.id] = this;
			$(document).data('tokenizers', tokenizers);
		},

		initHtml: function() {
			var self = this;
			var o = this.o,
			    v = this.v;

			o.element.wrap(v.html.wrapper);
			v.wrapper = o.element.parent();
			v.wrapper.addClass(v.classes.wrapper);

			v.typehead = $(v.html.typehead);
			v.wrapper.append(v.typehead);

			if (o.placeholder === false) {
				o.placeholder = o.element.attr('placeholder') || '';
			}
			v.typehead.attr('placeholder', o.placeholder);

			v.wrapper.css({width: o.element.width()});
			v.itemsList = $(v.html.itemsWrapper);
			v.wrapper.prepend(v.itemsList);

			v.listWrapper = $(v.html.listWrapper).hide();
			v.wrapper.append(v.listWrapper);

			o.element.hide();
			o.element.data('tokenizer', this);
			v.wrapper.data('tokenizer', this);

			if (this.length(o.items) > 0) {
				if (o.items instanceof Array) {
					v.activeItems = o.items;
				} else {
					v.activeItems = this.values(o.items);
				}
				$.each(o.items, function(k,v) {
					self.addItem(v.id);
				});
			}
			if (v.setItems.length > 1) {
				v.typehead.removeAttr('placeholder');
			}
		},

		initEvents: function() {
			var v = this.v;
			if ($(document).data('tokenizer') == undefined) {
				$(document).data('tokenizer', true);

				var wrapperClass = '.' + v.classes.wrapper;
				$(document).on('mousedown.tokenizer', function(e) {
					if (! $(e.target).is(wrapperClass) && ! $(e.target).parents().is(wrapperClass)) {
						// Destroy all lists in all tokenizers.
						var tokenizers = $(document).data('tokenizers') || {};
						$.each(tokenizers, function(k, tokenizer) {
							tokenizer.destroyList();
						});
					}
				});

				$(document).on('click.tokenizer', wrapperClass, function(e) {
					var tokenizer = $(this).data('tokenizer');
					if (tokenizer != undefined) {
						tokenizer.mouseClick(e);
						e.stopPropagation();
					}
				});

				var itemClass = '.' + v.classes.list+' li';
				$(document).on('mouseenter.tokenizer', itemClass, function(e) {
					var tokenizer = $(this).parents(wrapperClass).data('tokenizer');
					if (tokenizer != undefined) {
						tokenizer.mouseHover(e);
					}
				});

				$(document).on('mouseleave.tokenizer', itemClass, function(e) {
					var tokenizer = $(this).parents(wrapperClass).data('tokenizer');
					if (tokenizer != undefined) {
						tokenizer.mouseLeave(e);
					}
				});

				var typeheadClass = '.' + v.classes.typehead;
				$(document).on('focusin.tokenizer', typeheadClass, function(e) {
					var tokenizer = $(this).parents(wrapperClass).data('tokenizer');
					if (tokenizer != undefined) {
						$(document).off('keydown.tokenizer');
						$(document).on('keydown.tokenizer', typeheadClass, function(e) {
							tokenizer.keyDown(e);
							e.stopPropagation();
						});
					}
					$(document).on('focusout.tokenizer', typeheadClass, function(e) {
						$(document).off('keydown.tokenizer');
						$(document).off('focusout.tokenizer');
						e.stopPropagation();
					});
					e.stopPropagation();
				});
			}
		},

		initCallbacks: function() {
			var self = this;
			$.each(this.o.callbacks, function(k) {
				self.o.callbacks[k] = function() {
					var args = Array.prototype.slice.call(arguments);
					return self.o.element.triggerHandler(k, args);
				};
			});
		},

		bounds: function() {
			return this.v.wrapper[0].getBoundingClientRect();
		},

		keyDown: function(e) {
			var self = this;
			setTimeout(function() {
				self.resizeInput(self.v.typehead.val());
			}, 1);

			// Find out keycode.
			if (this.v.keys[e.keyCode] != undefined) {
				// Functional key.
				this.keyAction(e);
			} else {
				clearTimeout(this.v.timer);
				if (this.v.ajaxCall !== null) {
					this.v.ajaxCall.abort();
					this.v.ajaxCall = null;
				}
				setTimeout(function() {
					self.keyChar(e);
				}, 1);
			}
		},

		keyChar: function() {
			var self = this;
			// We've got an input to deal with.
			var val = this.v.typehead.val();
			if (val.length < this.o.minChars) {
				this.destroyList();
				return false;
			}
			if (this.v.setItems.length == 1 && ! this.o.multiple) {
				this.trigger('error');
				return false;
			}

			// Check if last character is a comma - add new item.
			if (val[val.length-1] == ',') {
				this.newItem(val.slice(0, val.length-1));
				this.refreshInput();
				return false;
			}

			// Check if we have cache with this val.
			if (this.v.cache[val] == undefined) {
				// Get new data.
				if (this.o.url) {
					this.v.timer = setTimeout(function() {
						self.loadData(val);
					}, this.o.ajaxDelay);
				}
			} else {
				// work with cache data
				this.v.activeItems = this.v.cache[val];
				this.buildList(this.filterItems(this.v.cache[val]));
			}
			return false;
		},

		keyAction: function(e) {
			var self = this,
			    keyName = this.v.keys[e.keyCode],
			    val = $.trim(this.v.typehead.val()),
			    id = false;
			if (this.v.list) {
				id = this.v.list.find('li.selected').data('id');
			}
			switch (keyName) {
				case 'esc':
					this.destroyList();
					break;
				case 'up':
					this.selectPrevItem();
					break;
				case 'down':
					this.selectNextItem();
					break;
				default:
					if (keyName == 'enter' || keyName == 'numpadEnter' || keyName == 'tab') {
						if (this.v.ajaxCall !== null) {
							this.v.ajaxCall.abort();
							this.v.ajaxCall = null;
						}
						if (this.v.list) {
							this.addItem(id);
							this.refreshInput();
						} else if (val.length > 0) {
							this.newItem(val);
							this.refreshInput();
						}
						this.v.activeItems = [];
						this.destroyList();
						if (val.length > 0) {
							e.preventDefault();
						}
					} else if (keyName == 'backspace' || keyName == 'delete') {
						if (this.v.ajaxCall !== null) {
							this.v.ajaxCall.abort();
							this.v.ajaxCall = null;
						}
						if (val.length < this.o.minChars) {
							this.destroyList();
							if (val.length === 0 && this.v.setItems.length > 0) {
								var item = this.v.setItems[(this.v.setItems.length-1)];
								this.removeItem(item.id);
								this.v.typehead.change();
							}
							return;
						}
						this.v.timer = setTimeout(function() {
							self.keyChar(e);
						}, this.o.ajaxDelay);
					}
					break;
			}
			return;
		},

		selectPrevItem: function() {
			var list = this.v.list;
			if (list) {
				var s = list.find('li.selected');
				var index = s.index();
				if (index == -1) {
					list.find('li').last().addClass('selected');
				} else if (index != -1 && index > 0) {
					s.removeClass('selected');
					s.prev().addClass('selected');
				} else if (index === 0) {
					s.removeClass('selected');
				}
			}
		},

		selectNextItem: function() {
			var list = this.v.list;
			if (list) {
				var s = list.find('li.selected');
				var l = list.find('li').length;
				var index = s.index();
				if (index == -1) {
					list.find('li').first().addClass('selected');
				} else if (index != -1 && index < (l-1)) {
					s.removeClass('selected');
					s.next().addClass('selected');
				} else if (index == (l-1)) {
					s.removeClass('selected');
				}
			}
		},

		mouseClick: function(e) {
			var target = $(e.target);

			if (target.hasClass('item-remove')) {
				this.removeItem(target.parents('.item').data('id'));
			} else if (target.hasClass('list-item')) {
				if (this.trigger('list-item-click', e) === false) {
					return;
				}
				this.addItem(target.data('id'));
				this.destroyList();
				this.refreshInput();
			} else {
				this.v.typehead.focus();
				this.keyChar();
			}
		},

		mouseHover: function(e) {
			this.v.wrapper.find('li.selected').removeClass('selected');
			$(e.target).addClass('selected');
		},

		mouseLeave: function(e) {
			if ($(e.target).data('key') === 0) {
				$(e.target).removeClass('selected');
			}
		},

		clearItems: function() {
			this.v.setItems = [];
			this.v.itemsList.empty();
		},

		destroyList: function() {
			if (this.v.list) {
				this.v.listWrapper.hide().empty();
				this.v.list = null;
			}
		},

		buildList: function(items) {
			var self = this,
					o = this.o,
					v = this.v,
					b = this.bounds();

			newItems = this.trigger('parseItems', items, this);
			if (newItems.length != undefined && newItems.length >= 0) {
				items = newItems;
			}
			if (items.length === 0) {
				return false;
			}

			// Create list.
			v.list = $(v.html.list);
			$.each(items, function(k,v) {
				if (k >= o.listLength) return false;

				var el = self.trigger('listBuild');
				if (el === true) {
					el = $(self.v.html.listItem)
						.attr('data-id', v['id'])
						.attr('data-key', k)
						.attr('title', v[o.searchProperty])
						.html(v[o.searchProperty]);
					if (k === 0) {
						el.addClass('selected');
					}
				}
				self.v.list.append(el);
			});

			v.listWrapper.html(v.list);
			v.listWrapper.addClass(this.v.classes.list)
				.css({top: b.height}).show();

			this.trigger('listShow');
		},

		filterItems: function(items) {
			var self = this;
			if (self.v.setItems.length === 0) return items;

			var filteredItems = [];
			$.each(items, function(k,v) {
				$.each(self.v.setItems, function(i,t) {
					if (v.id == t.id) {
						return false;
					}
					if (i == self.v.setItems.length-1) {
						filteredItems.push(v);
					}
				});
			});

			return filteredItems;
		},

		getItem: function(val, prop) {
			if (prop == undefined) {
				prop = 'id';
			}

			var item = false;
			$.each(this.v.activeItems, function(k,v) {
				if (prop == 'id') {
					if (v[prop] == val) {
						item = v;
						return false;
					}
				} else {
					if (v[prop] != undefined && $.type(v[prop]) == 'string' && v[prop].toLowerCase() == val.toLowerCase()) {
						item = v;
						return false;
					}
				}
			});

			return item;
		},

		// Add iteam via json object.
		setItem: function(val) {
			var item = this.getItem(val, this.o.searchProperty);
			if (! item && val != undefined) {
				if (! this.o.newItems && val.id == undefined) {
					return false;
				}
				this.o.activeItems.push(val);
				this.addItem(val.id);
				this.refreshInput();
			}
		},

		newItem: function(val) {
			// First, check if we have a item with excatly same name in our active list?
			var item = this.getItem(val, this.o.searchProperty);
			if (! item ) {
				if (! this.o.newItems ) return false;
				var id = 'new-'+guid();
				item = {id: id, newItem: true};
				item[this.o.searchProperty] = $.trim(val);
				this.v.activeItems.push(item);
			}
			this.addItem(item.id);
			this.refreshInput();
			return true;
		},

		addItem: function(id) {
			var o = this.o, v = this.v;
			var itemEl = $(v.html.item);
			var input = itemEl.find('input');
			if (v.setItems.length === 1 && ! o.multiple) {
				this.trigger('error');
				return false;
			}
			var item = this.getItem(id);
			if (item) {
				if (this.trigger('itemAdd', item, this) === false) {
					return false;
				}
				itemEl.find('.item-label').text(item[o.searchProperty]).parent().attr('data-id', id);
				if (item.newItem) {
					input.attr('name', o.itemName+o.newItemSuffix+'[]');
					input.val(item[o.newItemProp]);
				} else {
					input.attr('name', o.itemName+'[]');
					input.val(item[o.itemProp]);
				}
				this.trigger('itemBuild', item, itemEl, this);
				v.itemsList.append(itemEl);
				v.setItems.push(item);
				var inputArray = [];
				$.each(v.setItems, function(k,v) {
					inputArray.push(v.name);
				});
				this.o.element.val(inputArray.join(', '));
			} else if (this.o.newItems) {
				this.newItem(this.v.typehead.val());
			}
			return false;
		},

		removeItem: function(id) {
			var self = this;
			if (this.v.setItems.length > 0) {
				$.each(this.v.setItems, function(k,v) {
					if (v.id == id) {
						if (self.trigger('itemRemove', v) === false ) {
							return false;
						}
						self.v.setItems.splice(k,1);
						self.v.itemsList.find('[data-id="'+id+'"]').remove();
						self.v.typehead.change();
						return false;
					}
				});
			}
			this.refreshInput();
		},

		getItems: function() {
			return this.v.setItems;
		},

		refreshInput: function(focus) {
			if (focus !== false) {
				this.v.typehead.val('').change().focus();
			} else {
				this.v.typehead.val('').change();
			}
			this.resizeInput('');
			if (this.v.setItems.length > 0) {
				this.v.typehead.attr('placeholder', null);
			} else {
				this.v.typehead.attr('placeholder', this.o.placeholder);
			}
		},

		resizeInput: function(val) {
			var style = window.getComputedStyle(this.v.wrapper[0]);
			var compensate = parseInt(style['padding-left'], 10) + parseInt(style['paddingRight'], 10);
			var b = this.bounds();

			if ($('#tokenizer-text-length').length === 0) {
				var textHolder = $(document.createElement('div'))
					.attr('id', 'tokenizer-text-length')
					.css({
						width: 'auto',
						height: 'auto',
						overflow: 'hidden',
						whiteSpace: 'pre',
						maxWidth: b.width - compensate,
						position: 'fixed',
						top: -100,
						left: -1000,
						fontSize: style['fontSize']
					}).text(val);
				$('body').append(textHolder);
			} else {
				$('#tokenizer-text-length').text(val);
			}
			var w = $('#tokenizer-text-length').width();

			// Set low width to stack if there's still some place.
			this.v.typehead[0].style.width = '20px';
			var rw = b.width - this.v.typehead.position().left - parseInt(style['paddingLeft'], 10);
			if (w > rw) {
				this.v.typehead[0].style.width = b.width - compensate + 'px';
			} else {
				this.v.typehead[0].style.width = rw + 'px';
			}
		},

		loadData: function(val) {
			var self = this,
			    o = this.o,
			    v = this.v,
			    inputData = {};

			// Build get string.
			inputData[o.queryParam] = val;
			inputData['timestamp'] = Math.round((new Date).getTime()/1000);

			if (o.limit) {
				inputData[o.limit] = o.limit;
			}

			if (this.trigger('ajaxBefore') === false) return false;

			v.ajaxCall = $.ajax({
				url: o.url,
				type: o.ajaxType,
				data: inputData,
				dataType: 'JSON'
			}).done(function(response) {
				if (self.trigger('ajaxAfter') === false) return false;
				self.v.activeItems = response;
				self.v.cache[val] = response;
				self.buildList(self.filterItems(response));
			});
		},

		destroy: function() {
			this.o.element.removeData('tokenizer');
			var el = this.o.element;
			o.wrapper.replaceWith(el);
			el.show();

			// Remove instance from document data.
			var tokenizers = $(document).data('tokenizers') || {};
			delete tokenizers[this.id];
			$(document).data('tokenizers', tokenizers);
		},

		values: function(object) {
			return $.map(object, function(k) { return k; });
		},

		length: function(object) {
			var size = 0;

			if (typeof(object) != 'object') {
				if (object.length == undefined) return 0;
				return object.length;
			}

			for (key in object) {
				if (object.hasOwnProperty(key)) size++;
			}

			return size;
		},

		trigger: function(name) {
			var args = Array.prototype.slice.call(arguments, 1);

			if (this.o.callbacks[name] != undefined) {
				var call = this.o.callbacks[name].apply(this, args);
				if (call === undefined) {
					return true;
				}
				return call;
			}

			if (this[name]) {
				if (this[name].apply(this, args) === false)
					return false;
			}

			return true;
		}
	};
}));
