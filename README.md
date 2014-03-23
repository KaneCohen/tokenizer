Tokenizer
=========

jQuery tag manager plugin

When applied to the <input> tag, will wrap itself around that tag and display
simple to use tag picker similar to one that is used by Facebook on various
pages and to the Gmail email manager (when writing new email on "To" field).

Loaded as any other jQuery plugin (add .js file after jquery). Works with AMD.

How to use:

Client side:

````js
$('input').tokenizer({url: 'http://example.com/tags')});
````

Tokenizer is quite opinionated in what type of data it woul digest from the server.

Server side:

1. Server must return JSON data
2. Data must be an array of Objects
3. By Default, each Object must contain `id` and `value` properties
4. On form submit of existing tags, server by Default will receive an item with
the name of `items[]` - an array containing IDs of the picked tags
5. On form submit of new tags, server by Default will receive an item with the
name of `itemsNew[]` - an array containing strings of new tags

Almost every param can be changed during setup:

````js
// Set new POST property to 'tags'
$('input').tokenizer({url: 'http://example.com/tags'), itemName: 'tags'});
// On submit, server will receive 'tags[]' array containing IDs or String of the tags
````

TODO:

* Dossier docs
* CSS
* Item highlighting
* Rewrite for non jQuery use with AMD

