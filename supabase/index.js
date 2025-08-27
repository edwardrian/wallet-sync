const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_ANON_KEY } = require("../constant");

class Supabase {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async createTransaction(transaction) {
    try {
      const payload = {
        concept: transaction.concepto,
        amount: transaction.monto,
        type: transaction.tipo,
        category: transaction.categoria,
        payment_method: transaction.metodo_pago,
        notes: transaction.notas,
        image_url: transaction.photoUrl,
        notes: transaction.notas,
      };
      const { data, error } = await this.supabase
      .from("transactions")
      .insert([payload])
      .select();
      console.log("🚀 ~ Supabase ~ createTransaction ~ data:", data)
    } catch (error) {
      console.error("Error en createTransaction:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Función para subir foto a Supabase Storage
  async uploadPhotoToSupabase(file, bucketName = "facturas") {
    try {
      // Verificar que el archivo existe
      if (!file) {
        throw new Error("No se proporcionó ningún archivo");
      }

      // Generar nombre único para el archivo
      const fileExt = file.originalname.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Subir archivo a Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new Error(`Error al subir archivo: ${error.message}`);
      }

      // Obtener URL pública del archivo
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        success: true,
        fileName: fileName,
        filePath: filePath,
        publicUrl: urlData.publicUrl,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      console.error("Error en uploadPhotoToSupabase:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Función para crear bucket si no existe
  async createBucketIfNotExists(bucketName = SUPABASE_BUCKET) {
    try {
      // Verificar si el bucket existe
      const { data: buckets, error: listError } =
        await this.supabase.storage.listBuckets();

      if (listError) {
        throw new Error(`Error al listar buckets: ${listError.message}`);
      }

      const bucketExists = buckets.some((bucket) => bucket.name === bucketName);

      if (!bucketExists) {
        // Crear bucket
        const { error: createError } = await this.supabase.storage.createBucket(
          bucketName,
          {
            public: true,
            allowedMimeTypes: [
              "image/jpeg",
              "image/png",
              "image/gif",
              "image/webp",
              "application/pdf",
            ],
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          }
        );

        if (createError) {
          throw new Error(`Error al crear bucket: ${createError.message}`);
        }

        console.log(`Bucket '${bucketName}' creado exitosamente`);
      } else {
        console.log(`Bucket '${bucketName}' ya existe`);
      }

      return { success: true, bucketName };
    } catch (error) {
      console.error("Error en createBucketIfNotExists:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Función para eliminar archivo de Supabase Storage
  async deletePhotoFromSupabase(filePath, bucketName = "facturas") {
    try {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Error al eliminar archivo: ${error.message}`);
      }

      return {
        success: true,
        message: "Archivo eliminado correctamente",
      };
    } catch (error) {
      console.error("Error en deletePhotoFromSupabase:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = Supabase;
