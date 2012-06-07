const T = estransform;

const Node = T.Node;
const Literal = T.Literal;
const Identifier = T.Identifier;
const VariableDeclaration = T.VariableDeclaration;
const VariableDeclarator = T.VariableDeclarator;
const MemberExpression = T.MemberExpression;
const BinaryExpression = T.BinaryExpression;
const SequenceExpression = T.SequenceExpression;
const CallExpression = T.CallExpression;
const AssignmentExpression = T.AssignmentExpression;
const ExpressionStatement = T.ExpressionStatement;
const ReturnStatement = T.ReturnStatement;
const Program = T.Program;
const Statement = T.Statement;
const Comment = T.Comment;
const FunctionDeclaration = T.FunctionDeclaration;
const FunctionExpression = T.FunctionExpression;
const ConditionalExpression = T.ConditionalExpression;
const ObjectExpression = T.ObjectExpression;
const ArrayExpression = T.ArrayExpression;
const UnaryExpression = T.UnaryExpression;
const NewExpression = T.NewExpression;
const UpdateExpression = T.UpdateExpression;
const ForStatement = T.ForStatement;
const BlockStatement = T.BlockStatement;
const ThisExpression = T.ThisExpression;
const TypeAliasDirective = T.TypeAliasDirective;
const CastExpression = T.CastExpression;
const ThrowStatement = T.ThrowStatement;
const IfStatement = T.IfStatement;
const WhileStatement = T.WhileStatement;
const BreakStatement = T.BreakStatement;
const ContinueStatement = T.ContinueStatement;

const scopeName = new Identifier("$S");
const savedScopeName = new Identifier("$$S");
const constantsName = new Identifier("$C");

/**
 * To embed object references in compiled code we index into globally accessible constant table [$C].
 * This table maintains an unique set of object references, each of which holds its own position in
 * the constant table, thus providing for fast lookup. To embed a reference to an object [k] we call
 * [objectConstant(k)] which may generate the literal "$C[12]".
 */

var $C = [];
const SCOPE_NAME = "$S";
const SAVED_SCOPE_NAME = "$" + SCOPE_NAME;

function generate(node) {
  return escodegen.generate(node, {base: "", indent: "  "});
}

