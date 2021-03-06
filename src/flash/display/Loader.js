function Loader(parameters) {
  this.avm1 = parameters.avm1;
  this.avm2 = parameters.avm2;
  this._dictionary = new ObjDictionary;
}

Loader.SCRIPT_PATH = './Loader.js';
Loader.WORKERS_ENABLED = false;
Loader.WORKER_SCRIPTS = [
  '../../../lib/DataView.js/DataView.js',

  '../util.js',

  '../../swf/util.js',
  '../../swf/swf.js',
  '../../swf/types.js',
  '../../swf/structs.js',
  '../../swf/tags.js',
  '../../swf/inflate.js',
  '../../swf/stream.js',
  '../../swf/templates.js',
  '../../swf/generator.js',
  '../../swf/parser.js',
  '../../swf/bitmap.js',
  '../../swf/button.js',
  '../../swf/font.js',
  '../../swf/image.js',
  '../../swf/label.js',
  '../../swf/shape.js',
  '../../swf/text.js'
];

Loader._load = function (instance, data) {
  if (typeof data === 'object') {
    if (data instanceof ArrayBuffer) {
      instance._parse(data);
    } else if (typeof FileReaderSync !== 'undefined') {
      var reader = new FileReaderSync;
      var buffer = reader.readAsArrayBuffer(data);
      instance._parse(buffer);
    } else {
      var reader = new FileReader;
      reader.onload = function() {
        instance._parse(this.result);
      };
      reader.readAsArrayBuffer(data);
    }
  } else {
    var xhr = new XMLHttpRequest;
    xhr.open('GET', data);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      instance._parse(this.response);
    };
    xhr.send();
  }
};

var baseProto = null;

if (typeof window === 'undefined') {
  importScripts.apply(null, Loader.WORKER_SCRIPTS);

  onmessage = function (evt) {
    var loader = new Loader;
    Loader._load(loader, evt.data);
  };
} else {
  baseProto = new DisplayObjectContainer;
}

Loader.prototype = Object.create(baseProto, {
  content: descAccessor(function () {
    return this._content;
  }),
  contentLoaderInfo: descAccessor(function () {
    return this._contentLoaderInfo || (this._contentLoaderInfo = new LoaderInfo);
  }),
  uncaughtErrorEvents: descAccessor(function () {
    notImplemented();
  }),

  addChild: descMethod(function (child) {
    illegalOperation();
  }),
  addChildAt: descMethod(function (child, index) {
    illegalOperation();
  }),
  close: descMethod(function () {
    notImplemented();
  }),
  load: descMethod(function (request, context) {
    this._load(request.url);
  }),
  loadBytes: descMethod(function (bytes, context) {
    if (!bytes.length)
      throw ArgumentError();

    this._load(bytes);
  }),
  removeChild: descMethod(function (child) {
    illegalOperation();
  }),
  removeChildAt: descMethod(function (child, index) {
    illegalOperation();
  }),
  setChildIndex: descMethod(function (child, index) {
    illegalOperation();
  }),
  unload: descMethod(function() {
    notImplemented();
  }),
  unloadAndStop: descMethod(function (gc) {
    notImplemented();
  }),

  _getSymbolById: { value: function (id) {
    return this._dictionary[id];
  } },
  _load: { value: function (data) {
    if (Loader.WORKERS_ENABLED) {
      var loader = this;
      var worker = new Worker(Loader.SCRIPT_PATH);
      worker.onmessage = function (evt) {
        loader._process(evt.data);
      };
      worker.postMessage(data);
    } else {
      Loader._load(this, data);
    }
  } },
  _parse: { value: function (bytes) {
    var i = 0;
    var dictionary = { };
    var controlTags = [];

    var loader = this;

    function declare(obj) {
      if (obj.id)
        loader._process(obj);
    }

    SWF.parse(bytes, {
      onstart: function(result) {
        loader._process(result);
      },
      onprogress: function(result) {
        var tags = result.tags.slice(i);
        i += tags.length;
        var tag = tags[tags.length - 1];
        if ('id' in tag) {
          Loader._cast(tags.splice(-1, 1), dictionary, declare);
          push.apply(controlTags, tags);
        } else if ('ref' in tag) {
          var id = tag.ref - 0x4001;
          assert(id in dictionary, 'undefined object', 'ref');
          var obj = create(dictionary[id]);
          for (var prop in tag) {
            if (prop !== 'id' && prop !== 'ref')
              obj[prop] = tag[prop];
          }
          dictionary[id] = obj;
        } else {
          var pframes = Loader._cast(controlTags.concat(tags), dictionary);
          controlTags = [];
          var j = 0;
          var pframe;
          while (pframe = pframes[j++])
            loader._process(pframe);
        }
      },
      oncomplete: function(result) {
        loader._process(result);
        loader._process(null);
      }
    });
  } },
  _process: { value: function (data) {
    if (typeof window === 'undefined') {
      postMessage(data);
    } else {
      var dictionary = this._dictionary;
      var loaderInfo = this.contentLoaderInfo;
      var pframes = this._pframes || (this._pframes = []);

      if (!this._content) {
        loaderInfo._swfVersion = data.version;

        var bounds = data.bounds;
        loaderInfo._width = (bounds.xMax - bounds.xMin) / 20;
        loaderInfo._height = (bounds.yMax - bounds.yMin) / 20;

        loaderInfo._frameRate = data.frameRate;

        // TODO disable AVM1 if AVM2 is enabled
        var as2Context = new AS2Context(data.version);

        var timelineLoader = new TimelineLoader(data.frameCount, pframes, dictionary);
        var proto = new MovieClipPrototype({ }, timelineLoader);
        var root = proto.constructor(as2Context);
        root.name = '_root';

        var globals = as2Context.globals;
        globals._root = globals._level0 = root.$as2Object;

        this._content = root;

        loaderInfo._as2Context = as2Context;
        loaderInfo.dispatchEvent(new Event(Event.INIT));
      } else if (data) {
        if (data.id) {
          Loader._definePrototype(dictionary, data);
        } else if (data.type === 'pframe') {
          if (data.abcBlocks) {
            var blocks = data.abcBlocks;
            var i = 0;
            var block;
            while (block = blocks[i++]) {
              this.avm2.applicationDomain.executeAbc(new AbcFile(block, file, true));
            }
          }

          if (data.symbols) {
            var symbols = data.symbols;
            var i = 0;
            var sym;
            while (sym = symbols[i++]) {
              if (!sym.id) {
                var documentClass = this.avm2.applicationDomain.getProperty(
                  Multiname.fromSimpleName(sym.name),
                  true, true
                );
                new (documentClass.instance)();
              }
            }
          }

          pframes.push(data);

          loaderInfo.dispatchEvent(new Event(Event.PROGRESS));
        }
      } else {
        loaderInfo.dispatchEvent(new Event(Event.COMPLETE));
      }
    }
  } }
});

