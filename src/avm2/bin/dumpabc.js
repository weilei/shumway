load("../../../lib/DataView.js/DataView.js");

var SWF = {};
load("../../swf/util.js");
load("../../swf/types.js");
load("../../swf/structs.js");
load("../../swf/tags.js");
load("../../swf/inflate.js");
load("../../swf/stream.js");
load("../../swf/templates.js");
load("../../swf/generator.js");
load("../../swf/parser.js");
load("../../swf/bitmap.js");
load("../../swf/button.js");
load("../../swf/font.js");
load("../../swf/image.js");
load("../../swf/label.js");
load("../../swf/shape.js");
load("../../swf/text.js");

load("../util.js");
load("../options.js");
load("../metrics.js");

var Timer = metrics.Timer;
var stdout = new IndentingWriter();
var ArgumentParser = options.ArgumentParser;
var Option = options.Option;
var OptionSet = options.OptionSet;

var argumentParser = new ArgumentParser();
var systemOptions = new OptionSet("System Options");

load("../constants.js");
load("../opcodes.js");
load("../parser.js");
load("../disassembler.js");
load("../analyze.js");
load("../compiler/lljs/src/estransform.js");
load("../compiler/lljs/src/escodegen.js");
load("../compiler/compiler.js");
load("../native.js");
load("../runtime.js");
load("../interpreter.js");

function printUsage() {
  stdout.writeLn("dumpabc.js " + argumentParser.getUsage());
}

argumentParser.addArgument("h", "help", "boolean", {parse: function (x) { printUsage(); }});
var swfFile = argumentParser.addArgument("swf", "swf", "string", { positional: true });
var prefix = argumentParser.addArgument("prefix", "prefix", "string", { defaultValue: "abc" });

try {
  argumentParser.parse(arguments);
} catch (x) {
  stdout.writeLn(x.message);
  quit();
}

SWF.parse(snarf(swfFile.value, "binary"), {
  oncomplete: function(result) {
    var tags = result.tags;
    var abcCount = 0;
    for (var i = 0, n = tags.length; i < n; i++) {
      var tag = tags[i];
      if (tag.type === "abc") {
        // sysDomain.loadAbc(new AbcFile(tag.data, "playerGlobal/library" + i + ".abc"));
        stdout.writeLn("<<< BASE64 " + prefix.value + "-" + abcCount++ + ".abc");
        print (base64ArrayBuffer(tag.data));
        stdout.writeLn(">>>");
      }
    }
  }
});
