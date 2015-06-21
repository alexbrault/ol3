goog.provide('ol.style.Arrow');
goog.provide('ol.style.ArrowShape');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('ol.color');
goog.require('ol.has');
goog.require('ol.render.canvas');
goog.require('ol.structs.IHasChecksum');
goog.require('ol.style.AtlasManager');
goog.require('ol.style.Fill');
goog.require('ol.style.Image');
goog.require('ol.style.ImageState');
goog.require('ol.style.Stroke');


/**
 * Enum of predefined arrow shapes
 * @enum {Array.<number>}
 */
ol.style.ArrowShape = {
  LINE_BOTH: [1, 0.2, 0.7, 0, 1, 0.2, 0.7, 0.4, 1, 0.2, 0, 0.2],
  LINE_HALF_LEFT: [1, 0.2, 0.7, 0, 1, 0.2, 0, 0],
  LINE_HALF_RIGHT: [1, 0, 0.7, 0.2, 1, 0, 0, 0],
  LINE_TIP_BOTH: [0.3, 0.2, 0, 0, 0.3, 0.2, 0, 0.4],
  LINE_TIP_HALF_LEFT: [0.3, 0.2, 0, 0],
  LINE_TIP_HALF_RIGHT: [0.3, 0, 0.0, 0.2]
};



/**
 * @classdesc
 * Set arrow style for vector features. The resulting shape will be
 * an arrow of the style and length specified
 *
 * @constructor
 * @param {olx.style.ArrowOptions} options Options.
 * @extends {ol.style.Image}
 * @implements {ol.structs.IHasChecksum}
 * @api
 */
ol.style.Arrow = function(options) {

  goog.asserts.assert(
      options.shape.length % 2 === 0,
      '"shape" must have an even number of values');

  /**
   * @private
   * @type {Array.<number>}
   */
  this.shape_ = options.shape;

  /**
  * @private
  * @type {number}
  */
  this.arrowScale_ = options.scale;

  /**
  * @private
  * @type {Array.<string>}
  */
  this.checksums_ = null;

  /**
   * @private
   * @type {HTMLCanvasElement}
   */
  this.canvas_ = null;

  /**
   * @private
   * @type {HTMLCanvasElement}
   */
  this.hitDetectionCanvas_ = null;

  /**
   * @private
   * @type {ol.style.Fill}
   */
  this.fill_ = goog.isDef(options.fill) ? options.fill : null;

  /**
   * @private
   * @type {Array.<number>}
   */
  this.origin_ = [0, 0];

  /**
   * @private
   * @type {ol.style.Stroke}
   */
  this.stroke_ = goog.isDef(options.stroke) ? options.stroke : null;

  /**
   * @private
   * @type {Array.<number>}
   */
  this.anchor_ = null;

  /**
   * @private
   * @type {ol.Size}
   */
  this.size_ = null;

  /**
   * @private
   * @type {ol.Size}
   */
  this.imageSize_ = null;

  /**
   * @private
   * @type {ol.Size}
   */
  this.hitDetectionImageSize_ = null;

  this.render_(options.atlasManager);

  /**
   * @type {boolean}
   */
  var snapToPixel = goog.isDef(options.snapToPixel) ?
      options.snapToPixel : true;

  goog.base(this, {
    opacity: 1,
    rotateWithView: true,
    rotation: goog.isDef(options.rotation) ? options.rotation : 0,
    scale: 1,
    snapToPixel: snapToPixel
  });

};
goog.inherits(ol.style.Arrow, ol.style.Image);


/**
 * @inheritDoc
 * @api
 */
ol.style.Arrow.prototype.getAnchor = function() {
  return this.anchor_;
};


/**
 * Get the fill style for the shape.
 * @return {ol.style.Fill} Fill style.
 * @api
 */