Loader._cast = function cast(tags, dictionary, declare) {
  var pframes = [];
  var pframe = { };
  var i = 0;
  var tag;
  while (tag = tags[i++]) {
    if ('id' in tag) {
      var factory = null;
      var obj = null;
      switch (tag.type) {
      case 'bitmap':
        var factory = defineBitmap;
        break;
      case 'font':
        var factory = defineFont;
        break;
      case 'image':
        var factory = defineImage;
        break;
      case 'label':
        var factory = defineLabel;
        break;
      case 'shape':
        var factory = defineShape;
        break;
      case 'sprite':
        var dependencies = [];
        obj = {
          type: 'sprite',
          id: tag.id,
          frameCount: tag.frameCount,
          require: dependencies,
          pframes: cast(tag.tags, dictionary, (function(dependencies, obj) {
            dependencies.push(obj.id);
            declare(obj);
          }).bind(null, dependencies))
        };
        break;
      case 'text':
        var factory = defineText;
        break;
      case 'button':
        var factory = defineButton;
        break;
      case 'sound':
        var obj = {
          type: 'sound',
          id: tag.id
        };
        break;
      default:
        fail('unknown object type', 'cast');
      }

      var id = tag.id - 0x4001;
      dictionary[id] = tag;
      defineProperty(dictionary, tag.id, {
        get: (function(id, factory, obj) {
          var undeclared = true;
          return function() {
            if (undeclared) {
              if (!obj)
                obj = factory(dictionary[id], dictionary);
              if (obj.id)
                declare(obj);
              undeclared = false;
            }
            return obj;
          };
        })(id, factory, obj)
      });
      continue;
    }
    switch (tag.type) {
    case 'abc':
      if (!pframe.abcBlocks)
        pframe.abcBlocks = [];
      pframe.abcBlocks.push(tag.data);
      break;
    case 'actions':
      if (!pframe.actionsData) {
        pframe.initActionsData = {};
        pframe.actionsData = [];
      }
      if (tag.spriteId)
        pframe.initActionsData[tag.spriteId] = tag.actionsData;
      else
        pframe.actionsData.push(tag.actionsData);
      break;
    case 'background':
      pframe.bgcolor = toStringRgba(tag.color);
      break;
    case 'frame':
      var n = 1;
      for (; tag = tags[i]; ++n, ++i) {
        if (tag.type !== 'frame')
          break;
      }
      if (n > 1)
        pframe.repeat = n;
      pframe.type = 'pframe';
      pframes.push(pframe);
      pframe = { };
      break;
    case 'frameLabel':
      pframe.name = tag.name;
      break;
    case 'place':
      var entry = { };
      if (tag.place) {
        var obj = dictionary[tag.objId];
        assert(obj, 'undefined object', 'place');
        entry.id = obj.id;
      }
      if (tag.events) {
        var events = tag.events;
        if (events[events.length - 1].eoe)
          events = events.slice(0, events.length - 1);
        entry.events = events;
      }
      if (tag.move)
        entry.move = true;
      if (tag.name)
        entry.name = tag.name;
      if (tag.hasMatrix)
        entry.matrix = tag.matrix;
      if (tag.hasCxform)
        entry.cxform = tag.cxform;
      if (tag.hasRatio)
        entry.ratio = tag.ratio / 0xffff;
      pframe[tag.depth] = entry;

      break;
    case 'remove':
      pframe[tag.depth] = null;
      break;
    case 'symbols':
      pframe.symbols = tag.references;
      break;
    case 'assets':
      if (!pframe.assets)
        pframe.assets = [];
      pframe.assets = pframe.assets.concat(tag.references);
      break;
    }
  }
  return pframes;
};

