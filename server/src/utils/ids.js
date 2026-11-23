const idOf = (v) => (v && v._id ? v._id : v);
// Compares ObjectIds / populated docs / strings. null equals null.
const sameId = (a, b) => String(idOf(a) ?? 'null') === String(idOf(b) ?? 'null');
module.exports = { sameId, idOf };