ol.style.Arrow.prototype.getFill = function() {
  return this.fill_;
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.getHitDetectionImage = function(pixelRatio) {
  return this.hitDetectionCanvas_;
};


/**
 * @inheritDoc
 * @api
 */
ol.style.Arrow.prototype.getImage = function(pixelRatio) {
  return this.canvas_;
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.getImageSize = function() {
  return this.imageSize_;
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.getHitDetectionImageSize = function() {
  return this.hitDetectionImageSize_;
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.getImageState = function() {
  return ol.style.ImageState.LOADED;
};


/**
 * @inheritDoc
 * @api
 */
ol.style.Arrow.prototype.getOrigin = function() {
  return this.origin_;
};


/**
 * @inheritDoc
 * @api
 */
ol.style.Arrow.prototype.getSize = function() {
  return this.size_;
};


/**
 * Get the stroke style for the shape.
 * @return {ol.style.Stroke} Stroke style.
 * @api
 */
ol.style.Arrow.prototype.getStroke = function() {
  return this.stroke_;
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.listenImageChange = goog.nullFunction;


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.load = goog.nullFunction;


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.unlistenImageChange = goog.nullFunction;


/**
 * @typedef {{
 *   strokeStyle: (string|undefined),
 *   strokeWidth: number,
 *   length: number,
 *   width: number,
 *   lineCap: string,
 *   lineDash: Array.<number>,
 *   lineJoin: string,
 *   miterLimit: number
 * }}
 */
ol.style.Arrow.RenderOptions;


/**
 * @private
 * @param {ol.style.AtlasManager|undefined} atlasManager
 */
ol.style.Arrow.prototype.render_ = function(atlasManager) {
  var imageWidth;
  var imageHeight;
  var lineCap = '';
  var lineJoin = '';
  var miterLimit = 0;
  var lineDash = null;
  var strokeStyle;
  var strokeWidth = 0;

  if (!goog.isNull(this.stroke_)) {
    strokeStyle = ol.color.asString(this.stroke_.getColor());
    strokeWidth = this.stroke_.getWidth();
    if (!goog.isDef(strokeWidth)) {
      strokeWidth = ol.render.canvas.defaultLineWidth;
    }
    lineDash = this.stroke_.getLineDash();
    if (!ol.has.CANVAS_LINE_DASH) {
      lineDash = null;
    }
    lineJoin = this.stroke_.getLineJoin();
    if (!goog.isDef(lineJoin)) {
      lineJoin = ol.render.canvas.defaultLineJoin;
    }
    lineCap = this.stroke_.getLineCap();
    if (!goog.isDef(lineCap)) {
      lineCap = ol.render.canvas.defaultLineCap;
    }
    miterLimit = this.stroke_.getMiterLimit();
    if (!goog.isDef(miterLimit)) {
      miterLimit = ol.render.canvas.defaultMiterLimit;
    }
  }

  var width = 0;
  var height = 0;
  for (var i = 0; i < this.shape_.length; i += 2) {
    if (width < this.shape_[i]) {
      width = this.shape_[i];
    }
    if (height < this.shape_[i + 1]) {
      height = this.shape_[i + 1];
    }
  }

  width = width * this.arrowScale_ + 2 * strokeWidth;
  height = height * this.arrowScale_ + 2 * strokeWidth;

  /** @type {ol.style.Arrow.RenderOptions} */
  var renderOptions = {
    strokeStyle: strokeStyle,
    strokeWidth: strokeWidth,
    length: height,
    width: width,
    lineCap: lineCap,
    lineDash: lineDash,
    lineJoin: lineJoin,
    miterLimit: miterLimit
  };

  if (!goog.isDef(atlasManager)) {
    // no atlas manager is used, create a new canvas
    this.canvas_ = /** @type {HTMLCanvasElement} */
        (goog.dom.createElement(goog.dom.TagName.CANVAS));

    this.canvas_.height = height;
    this.canvas_.width = width;

    // canvas.width and height are rounded to the closest integer
    imageWidth = width = this.canvas_.width;
    imageHeight = height = this.canvas_.height;

    var context = /** @type {CanvasRenderingContext2D} */
        (this.canvas_.getContext('2d'));
    this.draw_(renderOptions, context, 0, 0);

    this.createHitDetectionCanvas_(renderOptions);
  } else {
    // an atlas manager is used, add the symbol to an atlas
    width = Math.round(width);
    height = Math.round(height);

    var hasCustomHitDetectionImage = goog.isNull(this.fill_);
    var renderHitDetectionCallback;
    if (hasCustomHitDetectionImage) {
      // render the hit-detection image into a separate atlas image
      renderHitDetectionCallback =
          goog.bind(this.drawHitDetectionCanvas_, this, renderOptions);
    }

    var id = this.getChecksum();
    var info = atlasManager.add(
        id, width, height, goog.bind(this.draw_, this, renderOptions),
        renderHitDetectionCallback);
    goog.asserts.assert(!goog.isNull(info), 'shape size is too large');

    this.canvas_ = info.image;
    this.origin_ = [info.offsetX, info.offsetY];
    imageWidth = info.image.width;
    imageHeight = info.image.height;

    if (hasCustomHitDetectionImage) {
      this.hitDetectionCanvas_ = info.hitImage;
      this.hitDetectionImageSize_ =
          [info.hitImage.width, info.hitImage.height];
    } else {
      this.hitDetectionCanvas_ = this.canvas_;
      this.hitDetectionImageSize_ = [imageWidth, imageHeight];
    }
  }

  this.anchor_ = [
    this.shape_[0] * this.arrowScale_ + strokeWidth,
    this.shape_[1] * this.arrowScale_ + strokeWidth
  ];
  this.size_ = [width, height];
  this.imageSize_ = [imageWidth, imageHeight];
};


/**
 * @private
 * @param {ol.style.Arrow.RenderOptions} renderOptions
 * @param {CanvasRenderingContext2D} context
 * @param {number} x The origin for the symbol (x).
 * @param {number} y The origin for the symbol (y).
 */
ol.style.Arrow.prototype.draw_ = function(renderOptions, context, x, y) {
  // reset transform
  context.setTransform(1, 0, 0, 1, 0, 0);

  // then move to (x, y)
  context.translate(x + renderOptions.strokeWidth,
      y + renderOptions.strokeWidth);

  context.beginPath();
  context.moveTo(
      this.shape_[0] * this.arrowScale_,
      this.shape_[1] * this.arrowScale_);
  for (var i = 2; i < this.shape_.length; i += 2) {
    context.lineTo(
        this.shape_[i] * this.arrowScale_,
        this.shape_[i + 1] * this.arrowScale_);
  }

  if (!goog.isNull(this.fill_)) {
    context.fillStyle = ol.color.asString(this.fill_.getColor());
    context.fill();
  }
  if (!goog.isNull(this.stroke_)) {
    context.strokeStyle = renderOptions.strokeStyle;
    context.lineWidth = renderOptions.strokeWidth;
    if (!goog.isNull(renderOptions.lineDash)) {
      context.setLineDash(renderOptions.lineDash);
    }
    context.lineCap = renderOptions.lineCap;
    context.lineJoin = renderOptions.lineJoin;
    context.miterLimit = renderOptions.miterLimit;
    context.stroke();
  }
  context.closePath();
};


/**
 * @private
 * @param {ol.style.Arrow.RenderOptions} renderOptions
 */
ol.style.Arrow.prototype.createHitDetectionCanvas_ =
    function(renderOptions) {
  this.hitDetectionImageSize_ = [renderOptions.width, renderOptions.height];
  if (!goog.isNull(this.fill_)) {
    this.hitDetectionCanvas_ = this.canvas_;
    return;
  }

  // if no fill style is set, create an extra hit-detection image with a
  // default fill style
  this.hitDetectionCanvas_ = /** @type {HTMLCanvasElement} */
      (goog.dom.createElement(goog.dom.TagName.CANVAS));
  var canvas = this.hitDetectionCanvas_;

  canvas.height = renderOptions.height;
  canvas.width = renderOptions.width;

  var context = /** @type {CanvasRenderingContext2D} */
      (canvas.getContext('2d'));
  this.drawHitDetectionCanvas_(renderOptions, context, 0, 0);
};


/**
 * @private
 * @param {ol.style.Arrow.RenderOptions} renderOptions
 * @param {CanvasRenderingContext2D} context
 * @param {number} x The origin for the symbol (x).
 * @param {number} y The origin for the symbol (y).
 */
ol.style.Arrow.prototype.drawHitDetectionCanvas_ =
    function(renderOptions, context, x, y) {
  // reset transform
  context.setTransform(1, 0, 0, 1, 0, 0);

  // then move to (x, y)
  context.translate(x + renderOptions.strokeWidth,
      y + renderOptions.strokeWidth);

  context.beginPath();
  context.moveTo(
      this.shape_[0] * this.arrowScale_,
      this.shape_[1] * this.arrowScale_);
  for (var i = 2; i < this.shape_.length; i += 2) {
    context.lineTo(
        this.shape_[i] * this.arrowScale_,
        this.shape_[i + 1] * this.arrowScale_);
  }

  context.fillStyle = ol.render.canvas.defaultFillStyle;
  context.fill();
  if (!goog.isNull(this.stroke_)) {
    context.strokeStyle = renderOptions.strokeStyle;
    context.lineWidth = renderOptions.strokeWidth;
    if (!goog.isNull(renderOptions.lineDash)) {
      context.setLineDash(renderOptions.lineDash);
    }
    context.stroke();
  }
  context.closePath();
};


/**
 * @inheritDoc
 */
ol.style.Arrow.prototype.getChecksum = function() {
  this.checksums_ = [''];
  return this.checksums_[0];
};
