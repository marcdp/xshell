using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Test {

    public sealed class JavaScriptSourceTests {

        // methods
        [Theory]
        [InlineData("const x = foo || /abc[\"]/.test(value);")]
        [InlineData("const x = foo && /abc[\"]/.test(value);")]
        [InlineData("const x = value ?? /fallback[\"]/.source;")]
        [InlineData("const x = value + /a[\"]/.source;")]
        [InlineData("const x = !foo ? /a[\"]/.test(value) : false;")]
        [InlineData("const x = flag ? /a/ : /b[\"]/;")]
        [InlineData("function value() { return /abc[\"]/; }")]
        [InlineData("function value() { throw /abc[\"]/; }")]
        [InlineData("switch (value) { case /abc[\"]/: break; }")]
        public void Parse_RegexAfterExpressionStartingToken_Succeeds(string source) {
            var exception = Record.Exception(() => JavaScriptSource.Parse(source));

            Assert.Null(exception);
        }
        [Fact]
        public void Parse_RegexCharacterClassAfterLogicalOr_Succeeds() {
            const string source = """
                if (
                    typeof path !== "string" ||
                    !path.startsWith("/") ||
                    path.includes("\\") ||
                    path.includes("//") ||
                    /[\x00-\x1f:*?<>|\\"]/.test(path)
                ) {
                    throw new Error("Invalid path");
                }
                """;

            var exception = Record.Exception(() => JavaScriptSource.Parse(source));

            Assert.Null(exception);
        }
        [Fact]
        public void Parse_RegexInsideTemplateSubstitution_Succeeds() {
            const string source = """const text = `${foo || /abc[\"]/.test(value)}`;""";

            var exception = Record.Exception(() => JavaScriptSource.Parse(source));

            Assert.Null(exception);
        }
        [Theory]
        [InlineData("const x = a / b;")]
        [InlineData("const x = foo() / 2;")]
        [InlineData("const x = values[0] / total;")]
        [InlineData("const x = value++ / divisor;")]
        public void Parse_DivisionExpression_Succeeds(string source) {
            var exception = Record.Exception(() => JavaScriptSource.Parse(source));

            Assert.Null(exception);
        }
        [Fact]
        public void GetStaticStringArray_ReadsQuotedEscapedCommentedAndTrailingValues() {
            const string source = """
                export default {
                    contract: {
                        tags: [
                            "ui",
                            // escaped literals use the existing JavaScript decoder
                            'cloud\x2dstorage',
                            `file-management`,
                        ]
                    }
                };
                """;

            var tags = JavaScriptSource.Parse(source).FindDefaultExportObject()!.FindProperty("contract")!.Value.AsObject()!
                .FindProperty("tags")!.Value.GetStaticStringArray();

            Assert.Equal(["ui", "cloud-storage", "file-management"], tags);
        }
        [Fact]
        public void GetStaticStringArray_ReadsEmptyArray() {
            const string source = "export default { contract: { tags: [] } };";

            var tags = JavaScriptSource.Parse(source).FindDefaultExportObject()!.FindProperty("contract")!.Value.AsObject()!
                .FindProperty("tags")!.Value.GetStaticStringArray();

            Assert.Empty(tags!);
        }
        [Theory]
        [InlineData("getTags()")]
        [InlineData("DEFAULT_TAGS")]
        [InlineData("[\"ui\", currentTag]")]
        [InlineData("[...sharedTags, \"ui\"]")]
        [InlineData("[`type-${name}`]")]
        [InlineData("[\"ui\", 1]")]
        [InlineData("[\"ui\" \"data\"]")]
        public void GetStaticStringArray_RejectsDynamicOrMalformedValues(string expression) {
            var source = $"export default {{ contract: {{ tags: {expression} }} }};";

            var tags = JavaScriptSource.Parse(source).FindDefaultExportObject()!.FindProperty("contract")!.Value.AsObject()!
                .FindProperty("tags")!.Value.GetStaticStringArray();

            Assert.Null(tags);
        }
    }
}
