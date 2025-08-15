require('dotenv').config();
const { Pool } = require('pg');
const fetch = require("node-fetch");
const cron = require("node-cron");

const TOKEN = process.env.TOKEN_FACEBOOK;
const API_URL = process.env.API_URL;

// Criar pool de conexão com Postgres
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necessário no Render
});

async function coletarStatus() {
    const client = await pool.connect();

    try {
        // Buscar anúncios salvos
        const { rows: anuncios } = await client.query("SELECT id FROM anuncios");

        for (const anuncio of anuncios) {
            try {
                // Consultar na API
                const url = `${API_URL}?access_token=${TOKEN}&ad_ids=${anuncio.id}&fields=id,ad_delivery_stop_time`;
                const resp = await fetch(url);
                const json = await resp.json();

                let ativo = 0;
                if (json.data && json.data.length > 0) {
                    const anuncioData = json.data[0];
                    ativo = anuncioData.ad_delivery_stop_time ? 0 : 1;
                }

                // Atualizar tabela de anúncios
                await client.query("UPDATE anuncios SET ativo = $1 WHERE id = $2", [ativo, anuncio.id]);

                // Inserir histórico
                await client.query(
                    "INSERT INTO historico (anuncio_id, data, ativos) VALUES ($1, CURRENT_DATE, $2)",
                    [anuncio.id, ativo]
                );

                console.log(`Anúncio ${anuncio.id} → ativo: ${ativo}`);
            } catch (err) {
                console.error(`Erro no anúncio ${anuncio.id}:`, err);
            }
        }
    } catch (err) {
        console.error("Erro na coleta:", err);
    } finally {
        client.release();
    }
}

// Executa todo dia às 2 da manhã
cron.schedule("0 2 * * *", () => {
    console.log("⏳ Rodando coleta diária...");
    coletarStatus();
});

// Para rodar manualmente no teste:
// coletarStatus();
