const crypto = require('crypto');
import { ResponseData } from "@constants/common.interface";
import { Response } from "express";
import  bcrypt  from 'bcrypt';
import  jwt  from 'jsonwebtoken';

export function ReS (res: Response, status: number, message: string, data?: any)  {
  const res_obj: ResponseData = { status, message, data };
  res.status(status).json(res_obj);
};

export function ReE (res:Response, status: number, message: string) {
  const res_obj: ResponseData = { status, message };
  res.status(status).json(res_obj);
}

export function  generate_6_Digit_Otp(){
  return Math.floor(100000 + Math.random() * 900000);
}

export function generate_Hash_Password(password:string){
  return bcrypt.hash(password, 10);
}

export function compare_Hash_Password(password:string, hashedPassword: string){
  return bcrypt.compare(password, hashedPassword);
}

// Function to generate an impossible-to-duplicate UUID
export function generateUUID(len=36) {
    const timestamp = Date.now().toString(len);  // Base36 timestamp (shorter & unique)
    const randomString = crypto.randomBytes(10).toString('hex'); // 20-char random string

    return `${timestamp}-${randomString}`;
}
// key 
export function generateRandomString(length = 100) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
}
export const enumToArray = (e: any): string[] => {
    return Object.values(e);
};

export function parseToObject(data, is_array = false) {
  if (!data) return is_array ? [] : {};
  if (typeof data === 'object') return is_array && !Array.isArray(data) ? [] : !is_array && Array.isArray(data) ? {} : data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (is_array ? parsed : []) : (parsed && typeof parsed === 'object' ? (is_array ? [] : parsed) : is_array ? [] : {});
    } catch {
      return is_array ? [] : {};
    }
  }
  return is_array ? [] : {};
}

export function bypassTokenCreation(data={}){
  return jwt.sign(
      { ...data},
      process.env.JWT_SECRET!
    );
}
export function verifyBypassToken(token:string){
  return jwt.verify(token, process.env.JWT_SECRET!);
}