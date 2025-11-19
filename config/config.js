import dotenv from 'dotenv';
dotenv.config();

const shared = {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  SG_API_KEY: process.env.SENDGRID_API_KEY,
  SG_BOOKING_TEMPLATE_ID: process.env.SG_BOOKING_TEMPLATE_ID,
  SG_INVITE_TEMPLATE_ID: process.env.SG_INVITE_TEMPLATE_ID,
  INVITE_SECRET: process.env.INVITE_SECRET,
  KEYCLOAK_BASE_URL: process.env.KEYCLOAK_BASE_URL,
  KEYCLOAK_REALM: process.env.KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID,
  KEYCLOAK_AUDIENCE: process.env.KEYCLOAK_AUDIENCE,
  KEYCLOAK_REQUIRED_ROLE: process.env.KEYCLOAK_REQUIRED_ROLE,
};

export default {
  ...shared,
};
