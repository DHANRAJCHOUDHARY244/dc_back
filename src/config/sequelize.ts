import dotenv from "dotenv";
dotenv.config();

export = {
  development: {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    dialect: "mysql",
    dialectOptions: {
      ssl: process.env.PGSSL === "true" ? { require: true, rejectUnauthorized: false } : undefined,
    },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },
  production: {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    dialect: "mysql",
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    pool: { max: 20, min: 5, acquire: 30000, idle: 10000 },
    logging: false,
  },
};
