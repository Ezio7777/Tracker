// Ids are UUID strings. These helpers also accept objects that carry an `id` (a user, a project...).
const idOf = (v) => (v && typeof v === 'object' && v.id ? v.id : v);
// null equals null, which is handy for "is this item unassigned?" style checks.
const sameId = (a, b) => String(idOf(a) ?? 'null') === String(idOf(b) ?? 'null');
module.exports = { sameId, idOf };
