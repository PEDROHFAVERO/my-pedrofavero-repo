#!/usr/bin/env node
// generate_migration.js
// Run: node generate_migration.js
// Reads the raw localStorage JSON and generates the final SQL for Supabase

// ─── RAW DATA from localStorage (paste the full JSON here) ───────────────────
const RAW_HUB = {
  "clientes": [
    {
      "id": "3iraxdfpkt3mmyxn7c4",
      "nome": "Albert Pak"
    },
    {
      "id": "f4mxn3cl6ammn3q2lc8",
      "nome": "Paulo e Andrea"
    }
  ]
};

// ─── Paste full client data objects here ─────────────────────────────────────
// These come from localStorage keys like b2if_pf_cliente_3iraxdfpkt3mmyxn7c4
const CLIENT_DATA = {
  "3iraxdfpkt3mmyxn7c4": null,   // ← paste Albert Pak full object
  "f4mxn3cl6ammn3q2lc8": null,   // ← paste Paulo e Andrea full object
};

const PLANEJADOR_EMAIL = 'jorgecarvalho@100um.com.br';

function generateSQL(planejadorId) {
  let sql = `-- AUTO-GENERATED MIGRATION\n-- Planejador: Jorge Carvalho (${planejadorId})\n-- Generated: ${new Date().toISOString()}\n\n`;

  sql += `ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;\n\n`;

  for (const [clienteId, clienteData] of Object.entries(CLIENT_DATA)) {
    const hub = RAW_HUB.clientes.find(c => c.id === clienteId);
    if (!hub) continue;

    const nome = hub.nome.replace(/'/g, "''");
    const dados = clienteData
      ? JSON.stringify(clienteData, null, 0).replace(/'/g, "''")
      : '{}';

    sql += `-- Cliente: ${hub.nome}\n`;
    sql += `INSERT INTO clientes (id, planejador_id, nome, dados)\n`;
    sql += `VALUES ('${clienteId}', '${planejadorId}', '${nome}', '${dados}'::jsonb)\n`;
    sql += `ON CONFLICT (id) DO UPDATE\n`;
    sql += `  SET planejador_id = EXCLUDED.planejador_id,\n`;
    sql += `      nome = EXCLUDED.nome,\n`;
    sql += `      dados = EXCLUDED.dados;\n\n`;
  }

  sql += `ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;\n\n`;
  sql += `-- Verify:\nSELECT id, nome, planejador_id FROM clientes ORDER BY criado_em;\n`;

  return sql;
}

// If planejadorId is provided as CLI arg
const planejadorId = process.argv[2];
if (planejadorId) {
  console.log(generateSQL(planejadorId));
} else {
  console.log(`Usage: node generate_migration.js <JORGE_CARVALHO_UUID>`);
  console.log(`\nFirst run this in Supabase SQL Editor:`);
  console.log(`SELECT id, email FROM auth.users WHERE email = '${PLANEJADOR_EMAIL}';`);
}
