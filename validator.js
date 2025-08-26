const { body, validationResult } = require('express-validator');

// Middleware para validar los campos requeridos
const validateRequiredFields = [
    body('concepto')
        .notEmpty()
        .withMessage('El concepto es requerido')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('El concepto debe tener entre 1 y 100 caracteres'),
    
    body('monto')
        .notEmpty()
        .withMessage('El monto es requerido')
        .isFloat({ min: 0.01 })
        .withMessage('El monto debe ser un número mayor a 0'),
    
    body('tipo')
        .notEmpty()
        .withMessage('El tipo es requerido')
        .isIn(['Ingreso', 'Gasto'])
        .withMessage('El tipo solo permite los valores: Ingreso o Gasto'),
    
    body('categoria')
        .notEmpty()
        .withMessage('La categoría es requerida')
        .isIn(['Salario', 'Comida', 'Servicios', 'Entretenimiento', 'Salud', 'Transporte'])
        .withMessage('La categoría solo permite los valores: Salario, Comida, Servicios, Entretenimiento, Salud, Transporte'),
    
    body('metodo_pago')
        .notEmpty()
        .withMessage('El método de pago es requerido')
        .isIn(['Efectivo', 'Tarjeta de Débito', 'Tarjeta de Crédito'])
        .withMessage('El método de pago solo permite los valores: Efectivo, Tarjeta de Débito, Tarjeta de Crédito'),
    
    body('notas')
        .notEmpty()
        .withMessage('Las notas son requeridas')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Las notas deben tener entre 1 y 500 caracteres'),
    
    // Middleware para verificar si hay errores de validación
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Errores de validación',
                errors: errors.array().map(error => ({
                    field: error.path,
                    message: error.msg,
                    value: error.value
                }))
            });
        }
        next();
    }
];

module.exports = { validateRequiredFields };