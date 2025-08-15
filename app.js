require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { engine } = require('express-handlebars');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3355;

// Conexão Postgres
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_BASE
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Página inicial / pesquisa
app.get('/', async (req, res) => {
    const termo = req.query.termo || '';
    let anuncios = [];
    const API_URL = process.env.API_URL;
    const TOKEN = process.env.TOKEN_FACEBOOK;
    const pais = 'BR';

    if (termo) {
        const url = `${API_URL}?access_token=${TOKEN}&search_terms=${encodeURIComponent(termo)}&ad_reached_countries=['${pais}']&fields=id,ad_creative_body,ad_snapshot_url,ad_delivery_stop_time&limit=10`;
        const response = await fetch(url);
        const json = await response.json();
        console.log('Resposta da API:', json); // debug
        anuncios = json.data || [];
    }

    res.render('index', { title: 'Pesquisar', termo, anuncios });
});

// Salvar anúncio no DB
app.post('/salvar', async (req, res) => {
    const { id, titulo, ad_snapshot_url, ad_delivery_stop_time } = req.body;
    try {
        // Salvar anúncio
        await pool.query(
            'INSERT INTO anuncios (id, titulo, ad_snapshot_url, ad_delivery_stop_time) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [id, titulo, ad_snapshot_url, ad_delivery_stop_time]
        );

        // Registrar histórico diário (hoje)
        const hoje = new Date().toISOString().split('T')[0];
        await pool.query(
            'INSERT INTO anuncios_monitoramento (anuncio_id, data_registro, status_ativo) VALUES ($1, $2, $3)',
            [id, hoje, true]
        );

        res.redirect('/grafico');
    } catch (err) {
        console.error(err);
        res.send('Erro ao salvar anúncio');
    }
});

// Página do gráfico
app.get('/grafico', async (req, res) => {
    try {
        const { rows: anuncios } = await pool.query('SELECT * FROM anuncios');
        res.render('grafico', { title: 'Gráfico', anuncios });
    } catch (err) {
        console.error(err);
        res.send('Erro ao carregar gráfico');
    }
});

// API histórico de um anúncio
app.get('/api/historico/:id', async (req, res) => {
    try {
        const { rows: dados } = await pool.query(
            `SELECT data_registro AS data, COUNT(*) AS ativos
             FROM anuncios_monitoramento
             WHERE status_ativo = true AND anuncio_id = $1
             GROUP BY data_registro
             ORDER BY data_registro ASC`,
            [req.params.id]
        );
        res.json(dados);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar histórico' });
    }
});

// Página de termos
app.get('/termos', (req, res) => res.render('termos'));

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`--SERVER ON RUNNING IN PORT ${PORT}--`);
});
