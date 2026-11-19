// Checks the request against a zod schema before the controller runs.
// Bad input becomes 400 VALIDATION_ERROR with a list of the wrong fields.
//
//   router.post('/', validate(schema), controller.create);           // checks req.body
//   router.get('/', validate(schema, 'query'), controller.list);     // checks req.query
const AppError = require('../utils/AppError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', details));
  }
  req[source] = result.data; // cleaned values (unknown fields removed)
  next();
};

module.exports = validate;
