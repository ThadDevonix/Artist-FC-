/**
 * ทางเข้าเดียวของ query ทั้งหมด — หน้าเพจ import จากที่นี่
 *
 * หน้าเพจไม่เรียก db ตรง ๆ (มีกฎ ESLint บังคับไว้) เพราะ query ที่เขียนกระจาย
 * ในหน้าเพจจะถูกใช้ซ้ำไม่ได้ และเวลาต้องแก้ select/where ต้องไล่หาหลายไฟล์
 */
export * from "./seasons";
export * from "./teams";
export * from "./players";
export * from "./matches";
export * from "./standings";
export * from "./stats";
export * from "./users";
export * from "./audit";
export * from "./staff";
