// Helpers Handlebars per i template
export function registerHelpers() {
  Handlebars.registerHelper("range", function (n) {
    n = Number(n) || 0;
    return Array.from({ length: n }, (_, i) => i);
  });
  Handlebars.registerHelper("lt",   (a, b) => Number(a) <  Number(b));
  Handlebars.registerHelper("lte",  (a, b) => Number(a) <= Number(b));
  Handlebars.registerHelper("gt",   (a, b) => Number(a) >  Number(b));
  Handlebars.registerHelper("gte",  (a, b) => Number(a) >= Number(b));
  Handlebars.registerHelper("eq",   (a, b) => a === b);
  Handlebars.registerHelper("ne",   (a, b) => a !== b);
  Handlebars.registerHelper("checked", v => v ? "checked" : "");
  Handlebars.registerHelper("join",  (arr, sep) => Array.isArray(arr) ? arr.join(sep ?? ", ") : arr);
  Handlebars.registerHelper("upper", s => (s ?? "").toString().toUpperCase());
  Handlebars.registerHelper("capitalize", s => {
    const str = (s ?? "").toString();
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
}
