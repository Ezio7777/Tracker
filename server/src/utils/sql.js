// Small helpers for building parameterized SQL.

// const p = createParams(); `... WHERE a = ${p.add(x)}`  ->  "WHERE a = $1", p.params = [x]
function createParams(initial = []) {
  const params = [...initial];
  return {
    params,
    add(value) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}

// Turns user search text into an ILIKE pattern, escaping the characters that mean something in LIKE.
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// Builds "UPDATE table SET col = $2, ... WHERE id = $1 RETURNING *".
// `columns` maps allowed JS keys to column names. Both come from our own code, never from user input,
// and the values always go through placeholders.
function buildUpdate(table, id, changes, columns) {
  const params = [id];
  const sets = [];
  Object.entries(columns).forEach(([key, column]) => {
    if (key in changes) {
      params.push(changes[key]);
      sets.push(`${column} = $${params.length}`);
    }
  });
  if (!sets.length) return null;
  return { text: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params };
}

module.exports = { createParams, likePattern, buildUpdate };