var Compiler = (function () {

  function objectId(obj) {
    assert(obj);
    if (obj.hasOwnProperty("objectId")) {
      return obj.objectId;
    }
    var id = $C.length;
    Object.defineProperty(obj, "objectId", {value: id, writable: false, enumerable: false});
    $C.push(obj);
    return id;
  }

  Control.Break.prototype.compile = function (cx, state) {
    return cx.compileBreak(this, state);
  };

  Control.Continue.prototype.compile = function (cx, state) {
    return cx.compileContinue(this, state);
  };

  Control.Exit.prototype.compile = function (cx, state) {
    return cx.compileExit(this, state);
  };

  Control.LabelSwitch.prototype.compile = function (cx, state) {
    return cx.compileLabelSwitch(this, state);
  };

  Control.Seq.prototype.compile = function (cx, state) {
    return cx.compileSequence(this, state);
  };

  Bytecode.prototype.compile = function (cx, state) {
    return cx.compileBytecode(this, state);
  };

  Control.Loop.prototype.compile = function (cx, state) {
    return cx.compileLoop(this, state);
  };

  Control.Switch.prototype.compile = function (cx, state) {
    return cx.compileSwitch(this, state);
  };

  Control.If.prototype.compile = function (cx, state) {
    return cx.compileIf(this, state);
  };

  function objectConstant(obj) {
    return new MemberExpression(constantsName, new Literal(objectId(obj)), true);
  }

  function constant(value) {
    if (value === undefined) {
      return id("undefined");
    }
    return new Literal(value);
  }

  function property(obj, path) {
    path.split(".").forEach(function(x) {
      obj = new MemberExpression(obj, new Identifier(x), false);
    });
    return obj;
  }

  function call(callee, arguments) {
    arguments.forEach(function (x) {
      assert (!(x instanceof Array));
    });
    return new CallExpression(callee, arguments);
  }

  function callCall(callee, arguments) {
    return call(property(callee, "call"), arguments);
  }

  function assignment(left, right) {
    assert (left && right);
    return new AssignmentExpression(left, "=", right);
  }

  function id(name) {
    return new Identifier(name);
  }

  function removeBlock(node) {
    if (node instanceof BlockStatement) {
      return node.body;
    }
    return node;
  }

  function compiler(abc) {
    this.writer = new IndentingWriter();
    this.abc = abc;
  }

  /**
   * Abstract program state.
   */
  var State = (function () {
    var stateCounter = 0;
    function state() {
      this.stack = [];
      this.scopeHeight = 0;
      this.id = stateCounter ++;
    }
    state.prototype.clone = function clone() {
      var s = new State();
      s.stack = this.stack.slice(0);
      s.scopeHeight = this.scopeHeight;
      return s;
    };
    state.prototype.trace = function trace(writer) {
      writer.enter("state id: " + stateCounter + ", scopeHeight: " + this.scopeHeight + ", stack: {");
      for (var i = 0; i < this.stack.length; i++) {
        writer.writeLn(i + ": " + generate(this.stack[i]));
      }
      writer.leave("}");
    };
    return state;
  })();

  /**
   * Describes binary and unary operators.
   */
  var Operator = (function () {
    var map = {};

    function operator(name, fn, binary) {
      this.name = name;
      this.fn = fn;
      this.binary = binary;
      map[name] = this;
    }

    operator.ADD = new operator("+", function (l, r) { return l + r; }, true);
    operator.SUB = new operator("-", function (l, r) { return l - r; }, true);
    operator.MUL = new operator("*", function (l, r) { return l * r; }, true);
    operator.DIV = new operator("/", function (l, r) { return l / r; }, true);
    operator.MOD = new operator("%", function (l, r) { return l % r; }, true);
    operator.AND = new operator("&", function (l, r) { return l & r; }, true);
    operator.OR = new operator("|", function (l, r) { return l | r; }, true);
    operator.XOR = new operator("^", function (l, r) { return l ^ r; }, true);
    operator.LSH = new operator("<<", function (l, r) { return l << r; }, true);
    operator.RSH = new operator(">>", function (l, r) { return l >> r; }, true);
    operator.URSH = new operator(">>>", function (l, r) { return l >>> r; }, true);
    operator.SEQ = new operator("===", function (l, r) { return l === r; }, true);
    operator.SNE = new operator("!==", function (l, r) { return l !== r; }, true);
    operator.EQ = new operator("==", function (l, r) { return l == r; }, true);
    operator.NE = new operator("!=", function (l, r) { return l != r; }, true);
    operator.LE = new operator("<=", function (l, r) { return l <= r; }, true);
    operator.GT = new operator(">", function (l, r) { return l > r; }, true);
    operator.LT = new operator("<", function (l, r) { return l < r; }, true);
    operator.GE = new operator(">=", function (l, r) { return l >= r; }, true);
    operator.BITWISE_NOT = new operator("~", function (a) { return ~a; }, false);
    operator.NEG = new operator("-", function (a) { return -a; }, false);
    operator.TRUE = new operator("!!", function (a) { return !!a; }, false);
    operator.FALSE = new operator("!", function (a) { return !a; }, false);

    function linkOpposites(a, b) {
      a.not = b;
      b.not = a;
    }

    /**
     * Note that arithmetic comparisons aren't partial orders and cannot be
     * negated to each other.
     */

    linkOpposites(operator.SEQ, operator.SNE);
    linkOpposites(operator.EQ, operator.NE);
    linkOpposites(operator.TRUE, operator.FALSE);

    operator.fromName = function fromName(name) {
      return map[name];
    };

    operator.prototype.isBinary = function isBinary() {
      return this.binary;
    };

    operator.prototype.toString = function toString() {
      return this.name;
    };
    return operator;
  })();

  function negate(node) {
    assert (node instanceof BinaryExpression || node instanceof UnaryExpression);
    var left = node instanceof BinaryExpression ? node.left : node.argument;
    var right = node.right;
    var operator = Operator.fromName(node.operator);
    if (operator === Operator.EQ && right instanceof Literal && right.value === false) {
      return left;
    }
    if (operator === Operator.FALSE) {
      return left;
    }
    if (operator.not) {
      if (node instanceof BinaryExpression) {
        return new BinaryExpression(operator.not.name, left, right);
      } else {
        return new UnaryExpression(operator.not.name, left);
      }
    }
    return new UnaryExpression(Operator.FALSE.name, node);
  }

  var FindProperty = (function () {
    function findProperty(multiname, strict) {
      this.strict = strict;
      this.multiname = multiname;
      CallExpression.call(this, property(scopeName, "findProperty"), [objectConstant(this.multiname), new Literal(this.strict)]);
    };
    findProperty.prototype = Object.create(CallExpression.prototype);
    findProperty.prototype.isEquivalent = function isEquivalent(other) {
      return other instanceof findProperty && this.multiname === other.multiname && this.strict === other.strict;
    };
    return findProperty;
  })();

  var Compilation = (function () {
    function compilation(compiler, methodInfo, scope) {
      this.compiler = compiler;
      var mi = this.methodInfo = methodInfo;
      this.bytecodes = methodInfo.analysis.bytecodes;

      this.state = new State();

      /* Initialize local variables. First declare the [this] reference, then ... */
      this.local = [id("this")];

      var freeVariableNames = "abcdefghijklmnopqrstuvwxyz".split("");

      /* push the method's parameters, followed by ... */
      for (var i = 0; i < mi.parameters.length; i++) {
        var name = mi.parameters[i].name;
        this.local.push(id(name));
        if (freeVariableNames.indexOf(name) >= 0) {
          delete freeVariableNames[freeVariableNames.indexOf(name)];
        }
      }

      var freshVariableCount = 0;

      function newVariableName() {
        var name = null;
        for (var i = 0; i < freeVariableNames.length; i++) {
          if ((name = freeVariableNames[i])) {
            delete freeVariableNames[i];
            return name;
          }
        }
        return "$l" + freshVariableCount++;
      }

      /* push the method's remaining locals.*/
      for (var i = mi.parameters.length; i < mi.localCount; i++) {
        this.local.push(id(newVariableName()));
      }

      this.temporary = [];

      this.prologue = [];
      this.prologue.push(new VariableDeclaration("var", [
        new VariableDeclarator(id(SCOPE_NAME), id(SAVED_SCOPE_NAME))
      ]));

      if (this.local.length > 1) {
        this.prologue.push(new VariableDeclaration("var", this.local.slice(1).map(function (x) {
          return new VariableDeclarator(x, null);
        })));
      }

      var parameterCount = mi.parameters.length;
      if (mi.needsRest() || mi.needsArguments()) {
        this.prologue.push(new ExpressionStatement(
          assignment(this.local[parameterCount + 1],
                     call(property(id("Array"), "prototype.slice.call"),
                          [id("arguments"), constant(mi.needsRest() ? parameterCount + 1 : 1)]))));
      }

    }
    compilation.prototype.compile = function compile() {
      var node = this.methodInfo.analysis.controlTree.compile(this, this.state).node;
      assert (node instanceof BlockStatement);
      if (this.temporary.length > 1) {
        this.prologue.push(new VariableDeclaration("var", this.temporary.map(function (x) {
          return new VariableDeclarator(x, null);
        })));
      }
      Array.prototype.unshift.apply(node.body, this.prologue);
      return node;
    };
    compilation.prototype.compileLabelSwitch = function compileLabelSwitch(item, state) {
      var node = null;
      var firstCase = true;

      for (var i = item.cases.length - 1; i >=0; i--) {
        var c = item.cases[i];
        node = new IfStatement(new BinaryExpression("===", id("$label"), constant(c.label)),
                               c.body ? c.body.compile(this, state).node : new BlockStatement(),
                               node);
      }
      return {node: node, state: state};
    };
    compilation.prototype.compileContinue = function compileContinue(item, state) {
      var body = [];
      if (item.label) {
        body.push(new VariableDeclaration("var", [
          new VariableDeclarator(id("$label"), id(item.label))
        ]));
      }
      body.push(new ContinueStatement(null));
      return {node: new BlockStatement(body), state: state};
    };
    compilation.prototype.compileBreak = function compileBreak(item, state) {
      var body = [];
      if (item.label) {
        body.push(new VariableDeclaration("var", [
          new VariableDeclarator(id("$label"), id(item.label))
        ]));
      }
      body.push(new BreakStatement(null));
      return {node: new BlockStatement(body), state: state};
    };
    compilation.prototype.compileSequence = function compileSequence(item, state) {
      var cx = this;
      var body = [];
      item.body.forEach(function (x) {
        var result = x.compile(cx, state);
        body.push(result.node);
        state = result.state;
      });
      var node = body.length > 1 ? new BlockStatement(body) : body[0];
      return {node: node, state: state};
    };
    compilation.prototype.compileLoop = function compileLoop(item, state) {
      var br = item.body.compile(this, state);
      return {node: new WhileStatement(constant(true), br.node), state: state};
    };
    compilation.prototype.compileIf = function compileIf(item, state) {
      var cr = item.cond.compile(this, state);
      var tr = null, er = null;
      if (item.then) {
        tr = item.then.compile(this, cr.state.clone());
      }
      if (item.else) {
        er = item.else.compile(this, cr.state.clone());
      }
      assert (tr || er);
      var node = cr.node;
      var condition = item.negated ? negate(cr.condition) : cr.condition;
      generate(condition);
      node.body.push(new IfStatement(condition, tr ? tr.node : new BlockStatement([]), er ? er.node : null));
      return {node: node, state: (tr || er).state};
    };
    compilation.prototype.compileBytecode = function compileBytecode(block, state) {
      var writer = traceLevel.value <= 2 ? null : this.compiler.writer;
      if (writer) {
        writer.enter("block " + block.blockId + ", dom: " + block.dominator.blockId + " [" + block.position + "-" + block.end.position + "] {");
        writer.leave("}");
      }

      var body = [];
      var local = this.local;
      var temporary = this.temporary;

      var abc = this.compiler.abc;
      var ints = abc.constantPool.ints;
      var uints = abc.constantPool.uints;
      var doubles = abc.constantPool.doubles;
      var strings = abc.constantPool.strings;
      var methods = abc.methods;
      var multinames = abc.constantPool.multinames;
      var runtime = abc.runtime;
      var savedScope = this.savedScope;
      var multiname, args, value, obj, ns, name, type, factory, index;


      function classObject() {
        return property(savedScopeName, "object");
      }

      function superClassInstanceObject() {
        return property(classObject(), "baseClass.instance");
      }

      function superOf(obj) {
        return property(obj, "public$constructor.baseClass.instance.prototype");
      }

      function runtimeProperty(propertyName) {
        var result = objectConstant(abc.runtime);
        if (propertyName) {
          result = property(result, propertyName);
        }
        return result;
      }

      function push(value) {
        assert (typeof value !== "string");
        state.stack.push(value);
      }

      function setLocal(index) {
        assert (state.stack.length);
        var value = state.stack.pop();
        flushStack();
        emit(assignment(local[index], value));
      }

      function duplicate(value) {
        var temp = getTemporary(state.stack.length);
        state.stack.push(assignment(temp, value));
        state.stack.push(temp);
      }

      function popValue() {
        emit(state.stack.pop());
      }

      function kill(index) {
        flushStack();
        emit(assignment(local[index], constant(undefined)));
      }

      function getSlot(obj, index) {
        push(call(id("getSlot"), [obj, constant(index)]));
      }

      function setSlot(obj, index, value) {
        flushStack();
        push(call(id("setSlot"), [obj, constant(index), value]));
      }

      function getTemporary(index) {
        if (index in temporary) {
          return temporary[index];
        }
        return temporary[index] = id("t" + index);
      }

      /**
       * Stores all stack values into temporaries. At the end of a block, the state stack
       * may not be empty. This usually occurs for short-circuited conditional expressions.
       */
      function flushStack() {
        // assert (state.stack.length <= 2, "Stack Length is " + state.stack.length);
        for (var i = 0; i < state.stack.length; i++) {
          if (state.stack[i] !== getTemporary(i)) {
            emit(assignment(getTemporary(i), state.stack[i]));
            state.stack[i] = getTemporary(i);
          }
        }
      }

      function emit(value) {
        if (!(value instanceof Statement)) {
          value = new ExpressionStatement(value);
        }
        body.push(value);
      }

      function emitComment(value) {
        // TODO
      }

      function expression(operator) {
        if (operator.isBinary()) {
          var b = state.stack.pop();
          var a = state.stack.pop();
          push(new BinaryExpression(operator.name, a, b));
        } else {
          var a = state.stack.pop();
          push(new UnaryExpression(operator.name, a));
        }
      }

      var condition = null;

      /**
       * Remembers the branch condition for this block, which is passed and used by the If control
       * node.
       */
      function setCondition(operator) {
        assert (condition === null);
        var b = undefined;
        if (operator.isBinary()) {
          b = state.stack.pop();
        }
        var a = state.stack.pop();
        if (b) {
          condition = new BinaryExpression(operator.name, a, b);
        } else {
          condition = new UnaryExpression(operator.name, a);
        }
      }

      function setNegatedCondition(operator) {
        setCondition(operator);
        condition = new UnaryExpression(Operator.FALSE.name, condition);
      }

      /**
       * Find the scope object containing the specified multiname.
       */
      function findProperty(multiname, strict) {
        if (false && !multiname.isQName()) {
          if (savedScope) {
            var resolved = savedScope.resolveMultiname(multiname);
            if (resolved) {
              return new FindProperty(resolved, strict);
            }
          }
        }
        return new FindProperty(multiname, strict);
      }

      function getProperty(obj, multiname) {
        if (obj instanceof FindProperty &&
            obj.multiname.name === multiname.name &&
            obj.multiname.isQName()) {
          return property(obj, obj.multiname.getQualifiedName());
        }

        /**
         * Looping over arrays by index will use a MultinameL
         * as it's the simplest type of late name. Instead of
         * doing a runtime looking, quickly go through late
         * name lookup here.
         */
        if (multiname.isRuntimeName() && !multiname.isPublicNamespaced()) {
          var value = state.stack.pop();
          return call(property(obj, GET_ACCESSOR), [value]);
        }

        return call(id("getProperty"), [obj, objectConstant(multiname)]);
      }

      var bytecodes = this.bytecodes;
      for (var bci = block.position, end = block.end.position; bci <= end; bci++) {
        var bc = bytecodes[bci];
        var op = bc.op;

        if (writer) {
          writer.writeLn("bytecode bci: " + bci + ", originalBci: " + bc.originalPosition + ", " + bc);
        }

        switch (op) {

        case OP_bkpt:           notImplemented(); break;
        case OP_throw:
          emit(assignment(getTemporary(0), property(objectConstant(abc), ".runtime.exception")));
          emit(assignment(property(getTemporary(0), "value"), state.stack.pop()));
          emit(new ThrowStatement(getTemporary(0)));
          break;
        case OP_getsuper:       notImplemented(); break;
        case OP_setsuper:       notImplemented(); break;
        case OP_dxns:           notImplemented(); break;
        case OP_dxnslate:       notImplemented(); break;
        case OP_kill:           kill(bc.index); break;
        case OP_lf32x4:         notImplemented(); break;
        case OP_sf32x4:         notImplemented(); break;
        case OP_ifnlt:          setNegatedCondition(Operator.LT); break;
        case OP_ifge:           setCondition(Operator.GE); break;
        case OP_ifnle:          setNegatedCondition(Operator.LE); break;
        case OP_ifgt:           setCondition(Operator.GT); break;
        case OP_ifngt:          setNegatedCondition(Operator.GT); break;
        case OP_ifle:           setCondition(Operator.LE); break;
        case OP_ifnge:          setNegatedCondition(Operator.GE); break;
        case OP_iflt:           setCondition(Operator.LT); break;
        case OP_jump:
          // NOP
          break;
        case OP_iftrue:
          setCondition(Operator.TRUE);
          break;
        case OP_iffalse:
          setCondition(Operator.FALSE);
          break;
        case OP_ifeq:           setCondition(Operator.EQ); break;
        case OP_ifne:           setCondition(Operator.NE); break;
        case OP_ifstricteq:     setCondition(Operator.SEQ); break;
        case OP_ifstrictne:     setCondition(Operator.SNE); break;
        case OP_lookupswitch:
          // notImplemented();
          break;
        case OP_pushwith:
          flushStack();
          obj = state.stack.pop();
          emit(assignment(scopeName, new NewExpression(id("Scope"), [scopeName, obj])));
          state.scopeHeight += 1;
          break;
        case OP_popscope:
          flushStack();
          emit(assignment(scopeName, property(scopeName, "parent")));
          state.scopeHeight -= 1;
          break;
        case OP_nextname:
          index = state.stack.pop();
          obj = state.stack.pop();
          push(call(id("nextName"), [obj, index]));
          break;
        case OP_hasnext:
          // TODO: Temporary implementation, totally broken.
          push(constant(false));
          break;
        case OP_hasnext2:
          flushStack();
          obj = local[bc.object];
          index = local[bc.index];
          emit(assignment(getTemporary(0), call(id("hasNext2"), [obj, index])));
          emit(assignment(local[bc.object], property(getTemporary(0), "object")));
          emit(assignment(local[bc.index], property(getTemporary(0), ".index")));
          push(property(getTemporary(0), "index"));
          break;
        case OP_pushnull:       push(constant(null)); break;
        case OP_pushundefined:  push(constant(undefined)); break;
        case OP_pushfloat:      notImplemented(); break;
        case OP_nextvalue:      notImplemented(); break;
        case OP_pushbyte:       push(constant(bc.value)); break;
        case OP_pushshort:      push(constant(bc.value)); break;
        case OP_pushstring:     push(constant(strings[bc.index])); break;
        case OP_pushint:        push(constant(ints[bc.index])); break;
        case OP_pushuint:       push(constant(uints[bc.index])); break;
        case OP_pushdouble:     push(constant(doubles[bc.index])); break;
        case OP_pushtrue:       push(constant(true)); break;
        case OP_pushfalse:      push(constant(false)); break;
        case OP_pushnan:        push(constant(NaN)); break;
        case OP_pop:            popValue(); break;
        case OP_dup:            duplicate(state.stack.pop()); break;
        case OP_swap:           state.stack.push(state.stack.pop(), state.stack.pop()); break;
        case OP_pushscope:
          flushStack();
          obj = state.stack.pop();
          emit(assignment(scopeName, new NewExpression(id("Scope"), [scopeName, obj])));
          state.scopeHeight += 1;
          break;
        case OP_pushnamespace:  notImplemented(); break;
        case OP_li8:            notImplemented(); break;
        case OP_li16:           notImplemented(); break;
        case OP_li32:           notImplemented(); break;
        case OP_lf32:           notImplemented(); break;
        case OP_lf64:           notImplemented(); break;
        case OP_si8:            notImplemented(); break;
        case OP_si16:           notImplemented(); break;
        case OP_si32:           notImplemented(); break;
        case OP_sf32:           notImplemented(); break;
        case OP_sf64:           notImplemented(); break;
        case OP_newfunction:
          push(call(runtimeProperty("createFunction"), [objectConstant(methods[bc.index]), scopeName]));
          break;
        case OP_call:
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(callCall(state.stack.pop(), [obj].concat(args)));
          break;
        case OP_construct:
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(new NewExpression(property(obj, "instance"), args));
          break;
        case OP_callmethod:     notImplemented(); break;
        case OP_callstatic:     notImplemented(); break;
        case OP_callsuper:
          flushStack();
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(call(getProperty(superOf(obj), multiname), [obj].concat(args)));
          break;
        case OP_callproperty:
          flushStack();
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(callCall(getProperty(obj, multiname), [obj].concat(args)));
          break;
        case OP_returnvoid:     emit(new ReturnStatement()); break;
        case OP_returnvalue:    emit(new ReturnStatement(state.stack.pop())); break;
        case OP_constructsuper:
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          emit(callCall(superClassInstanceObject(), [obj].concat(args)));
          break;
        case OP_constructprop:
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(new NewExpression(property(getProperty(obj, multiname), "instance"), args));
          break;
        case OP_callsuperid:    notImplemented(); break;
        case OP_callproplex:
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          push(callCall(getProperty(obj, multiname), [obj].concat(args)));
          break;
        case OP_callinterface:  notImplemented(); break;
        case OP_callsupervoid:
          flushStack();
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          emit(callCall(getProperty(superOf(obj), multiname), [obj].concat(args)));
          break;
        case OP_callpropvoid:
          multiname = multinames[bc.index];
          args = state.stack.popMany(bc.argCount);
          obj = state.stack.pop();
          assert(!multiname.isRuntime());
          emit(callCall(getProperty(obj, multiname), [obj].concat(args)));
          break;
        case OP_sxi1:           notImplemented(); break;
        case OP_sxi8:           notImplemented(); break;
        case OP_sxi16:          notImplemented(); break;
        case OP_applytype:
          args = state.stack.popMany(bc.argCount);
          factory = state.stack.pop();
          push(call(id("applyType"), [factory, args]));
          flushStack();
          break;
        case OP_pushfloat4:     notImplemented(); break;
        case OP_newobject:
          var properties = [];
          for (var i = 0; i < bc.argCount; i++) {
            var pair = state.stack.popMany(2);
            properties.unshift(new T.Property(pair[0], pair[1], "init"));
          }
          push(new ObjectExpression(properties));
          break;
        case OP_newarray:       push(new ArrayExpression(state.stack.popMany(bc.argCount))); break;
        case OP_newactivation:
          assert (this.methodInfo.needsActivation());
          emit(new VariableDeclaration("var", [
            new VariableDeclarator(id("activation"),
                                   call(runtimeProperty("createActivation"), [objectConstant(this.methodInfo)]))
          ]));
          push(id("activation"));
          break;
        case OP_newclass:
          push(call(property(objectConstant(abc), "runtime.createClass"),
                    [objectConstant(abc.classes[bc.index]), state.stack.pop(), scopeName]));
          break;
        case OP_getdescendants: notImplemented(); break;
        case OP_newcatch:       notImplemented(); break;
        case OP_findpropstrict:
          multiname = multinames[bc.index];
          assertNotImplemented (!multiname.isRuntime());
          push(findProperty(multiname, true));
          break;
        case OP_findproperty:
          multiname = multinames[bc.index];
          assertNotImplemented (!multiname.isRuntime());
          push(findProperty(multiname, false));
          break;
        case OP_finddef:        notImplemented(); break;
        case OP_getlex:
          multiname = multinames[bc.index];
          assert (!multiname.isRuntime());
          push(getProperty(findProperty(multiname, true), multiname));
          break;
        case OP_setproperty:
          value = state.stack.pop();
          multiname = multinames[bc.index];
          flushStack();
          if (!multiname.isRuntime()) {
            obj = state.stack.pop();
            emit(call(id("setProperty"), [obj, objectConstant(multiname), value]));
          } else {
            ns = name = null;
            if (multiname.isRuntimeName()) {
              name = state.stack.pop();
            }
            if (multiname.isRuntimeNamespace()) {
              ns = state.stack.pop();
            }
            obj = state.stack.pop();
            emit(call(property(obj, SET_ACCESSOR), [name, value]));
          }
          break;
        case OP_getlocal:       push(local[bc.index]); break;
        case OP_setlocal:       setLocal(bc.index); break;
        case OP_getglobalscope:
          push(property(scopeName, "global.object"));
          break;
        case OP_getscopeobject:
          obj = scopeName;
          for (var i = 0; i < (state.scopeHeight - 1) - bc.index; i++) {
            obj = property(obj, "parent");
          }
          push(property(obj, "object"));
          break;
        case OP_getproperty:
          multiname = multinames[bc.index];
          if (!multiname.isRuntime()) {
            obj = state.stack.pop();
            push(getProperty(obj, multiname));
          } else {
            ns = name = null;
            if (multiname.isRuntimeName()) {
              name = state.stack.pop();
            }
            if (multiname.isRuntimeNamespace()) {
              ns = state.stack.pop();
            }
            obj = state.stack.pop();
            push(call(property(obj, GET_ACCESSOR), [name]));
          }
          break;
        case OP_getouterscope:      notImplemented(); break;
        case OP_initproperty:
          value = state.stack.pop();
          multiname = multinames[bc.index];
          if (!multiname.isRuntime()) {
            obj = state.stack.pop();
            emit(call(id("setProperty"), [obj, objectConstant(multiname), value]));
          } else {
            notImplemented();
          }
          break;
        case OP_setpropertylate:    notImplemented(); break;
        case OP_deleteproperty:
          multiname = multinames[bc.index];
          if (!multiname.isRuntime()) {
            obj = state.stack.pop();
            emit(call(id("deleteProperty"), [obj, objectConstant(multiname)]));
            flushStack();
          } else {
            notImplemented();
          }
          break;
        case OP_deletepropertylate: notImplemented(); break;
        case OP_getslot:            getSlot(state.stack.pop(), bc.index); break;
        case OP_setslot:
          value = state.stack.pop();
          obj = state.stack.pop();
          setSlot(obj, bc.index, value);
          break;
        case OP_getglobalslot:  notImplemented(); break;
        case OP_setglobalslot:  notImplemented(); break;
        case OP_convert_s:      push("toString" + argumentList(state.stack.pop())); break;
        case OP_esc_xelem:      notImplemented(); break;
        case OP_esc_xattr:      notImplemented(); break;
        case OP_coerce_i:
        case OP_convert_i:
          push(call(id("toInt"), [state.stack.pop()]));
          break;
        case OP_coerce_u:
        case OP_convert_u:
          push(call(id("toUint"), [state.stack.pop()]));
          break;
        case OP_coerce_d:
        case OP_convert_d:
          push(call(id("toDouble"), [state.stack.pop()]));
          break;
        case OP_coerce_b:
        case OP_convert_b:
          push(call(id("toBoolean"), [state.stack.pop()]));
          break;
        case OP_convert_o:      notImplemented(); break;
        case OP_checkfilter:    notImplemented(); break;
        case OP_convert_f:      notImplemented(); break;
        case OP_unplus:         notImplemented(); break;
        case OP_convert_f4:     notImplemented(); break;
        case OP_coerce:
          value = state.stack.pop();
          multiname = multinames[bc.index];
          type = getProperty(findProperty(multiname, true), multiname);
          push(call(id("coerce"), [value, type]));
        case OP_coerce_a:       /* NOP */ break;
        case OP_coerce_s:       push(call(id("coerceString"), [state.stack.pop()])); break;
        case OP_astype:         notImplemented(); break;
        case OP_astypelate:     notImplemented(); break;
        case OP_coerce_o:       notImplemented(); break;
        case OP_negate:         expression(Operator.NEG); break;
        case OP_increment:
          push(constant(1));
          expression(Operator.ADD);
          break;
        case OP_inclocal:
          emit(new UpdateExpression("++", local[bc.index]));
          break;
        case OP_decrement:
          push(constant(1));
          expression(Operator.SUB);
          break;
        case OP_declocal:
          emit(new UpdateExpression("--", local[bc.index]));
          break;
        case OP_typeof:
          push(call(id("typeOf"), [state.stack.pop()]));
          break;
        case OP_not:            expression(Operator.FALSE); break;
        case OP_bitnot:         expression(Operator.BITWISE_NOT); break;
        case OP_add_d:          notImplemented(); break;
        case OP_add:            expression(Operator.ADD); break;
        case OP_subtract:       expression(Operator.SUB); break;
        case OP_multiply:       expression(Operator.MUL); break;
        case OP_divide:         expression(Operator.DIV); break;
        case OP_modulo:         expression(Operator.MOD); break;
        case OP_lshift:         expression(Operator.LSH); break;
        case OP_rshift:         expression(Operator.RSH); break;
        case OP_urshift:        expression(Operator.URSH); break;
        case OP_bitand:         expression(Operator.AND); break;
        case OP_bitor:          expression(Operator.OR); break;
        case OP_bitxor:         expression(Operator.XOR); break;
        case OP_equals:         expression(Operator.EQ); break;
        case OP_strictequals:   expression(Operator.SEQ); break;
        case OP_lessthan:       expression(Operator.LT); break;
        case OP_lessequals:     expression(Operator.LE); break;
        case OP_greaterthan:    expression(Operator.GT); break;
        case OP_greaterequals:  expression(Operator.GE); break;
        case OP_instanceof:
          // TODO: Temporary implementation, totally broken.
          state.stack.pop();
          state.stack.pop();
          push(constant(true));
          break;
        case OP_istype:
          value = state.stack.pop();
          multiname = multinames[bc.index];
          assert (!multiname.isRuntime());
          type = getProperty(findProperty(multiname, true), multiname);
          push(new ConditionalExpression(new BinaryExpression("instanceof", type, id("Class")),
                                         call(property(type, "isInstance"), [value]),
                                         constant(false)));
          break;
        case OP_istypelate:
          type = state.stack.pop();
          value = state.stack.pop();
          push(new ConditionalExpression(new BinaryExpression("instanceof", type, id("Class")),
                                         call(property(type, "isInstance"), [value]),
                                         constant(false)));
          break;
        case OP_in:             notImplemented(); break;
        case OP_increment_i:
          toInt32();
          push(constant(1));
          expression(Operator.ADD);
          break;
        case OP_decrement_i:
          toInt32();
          push(constant(1));
          expression(Operator.SUB);
          break;
        case OP_inclocal_i:     notImplemented(); break;
        case OP_declocal_i:     notImplemented(); break;
        case OP_negate_i:       notImplemented(); break;
        case OP_add_i:          notImplemented(); break;
        case OP_subtract_i:     notImplemented(); break;
        case OP_multiply_i:     notImplemented(); break;
        case OP_getlocal0:
        case OP_getlocal1:
        case OP_getlocal2:
        case OP_getlocal3:
          push(local[op - OP_getlocal0]);
          break;
        case OP_setlocal0:
        case OP_setlocal1:
        case OP_setlocal2:
        case OP_setlocal3:
          setLocal(op - OP_setlocal0);
          break;
        case OP_debug:
          /* NOP */
          break;
        case OP_debugline:
          emitComment("line: " + bc.lineNumber);
          break;
        case OP_debugfile:
          emitComment("file: " + strings[bc.index]);
          break;
        case OP_bkptline:       notImplemented(); break;
        case OP_timestamp:      notImplemented(); break;
        default:
          console.info("Not Implemented: " + bc);
        }

        if (writer) {
          state.trace(writer);
          writer.enter("body: {");
          for (var i = 0; i < body.length; i++) {
            writer.writeLn(generate(body[i]));
          }
          writer.leave("}");
        }
      }

      flushStack();

      return {node: new BlockStatement(body), condition: condition, state: state};
    };
    return compilation;
  })();

  compiler.prototype.compileMethod = function compileMethod(methodInfo, hasDefaults, scope) {
    assert(methodInfo.analysis);
    // methodInfo.analysis.trace(new IndentingWriter());
    var cx = new Compilation(this, methodInfo, scope);
    return generate(cx.compile());
  };

  compiler.Operator = Operator;

  return compiler;
})();