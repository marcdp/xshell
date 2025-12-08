//export 
export default {
  name: "css-trim",
  match: /\.css$/,
  order: 10,

  async transform({ request, blob, headers, type }) {
    const text = await blob.text();
    const trimmed = text + "<h1>hello world</h1>";
    return {
      blob: new Blob([trimmed], { type: "text/css" }),
      headers,
      type: "css-trimmed"
    };
  }
};