using System.Collections;
using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Test {

    public sealed class XTemplateRendererRun3Tests {

        // methods
        [Fact]
        public void RendersRecursiveItemsWithDepthFirstScopeAndWrapper() {
            var state = new {
                items = new[] {
                    new Node("Root", new[] { new Node("Leaf", Array.Empty<Node>()) }),
                    new Node("Other", Array.Empty<Node>())
                }
            };
            var html = Render("<ul><li x-recursive=\"(item,index,indexAbsolute) in state.items\" x-recursive-wrapper=\"ul\">{{ indent }}:{{ index }}:{{ indexAbsolute }}:{{ item.name }}</li></ul>", state);

            Assert.Equal("<ul><li>0:0:0:Root<ul><li>1:0:1:Leaf</li></ul></li><li>0:1:2:Other</li></ul>", html);
        }

        [Fact]
        public void RendersRecursiveItemsWithDepthFirstTraversalAndRecursiveLocals() {
            var state = new {
                items = new[] {
                    new Node("A", new[] { new Node("A1", Array.Empty<Node>()), new Node("A2", Array.Empty<Node>()) }),
                    new Node("B", new[] { new Node("B1", Array.Empty<Node>()) })
                }
            };
            var html = Render("<ul><li x-recursive=\"(item,index,indexAbsolute) in state.items\" x-recursive-wrapper=\"ul\">{{ item.name }}:{{ index }}:{{ indexAbsolute }}:{{ indent }}</li></ul>", state);

            Assert.Equal("<ul><li>A:0:0:0<ul><li>A1:0:1:1</li><li>A2:1:2:1</li></ul></li><li>B:1:3:0<ul><li>B1:0:4:1</li></ul></li></ul>", html);
        }

        [Fact]
        public void ContinuesAbsoluteRecursiveIndexAfterReturningFromDeeperBranch() {
            var state = new {
                items = new[] {
                    new Node("A", new[] { new Node("A1", new[] { new Node("A1a", Array.Empty<Node>()) }), new Node("A2", Array.Empty<Node>()) }),
                    new Node("B", Array.Empty<Node>())
                }
            };
            var html = Render("<span x-recursive=\"(item,index,indexAbsolute) in state.items\" x-recursive-wrapper=\"div\">{{ item.name }}={{ index }}={{ indexAbsolute }}={{ indent }}</span>", state);

            Assert.Equal("<span>A=0=0=0<div><span>A1=0=1=1<div><span>A1a=0=2=2</span></div></span><span>A2=1=3=1</span></div></span><span>B=1=4=0</span>", html);
        }

        [Fact]
        public void RendersNoRecursiveChildrenForNullCollection() {
            var html = Render("<li x-recursive=\"item in state.items\">{{ item.label }}</li>", new { items = new[] { new { label = "Root", children = (object?)null } } });

            Assert.Equal("<li>Root</li>", html);
        }

        [Fact]
        public void TreatsNullRecursiveRootSourcesAsEmptyCollections() {
            var html = Render("<ul><li x-recursive=\"item in state.items\">{{ item.label }}</li></ul>", new { items = (object?)null });

            Assert.Equal("<ul></ul>", html);
        }

        [Fact]
        public void RendersNoRecursiveChildrenForEmptyCollection() {
            var html = Render("<li x-recursive=\"item in state.items\">{{ item.label }}</li>", new { items = new[] { new { label = "Root", children = (object?)Array.Empty<object>() } } });

            Assert.Equal("<li>Root</li>", html);
        }

        [Fact]
        public void UsesObjectSemanticsForRecursiveReadOnlyDictionaryChildren() {
            var children = new ReadOnlyMap(new Dictionary<string, object?> { ["Child"] = null });
            var state = new { items = new[] { new { label = "Root", children = (object?)children } } };

            var html = Render("<li x-recursive=\"item in state.items\">{{ item.label ?? item }}</li>", state);

            Assert.Equal("<li>Root<li>Child</li></li>", html);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        [InlineData(-1)]
        [InlineData(1.5)]
        public void RejectsInvalidRecursiveChildCollections(object children) {
            var exception = Assert.Throws<XTemplateException>(() => Render("<li x-recursive=\"item in state.items\">{{ item.label }}</li>", new { items = new[] { new { label = "Root", children = (object?)children } } }));

            Assert.IsType<XTemplateException>(exception);
        }

        [Fact]
        public void ExpandsNonNegativeIntegerRecursiveChildCollections() {
            var html = Render("<li x-recursive=\"(item,index) in state.items\">{{ index }}</li>", new { items = new[] { new { label = "Root", children = (object?)3 } } });

            Assert.Equal("<li>0<li>0</li><li>1</li><li>2</li></li>", html);
        }

        [Fact]
        public void ValidatesRecursiveSyntaxWrapperAndKeyUse() {
            Assert.Throws<XTemplateException>(() => Render("<li x-recursive=\"(item,index,absolute,extra) in state.items\"></li>", new { items = Array.Empty<object>() }));
            Assert.Throws<XTemplateException>(() => Render("<li x-recursive-wrapper=\"ul\"></li>"));
            Assert.Throws<XTemplateException>(() => Render("<li x-key=\"id\"></li>"));
            Assert.Equal("<li>A</li>", Render("<li x-recursive=\"item in state.items\" x-key=\"id\">{{ item.name }}</li>", new { items = new[] { new { id = 1, name = "A", children = Array.Empty<object>() } } }));
        }

        [Fact]
        public void SerializesInputModelValuesWithoutClientBehavior() {
            var state = new { name = "M<&\"'", count = 4, enabled = true, disabled = false, choice = "b" };
            var html = Render("<input x-model=\"state.name\"><input type=\"number\" x-model=\"state.count\"><input type=\"checkbox\" x-model=\"state.enabled\"><input type=\"checkbox\" x-model=\"state.disabled\"><input type=\"radio\" value=\"a\" x-model=\"state.choice\"><input type=\"radio\" value=\"b\" x-model=\"state.choice\">", state);

            Assert.Equal("<input value=\"M&lt;&amp;&quot;&#39;\"><input type=\"number\" value=\"4\"><input type=\"checkbox\" checked><input type=\"checkbox\"><input type=\"radio\" value=\"a\"><input type=\"radio\" value=\"b\" checked>", html);
        }

        [Fact]
        public void InputModelModifierPreservesServerModelInitialization() {
            Assert.Equal("<input value=\"live\">", Render("<input x-model.input=\"state.query\">", new { query = "live" }));
            Assert.Equal("<x-field></x-field>", Render("<div x-is=\"state.tag\" x-model.input=\"state.value\"></div>", new { tag = "x-field", value = "live" }));
        }

        [Fact]
        public void RadioModelUsesScalarComparisonAndDoesNotSelectNull() {
            Assert.Equal("<input type=\"radio\" value=\"1\" checked>", Render("<input type=\"radio\" value=\"1\" x-model=\"state.choice\">", new { choice = 1 }));
            Assert.Equal("<input type=\"radio\" value=\"true\" checked>", Render("<input type=\"radio\" value=\"true\" x-model=\"state.choice\">", new { choice = true }));
            Assert.Equal("<input type=\"radio\" value=\"\">", Render("<input type=\"radio\" value=\"\" x-model=\"state.choice\">", new { choice = (object?)null }));
        }

        [Fact]
        public void RadioModelUsesResolvedDynamicValueAndNestedTarget() {
            var html = Render("<input type=\"radio\" x-attr:value=\"state.radioValue\" x-model=\"state.form.choice\">", new { radioValue = 1, form = new { choice = "1" } });

            Assert.Equal("<input type=\"radio\" value=\"1\" checked>", html);
        }

        [Fact]
        public void RejectsInvalidAndAmbiguousModelCases() {
            Assert.Throws<XTemplateException>(() => Render("<input x-model=\"state.a + state.b\">", new { a = 1, b = 2 }));
            Assert.Throws<XTemplateException>(() => Render("<input x-model.input=\"state.a + state.b\">", new { a = 1, b = 2 }));
            Assert.Throws<XTemplateException>(() => Render("<input x-model.foo=\"state.a\">", new { a = 1 }));
            Assert.Throws<XTemplateException>(() => Render("<input x-model=\"state.a\" x-model.input=\"state.a\">", new { a = 1 }));
            Assert.Throws<XTemplateException>(() => Render("<select multiple x-model=\"state.value\"><option value=\"a\">A</option></select>", new { value = "a" }));
            Assert.Throws<XTemplateException>(() => Render("<select multiple x-is=\"state.tag\" x-model=\"state.value\"></select>", new { tag = "x-datafield", value = "a" }));
        }

        [Theory]
        [InlineData("a", "<select><option value=\"a\" selected>A</option><option value=\"b\">B</option><option value=\"c\">C</option></select>")]
        [InlineData("b", "<select><option value=\"a\">A</option><option value=\"b\" selected>B</option><option value=\"c\">C</option></select>")]
        [InlineData("c", "<select><option value=\"a\">A</option><option value=\"b\">B</option><option value=\"c\" selected>C</option></select>")]
        public void SelectModelMarksTheMatchingExplicitValueOption(string value, string expected) {
            var html = Render("<select x-model=\"state.value\"><option value=\"a\">A</option><option value=\"b\">B</option><option value=\"c\">C</option></select>", new { value });

            Assert.Equal(expected, html);
        }

        [Fact]
        public void SelectModelNormalizesOptionsAndPreservesOptionMarkup() {
            var html = Render("<select id=\"choices\" x-model=\"state.value\"><option value=\"1\" selected data-id=\"first\">One</option><option class=\"choice\" selected data-id=\"second\"><span>Two</span> &amp; more</option><option value=\"3\" selected>Three</option></select>", new { value = "Two & more" });

            Assert.Equal("<select id=\"choices\"><option value=\"1\" data-id=\"first\">One</option><option class=\"choice\" selected data-id=\"second\"><span>Two</span> &amp; more</option><option value=\"3\">Three</option></select>", html);
        }

        [Fact]
        public void SelectModelUsesScalarConversionAndLeavesNoMatchUnselected() {
            Assert.Equal("<select><option value=\"1\">One</option><option value=\"2\" selected>Two</option></select>", Render("<select x-model=\"state.value\"><option value=\"1\">One</option><option value=\"2\">Two</option></select>", new { value = 2 }));
            Assert.Equal("<select><option value=\"a\">A</option><option value=\"b\">B</option></select>", Render("<select x-model=\"state.value\"><option value=\"a\" selected>A</option><option value=\"b\">B</option></select>", new { value = "missing" }));
        }

        [Fact]
        public void PreservesPreformattedChildMarkupAndEvaluatesOutsideIt() {
            var html = Render("<div x-pre>{{ state.name }}<span x-if=\"state.visible\">Test</span><!-- note --></div><p>{{ state.name }}</p>", new { name = "Ada", visible = true });

            Assert.Equal("<div>{{ state.name }}<span x-if=\"state.visible\">Test</span><!-- note --></div><p>Ada</p>", html);
        }

        [Fact]
        public void RejectsBrowserDomChildrenButSuppressesOtherBrowserDirectives() {
            Assert.Throws<XTemplateException>(() => Render("<div x-children=\"state.node\"></div>", new { node = new object() }));
            Assert.Equal("<button>Save</button>", Render("<button x-on:click.stop=\"save\" x-prop:value=\"state.value\" x-once>Save</button>", new { value = "x" }));
        }

        [Theory]
        [InlineData("<button x-on:=\"save\"></button>")]
        [InlineData("<button x-on:click=\"\"></button>")]
        public void RejectsMalformedBrowserOnlyDirectives(string template) {
            Assert.Throws<XTemplateException>(() => Render(template, new { value = "x" }));
        }

        [Fact]
        public void CombinesRecursiveBindingsWithoutDirectiveLeakage() {
            var state = new { visible = true, selectedId = 2, menu = new[] { new Menu(1, "One", "/one", new[] { new Menu(2, "Two", "/two", Array.Empty<Menu>()) }) } };
            var html = Render("<nav x-if=\"state.visible\"><ul><li x-recursive=\"(item,index,indexAbsolute) in state.menu\" x-recursive-wrapper=\"ul\" x-key=\"id\" x-class:selected=\"item.id == state.selectedId\"><a x-attr:href=\"item.href\">{{ item.label }}</a></li></ul></nav>", state);

            Assert.Equal("<nav><ul><li><a href=\"/one\">One</a><ul><li class=\"selected\"><a href=\"/two\">Two</a></li></ul></li></ul></nav>", html);
            Assert.DoesNotContain("x-", html, StringComparison.Ordinal);
        }

        [Fact]
        public void ResolvesDynamicElementNamesWithFallbackNormalizationAndBindings() {
            var state = new { tag = "X-Card", value = "hello", visible = true };

            var html = Render("<div x-is=\"state.tag\" x-if=\"state.visible\" x-attr:data-value=\"state.value\" x-class:active=\"true\"><span>{{ state.value }}</span></div><p x-is=\"state.missing\">fallback</p>", state);

            Assert.Equal("<x-card data-value=\"hello\" class=\"active\"><span>hello</span></x-card><p>fallback</p>", html);
            Assert.DoesNotContain("x-is", html, StringComparison.Ordinal);
        }

        [Fact]
        public void ResolvesDynamicElementNamesInForAndRecursiveScopes() {
            var state = new {
                items = new[] { new { tag = "section", label = "A" }, new { tag = "X-Card", label = "B" } },
                tree = new[] { new { tag = "article", label = "root", children = new[] { new { tag = "x-leaf", label = "child", children = Array.Empty<object>() } } } }
            };

            var html = Render("<div x-is=\"item.tag\" x-for=\"item in state.items\">{{ item.label }}</div><span x-is=\"item.tag\" x-recursive=\"item in state.tree\">{{ item.label }}</span>", state);

            Assert.Equal("<section>A</section><x-card>B</x-card><article>root<x-leaf>child</x-leaf></article>", html);
        }

        [Theory]
        [InlineData("")]
        [InlineData("1div")]
        [InlineData("a b")]
        [InlineData("script")]
        [InlineData("style")]
        [InlineData("input")]
        public void RejectsInvalidForbiddenAndVoidDynamicElementNames(string tag) {
            Assert.Throws<XTemplateException>(() => Render("<div x-is=\"state.tag\"></div>", new { tag }));
        }

        [Fact]
        public void RejectsNonStringDynamicNamesAndVoidHosts() {
            Assert.Throws<XTemplateException>(() => Render("<div x-is=\"state.tag\"></div>", new { tag = 123 }));
            Assert.Throws<XTemplateException>(() => Render("<input x-is=\"state.tag\">", new { tag = "div" }));
        }

        [Fact]
        public void RendersDynamicElementModelsAfterResolvingTheElementName() {
            var template = "<div x-is=\"state.tag\" x-model=\"state.value\"><option value=\"a\">A</option><option value=\"b\">B</option></div>";

            Assert.Equal("<select><option value=\"a\">A</option><option value=\"b\" selected>B</option></select>", Render(template, new { tag = "select", value = "b" }));
            Assert.Equal("<x-datafield><option value=\"a\">A</option><option value=\"b\">B</option></x-datafield>", Render(template, new { tag = "x-datafield", value = "b" }));
            Assert.Equal("<div><option value=\"a\">A</option><option value=\"b\">B</option></div>", Render(template, new { tag = (string?)null, value = "b" }));
        }

        [Theory]
        [InlineData("slot")]
        [InlineData("SLOT")]
        public void RejectsDynamicSlotsFromOrdinaryAuthoredElements(string tag) {
            var exception = Assert.Throws<XTemplateException>(() => Render("<div x-is=\"state.tag\" name=\"header\"></div>", new { tag }));

            Assert.Contains("cannot create an undeclared slot element", exception.Message, StringComparison.Ordinal);
        }

        [Theory]
        [InlineData("slot", "<slot name=\"header\"></slot>")]
        [InlineData("SLOT", "<slot name=\"header\"></slot>")]
        [InlineData("div", "<div name=\"header\"></div>")]
        [InlineData(null, "<slot name=\"header\"></slot>")]
        public void AllowsAuthoredSlotsToResolveToSupportedElements(string? tag, string expected) {
            Assert.Equal(expected, Render("<slot name=\"header\" x-is=\"state.tag\"></slot>", new { tag }));
        }

        [Fact]
        public void KeepsDynamicDirectivesLiteralInsideXPre() {
            var html = Render("<div x-pre><span x-is=\"state.tag\">{{ state.value }}</span></div>", new { tag = "section", value = "changed" });

            Assert.Equal("<div><span x-is=\"state.tag\">{{ state.value }}</span></div>", html);
        }

        // methods (private)
        private static string Render(string template, object? state = null) => new XTemplateRenderer(new[] { new XTemplateReflectionObjectAdapter() }).Render(template, state ?? new { });
        private sealed class ReadOnlyMap : IReadOnlyDictionary<string, object?> {

            // vars
            private readonly Dictionary<string, object?> _values;

            // props
            public object? this[string key] => _values[key];
            public IEnumerable<string> Keys => _values.Keys;
            public IEnumerable<object?> Values => _values.Values;
            public int Count => _values.Count;

            // ctor
            public ReadOnlyMap(Dictionary<string, object?> values) {
                _values = values;
            }

            // methods
            public bool ContainsKey(string key) => _values.ContainsKey(key);
            public bool TryGetValue(string key, out object? value) => _values.TryGetValue(key, out value);
            public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => _values.GetEnumerator();
            IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
        }
        private sealed record Node(string name, Node[] children);
        private sealed record Menu(int id, string label, string href, Menu[] children);
    }
}
