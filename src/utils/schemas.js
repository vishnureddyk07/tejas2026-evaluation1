import Joi from "joi";

export const schemas = {
  projectCreate: Joi.object({
    teamNumber: Joi.string().trim().max(50).required(),
    title: Joi.string().trim().min(3).max(100).required(),
    sector: Joi.string().trim().max(50).default(""),
    department: Joi.string().trim().max(50).default(""),
    abstract: Joi.string().trim().max(500).default(""),
    teamMembers: Joi.string().trim().max(200).default("")
  }),
  projectUpdate: Joi.object({
    title: Joi.string().trim().min(3).max(100),
    sector: Joi.string().trim().max(50),
    department: Joi.string().trim().max(50),
    abstract: Joi.string().trim().max(500),
    teamMembers: Joi.string().trim().max(200)
  }).min(1),
  voteSubmit: Joi.object({
    projectId: Joi.string().trim().required(),
    deviceHash: Joi.string().trim().required(),
    voterName: Joi.string().trim().max(40).required(),
    score: Joi.number().integer().min(0).max(10).required()
  }),
  adminLogin: Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(6).required()
  })
};

export const validateRequest = async (data, schema) => {
  try {
    const validated = await schema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true
    });
    return { valid: true, data: validated, errors: null };
  } catch (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join("."),
      message: detail.message
    }));
    return { valid: false, data: null, errors };
  }
};
