const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const axios = require("axios").default;
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const multer = require("multer");

// Configurar plugins de dayjs para zona horaria
dayjs.extend(utc);
dayjs.extend(timezone);
const { NOTION_API_URL, NOTION_VERSION, NOTION_API_KEY, SUPABASE_BUCKET } = require("./constant");
const { validateRequiredFields, convertMontoMiddleware } = require("./validator");
const Supabase = require("./supabase");

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Configuración de multer para subida de archivos (memory storage para Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Permitir solo imágenes y documentos
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("application/pdf") ||
      file.mimetype.startsWith("application/msword") ||
      file.mimetype.startsWith("application/vnd.openxmlformats-officedocument")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Tipo de archivo no permitido. Solo se permiten imágenes, PDFs y documentos de Word."
        ),
        false
      );
    }
  },
});

const url = `${NOTION_API_URL}/v1/pages`;

// Funciones para crear cada campo del body de Notion
const createConceptoField = (concepto) => ({
  Concepto: {
    title: [
      {
        text: {
          content: concepto,
        },
      },
    ],
  },
});

const createFechaField = () => ({
  Fecha: {
    type: "date",
    date: {
      start: dayjs().tz("America/Guayaquil").format("YYYY-MM-DD"),
      end: null,
      time_zone: null,
    },
  },
});

const createMontoField = (monto) => ({
  Monto: {
    type: "number",
    number: Number(monto),
  },
});

// Objeto para mapear tipos a colores
const tipoColors = {
  Ingreso: "green",
  Gasto: "red",
};

const createTipoField = (tipo) => ({
  Tipo: {
    type: "select",
    select: {
      name: tipo,
      color: tipoColors[tipo] || "red",
    },
  },
});

// Objeto para mapear categorías a colores
const categoriaColors = {
  Salario: "purple",
  Transporte: "blue",
  Comida: "green",
  Entretenimiento: "pink",
  Salud: "red",
  Servicios: "orange",
};

const createCategoriaField = (categoria) => ({
  Categoría: {
    type: "select",
    select: {
      name: categoria,
      color: categoriaColors[categoria] || "green",
    },
  },
});

// Objeto para mapear métodos de pago a colores
const metodoPagoColors = {
  Efectivo: "green",
  "Tarjeta de Débito": "purple",
  "Tarjeta de Crédito": "blue",
};

const createMetodoPagoField = (metodo_pago) => ({
  "Método de Pago": {
    type: "select",
    select: {
      name: metodo_pago,
      color: metodoPagoColors[metodo_pago] || "blue",
    },
  },
});

const createNotasField = (notas) => ({
  Notas: {
    type: "rich_text",
    rich_text: [
      {
        type: "text",
        text: {
          content: notas,
        },
        plain_text: notas,
      },
    ],
  },
});

const createPhotoField = (photoUrl) => {
  if (!photoUrl) {
    return {}; // Retorna objeto vacío si no hay foto
  }

  return {
    Files: {
        files: [
          {
            name: photoUrl.split("/").pop(),
            type: "external",
            external: {
              url: photoUrl
            }
          }
        ]
      },
  };
};

// Función para crear el body completo
const createNotionBody = (
  concepto,
  monto,
  tipo,
  categoria,
  metodo_pago,
  notas,
  photo
) => ({
  parent: {
    database_id: "25b4a660b1eb80ad8972ec538b9a8388",
  },
  icon: {
    type: "external",
    external: {
      url: "https://www.notion.so/icons/currency-coin_gray.svg",
    },
  },
  properties: {
    ...createConceptoField(concepto),
    ...createFechaField(),
    ...createMontoField(monto),
    ...createTipoField(tipo),
    ...createCategoriaField(categoria),
    ...createMetodoPagoField(metodo_pago),
    ...createNotasField(notas),
    ...createPhotoField(photo),
  },
});



app.post(
  "/create",
  upload.single("foto"),
  convertMontoMiddleware,
  validateRequiredFields,
  async (req, res) => {
    try {
      const { concepto, monto, tipo, categoria, metodo_pago, notas } = req.body;
      const foto = req.file;

      let photoResult = null;
      let photoUrl = null;

      const supabase = new Supabase();
      // Si hay foto, subirla a Supabase
      if (foto) {
        try {
          const {
            uploadPhotoToSupabase,
            createBucketIfNotExists,
          } = require("./upload");

          // Crear bucket si no existe
          await supabase.createBucketIfNotExists( SUPABASE_BUCKET );

          // Subir foto a Supabase
          photoResult = await supabase.uploadPhotoToSupabase(foto, SUPABASE_BUCKET);

          if (photoResult.success) {
            photoUrl = photoResult.publicUrl;
          } else {
            console.warn(
              "⚠️ Error al subir foto a Supabase:",
              photoResult.error
            );
            // Continuar sin foto, no fallar todo el proceso
          }
        } catch (photoError) {
          console.warn("⚠️ Error al procesar foto:", photoError.message);
          // Continuar sin foto, no fallar todo el proceso
        }
      } else {
        console.log("ℹ️ No se proporcionó foto, continuando sin ella");
      }

      await supabase.createTransaction({
        concepto,
        monto,
        tipo,
        categoria,
        metodo_pago,
        photoUrl,
        notas,
      });


      // Crear el body de Notion (con o sin foto)
      const body = createNotionBody(
        concepto,
        monto,
        tipo,
        categoria,
        metodo_pago,
        notas,
        photoUrl
      );

      // Intentar crear la página en Notion
      try {
        const { data } = await axios.post(url, body, {
          headers: {
            Authorization: `Bearer ${NOTION_API_KEY}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
          },
        });

        // Respuesta exitosa
        res.status(200).json({
          message: "Registro creado correctamente en Notion",
          data: {
            notionPage: data,
            photo: photoResult
              ? {
                  fileName: photoResult.fileName,
                  filePath: photoResult.filePath,
                  publicUrl: photoResult.publicUrl,
                  size: photoResult.size,
                  mimetype: photoResult.mimetype,
                }
              : null,
          },
        });
      } catch (notionError) {
        console.error(
          "❌ Error al crear página en Notion:",
          notionError.message
        );
        res.status(500).json({
          error: "Error al crear página en Notion",
          message: notionError.message,
          photo: photoResult
            ? {
                fileName: photoResult.fileName,
                filePath: photoResult.filePath,
                publicUrl: photoResult.publicUrl,
              }
            : null,
        });
      }
    } catch (error) {
      console.error("❌ Error general en v2/create:", error);
      res.status(500).json({
        error: "Error general en v2/create",
        message: error.message,
      });
    }
  }
);

app.get("/", (req, res) => {
  res.send("status: ok");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
