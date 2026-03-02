'use strict';
// @esm-group Layout

/**
 * Carousel layout — manages page transitions by swapping widget trees on a
 * shared screen.
 *
 * On each move(), the carousel detaches every descendant of every screen child
 * (bottom-up, deepest first) before detaching the direct children themselves.
 * This prevents stale widget accumulation across page transitions: without the
 * recursive cleanup, descendants of container widgets (e.g. grid children
 * inside a chrome box) survive the transition and crash when new widgets try
 * to reinitialize shared resources like Canvas rendering contexts.
 */

/**
 * Recursively detach a node and all its descendants, bottom-up.
 *
 * Recurses into children before detaching the node itself, so the deepest
 * descendants are removed first. Uses while(children.length) instead of
 * index-based iteration because detach() splices the child out of its parent's
 * children array — always processing index 0 avoids skipping elements.
 *
 * @param {Object} node - Blessed Node instance (any element with .children and .detach())
 */
function detachAll(node) {
  // Bottom-up: recursively detach all children before detaching this node.
  // Each detachAll(children[0]) call removes that child from node.children,
  // so the next iteration naturally picks up the next child at index 0.
  while (node.children.length) {
    detachAll(node.children[0]);
  }
  node.detach();
}

function Carousel(pages, options) {
  this.currPage = 0;
  this.pages = pages;
  this.options = options;
  this.screen = this.options.screen;
}

Carousel.prototype.move = function() {
  // Detach all screen children and their entire descendant trees.
  // Previous behavior only detached direct children, leaving descendants
  // in their parent's children array. Those orphaned descendants accumulated
  // across page transitions and caused crashes (e.g. Canvas widgets trying
  // to reinitialize their rendering context from stale attach handlers).
  while (this.screen.children.length) {
    detachAll(this.screen.children[0]);
  }

  this.pages[this.currPage](this.screen, this.currPage);
  this.screen.render();
};

Carousel.prototype.next = function() {
  this.currPage++;
  if (this.currPage==this.pages.length){
    if (!this.options.rotate) {
      this.currPage--;
      return;
    } else {
      this.currPage=0;
    }
  }
  this.move();
};

Carousel.prototype.prev = function() {
  this.currPage--;
  if (this.currPage<0) {
    if (!this.options.rotate) {
      this.currPage++;
      return;
    } else {
      this.currPage=this.pages.length-1;
    }
  }
  this.move();
};

Carousel.prototype.home = function() {
  this.currPage = 0;
  this.move();
};

Carousel.prototype.end = function() {
  this.currPage = this.pages.length -1;
  this.move();
};

Carousel.prototype.start = function() {
  var self = this;

  this.move();

  if (this.options.interval) {
    setInterval(this.next.bind(this), this.options.interval);
  }

  if (this.options.controlKeys) {
    this.screen.key(['right', 'left', 'home', 'end'], function(ch, key) {
      if (key.name=='right') self.next();
      if (key.name=='left') self.prev();
      if (key.name=='home') self.home();
      if (key.name=='end') self.end();
    });
  }

};

module.exports = Carousel;