function ObjDictionary() {
  this.promises = this;
}
ObjDictionary.prototype = {
  getPromise: function(objId) {
    if (!(objId in this.promises)) {
      var promise = new Promise();
      this.promises[objId] = promise;
    }
    return this.promises[objId];
  },
  isPromiseExists: function(objId) {
    return objId in this.promises;
  }
};

if (typeof document !== 'undefined') {
  var head = document.head;
  head.insertBefore(document.createElement('style'), head.firstChild);
  var style = document.styleSheets[0];

  Loader._definePrototype = function (dictionary, obj) {
    var id = obj.id;
    var requirePromise = Promise.resolved;
    if (obj.require && obj.require.length > 0) {
      var requirePromises = [];
      for (var i = 0; i < obj.require.length; i++)
        requirePromises.push(dictionary.getPromise(obj.require[i]));
      requirePromise = Promise.all(requirePromises);
    }
    var promise = dictionary.getPromise(id);
    switch (obj.type) {
    case 'font':
      var charset = fromCharCode.apply(null, obj.codes);
      if (charset) {
        style.insertRule(
          '@font-face{' +
            'font-family:"' + obj.name + '";' +
            'src:url(data:font/opentype;base64,' + btoa(obj.data) + ')' +
          '}',
          style.cssRules.length
        );
        var ctx = (document.createElement('canvas')).getContext('2d');
        ctx.font = '1024px "' + obj.name + '"';
        var defaultWidth = ctx.measureText(charset).width;

        requirePromise.then(function() {
          promise.resolve(obj);
        });
      }
      break;
    case 'image':
      var img = new Image;
      img.src = 'data:' + obj.mimeType + ';base64,' + btoa(obj.data);
      img.onload = function() {
        var proto = create(obj);
        proto.img = img;
        requirePromise.then(function() {
          promise.resolve(proto);
        });
      };
      break;
    case 'sprite':
      requirePromise.then(function() {
        var timelineLoader = new TimelineLoader(obj.frameCount || 1, obj.pframes || [], dictionary);
        promise.resolve(new MovieClipPrototype(obj, timelineLoader));
      });
      break;
    case 'shape':
    case 'text':
      var proto = create(obj);
      var drawFn = new Function('d,c,r', obj.data);
      proto.draw = (function(c, r) {
        return drawFn.call(this, dictionary, c, r);
      });
      requirePromise.then(function() {
        promise.resolve(proto);
      });
      break;
    case 'button':
      requirePromise.then(function() {
        var timelineLoader = new TimelineLoader(4,
          [obj.states.up,obj.states.over,obj.states.down,obj.states.hitTest],
          dictionary);
        promise.resolve(new ButtonPrototype(obj, timelineLoader));
      });
      break;
    default:
      fail('unknown object type', 'define');
    }
  };
}
