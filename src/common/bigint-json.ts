// Khóa chính là BIGINT: dòng đọc từ CSDL đã là chuỗi, còn `bigint` (ParseBigIntPipe, insertId) nếu lọt vào JSON thì cũng thành chuỗi;
// JSON.stringify mặc định không tuần tự hóa được BigInt.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON() {
  return this.toString();
};

export {};
