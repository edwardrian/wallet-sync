const dotenv = require('dotenv');
const express = require('express');
const axios = require('axios').default;
const dayjs = require('dayjs');
const { validateRequiredFields } = require('./validator');
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

const url = 'https://api.notion.com/v1/pages';

// Funciones para crear cada campo del body de Notion
const createConceptoField = (concepto) => ({
    "Concepto": {
        "title": [
            {
                "text": {
                    "content": concepto
                }
            }
        ]
    }
});

const createFechaField = () => ({
    "Fecha": {
        "type": "date",
        "date": {
            "start": dayjs().format('YYYY-MM-DD'),
            "end": null,
            "time_zone": null
        }
    }
});

const createMontoField = (monto) => ({
    "Monto": {
        "type": "number",
        "number": monto
    }
});

// Objeto para mapear tipos a colores
const tipoColors = {
    "Ingreso": "green",
    "Gasto": "red"
};

const createTipoField = (tipo) => ({
    "Tipo": {
        "type": "select",
        "select": {
            "name": tipo,
            "color": tipoColors[tipo] || "red"
        }
    }
});

// Objeto para mapear categorías a colores
const categoriaColors = {
    "Salario": "purple",
    "Transporte": "blue",
    "Comida": "green",
    "Entretenimiento": "pink",
    "Salud": "red",
    "Servicios": "orange"
};

const createCategoriaField = (categoria) => ({
    "Categoría": {
        "type": "select",
        "select": {
            "name": categoria,
            "color": categoriaColors[categoria] || "green"
        }
    }
});

// Objeto para mapear métodos de pago a colores
const metodoPagoColors = {
    "Efectivo": "green",
    "Tarjeta de Débito": "purple",
    "Tarjeta de Crédito": "blue"
};

const createMetodoPagoField = (metodo_pago) => ({
    "Método de Pago": {
        "type": "select",
        "select": {
            "name": metodo_pago,
            "color": metodoPagoColors[metodo_pago] || "blue"
        }
    }
});

const createNotasField = (notas) => ({
    "Notas": {
        "type": "rich_text",
        "rich_text": [
            {
                "type": "text",
                "text": {
                    "content": notas
                },
                "plain_text": notas
            }
        ]
    }
});

// Función para crear el body completo
const createNotionBody = (concepto, monto, tipo, categoria, metodo_pago, notas) => ({
    "parent": {
        "database_id": "25b4a660b1eb80ad8972ec538b9a8388"
    },
    "icon": {
        "type": "external",
        "external": {
            "url": "https://www.notion.so/icons/currency-coin_gray.svg"
        }
    },
    "properties": {
        ...createConceptoField(concepto),
        ...createFechaField(),
        ...createMontoField(monto),
        ...createTipoField(tipo),
        ...createCategoriaField(categoria),
        ...createMetodoPagoField(metodo_pago),
        ...createNotasField(notas)
    }
});

app.post('/create', validateRequiredFields, async (req, res) => {

    const { concepto, monto, tipo, categoria, metodo_pago, notas } = req.body;

    const body = createNotionBody(concepto, monto, tipo, categoria, metodo_pago, notas);
    console.log("🚀 ~ body:", JSON.stringify(body, null, 2))

    try {
        const {data} = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        });
        res.status(200).json({ message: 'Página creada correctamente', data: data });
    } catch (error) {
        console.error('Error al crear la página:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Error al crear la página' });
    }
    
});

app.get('/', (req, res) => {
    res.send('status: ok');
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

